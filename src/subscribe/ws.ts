import React from 'react'
import { getHeaders } from '../api'
import { createWSClient } from './wsClient'
import type { WSClientHandlers } from './wsClient'

// ============================================================================
// Types
// ============================================================================

interface WSMessage {
  message?: string
  data?: any
  [key: string]: any
}

interface OnMessageFunc {
  (message: WSMessage): void
}

interface OnDataFunc {
  (data: any, socket: WebSocket): void
}

interface OnStatusFunc {
  (status: string, event?: Event | CloseEvent): void
}

/** 订阅地址：字符串，或每次连接时求值的函数 */
type WSUrl = string | (() => string)

interface UseCommWSResult {
  subscribe: (url: WSUrl, query: any) => () => void
  onData: (fn: OnDataFunc) => void
  onMessage: (fn: OnMessageFunc) => void
  onStatus: (fn: OnStatusFunc) => void
}

interface UseWSResult {
  subscribe: (subType: string, query: any) => () => void
  onData: (fn: OnDataFunc) => void
  onMessage: (fn: OnMessageFunc) => void
  onStatus: (fn: OnStatusFunc) => void
}

interface UseWSDataProps {
  query: any
}

interface UseWSDataResult {
  onData: (fn: OnDataFunc) => void
  onStatus: (fn: OnStatusFunc) => void
}

// ============================================================================
// Hooks
// ============================================================================

export const useCommWS = (): UseCommWSResult => {
  const onMessageFunc = React.useRef<OnMessageFunc | null>(null)
  const onDataFunc = React.useRef<OnDataFunc | null>(null)
  const onStatusFunc = React.useRef<OnStatusFunc | null>(null)

  const onMessage = React.useCallback((fn: OnMessageFunc) => {
    onMessageFunc.current = fn
  }, [])

  const onData = React.useCallback((fn: OnDataFunc) => {
    onDataFunc.current = fn
  }, [])

  const onStatus = React.useCallback((fn: OnStatusFunc) => {
    onStatusFunc.current = fn
  }, [])

  const subscribe = React.useCallback((url: WSUrl, query: any) => {
    const handlers: WSClientHandlers = {
      message: (message) => onMessageFunc.current?.(message),
      data: (data, socket) => onDataFunc.current?.(data, socket),
      status: (status, event) => onStatusFunc.current?.(status, event),
      // 每次连接（含重连）建立后下发订阅条件
      open: (send) => send({ type: 'query', data: query })
    }
    const client = createWSClient(url, handlers)
    return () => client.close()
  }, [])

  return { subscribe, onData, onMessage, onStatus }
}

/**
 * 组装订阅地址。**每次连接时调用**，因此登录态变化（token 更新）后
 * 重连会带上新 token，不会被冻结在首次渲染。
 */
export const buildWsUrl = (subType: string): string => {
  const headers = getHeaders()
  const authorization = headers['Authorization']
  const token = authorization ? `token=${authorization}` : ''
  const projectID = headers['x-request-project']
  const protocol = window.location.protocol.indexOf('https') === 0 ? 'wss' : 'ws'
  const project = projectID ? `${token ? '&' : ''}x-request-project=${projectID}` : ''
  return `${protocol}://${window.location.host}/ws/${subType}?${token}${project}`
}

export const useWS = (): UseWSResult => {
  const { subscribe: commSubscribe, onData, onMessage, onStatus } = useCommWS()

  const subscribe = React.useCallback((subType: string, query: any) => {
    return commSubscribe(() => buildWsUrl(subType), query)
  }, [commSubscribe])

  return { subscribe, onData, onMessage, onStatus }
}

export const useWSData = ({ query }: UseWSDataProps): UseWSDataResult => {
  const { subscribe, onData, onStatus } = useWS()

  React.useEffect(() => {
    return subscribe('data', query)
  }, [query, subscribe])

  return { onData, onStatus }
}

export type { WSUrl }
