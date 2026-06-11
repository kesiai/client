import { describe, it, expect, beforeEach, vi } from 'vitest'
import axios from 'axios'
import { setConfig } from '../config'
import { createHttpClient } from './client'

vi.mock('axios')
const mockedAxios = vi.mocked(axios)

// Mock isAxiosError to check the isAxiosError property on the error object
;(axios.isAxiosError as ReturnType<typeof vi.fn>).mockImplementation(
  (error: unknown) => !!(error as Record<string, unknown>)?.isAxiosError
)

describe('createHttpClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // setConfig 是 Object.assign 合并，需要显式清除所有字段
    setConfig({ rest: undefined, projectId: undefined, user: undefined, language: undefined, settings: undefined })
  })

  describe('实例创建', () => {
    it('使用默认 baseURL', () => {
      const client = createHttpClient({ resource: 'test' })
      expect(client.resource).toBe('test')
      expect(client.baseURL).toBe('/rest/')
    })

    it('使用 proxyKey 覆盖 baseURL', () => {
      const client = createHttpClient({ resource: 'test', proxyKey: '/api/' })
      expect(client.baseURL).toBe('/api/')
    })

    it('使用 config.rest 作为 baseURL', () => {
      setConfig({ rest: 'http://server:3030/rest/' })
      const client = createHttpClient({ resource: 'test' })
      expect(client.baseURL).toBe('http://server:3030/rest/')
    })

    it('auth/ 前缀自动转为 core/auth/', () => {
      const client = createHttpClient({ resource: 'auth/login' })
      expect(client.resource).toBe('core/auth/login')
    })

    it('不以 auth/ 开头的 resource 不变', () => {
      const client = createHttpClient({ resource: 'core/user' })
      expect(client.resource).toBe('core/user')
    })
  })

  describe('request - 基本请求', () => {
    it('发送 GET 请求', async () => {
      mockedAxios.mockResolvedValue({
        data: { id: 1, name: 'test' },
        status: 200,
        headers: {},
      })

      const client = createHttpClient({ resource: 'test' })
      const result = await client.request('/1')

      expect(result.data).toEqual({ id: 1, name: 'test' })
      expect(result.status).toBe(200)
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/rest/test/1',
        })
      )
    })

    it('发送 POST 请求并自动 stringify body', async () => {
      mockedAxios.mockResolvedValue({ data: { success: true }, status: 200, headers: {} })

      const client = createHttpClient({ resource: 'test' })
      await client.request('', { method: 'POST', body: { name: 'test' } })

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          data: '{"name":"test"}',
        })
      )
    })

    it('拼接 query params', async () => {
      mockedAxios.mockResolvedValue({ data: [], status: 200, headers: {} })

      const client = createHttpClient({ resource: 'test' })
      await client.request('/list', { params: { page: '1', size: '10' } })

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('page=1&size=10'),
        })
      )
    })

    it('传递 AbortSignal', async () => {
      mockedAxios.mockResolvedValue({ data: null, status: 200, headers: {} })
      const controller = new AbortController()

      const client = createHttpClient({ resource: 'test' })
      await client.request('', { signal: controller.signal })

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: controller.signal,
        })
      )
    })
  })

  describe('request - Headers', () => {
    it('包含 Content-Type 和 Timezone', async () => {
      mockedAxios.mockResolvedValue({ data: null, status: 200, headers: {} })

      const client = createHttpClient({ resource: 'test' })
      await client.request('')

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      const headers = callArgs.headers as Record<string, string>
      expect(headers['Content-Type']).toBe('application/json')
      expect(headers['X-Request-TimeZone']).toMatch(/^[+-]\d{2}:\d{2}$/)
    })

    it('注入 user token', async () => {
      setConfig({ user: { token: 'my-token' } })
      mockedAxios.mockResolvedValue({ data: null, status: 200, headers: {} })

      const client = createHttpClient({ resource: 'test' })
      await client.request('')

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect((callArgs.headers as Record<string, string>)['Authorization']).toBe('my-token')
    })

    it('noToken 资源不注入 token', async () => {
      setConfig({ user: { token: 'my-token' } })
      mockedAxios.mockResolvedValue({ data: null, status: 200, headers: {} })

      // core/auth/login 在内置 noToken 列表中
      const client = createHttpClient({ resource: 'core/auth/login' })
      await client.request('')

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect((callArgs.headers as Record<string, string>)['Authorization']).toBeUndefined()
    })

    it('noGetToken 资源在 GET 时不注入 token', async () => {
      setConfig({ user: { token: 'my-token' } })
      mockedAxios.mockResolvedValue({ data: null, status: 200, headers: {} })

      // core/message 在内置 noGetToken 列表中
      const client = createHttpClient({ resource: 'core/message' })
      await client.request('', { method: 'GET' })

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect((callArgs.headers as Record<string, string>)['Authorization']).toBeUndefined()
    })

    it('noGetToken 资源在 POST 时注入 token', async () => {
      setConfig({ user: { token: 'my-token' } })
      mockedAxios.mockResolvedValue({ data: null, status: 200, headers: {} })

      const client = createHttpClient({ resource: 'core/message' })
      await client.request('', { method: 'POST', body: {} })

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect((callArgs.headers as Record<string, string>)['Authorization']).toBe('my-token')
    })

    it('自定义 noToken 列表合并内置列表', async () => {
      setConfig({ user: { token: 'my-token' } })
      mockedAxios.mockResolvedValue({ data: null, status: 200, headers: {} })

      const client = createHttpClient({ resource: 'my/custom', noToken: ['my/custom'] })
      await client.request('')

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect((callArgs.headers as Record<string, string>)['Authorization']).toBeUndefined()
    })

    it('注入 projectId', async () => {
      setConfig({ projectId: 'kesi' })
      mockedAxios.mockResolvedValue({ data: null, status: 200, headers: {} })

      const client = createHttpClient({ resource: 'test' })
      await client.request('')

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect((callArgs.headers as Record<string, string>)['x-request-project']).toBe('kesi')
    })

    it('注入 Language', async () => {
      setConfig({ language: 'zh-CN' })
      mockedAxios.mockResolvedValue({ data: null, status: 200, headers: {} })

      const client = createHttpClient({ resource: 'test' })
      await client.request('')

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect((callArgs.headers as Record<string, string>)['Accept-Language']).toBe('zh-CN')
    })

    it('请求级别 headers 覆盖默认值', async () => {
      mockedAxios.mockResolvedValue({ data: null, status: 200, headers: {} })

      const client = createHttpClient({ resource: 'test' })
      await client.request('', { headers: { 'X-Custom': 'value' } })

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect((callArgs.headers as Record<string, string>)['X-Custom']).toBe('value')
    })

    it('默认 headers 从配置注入', async () => {
      mockedAxios.mockResolvedValue({ data: null, status: 200, headers: {} })

      const client = createHttpClient({ resource: 'test', defaultHeaders: { 'X-App': 'kesu' } })
      await client.request('')

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect((callArgs.headers as Record<string, string>)['X-App']).toBe('kesu')
    })
  })

  describe('request - safeRequest', () => {
    it('DELETE 转为 GET，附加原始方法 header', async () => {
      setConfig({ settings: { safeRequest: true } })
      mockedAxios.mockResolvedValue({ data: null, status: 200, headers: {} })

      const client = createHttpClient({ resource: 'test' })
      await client.request('/1', { method: 'DELETE' })

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect(callArgs.method).toBe('GET')
      expect((callArgs.headers as Record<string, string>)['x-request-http-method']).toBe('DELETE')
    })

    it('PUT 转为 POST，附加原始方法 header', async () => {
      setConfig({ settings: { safeRequest: true } })
      mockedAxios.mockResolvedValue({ data: null, status: 200, headers: {} })

      const client = createHttpClient({ resource: 'test' })
      await client.request('/1', { method: 'PUT', body: {} })

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect(callArgs.method).toBe('POST')
      expect((callArgs.headers as Record<string, string>)['x-request-http-method']).toBe('PUT')
    })

    it('PATCH 转为 POST，附加原始方法 header', async () => {
      setConfig({ settings: { safeRequest: true } })
      mockedAxios.mockResolvedValue({ data: null, status: 200, headers: {} })

      const client = createHttpClient({ resource: 'test' })
      await client.request('/1', { method: 'PATCH', body: {} })

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect(callArgs.method).toBe('POST')
      expect((callArgs.headers as Record<string, string>)['x-request-http-method']).toBe('PATCH')
    })

    it('配置级别的 safeRequest 覆盖全局设置', async () => {
      setConfig({ settings: { safeRequest: false } })
      mockedAxios.mockResolvedValue({ data: null, status: 200, headers: {} })

      const client = createHttpClient({ resource: 'test', safeRequest: true })
      await client.request('/1', { method: 'DELETE' })

      const callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect(callArgs.method).toBe('GET')
    })
  })

  describe('request - 错误处理', () => {
    it('axios 错误归一化为 { data, status }', async () => {
      mockedAxios.mockRejectedValue({
        isAxiosError: true,
        response: { status: 404, data: { error: 'Not found' } },
      })

      const client = createHttpClient({ resource: 'test' })
      await expect(client.request('/invalid')).rejects.toEqual({
        data: { error: 'Not found' },
        status: 404,
      })
    })

    it('无 response 时回退到 error message', async () => {
      mockedAxios.mockRejectedValue({
        isAxiosError: true,
        message: 'Network Error',
        response: undefined,
      })

      const client = createHttpClient({ resource: 'test' })
      await expect(client.request('')).rejects.toEqual({
        data: { _error: 'Network Error' },
        status: 0,
      })
    })

    it('非 axios 错误也归一化', async () => {
      mockedAxios.mockRejectedValue(new Error('Unknown'))

      const client = createHttpClient({ resource: 'test' })
      await expect(client.request('')).rejects.toEqual({
        data: { _error: 'Unknown' },
        status: 0,
      })
    })
  })

  describe('request - 配置实时生效', () => {
    it('创建 client 后修改 config，下次请求立即生效', async () => {
      setConfig({ user: { token: 'token-1' } })
      mockedAxios.mockResolvedValue({ data: null, status: 200, headers: {} })

      const client = createHttpClient({ resource: 'test' })

      // 第一次请求
      await client.request('')
      let callArgs = mockedAxios.mock.calls[0][0] as Record<string, unknown>
      expect((callArgs.headers as Record<string, string>)['Authorization']).toBe('token-1')

      // 修改 token
      setConfig({ user: { token: 'token-2' } })
      await client.request('')
      callArgs = mockedAxios.mock.calls[1][0] as Record<string, unknown>
      expect((callArgs.headers as Record<string, string>)['Authorization']).toBe('token-2')
    })
  })
})
