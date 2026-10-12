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
        // 报警详情透传（DataPoint 弹卡等消费端挑字段展示）
        info: { ...data, level },
      }
    })
  })
}

/**
 * 首屏补拉：订阅数据点所在设备的未恢复报警（WS 只推打开页面后新产生的报警）。
 * 一批 key 按设备去重合并为一次请求（过滤键 tableDataId 是 SQL 列名，
 * 响应键才是 tableDataID——见 kesi 应用 warning.schema 注释）；复用 applyWarning 路由。
 */
const prefetchWarnings = (keys: string[]) => {
  const dataIds = new Set<string>()
  for (const key of keys) {
    const { dataId } = parseTagKey(key)
    if (dataId) dataIds.add(dataId)
  }
  if (dataIds.size === 0) return

  const query = encodeURIComponent(JSON.stringify({
    // 列表端点不带 project 只回 id 等系统字段（平台行为），显式指定消费端需要的字段
    project: {
      table: 1, tableData: 1, fields: 1, className: 1,
      level: 1, recoveryTime: 1, time: 1, desc: 1, type: 1,
      status: 1, processed: 1, confirmUser: 1, name: 1,
    },
    filter: { tableDataId: { $in: Array.from(dataIds) }, recoveryTime: { $exists: false } },
    sort: { time: -1 },
    limit: 100,
  }))
  api({ name: 'warning/warning' })
    .get(`?query=${query}`)
    .then(({ data }: any) => {
      const list = Array.isArray(data) ? data : []
      // sort time -1（最新在前）→ 倒序应用让最新一条最后落：同一 tag 有多条
      // 未恢复报警时 level/recoveryTime 以最新记录为准（正序 forEach 会被最旧的覆盖）
      for (let i = list.length - 1; i >= 0; i--) applyWarning(list[i])
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
