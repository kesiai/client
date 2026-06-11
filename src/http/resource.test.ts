import { describe, it, expect, beforeEach, vi } from 'vitest'
import axios from 'axios'
import { setConfig } from '../config'
import { createHttpClient } from './client'
import { createResourceClient } from './resource'

vi.mock('axios')
const mockedAxios = vi.mocked(axios)

describe('createResourceClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setConfig({ rest: undefined, projectId: undefined, user: undefined, language: undefined, settings: undefined })
  })

  // 辅助：创建一个绑定了 resource 的 client + resourceClient
  const setup = (resource: string) => {
    const client = createHttpClient({ resource })
    const api = createResourceClient<{ id?: string; name?: string; status?: string }>({
      client,
      resource,
    })
    return { client, api }
  }

  describe('query()', () => {
    it('发送编码后的查询字符串', async () => {
      mockedAxios.mockResolvedValue({
        data: [{ id: '1', name: 'test' }],
        status: 200,
        headers: { count: '1' },
      })

      const { api } = setup('test')
      const result = await api.query({ skip: 0, limit: 10 })

      expect(result.items).toEqual([{ id: '1', name: 'test' }])
      expect(result.total).toBe(1)

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect(callArgs.url).toContain('?query=')
    })

    it('正确构建分页参数', async () => {
      mockedAxios.mockResolvedValue({ data: [], status: 200, headers: {} })

      const { api } = setup('test')
      await api.query({ skip: 20, limit: 10 })

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      const url = callArgs.url as string
      const queryStr = decodeURIComponent(url.split('?query=')[1])
      const queryObj = JSON.parse(queryStr)
      expect(queryObj.skip).toBe(20)
      expect(queryObj.limit).toBe(10)
    })

    it('正确构建排序参数', async () => {
      mockedAxios.mockResolvedValue({ data: [], status: 200, headers: {} })

      const { api } = setup('test')
      await api.query({ order: { name: 'ASC', createdAt: 'DESC' } })

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      const url = callArgs.url as string
      const queryStr = decodeURIComponent(url.split('?query=')[1])
      const queryObj = JSON.parse(queryStr)
      expect(queryObj.sort).toEqual({ name: 1, createdAt: -1 })
    })

    it('正确构建字段投影', async () => {
      mockedAxios.mockResolvedValue({ data: [], status: 200, headers: {} })

      const { api } = setup('test')
      await api.query({ fields: ['id', 'name'] })

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      const url = callArgs.url as string
      const queryStr = decodeURIComponent(url.split('?query=')[1])
      const queryObj = JSON.parse(queryStr)
      expect(queryObj.project).toEqual({ id: 1, name: 1 })
    })

    it('传递 where 条件', async () => {
      mockedAxios.mockResolvedValue({ data: [], status: 200, headers: {} })

      const { api } = setup('test')
      await api.query({}, { status: { $eq: 'active' } })

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      const url = callArgs.url as string
      const queryStr = decodeURIComponent(url.split('?query=')[1])
      const queryObj = JSON.parse(queryStr)
      expect(queryObj.filter).toEqual({ status: { $eq: 'active' } })
    })

    it('always withCount = true', async () => {
      mockedAxios.mockResolvedValue({ data: [], status: 200, headers: {} })

      const { api } = setup('test')
      await api.query()

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      const url = callArgs.url as string
      const queryStr = decodeURIComponent(url.split('?query=')[1])
      const queryObj = JSON.parse(queryStr)
      expect(queryObj.withCount).toBe(true)
    })

    it('total 从 headers.count 读取', async () => {
      mockedAxios.mockResolvedValue({
        data: [{ id: '1' }, { id: '2' }],
        status: 200,
        headers: { count: '100' },
      })

      const { api } = setup('test')
      const { total } = await api.query()
      expect(total).toBe(100)
    })

    it('total 无 headers.count 时回退到 items.length', async () => {
      mockedAxios.mockResolvedValue({
        data: [{ id: '1' }, { id: '2' }],
        status: 200,
        headers: {},
      })

      const { api } = setup('test')
      const { total } = await api.query()
      expect(total).toBe(2)
    })

    it('_id 自动转换为 id', async () => {
      mockedAxios.mockResolvedValue({
        data: [{ _id: 'abc', name: 'test' }],
        status: 200,
        headers: {},
      })

      const { api } = setup('test')
      const { items } = await api.query()
      expect(items[0].id).toBe('abc')
    })

    it('响应不是数组时回退为空数组', async () => {
      mockedAxios.mockResolvedValue({
        data: null,
        status: 200,
        headers: {},
      })

      const { api } = setup('test')
      const { items, total } = await api.query()
      expect(items).toEqual([])
      expect(total).toBe(0)
    })
  })

  describe('get()', () => {
    it('获取单条数据', async () => {
      mockedAxios.mockResolvedValue({
        data: { id: '123', name: 'test' },
        status: 200,
        headers: {},
      })

      const { api } = setup('test')
      const item = await api.get('123')

      expect(item).toEqual({ id: '123', name: 'test' })

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect(callArgs.url).toBe('/rest/test/123')
    })

    it('不会覆盖后端返回的 id', async () => {
      mockedAxios.mockResolvedValue({
        data: { id: 'real-id', name: 'test' },
        status: 200,
        headers: {},
      })

      const { api } = setup('test')
      const item = await api.get('123')
      expect(item.id).toBe('real-id')
    })

    it('_id 自动转换为 id', async () => {
      mockedAxios.mockResolvedValue({
        data: { _id: 'abc', name: 'test' },
        status: 200,
        headers: {},
      })

      const { api } = setup('test')
      const item = await api.get('abc')
      expect(item.id).toBe('abc')
    })
  })

  describe('save()', () => {
    it('无 id 时 POST 创建', async () => {
      mockedAxios.mockResolvedValue({
        data: { InsertedID: 'new-id' },
        status: 200,
        headers: {},
      })

      const { api } = setup('test')
      const result = await api.save({ name: 'New Item' })

      expect(result.id).toBe('new-id')
      expect(result.name).toBe('New Item')

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect(callArgs.method).toBe('POST')
      expect(callArgs.url).toBe('/rest/test')
    })

    it('有 id 时 PUT 更新', async () => {
      mockedAxios.mockResolvedValue({ data: {}, status: 200, headers: {} })

      const { api } = setup('test')
      const result = await api.save({ id: '123', name: 'Updated' })

      expect(result.id).toBe('123')
      expect(result.name).toBe('Updated')

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect(callArgs.method).toBe('PUT')
      expect(callArgs.url).toBe('/rest/test/123')
    })

    it('partial=true 时 PATCH 更新', async () => {
      mockedAxios.mockResolvedValue({ data: {}, status: 200, headers: {} })

      const { api } = setup('test')
      const result = await api.save({ id: '123', status: 'active' }, true)

      expect(result.status).toBe('active')

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect(callArgs.method).toBe('PATCH')
    })

    it('body 自动 JSON.stringify', async () => {
      mockedAxios.mockResolvedValue({ data: { id: '1' }, status: 200, headers: {} })

      const { api } = setup('test')
      await api.save({ name: 'test' })

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect(callArgs.data).toBe('{"name":"test"}')
    })
  })

  describe('delete()', () => {
    it('发送 DELETE 请求', async () => {
      mockedAxios.mockResolvedValue({ data: null, status: 200, headers: {} })

      const { api } = setup('test')
      await api.delete('123')

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect(callArgs.method).toBe('DELETE')
      expect(callArgs.url).toBe('/rest/test/123')
    })
  })

  describe('count()', () => {
    it('返回计数', async () => {
      mockedAxios.mockResolvedValue({
        data: { count: 42 },
        status: 200,
        headers: {},
      })

      const { api } = setup('test')
      const count = await api.count({ status: 'active' })

      expect(count).toBe(42)

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect((callArgs.url as string)).toContain('count?query=')
    })
  })

  describe('raw()', () => {
    it('直接代理到 client.request', async () => {
      mockedAxios.mockResolvedValue({
        data: { success: true },
        status: 200,
        headers: {},
      })

      const { api } = setup('test')
      const result = await api.raw('/custom-action', { method: 'POST', body: {} })

      expect(result.data).toEqual({ success: true })

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect(callArgs.url).toBe('/rest/test/custom-action')
      expect(callArgs.method).toBe('POST')
    })
  })

  describe('泛型类型', () => {
    it('支持自定义 idField', async () => {
      mockedAxios.mockResolvedValue({
        data: { key: 'my-key', value: 'my-value' },
        status: 200,
        headers: {},
      })

      const client = createHttpClient({ resource: 'test' })
      const api = createResourceClient<{ id?: string; key?: string; value?: string }>({
        client,
        resource: 'test',
        idField: 'key',
      })

      const item = await api.get('my-key')
      expect(item.key).toBe('my-key')
      expect(item.value).toBe('my-value')
    })
  })
})
