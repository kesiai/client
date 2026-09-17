// ============================================================================
// 引用/计算字段通道（computerecord）
//
// 取代原先挂在 <Subscribe> Provider 上的 useComputeSubscribe。
// 与 tag/data 不同，服务端这里是一个**全局订阅**（只传 projectId，不按 key 声明），
// 所以 keyed registry 只用来决定「还需不需要这条连接」。
// ============================================================================

import { KeyedRegistry } from '../registry'
import { createWSClient } from '../wsClient'
import type { WSClient } from '../wsClient'
import { buildWsUrl } from '../ws'

export const referenceKey = (tableId: string, tableDataId: string, field: string) =>
  `${tableId}#%${tableDataId}#%${field}`

const projectIdOf = () =>
  typeof location !== 'undefined'
    ? location.pathname.split('/').find((p) => p.startsWith('_p_'))?.substring(3)
    : undefined

let client: WSClient | null = null

const handleData = (data: any) => {
  if (!data?.tableId || !data?.tableDataId || !data?.field) return
  referenceChannelRegistry.update(referenceKey(data.tableId, data.tableDataId, data.field), data.value || 'computing')
}

const start = () => {
  if (client) return
  client = createWSClient(() => buildWsUrl('computerecord'), {
    open: (send) => send({ type: 'query', data: { projectId: projectIdOf() } }),
    data: handleData
  })
}

const stop = () => {
  client?.close()
  client = null
}

export const referenceChannelRegistry = new KeyedRegistry<any>({
  onChange: (all) => {
    if (all.length > 0) start()
    else stop()
  }
})
