import { useAtomValue } from 'jotai'
import React from 'react'
import _ from 'lodash'
import type { TagOptions, DataPropOptions, SubTag, SubData } from './types'
import { dataPropSelector, tagsState, referenceState, emptyTagState } from './atoms'
import { tagKey, tagRegistry } from './channels/tagChannel'
import { dataChannelRegistry, noteTableId } from './channels/dataChannel'
import { referenceKey } from './channels/referenceChannel'
import { serverTimeState, ensureServerTimeChannel } from './channels/serverTimeChannel'
import { useCellDataValue } from '../page/hooks/context'
import { usePageStore } from '../page/hooks/util'

// ============================================================================
// 命令式订阅（group 语义）
//
// 与 atom 生命周期是两种并存的所有权模型：
//   - useTag/useTableData  → 声明式，atom 被 mount 就订阅，卸载就释放
//   - subscribeTags/Data   → 命令式，整组替换/追加，由调用方自己负责收尾
// 拆成独立 group 之后，clear=true 只影响该 group 自己的 key，
// 不再像改造前那样把同一个 Provider 下其它组件的订阅一并清掉。
// ============================================================================

const TAG_GROUP = '__subscribeTags__'
const DATA_GROUP = '__subscribeData__'

export const subscribeTags = (tags: SubTag[], clear?: boolean): void => {
  const keys = (tags || [])
    .filter((tag) => tag?.tableId && tag?.dataId && tag?.tagId)
    .map((tag) => tagKey(tag.tableId, tag.dataId!, tag.tagId!))
  tagRegistry.setGroup(TAG_GROUP, keys, clear ? 'replace' : 'append')
}

export const subscribeData = (dataIds: SubData[], clear?: boolean): void => {
  ;(dataIds || []).forEach((data) => noteTableId(data?.dataId, data?.tableId))
  const keys = (dataIds || []).filter((data) => data?.dataId).map((data) => data.dataId!)
  dataChannelRegistry.setGroup(DATA_GROUP, keys, clear ? 'replace' : 'append')
}

/** 丢弃命令式订阅组（改造前没有对应能力，如需彻底退订可用） */
export const clearSubscriptions = (): void => {
  tagRegistry.clearGroup(TAG_GROUP)
  dataChannelRegistry.clearGroup(DATA_GROUP)
}

// ============================================================================
// Context 兼容层
//
// 改造后不再有 Context，也不再抛错：返回的就是上面的模块级函数。
// 保留这个 hook 只是为了不打断已有调用点（view-data-table 等）。
// ============================================================================

const SUBSCRIBE_API = { subscribeTags, subscribeData }

export function useSubscribeContext() {
  return React.useMemo(() => SUBSCRIBE_API, [])
}

// ============================================================================
// Tag Hooks
// ============================================================================

/**
 * 订阅并读取数据点。可以在任意位置使用，**不需要外层 <Subscribe>**——
 * 订阅由 tagsState 这个 atom 的 onMount 发起，卸载时自动释放。
 */
export function useTag(options: TagOptions) {
  const tableDataContext = useCellDataValue()?.tableData

  const dataId = options.dataId || tableDataContext?.id
  const tableId = options.tableId || tableDataContext?.table?.id || tableDataContext?._table

  return useTagValue({ ...options, tableId, dataId })
}

/**
 * 读取数据点。注意：改造后它和 useTag 一样会订阅——
 * 生命周期挂在 atom 的 mount 上，只要读了就会 mount。
 * （改造前它不订阅，但也没有任何调用点在依赖这一点。）
 */
export function useTagValue(options: TagOptions) {
  const { tableId, dataId, tagId, field } = options
  const key = tableId && dataId && tagId ? tagKey(tableId, dataId, tagId) : null

  // key 可能因为上下文里的 dataId 后到而为空，用占位 atom 保证 hook 调用数稳定
  const tag = useAtomValue(key ? tagsState(key) : emptyTagState, { store: usePageStore() })

  return field ? _.get(tag, field) : tag
}

// ============================================================================
// Data Hooks
// ============================================================================

export function useTableData(options: DataPropOptions) {
  const tableDataContext = useCellDataValue()?.tableData

  const dataId = options.dataId || tableDataContext?.id
  const tableId = options.tableId || tableDataContext?.table?.id || tableDataContext?._table
  noteTableId(dataId, tableId)

  return useTableDataValue({ ...options, dataId, tableId })
}

export function useTableDataValue(options: DataPropOptions) {
  noteTableId(options.dataId, options.tableId)
  return useAtomValue(dataPropSelector(options), { store: usePageStore() })
}

// ============================================================================
// Reference/Compute Hooks
// ============================================================================

export function useReferenceValue(tableId: string, tableDataId: string, field: string) {
  return useAtomValue(referenceState(referenceKey(tableId, tableDataId, field)), { store: usePageStore() })
}

// ============================================================================
// Server Time Hooks
// ============================================================================

/** 首次调用时惰性启动 time 通道，不再依赖 <Subscribe> 挂载 */
export function useServerTime() {
  React.useEffect(() => {
    ensureServerTimeChannel()
  }, [])
  return useAtomValue(serverTimeState)
}

/** 兼容保留：显式启动 time 通道，返回 null */
export function useTimeSubscribe() {
  React.useEffect(() => {
    ensureServerTimeChannel()
  }, [])
  return null
}
