import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { KeyedRegistry } from './registry'
import type { KeyedRegistryOptions } from './registry'

interface Value { value?: number; warningState?: unknown }

const createRegistry = (options: Partial<KeyedRegistryOptions> = {}) => {
  const onChange = vi.fn()
  const onFirstRetain = vi.fn()
  const onEvict = vi.fn()
  const registry = new KeyedRegistry<Value>({
    batchDelay: 100,
    releaseDelay: 1000,
    onChange,
    ...options
  })
  registry.onFirstRetain(onFirstRetain)
  registry.onEvicted(onEvict)
  return { registry, onChange, onFirstRetain, onEvict }
}

describe('KeyedRegistry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('refCount', () => {
    it('多个持有者共享同一个 key，只算一次订阅', () => {
      const { registry, onChange } = createRegistry()
      const a = registry.retain('t1', vi.fn())
      const b = registry.retain('t1', vi.fn())

      expect([...registry.desired()]).toEqual(['t1'])

      vi.advanceTimersByTime(100)
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(['t1'])

      // 释放其中一个，key 仍然被期望
      a()
      vi.advanceTimersByTime(100)
      expect([...registry.desired()]).toEqual(['t1'])

      // 最后一个也释放：宽限期内仍然是期望集合（不产生退订变更）
      b()
      vi.advanceTimersByTime(100)
      expect([...registry.desired()]).toEqual(['t1'])

      // 宽限期结束才真正离开
      vi.advanceTimersByTime(1000)
      expect([...registry.desired()]).toEqual([])
    })

    it('release 是幂等的，重复调用不会把计数减成负数', () => {
      const { registry, onEvict } = createRegistry()
      const release = registry.retain('t1', vi.fn())
      const other = registry.retain('t1', vi.fn())

      release()
      release()
      release()

      expect([...registry.desired()]).toEqual(['t1'])

      other()
      vi.advanceTimersByTime(5000)
      expect(onEvict).toHaveBeenCalledWith('t1')
    })
  })

  describe('延迟释放', () => {
    it('最后一个持有者离开后，等待 releaseDelay 才真正释放', () => {
      const { registry, onEvict } = createRegistry()
      const release = registry.retain('t1', vi.fn())

      release()
      vi.advanceTimersByTime(999)
      expect(onEvict).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1)
      expect(onEvict).toHaveBeenCalledWith('t1')
    })

    it('StrictMode 的 mount→unmount→mount 抖动不会触发释放', () => {
      const { registry, onEvict } = createRegistry()

      const first = registry.retain('t1', vi.fn())
      first()
      // 同一个 tick 内重新挂载
      registry.retain('t1', vi.fn())

      vi.advanceTimersByTime(5000)
      expect(onEvict).not.toHaveBeenCalled()
      expect([...registry.desired()]).toEqual(['t1'])
    })

    it('延迟窗口内重新持有会取消释放', () => {
      const { registry, onEvict } = createRegistry()
      const release = registry.retain('t1', vi.fn())
      release()

      vi.advanceTimersByTime(900)
      registry.retain('t1', vi.fn())

      vi.advanceTimersByTime(5000)
      expect(onEvict).not.toHaveBeenCalled()
    })

    it('卸载不会立刻产生退订变更（避免连接抖动）', () => {
      const { registry, onChange } = createRegistry()
      const release = registry.retain('t1', vi.fn())

      vi.advanceTimersByTime(100)
      expect(onChange).toHaveBeenCalledWith(['t1'])
      onChange.mockClear()

      // 组件卸载：宽限期内不发布收缩后的集合，传输层据此不会重开连接
      release()
      vi.advanceTimersByTime(500)
      expect(onChange).not.toHaveBeenCalled()

      // 宽限期结束（releaseDelay）后才发布移除，移除本身再走一次批量窗口
      vi.advanceTimersByTime(1000)
      expect(onChange).toHaveBeenCalledWith([])
    })

    it('宽限期内重新持有不会产生任何变更（路由来回切换）', () => {
      const { registry, onChange } = createRegistry()
      const release = registry.retain('t1', vi.fn())
      vi.advanceTimersByTime(100)
      onChange.mockClear()

      release()
      vi.advanceTimersByTime(300)
      registry.retain('t1', vi.fn())

      vi.advanceTimersByTime(5000)
      expect(onChange).not.toHaveBeenCalled()
      expect([...registry.desired()]).toEqual(['t1'])
    })

    it('释放后清掉值缓存与 listener', () => {
      const { registry } = createRegistry()
      const listener = vi.fn()
      const release = registry.retain('t1', listener)

      registry.update('t1', { value: 1 })
      expect(registry.peek('t1')).toEqual({ value: 1 })

      release()
      vi.advanceTimersByTime(1000)

      expect(registry.peek('t1')).toBeUndefined()

      // 已释放的 key 不再接收推送
      registry.update('t1', { value: 2 })
      expect(listener).toHaveBeenCalledTimes(1)
    })
  })

  describe('groups（命令式整表替换）', () => {
    it('replace 只影响自己的 group', () => {
      const { registry } = createRegistry()
      registry.retain('atomic1', vi.fn())

      registry.setGroup('table', ['a', 'b'], 'replace')
      expect([...registry.desired()].sort()).toEqual(['a', 'atomic1', 'b'])

      // 整表替换成一个新集合，旧的 a/b 进入释放宽限期，但 atomic1 不受影响
      registry.setGroup('table', ['c'], 'replace')
      expect([...registry.desired()].sort()).toEqual(['a', 'atomic1', 'b', 'c'])

      vi.advanceTimersByTime(1000)
      expect([...registry.desired()].sort()).toEqual(['atomic1', 'c'])
    })

    it('replace 不会误伤另一个 group', () => {
      const { registry } = createRegistry()
      registry.setGroup('g1', ['a'])
      registry.setGroup('g2', ['b'])

      registry.setGroup('g1', ['c'])
      vi.advanceTimersByTime(1000)
      expect([...registry.desired()].sort()).toEqual(['b', 'c'])
    })

    it('append 累加而不是替换', () => {
      const { registry } = createRegistry()
      registry.setGroup('g1', ['a'], 'append')
      registry.setGroup('g1', ['b'], 'append')
      expect([...registry.desired()].sort()).toEqual(['a', 'b'])
    })

    it('同一个 key 同时被 atom 和 group 持有时，只有全部释放才移除', () => {
      const { registry, onEvict } = createRegistry()
      const release = registry.retain('shared', vi.fn())
      registry.setGroup('g1', ['shared'])

      release()
      vi.advanceTimersByTime(5000)
      expect(onEvict).not.toHaveBeenCalled()

      registry.clearGroup('g1')
      vi.advanceTimersByTime(1000)
      expect(onEvict).toHaveBeenCalledWith('shared')
    })
  })

  describe('onChange 防抖', () => {
    it('窗口内的多次变化合并成一次回调', () => {
      const { registry, onChange } = createRegistry()

      registry.retain('a', vi.fn())
      registry.retain('b', vi.fn())
      registry.retain('c', vi.fn())
      expect(onChange).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(['a', 'b', 'c'])
    })

    it('首屏一次性出现大量 key 时只触发一次 onFirstRetain', () => {
      const { registry, onFirstRetain } = createRegistry()

      registry.retain('a', vi.fn())
      registry.retain('b', vi.fn())
      registry.retain('c', vi.fn())

      vi.advanceTimersByTime(100)
      expect(onFirstRetain).toHaveBeenCalledTimes(1)
      expect(onFirstRetain).toHaveBeenCalledWith(['a', 'b', 'c'])
    })

    it('已经初始化过的 key 不会重复触发 onFirstRetain', () => {
      const { registry, onFirstRetain } = createRegistry()

      registry.retain('a', vi.fn())
      vi.advanceTimersByTime(100)
      expect(onFirstRetain).toHaveBeenCalledTimes(1)

      registry.retain('a', vi.fn())
      vi.advanceTimersByTime(100)
      expect(onFirstRetain).toHaveBeenCalledTimes(1)
    })
  })

  describe('数据广播', () => {
    it('update 只广播给该 key 的 listener', () => {
      const { registry } = createRegistry()
      const a = vi.fn()
      const b = vi.fn()
      registry.retain('t1', a)
      registry.retain('t2', b)

      registry.update('t1', { value: 100 })

      expect(a).toHaveBeenCalledWith({ value: 100 })
      expect(b).not.toHaveBeenCalled()
    })

    it('多个 store 的 listener 都会收到（onMount 各绑定各的 store）', () => {
      const { registry } = createRegistry()
      const pageA = vi.fn()
      const pageB = vi.fn()
      registry.retain('t1', pageA)
      registry.retain('t1', pageB)

      registry.update('t1', { value: 1 })

      expect(pageA).toHaveBeenCalledWith({ value: 1 })
      expect(pageB).toHaveBeenCalledWith({ value: 1 })
    })

    it('patch 合并写入而不覆盖其它字段', () => {
      const { registry } = createRegistry()
      const listener = vi.fn()
      registry.retain('t1', listener)

      registry.update('t1', { value: 1 })
      registry.patch('t1', { warningState: { level: 2 } })

      expect(listener).toHaveBeenLastCalledWith({ value: 1, warningState: { level: 2 } })
      expect(registry.peek('t1')).toEqual({ value: 1, warningState: { level: 2 } })
    })

    it('无人持有的 key 不缓存值（避免报警推送把缓存撑爆）', () => {
      const { registry } = createRegistry()

      registry.update('nobody', { value: 1 })

      expect(registry.peek('nobody')).toBeUndefined()
    })

    it('释放延迟窗口内仍然缓存值，重新挂载时可回填避免闪空', () => {
      const { registry } = createRegistry()
      const release = registry.retain('t1', vi.fn())
      registry.update('t1', { value: 42 })

      release()
      vi.advanceTimersByTime(500)

      expect(registry.peek('t1')).toEqual({ value: 42 })
    })
  })

  describe('onEvicted', () => {
    it('evictor 收到 key，供 atomFamily.remove 回收', () => {
      const { registry } = createRegistry()
      const evicted: string[] = []
      registry.onEvicted((key) => evicted.push(key))

      const release = registry.retain('t1', vi.fn())
      release()
      vi.advanceTimersByTime(1000)

      expect(evicted).toEqual(['t1'])
    })
  })
})
