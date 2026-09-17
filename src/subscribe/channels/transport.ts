// ============================================================================
// 传输层：把「期望订阅集合」映射到一条 WebSocket 连接
//
// 这是全案唯一与订阅协议耦合的地方。当前协议：
//   连接建立后发 { type: 'query', data: [...] }，服务端**幂等累积**，
//   且**没有单独的退订消息**。
// 由此推出唯一的正确策略：
//   纯新增 → 复用现有连接，只发差量（服务端累积，等价于重新声明）
//   有移除 → 关连接重开，用完整集合重新声明（否则旧 tag 永远退不掉）
//   desired 为空 → 直接断开，不保留空转连接
// 服务端一旦支持退订消息，只需改 setDesired 一个分支。
// ============================================================================

import { createWSClient } from '../wsClient'
import type { WSClient } from '../wsClient'
import { buildWsUrl } from '../ws'

export interface Transport {
  /** 期望的完整订阅集合：key → 下发给服务端的 payload */
  setDesired: (payloads: Map<string, unknown>) => void
  close: () => void
  /** 当前连接是否已建立（诊断用） */
  isConnected: () => boolean
}

export interface TransportOptions {
  subType: string
  onData: (data: any) => void
  onStatus?: (status: string) => void
}

export function createTransport(options: TransportOptions): Transport {
  let client: WSClient | null = null
  /** 服务端当前已知的订阅（每次重连后由 open 重新声明） */
  let serverKnown = new Map<string, unknown>()
  /** 期望的订阅 */
  let ideal = new Map<string, unknown>()

  const connect = () => {
    client = createWSClient(() => buildWsUrl(options.subType), {
      // 每次连接（含断线重连）都重新声明完整集合——重连后服务端状态已丢失
      open: (send) => {
        serverKnown = new Map(ideal)
        if (serverKnown.size > 0) {
          send({ type: 'query', data: [...serverKnown.values()] })
        }
      },
      data: (data) => options.onData(data),
      status: (status) => options.onStatus?.(status)
    })
  }

  return {
    setDesired(payloads) {
      ideal = new Map(payloads)

      if (ideal.size === 0) {
        client?.close()
        client = null
        serverKnown = new Map()
        return
      }

      if (!client) {
        connect()
        return
      }

      // 还没连上（首次连接中或重连中）：open 时会一次性声明当时的 ideal，
      // 此时不要按 serverKnown 算差量，否则会和 open 的整份声明重叠发一遍。
      if (client.readyState !== 1) return

      // 纯新增：可以不打断连接
      const pureAdd = [...serverKnown.keys()].every((key) => ideal.has(key))
      if (pureAdd) {
        const added = [...ideal.keys()].filter((key) => !serverKnown.has(key))
        serverKnown = new Map(ideal)
        if (added.length > 0) {
          client.send({ type: 'query', data: added.map((key) => ideal.get(key)) })
        }
        return
      }

      // 有移除：协议不支持退订，只能重开
      client.close()
      client = null
      connect()
    },
    close() {
      client?.close()
      client = null
      serverKnown = new Map()
      ideal = new Map()
    },
    isConnected: () => client?.readyState === 1
  }
}
