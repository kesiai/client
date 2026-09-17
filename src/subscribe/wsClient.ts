// ============================================================================
// 无 React 依赖的 WebSocket 客户端
//
// 从 ws.ts 抽出：订阅通道（registry）是模块级单例，不能在 hook 里创建连接，
// 但需要与 useWS 完全一致的连接/重连/保活语义，因此两侧共用这一层。
// ============================================================================

export interface WSClient {
  /** 未 open 时先入队，open 后自动 flush */
  send: (data: unknown) => void
  close: () => void
  readonly readyState: number
}

export interface WSClientHandlers {
  /** 每次连接（含重连）建立后触发，用于下发当前订阅条件 */
  open?: (send: (data: unknown) => void, socket: WebSocket) => void
  /** 收到完整 JSON 消息 */
  message?: (message: any, socket: WebSocket) => void
  /** 收到消息体 message.data */
  data?: (data: any, socket: WebSocket) => void
  status?: (status: string, event?: Event | CloseEvent) => void
}

const KEEPALIVE_MESSAGE = 'client send keeplive message!'
const KEEPALIVE_INTERVAL = 30000
const RECONNECT_TIMEOUT = 3000
const RECONNECT_TIMEOUT_SLOW = 10000
const RECONNECT_SLOW_AFTER = 10
const RECONNECT_GIVE_UP_AFTER = 20
const AUTH_FAILED_MARKER = '获取当前用户ID失败'

/**
 * @param url 字符串或**函数**。传函数时每次连接都会重新求值，
 *   从而在重连时重新读取 token / projectId（登录态变化后不会被冻结在首次渲染）。
 */
export function createWSClient(url: string | (() => string), handlers: WSClientHandlers = {}): WSClient {
  let socket: WebSocket | null = null
  let connecting = false
  /** 主动 close 后不再重连 */
  let closed = false
  let reConnectCount = 0
  let keepLiveTimer: ReturnType<typeof setTimeout> | null = null
  /** 重连互斥：onerror 与 onclose 会先后触发，不互斥会排出两个 connect */
  let reConnectTimer: ReturnType<typeof setTimeout> | null = null
  /** open 之前排队的消息 */
  const pending: unknown[] = []

  const status = (s: string, event?: Event | CloseEvent) => handlers.status?.(s, event)

  const rawSend = (target: WebSocket, data: unknown) => {
    target.send(typeof data === 'string' ? data : JSON.stringify(data))
  }

  const send = (data: unknown) => {
    if (socket && socket.readyState === 1) {
      rawSend(socket, data)
    } else {
      pending.push(data)
    }
  }

  const flush = (target: WebSocket) => {
    while (pending.length > 0) {
      rawSend(target, pending.shift())
    }
  }

  const scheduleKeepLive = () => {
    keepLiveTimer = setTimeout(() => {
      if (socket?.readyState === 1) {
        socket.send(KEEPALIVE_MESSAGE)
        scheduleKeepLive()
      }
    }, KEEPALIVE_INTERVAL)
  }

  const reconnect = () => {
    if (closed || connecting || reConnectTimer) return
    if (reConnectCount >= RECONNECT_GIVE_UP_AFTER) return
    const timeout = reConnectCount > RECONNECT_SLOW_AFTER ? RECONNECT_TIMEOUT_SLOW : RECONNECT_TIMEOUT
    reConnectCount++
    reConnectTimer = setTimeout(() => {
      reConnectTimer = null
      connect()
    }, timeout)
  }

  const connect = () => {
    if (closed) return
    const current = new WebSocket(typeof url === 'function' ? url() : url)
    socket = current
    connecting = true
    status('connecting')

    current.onopen = () => {
      // close() 可能发生在 CONNECTING 期间，此时 onopen 仍会触发
      if (closed) {
        current.close()
        return
      }
      connecting = false
      reConnectCount = 0
      status('connected')

      current.onmessage = (msg: MessageEvent) => {
        let message: any
        try {
          message = JSON.parse(msg.data)
        } catch {
          // 服务端可能回非 JSON 帧（如 keepalive 应答），忽略
          return
        }
        if (typeof message?.message === 'string' && message.message.indexOf(AUTH_FAILED_MARKER) >= 0) {
          closed = true
          status('auth-failed')
        }
        handlers.message?.(message, current)
        handlers.data?.(message?.data, current)
      }

      current.onclose = (v: CloseEvent) => {
        status('close', v)
        reconnect()
      }

      handlers.open?.(send, current)
      flush(current)
      scheduleKeepLive()
    }

    current.onerror = (err: Event) => {
      // 连接失败时 connecting 一直是 true，不清掉会让重连阶梯永不触发
      connecting = false
      status('error', err)
      reconnect()
    }
  }

  connect()

  return {
    send,
    close() {
      closed = true
      if (keepLiveTimer) clearTimeout(keepLiveTimer)
      if (reConnectTimer) clearTimeout(reConnectTimer)
      keepLiveTimer = null
      reConnectTimer = null
      if (socket) {
        const current = socket
        socket = null
        current.onopen = null
        current.onmessage = null
        current.onclose = null
        current.onerror = null
        current.close()
      }
    },
    get readyState() {
      return socket?.readyState ?? 3
    }
  }
}
