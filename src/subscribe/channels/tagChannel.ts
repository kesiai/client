// ============================================================================
// 数据点（tag）订阅通道
//
// 取代原先挂在 <Subscribe> Provider 上的 useDataTagSubscribe。
// 订阅集合由 tagRegistry 的 refCount 决定，不再由一个 useRef 数组只增不减地累积。
// ============================================================================

import _ from 'lodash'
import dayjs from 'dayjs'

import { KeyedRegistry } from '../registry'
import { createTransport } from './transport'
import { queryLastData, queryMeta } from '../queries'
import { onTagsTimeout, registerTagTimeout, unregisterTagTimeout } from '../worker'
import type { SubTag, TagValue } from '../types'

/** tagsState / worker 的统一 key 格式 */
export const tagKey = (tableId: string, dataId: string, tagId: string) => `${tableId}|${dataId}|${tagId}`

export const parseTagKey = (key: string) => {
  const [tableId, dataId, tagId] = key.split('|')
  return { tableId, dataId, tagId }
}

/** WS 'data' 通道的下发格式 */
const toPayload = (key: string) => {
  const { tableId, dataId, tagId } = parseTagKey(key)
  return { tableId, id: dataId, tagId }
}

/** 一条 WS 消息可能带整行的多个 tag，沿用原先的 warehouse + debounce 合并写入 */
const WAREHOUSE_DELAY = 100
const WAREHOUSE_MAX_WAIT = 1000

let warehouse: Record<string, TagValue> = {}

const flushWarehouse = _.debounce(() => {
  const batch = warehouse
  warehouse = {}
  for (const key of Object.keys(batch)) {
    tagRegistry.patch(key, batch[key])
  }
}, WAREHOUSE_DELAY, { maxWait: WAREHOUSE_MAX_WAIT })

const handleData = (data: any) => {
  if (!data || !_.isPlainObject(data)) return
  const tableId = data.tableId
  const dataId = data.tableDataId || data.id
  const tags = data.fields
  const time = data.time
  if (!tableId || !dataId || !tags) return

  Object.keys(tags).forEach((tagId: string) => {
    warehouse[tagKey(tableId, dataId, tagId)] = { value: tags[tagId], time }
  })
  flushWarehouse()
}

const transport = createTransport({
  subType: 'data',
  onData: handleData
})

export const tagRegistry = new KeyedRegistry<TagValue>({
  onChange: (all) => {
    transport.setDesired(new Map(all.map((key) => [key, toPayload(key)])))
  }
})

/**
 * 首屏拉取：最新值 + 数据点元信息。
 * 一批 key 合并成一次请求（原先就是按全量列表批量发，这里保持）。
 */
const prefetch = (keys: string[]) => {
  const subTags: SubTag[] = keys
    .map((key) => parseTagKey(key))
    .filter((tag) => Boolean(tag.tableId && tag.dataId && tag.tagId))

  if (subTags.length === 0) return

  queryLastData(subTags, (value) => {
    if (value) {
      for (const key of Object.keys(value)) {
        tagRegistry.patch(key, value[key])
      }
    }
    queryMeta(subTags, (meta: Record<string, any>) => {
      if (!meta) return
      Object.keys(meta).forEach((key: string) => {
        const tagMeta = meta[key]
        tagRegistry.patch(key, { meta: tagMeta })
        if (tagMeta?.timeout) {
          const { tableId, dataId, tagId } = parseTagKey(key)
          const time = value?.[key]?.time
          if (time) {
            registerTagTimeout(tableId, dataId, tagId, dayjs(time).unix(), tagMeta.timeout)
          }
        }
      })
    })
  })
}

tagRegistry.onFirstRetain(prefetch)

tagRegistry.onEvicted((key) => {
  const { tableId, dataId, tagId } = parseTagKey(key)
  unregisterTagTimeout(tableId, dataId, tagId)
})

/**
 * worker 的超时判定结果写回各 store。
 * 走 registry 广播而不是 useSetAtom(tagsTimeoutSelector, {store})，
 * 后者只能写进单个 store，而多 store 会同时存活。
 */
const toTimeoutState = (level: number) => {
  if (level === 0 || level === 1) return { isTimeout: false, isOffline: false, level }
  if (level === 2) return { isTimeout: true, isOffline: false, level }
  if (level === 3) return { isTimeout: true, isOffline: true, level }
  return { level }
}

onTagsTimeout((data) => {
  for (const { key, level } of data) {
    // 级别没变就不写，避免每秒 tick 触发无谓重渲染（与改造前一致）
    if (tagRegistry.peek(key)?.timeoutState?.level === level) continue
    tagRegistry.patch(key, { timeoutState: toTimeoutState(level) })
  }
})

/** 诊断用：当前期望的订阅 key 快照 */
export const getSubscribedTagKeys = () => [...tagRegistry.desired()]
