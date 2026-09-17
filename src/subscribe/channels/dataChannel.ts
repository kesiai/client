// ============================================================================
// 表数据（tabledata）订阅通道
//
// 取代原先挂在 <Subscribe> Provider 上的 useTableDataSubscribe。
//
// 关于 key 的一个既有事实（非本次引入）：`dataState` 是按 **dataId 单独** 建 atom 的
// （见 atoms.ts），而订阅下发需要 tableId。因此这里用 dataId 作 registry key，
// 并额外维护 dataId → tableId 的映射，映射来源与取值仍然是 tableId（同一 dataId
// 不会跨表重复）。`useTableDataValue` 在不传 tableId 时仍可读值——与改造前一致。
// ============================================================================

import _ from 'lodash'

import { KeyedRegistry } from '../registry'
import { createTransport } from './transport'

/** dataId → tableId。dataId 全局唯一，同 key 重复写入值不变，幂等 */
const tableIdByDataId = new Map<string, string>()

export const noteTableId = (dataId?: string, tableId?: string) => {
  if (dataId && tableId && tableIdByDataId.get(dataId) !== tableId) {
    tableIdByDataId.set(dataId, tableId)
  }
}

/**
 * 下发 { tableId, id, fields }。
 * fields 用 [''] 表示整行：view-data-table 本来就按整行订阅（fields: []），
 * useTableData 只关心其中一列，整行推送是两者的并集，语义与改造前的合并订阅一致。
 */
const toPayload = (dataId: string) => ({
  tableId: tableIdByDataId.get(dataId),
  id: dataId,
  fields: ['']
})

const WAREHOUSE_DELAY = 100
const WAREHOUSE_MAX_WAIT = 1000

let warehouse: Record<string, any> = {}

const flushWarehouse = _.debounce(() => {
  const batch = warehouse
  warehouse = {}
  for (const dataId of Object.keys(batch)) {
    dataChannelRegistry.patch(dataId, batch[dataId])
  }
}, WAREHOUSE_DELAY, { maxWait: WAREHOUSE_MAX_WAIT })

const handleData = (data: any) => {
  const dataId = data?.tableDataId || data?.id
  if (!dataId) return
  noteTableId(dataId, data?.tableId)
  warehouse[dataId] = { ...(warehouse[dataId] || {}), ...data }
  flushWarehouse()
}

const transport = createTransport({
  subType: 'tabledata',
  onData: handleData
})

export const dataChannelRegistry = new KeyedRegistry<any>({
  onChange: (all) => {
    // tableId 未知的 key 无法构造订阅条件，跳过（保留在 desired 里，等映射补齐）
    const payloads = new Map<string, unknown>()
    for (const dataId of all) {
      const payload = toPayload(dataId)
      if (payload.tableId) payloads.set(dataId, payload)
    }
    transport.setDesired(payloads)
  }
})
