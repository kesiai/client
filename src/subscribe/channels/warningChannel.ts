// ============================================================================
// 报警通道（warning）
//
// 取代原先挂在 <Subscribe> Provider 上的 useTagWarningSubscribe。
// 服务端是全局订阅（不按 key 声明），推送带着 table/tableData/field，
// 由这里路由回 tagRegistry 对应的 key 上。
//
// 注意（既有事实，本次未激活）：原实现里 getTableWarning —— 首屏通过
// warning/warning/stats/latest 拉取已有报警状态 —— 在 Store.tsx 中返回值被直接忽略，
// 从未被调用过，属于死代码。本次保持现状，避免夹带行为变更。
// ============================================================================

import { createWSClient } from '../wsClient'
import type { WSClient } from '../wsClient'
import { buildWsUrl } from '../ws'
import { tagRegistry, tagKey } from './tagChannel'

let client: WSClient | null = null

const applyWarning = (data: any) => {
  const fields = data?.fields
  const table = data?.table
  const tableData = data?.tableData
  if (!table?.id || !tableData?.id || !fields) return

  fields.forEach((field: any) => {
    tagRegistry.patch(tagKey(table.id, tableData.id, field.id), {
      warningState: {
        className: data.className,
        level: field.level || data.level,
        recoveryTime: data.recoveryTime
      }
    })
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

// 报警只对已订阅的数据点有意义，所以跟随 tagChannel 一起启动
tagRegistry.onFirstRetain(() => ensureWarningChannel())
