// ============================================================================
// KeyedRegistry —— 订阅生命周期与 WebSocket 之间的中间层
//
// 不依赖 React / Jotai，可独立单测。职责：
//   refCount（原子持有） + groups（命令式整表替换） → desired 集合
//   desired 变化 → 防抖合并 → onChange（交给传输层）
//   值缓存 + 广播（写回各个 store 的 atom setter）
//   最后一个持有者离开 → 延迟释放 → onEvict
//
// 之所以广播用「调用方传进来的 listener」而不是某个 store 引用：
// usePageStore() 在 <Page> 外返回 undefined（jotai 视为默认 store），
// 且嵌套 <Page> 会让多个 store 同时存活，只有 atom onMount 拿到的 setAtom
// 才绑定到正确的那一个。
// ============================================================================

export type Release = () => void
export type Listener<T> = (value: T) => void

export interface KeyedRegistryOptions {
  /**
   * desired 集合变化（已按 batchDelay 合并），返回当前完整期望集合。
   * 只给全量、不给增量：传输层需要与「服务端已知集合」做 diff 才能决定
   * 是发差量还是重开连接，那边本来就要自己算一次。
   */
  onChange: (all: string[]) => void
  /** 最后一个持有者离开后的延迟，吸收 StrictMode 双调用与路由切换抖动 */
  releaseDelay?: number
  /** 批量合并窗口 */
  batchDelay?: number
}

export const DEFAULT_BATCH_DELAY = 100
export const DEFAULT_RELEASE_DELAY = 2000

export class KeyedRegistry<T> {
  private readonly options: Required<Pick<KeyedRegistryOptions, 'releaseDelay' | 'batchDelay'>> & KeyedRegistryOptions

  /** 原子持有计数（atom onMount / unmount） */
  private counts = new Map<string, number>()
  /** 命令式持有（subscribeData(tags, true) 这类整表替换语义） */
  private groups = new Map<string, Set<string>>()
  private listeners = new Map<string, Set<Listener<T>>>()
  private values = new Map<string, T>()

  private releaseTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private changeTimer: ReturnType<typeof setTimeout> | null = null
  private firstRetainTimer: ReturnType<typeof setTimeout> | null = null
  private pendingFirstRetain = new Set<string>()

  private evictors = new Set<(key: string) => void>()
  private firstRetainHooks = new Set<(keys: string[]) => void>()
  private lastDesired = new Set<string>()
  /** 已经做过首屏拉取、且值仍在缓存中的 key */
  private initialized = new Set<string>()

  constructor(options: KeyedRegistryOptions) {
    this.options = {
      releaseDelay: DEFAULT_RELEASE_DELAY,
      batchDelay: DEFAULT_BATCH_DELAY,
      ...options
    }
  }

  // --------------------------------------------------------------------------
  // 持有
  // --------------------------------------------------------------------------

  /** 原子持有。返回 release，由 atom 的 onMount 返回值直接充当 */
  retain(key: string, listener: Listener<T>): Release {
    let set = this.listeners.get(key)
    if (!set) {
      set = new Set()
      this.listeners.set(key, set)
    }
    set.add(listener)
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1)

