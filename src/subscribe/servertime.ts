import { atom } from 'jotai'
import { useAtomValue, useSetAtom } from 'jotai'
import React, { useEffect, useRef } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { useWS } from './ws'
import worker from './worker'

const serverTimeState = atom<Dayjs>(dayjs())

export const useTimeSubscribe = () => {
  const setTime = useSetAtom(serverTimeState)
  const baseRef = useRef(Date.now())
  const offsetRef = useRef(0)
  const { subscribe, onMessage } = useWS()

  // 每秒：基准 + 偏移 → 写入 atom
  useEffect(() => {
    const id = setInterval(() => {
      offsetRef.current += 1
      const now = dayjs(baseRef.current).add(offsetRef.current, 's')
      setTime(now)
      worker.postMessage({ type: 'servertime', value: now.unix() })
    }, 1000)
    return () => clearInterval(id)
  }, [setTime])

  // WS 同步基准时间，重置偏移
  onMessage(json => {
    if (json?.time) {
      baseRef.current = json.time
      offsetRef.current = 0
      setTime(dayjs(json.time))
      worker.postMessage({ type: 'servertime', value: dayjs(json.time).unix() })
    }
  })

  React.useEffect(() => subscribe('time', []), [])
}

export function useServerTime() {
  return useAtomValue(serverTimeState)
}
