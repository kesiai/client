// ============================================================================
// 服务器时间通道（time）
//
// 取代原先挂在 <Subscribe> Provider 上的 useTimeSubscribe。
// 现在由 useServerTime() 首次调用时惰性启动，因此不再需要 Provider。
//
// store 说明：serverTimeState 一直读写 jotai 默认 store（改造前 useSetAtom /
// useAtomValue 都没传 store，且应用里没有任何 jotai <Provider>）。
// 这里沿用一个全局单例，因此**不要**把 useServerTime 放进 jotai <Provider> 内使用。
// ============================================================================

import { atom, getDefaultStore } from 'jotai'
import dayjs, { type Dayjs } from 'dayjs'

import { createWSClient } from '../wsClient'
import type { WSClient } from '../wsClient'
import { buildWsUrl } from '../ws'
import { syncServerTime } from '../worker'

export const serverTimeState = atom<Dayjs>(dayjs())

let client: WSClient | null = null
let tickTimer: ReturnType<typeof setInterval> | null = null
let base = Date.now()
let offset = 0

export const ensureServerTimeChannel = () => {
  if (client) return
  const store = getDefaultStore()

  // 每秒：基准 + 偏移
  tickTimer = setInterval(() => {
    offset += 1
    const now = dayjs(base).add(offset, 's')
    store.set(serverTimeState, now)
    syncServerTime(now.unix())
  }, 1000)

  // WS 同步基准时间，重置偏移
  client = createWSClient(() => buildWsUrl('time'), {
    open: (send) => send({ type: 'query', data: [] }),
    message: (json) => {
      if (!json?.time) return
      base = json.time
      offset = 0
      store.set(serverTimeState, dayjs(json.time))
      syncServerTime(dayjs(json.time).unix())
    }
  })
}

export const stopServerTimeChannel = () => {
  if (tickTimer) clearInterval(tickTimer)
  tickTimer = null
  client?.close()
  client = null
}
