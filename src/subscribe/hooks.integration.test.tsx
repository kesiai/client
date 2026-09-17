/**
 * 验收测试：useTag / useTableData 在**没有任何 Provider** 的情况下可用。
 *
 * 这正是本次改造要解决的痛点——packages/vite-plugin/src/Canvas.tsx 渲染页面时
 * 没有 <Subscribe>，而编辑器生成的表达式代码会调用 useTag。
 *
 * 覆盖：无 Provider 订阅 → 下发 query → 收推送写回 atom → 重渲染 → 卸载后释放。
 *
 * 说明：registry / transport 都是模块级单例，跨用例存活（这正是设计意图）。
 * 因此这里不按「用例开始时的实例列表」断言，而是按**当前是否还活着**来取连接。
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { render, cleanup, screen, act } from '@testing-library/react'

// 首屏拉取会打 HTTP，这里隔离掉；本测试只关心 WS 通道与 atom 生命周期
vi.mock('./queries')

import { setConfig } from '../config'
import { useTag, useTableData } from './hooks'

// ============================================================================
// 假的 WebSocket
// ============================================================================

class FakeWebSocket {
  static instances: FakeWebSocket[] = []

  url: string
  readyState = 0
  sent: string[] = []
  closed = false

  onopen: ((e: any) => void) | null = null
  onmessage: ((e: any) => void) | null = null
  onclose: ((e: any) => void) | null = null
  onerror: ((e: any) => void) | null = null

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.closed = true
    this.readyState = 3
  }

  fireOpen() {
    this.readyState = 1
    this.onopen?.({})
  }

  /** 按服务端信封格式发一条消息：业务负载在 `data` 字段里 */
  emit(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify({ data: payload }) })
  }

  /** 本次连接收到的所有 query 里的订阅条件，拼成一个字符串方便断言 */
  queries(): string {
    return this.sent
      .map((raw) => {
        try {
          return JSON.stringify(JSON.parse(raw).data)
        } catch {
          return raw
        }
      })
      .join(' ')
  }
}

/** 当前仍然活着的某个通道的连接 */
const activeSocket = (subType: string) =>
  [...FakeWebSocket.instances].reverse().find((s) => s.url.includes(`/ws/${subType}`) && !s.closed)

const activeCount = (subType: string) =>
  FakeWebSocket.instances.filter((s) => s.url.includes(`/ws/${subType}`) && !s.closed).length

/** 拿到当前 data 通道连接，必要时补一次 open（模拟服务端握手完成） */
const openDataSocket = () => {
  const socket = activeSocket('data')
  expect(socket, '应已建立 data 通道连接').toBeDefined()
  if (socket!.readyState === 0) socket!.fireOpen()
  return socket!
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
/** 等过 registry 的批量窗口 + 通道内的合并窗口 */
const settle = () => act(async () => { await wait(250) })

// ============================================================================
// 组件
// ============================================================================

function TagReader({ tableId, dataId, tagId }: { tableId: string; dataId: string; tagId: string }) {
  const tag = useTag({ tableId, dataId, tagId })
  return <span data-testid="tag">{String(tag?.value ?? 'none')}</span>
}

function DataReader({ tableId, dataId, field }: { tableId: string; dataId: string; field: string }) {
  return <span data-testid="data">{String(useTableData({ tableId, dataId, field }) ?? 'none')}</span>
}

describe('订阅在无 Provider 下可用', () => {
  // 只在开始时替换一次全局 WebSocket，且不清空实例列表——
  // 连接是跨用例存活的，按用例清空会让「活着的连接」查不到。
  beforeAll(() => {
    setConfig({ projectId: 'test' })
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })

  afterEach(() => {
    cleanup()
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('useTag 不抛错，并下发订阅条件', async () => {
    // 注意：这里**没有**任何 <Subscribe> / <Provider>
    expect(() => render(<TagReader tableId="t1" dataId="d1" tagId="temp" />)).not.toThrow()
    expect(screen.getByTestId('tag').textContent).toBe('none')

    await settle()

    const socket = openDataSocket()
    expect(socket.queries()).toContain('"tagId":"temp"')
  })

  it('推送写回 atom 并触发重渲染', async () => {
    render(<TagReader tableId="t2" dataId="d2" tagId="humidity" />)
    await settle()

    const socket = openDataSocket()
    expect(socket.queries()).toContain('"tagId":"humidity"')

    await act(async () => {
      socket.emit({ tableId: 't2', tableDataId: 'd2', fields: { humidity: 61 }, time: 1000 })
      await wait(250) // 通道内的 warehouse 合并窗口
    })

    expect(screen.getByTestId('tag').textContent).toBe('61')
  })

  it('tag 与 tabledata 各走自己的通道，且各自只有一条连接', async () => {
    render(
      <>
        <TagReader tableId="t3" dataId="d3" tagId="a" />
        <DataReader tableId="t3" dataId="d3" field="name" />
      </>
    )
    await settle()

    const data = activeSocket('data')
    const tabledata = activeSocket('tabledata')
    expect(data, 'data 通道').toBeDefined()
    expect(tabledata, 'tabledata 通道').toBeDefined()
    expect(activeCount('data')).toBe(1)
    expect(activeCount('tabledata')).toBe(1)

    openDataSocket()
    if (tabledata!.readyState === 0) tabledata!.fireOpen()
    expect(tabledata!.queries()).toContain('"id":"d3"')
  })

  it('多个组件读同一个 key 只订阅一次，最后一个卸载后才释放', async () => {
    const first = render(<TagReader tableId="t4" dataId="d4" tagId="shared" />)
    await settle()
    openDataSocket()

    const second = render(<TagReader tableId="t4" dataId="d4" tagId="shared" />)
    await settle()
    expect(activeCount('data'), '同一个 key 不应重复建连').toBe(1)

    // 卸载一个：另一个还在读，连接应保持
    first.unmount()
    await wait(2300)
    expect(activeSocket('data'), '仍有读者时不应断开').toBeDefined()

    // 卸载最后一个：过了释放宽限期后彻底断开
    second.unmount()
    await wait(2600)
    expect(activeCount('data')).toBe(0)
  }, 20000)
})
