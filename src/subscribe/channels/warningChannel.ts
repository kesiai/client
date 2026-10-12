// ============================================================================
// 报警通道（warning）
//
// 取代原先挂在 <Subscribe> Provider 上的 useTagWarningSubscribe。
// 服务端是全局订阅（不按 key 声明），推送带着 table/tableData/field，
// 由这里路由回 tagRegistry 对应的 key 上。
//
// warningState 组成：
//   首屏：onFirstRetain 补拉订阅设备 的未恢复报警（存量报警 WS 不会推）。
//         原实现里的首屏拉取（getTableWarning）在旧 Store.tsx 中是死代码，
//         2026-10-12 在此激活为统一实现——所有 useTag 消费方自动获得报警态。
//   实时：WS 推送覆盖（级别/恢复时间以推送为准）。
//   info：整条报警透传（首屏=完整报警记录；推送=推送体字段），消费端挑字段展示。
// ============================================================================

import { createWSClient } from '../wsClient'
import type { WSClient } from '../wsClient'
import { buildWsUrl } from '../ws'
import api from '../../api'
import { tagRegistry, tagKey, parseTagKey } from './tagChannel'

let client: WSClient | null = null

const applyWarning = (data: any) => {
  const fields = data?.fields
  const table = data?.table
  const tableData = data?.tableData
  if (!table?.id || !tableData?.id || !fields) return

  fields.forEach((field: any) => {
    const level = field?.level || data.level
    tagRegistry.patch(tagKey(table.id, tableData.id, field.id), {
      warningState: {
        className: data.className,
        level,
        recoveryTime: data.recoveryTime,
        // 报警详情透传（DataPoint 弹卡等消费端挑字段展示）。fields 只留展示所需
        // 键——stats/latest 返回的 fields 是完整 tag 配置（rules 等，单条几 KB），
        // 不精简会把配置巨对象写进 atom
        info: {
          ...data,
          level,
          fields: fields.map((f: any) => ({ id: f.id, name: f.name, value: f.value, level: f.level })),
        },
      }
    })
  })
}

/**
 * 首屏补拉：订阅数据点所在设备的当前未恢复报警（WS 只推打开页面后新产生的报警）。
 * 走 stats/latest 专用端点（新旧平台均有，2026-10-12 实测）：入参按表分组记录 id，
 * 响应按 rule 聚合（ruleid = 表|记录|数据点|规则）、只含未恢复、天然最新一条——
 * 无 limit 截断，也不需要 project 白名单（list 端点「不带 project 只回 id」的怪癖它没有）。
 */
const prefetchWarnings = (keys: string[]) => {
  const byTable = new Map<string, Set<string>>()
  for (const key of keys) {
    const { tableId, dataId } = parseTagKey(key)
    if (!tableId || !dataId) continue
    if (!byTable.has(tableId)) byTable.set(tableId, new Set())
    byTable.get(tableId)!.add(dataId)
  }
  if (byTable.size === 0) return

  const tableData = encodeURIComponent(JSON.stringify(
    Array.from(byTable, ([tableId, ids]) => ({ tableId, data: Array.from(ids) })),
  ))
  api({ name: 'warning/warning' })
    .get(`stats/latest?tableData=${tableData}`)
    .then(({ data }: any) => {
      const list = Array.isArray(data) ? data : []
      // 服务端已按 rule 聚合（每 rule 一条当前未恢复报警），顺序无关
      list.forEach((w: any) => applyWarning(w))
    })
    .catch(() => {
      // 首屏补拉失败静默降级（此前本无此能力；实时推送不受影响）
    })
}

/** 幂等：第一个 tag 被订阅时才建立连接 */
export const ensureWarningChannel = () => {
  if (client) return
  client = createWSClient(() => buildWsUrl('warning'), {
    open: (send) => send({ type: 'query', data: { recoveryStatus: '已恢复' } }),
    data: applyWarning
  })
}

// 报警跟随 tagChannel：首屏补拉 + 第一个订阅建立连接
tagRegistry.onFirstRetain(prefetchWarnings)
tagRegistry.onFirstRetain(() => ensureWarningChannel())
