// 分支必须显式按 type 分发：原来 'servertime' 与其它类型共用一个 if/else，
// 同一秒内的重复 servertime 会掉进 else 分支，把 {undefined,undefined} 以
// 'undefined|undefined|undefined' 为 key 写进 tagsMap（每秒一条，永不回收）。
const workerBlob = `
let servertime = null
const tagsMap = new Map()
self.onmessage = function (event) {
  const { type, value } = event.data;
  if (type == 'servertime') {
    if (value == servertime) return
    servertime = value
    const timeoutTags = []
    tagsMap.forEach(({ time, timeout }, key) => {
      const gap = servertime - time
      let level = null
      if (gap > timeout * 8) {
        level = 3
      } else if (gap > timeout * 3) {
        level = 2
      } else if (gap > timeout) {
        level = 1
      } else if (timeout > gap) {
        level = 0
      }
      timeoutTags.push({ key, level })
    })
    timeoutTags.length > 0 && self.postMessage(timeoutTags)
  } else if (type == 'tags-remove') {
    const { tableId, tableDataId, tagId } = value
    tagsMap.delete(tableId+'|'+tableDataId+'|'+tagId)
  } else if (type == 'tags') {
    const { tableId, tableDataId, tagId, time, timeout } = value
    const key = tableId+'|'+tableDataId+'|'+tagId
    tagsMap.set(key, { time, timeout })
  }
};
`

type TimeoutHandler = (data: { key: string; level: number }[]) => void

let worker: Worker | null = null
let timeoutHandler: TimeoutHandler | null = null

/**
 * 惰性创建：模块级 new Worker 会让「只是 import 了 subscribe」的环境
 * （Node / 无 Worker 的测试环境）直接抛错。改成第一次真正需要时才建。
 *
 * 环境不支持 Worker（SSR / 测试环境）时返回 null：这些都是清理与判定逻辑，
 * 静默降级为「不做超时判定」远好过让调用方（含定时器里的 evict 回调）炸掉。
 */
const ensureWorker = (): Worker | null => {
  if (worker) return worker
  if (typeof Worker === 'undefined' || typeof URL?.createObjectURL !== 'function') return null
  const blob = new Blob([workerBlob], { type: 'application/javascript' })
  worker = new Worker(URL.createObjectURL(blob))
  if (timeoutHandler) {
    worker.onmessage = (event) => timeoutHandler?.(event.data)
  }
  return worker
}

/** 超时级别回调。模块级单例，只注册一次——替代原先在 hook 里反复赋值 worker.onmessage 的写法 */
export function onTagsTimeout(cb: TimeoutHandler): void {
  timeoutHandler = cb
  if (worker) {
    worker.onmessage = (event) => cb(event.data)
  }
}

/** 注册一个 tag 的超时判定：time 为该点最后一次数据的时间戳（秒） */
export function registerTagTimeout(tableId: string, tableDataId: string, tagId: string, time: number, timeout: number): void {
  ensureWorker()?.postMessage({ type: 'tags', value: { tableId, tableDataId, tagId, time, timeout } })
}

/** 释放 tag 时移除超时判定，否则 tagsMap 只增不减、离线点会一直上报 */
export function unregisterTagTimeout(tableId: string, tableDataId: string, tagId: string): void {
  ensureWorker()?.postMessage({ type: 'tags-remove', value: { tableId, tableDataId, tagId } })
}

/** 同步服务器时间给 worker，驱动超时计算 */
export function syncServerTime(unix: number): void {
  ensureWorker()?.postMessage({ type: 'servertime', value: unix })
}