    const timer = this.releaseTimers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.releaseTimers.delete(key)
    }

    this.sync()

    let released = false
    return () => {
      if (released) return
      released = true
      this.release(key, listener)
    }
  }

  private release(key: string, listener: Listener<T>) {
    this.listeners.get(key)?.delete(listener)
    const count = (this.counts.get(key) ?? 0) - 1
    if (count <= 0) {
      this.counts.delete(key)
    } else {
      this.counts.set(key, count)
    }
    this.sync()
  }

  /**
   * 命令式持有：整组替换或追加。
   * replace 只影响该 group 自己的 key，不会误伤其它组件已建立的订阅。
   */
  setGroup(groupId: string, keys: Iterable<string>, mode: 'replace' | 'append' = 'replace'): void {
    const next = mode === 'replace' ? new Set(keys) : new Set([...(this.groups.get(groupId) ?? []), ...keys])
    if (next.size === 0) {
      this.groups.delete(groupId)
    } else {
      this.groups.set(groupId, next)
    }
    this.sync()
  }

  clearGroup(groupId: string): void {
    this.groups.delete(groupId)
    this.sync()
  }

  // --------------------------------------------------------------------------
  // 数据
  // --------------------------------------------------------------------------

  /** 只有被持有（或处于释放延迟窗口内）的 key 才会缓存值 */
  private isLive(key: string): boolean {
    return this.counts.has(key) || this.isGrouped(key) || this.releaseTimers.has(key)
  }

  private isGrouped(key: string): boolean {
    for (const keys of this.groups.values()) {
      if (keys.has(key)) return true
    }
    return false
  }

  /** 真正还被持有的 key（不含释放宽限期内的） */
  private heldKeys(): Set<string> {
    const held = new Set(this.counts.keys())
    for (const keys of this.groups.values()) {
      for (const key of keys) held.add(key)
    }
    return held
  }

  /** 覆盖写入并广播 */
  update(key: string, value: T): void {
    if (!this.isLive(key)) return
    this.values.set(key, value)
    this.emit(key, value)
  }

  /** 合并写入并广播（报警状态这类只更新部分字段的推送） */
  patch(key: string, partial: Partial<T>): void {
    if (!this.isLive(key)) return
    const prev = this.values.get(key)
    const next = { ...(prev ?? ({} as T)), ...partial }
    this.values.set(key, next)
    this.emit(key, next)
  }

  private emit(key: string, value: T) {
    const set = this.listeners.get(key)
    if (!set) return
    for (const listener of set) listener(value)
  }

  /** 供 atom 初始化用：避免重新挂载时闪空 */
  peek(key: string): T | undefined {
    return this.values.get(key)
  }

  /** 注册 key 被彻底释放时的清理回调（atomFamily.remove、worker 反注册等） */
  onEvicted(cb: (key: string) => void): void {
    this.evictors.add(cb)
  }

  /**
   * 注册「某批 key 首次被持有」的回调（首屏拉取初始值 / 元信息 / 启动关联通道）。
   * 多播，避免 tagChannel 与 warning 之间产生循环 import。
   */
  onFirstRetain(cb: (keys: string[]) => void): void {
    this.firstRetainHooks.add(cb)
  }

  // --------------------------------------------------------------------------
  // 生命周期
  // --------------------------------------------------------------------------

  /**
   * 仍然订阅中的 key = 真正被持有的 ∪ 处于释放宽限期内的。
   *
   * 宽限期内的 key 刻意保留在集合里：这样「组件卸载」不会立刻变成一次退订，
   * 也就不会引发「有移除 → 关连接重开」的抖动（路由切换、StrictMode 双调用）。
   * 宽限期内重新被持有则直接取消释放。
   */
  desired(): Set<string> {
    const all = this.heldKeys()
    for (const key of this.releaseTimers.keys()) all.add(key)
    return all
  }

  /** 同步 desired 差异；onChange 走防抖，firstRetain 走防抖，释放走延迟 */
  private sync() {
    const held = this.heldKeys()

    // 刚失去最后一个持有者 → 进入释放宽限期（此时它仍在 desired 里，不产生变更）
    for (const key of this.lastDesired) {
      if (!held.has(key)) this.scheduleRelease(key)
    }

    const next = this.desired()

    const add: string[] = []
    let changed = false
    for (const key of next) {
      if (!this.lastDesired.has(key)) add.push(key)
    }
    if (add.length === 0) {
      for (const key of this.lastDesired) {
        if (!next.has(key)) {
          changed = true
          break
        }
      }
    }
    this.lastDesired = next

    if (add.length > 0) {
      for (const key of add) {
        if (!this.initialized.has(key)) this.pendingFirstRetain.add(key)
      }
      this.scheduleFirstRetain()
      changed = true
    }

    if (changed) this.scheduleChange()
  }

  private scheduleChange() {
    if (this.changeTimer) return
    this.changeTimer = setTimeout(() => {
      this.changeTimer = null
      // 防火时重算：防抖窗口内可能又有增删
      this.options.onChange([...this.desired()])
    }, this.options.batchDelay)
  }

  private scheduleFirstRetain() {
    if (this.firstRetainTimer) return
    this.firstRetainTimer = setTimeout(() => {
      this.firstRetainTimer = null
      const keys = [...this.pendingFirstRetain]
      this.pendingFirstRetain.clear()
      if (keys.length > 0) {
        for (const key of keys) this.initialized.add(key)
        for (const hook of this.firstRetainHooks) hook(keys)
      }
    }, this.options.batchDelay)
  }

  /**
   * 宽限期结束：key 才真正离开 desired。
   * 这里不当走 sync()——sync 会按 lastDesired 再排一次释放，形成自激循环。
   */
  private scheduleRelease(key: string) {
    if (this.releaseTimers.has(key)) return
    this.releaseTimers.set(key, setTimeout(() => {
      this.releaseTimers.delete(key)
      // 期间又被持有则放弃释放
      if (this.counts.has(key) || this.isGrouped(key)) return
      this.values.delete(key)
      this.listeners.delete(key)
      this.initialized.delete(key)
      for (const cb of this.evictors) cb(key)
      if (this.lastDesired.delete(key)) this.scheduleChange()
    }, this.options.releaseDelay))
  }

  // --------------------------------------------------------------------------
  // 测试辅助
  // --------------------------------------------------------------------------

  /** 立即执行挂起的防抖（仅测试用） */
  flush(): void {
    if (this.changeTimer) {
      clearTimeout(this.changeTimer)
      this.changeTimer = null
    }
    this.options.onChange([...this.desired()])

    if (this.firstRetainTimer) {
      clearTimeout(this.firstRetainTimer)
      this.firstRetainTimer = null
    }
    const keys = [...this.pendingFirstRetain]
    this.pendingFirstRetain.clear()
    if (keys.length > 0) {
      for (const key of keys) this.initialized.add(key)
      for (const hook of this.firstRetainHooks) hook(keys)
    }
  }

  reset(): void {
    for (const timer of this.releaseTimers.values()) clearTimeout(timer)
    if (this.changeTimer) clearTimeout(this.changeTimer)
    if (this.firstRetainTimer) clearTimeout(this.firstRetainTimer)
    this.counts.clear()
    this.groups.clear()
    this.listeners.clear()
    this.values.clear()
    this.releaseTimers.clear()
    this.pendingFirstRetain.clear()
    this.initialized.clear()
    this.lastDesired.clear()
    this.changeTimer = null
    this.firstRetainTimer = null
    this.evictors.clear()
    this.firstRetainHooks.clear()
  }
}
