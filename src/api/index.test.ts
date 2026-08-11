import { describe, it, expect, beforeEach, vi } from 'vitest'
import axios from 'axios'
import { createHttp, createAPI, type APIOptions } from '../api'

vi.mock('axios')
const mockedAxios = vi.mocked(axios)

let requestMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  // createHttp 返回 axios.create 的实例，这里让 create 返回一个可断言的请求函数
  requestMock = vi.fn()
  Object.assign(requestMock, {
    interceptors: { request: { use: vi.fn() } },
    defaults: {},
    // fetch 内部通过 instance.request() 发请求，将其指向同一个 mock
    request: requestMock
  })
  ;(mockedAxios.create as any) = vi.fn().mockReturnValue(requestMock)
})

describe('API Module', () => {
  describe('createHttp', () => {
    it('should return an axios instance configured with baseURL', () => {
      const api = createHttp({ resource: 'test' })

      expect(api).toBe(requestMock)
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: '/rest/test'
      })
    })

    it('should use custom proxyKey as baseURL', () => {
      createHttp({ resource: 'test', proxyKey: '/api/' })

      expect(mockedAxios.create).toHaveBeenCalledWith(expect.objectContaining({ baseURL: '/api/test' }))
    })

    it('should convert auth resource to core/auth', () => {
      createHttp({ resource: 'auth/login' })

      expect(mockedAxios.create).toHaveBeenCalledWith(expect.objectContaining({
        baseURL: '/rest/core/auth/login'
      }))
    })

    it('should add default headers via request interceptor', () => {
      let interceptor: any
      Object.assign(requestMock, {
        interceptors: { request: { use: (fn: any) => { interceptor = fn } } }
      })

      createHttp({ resource: 'test' }, { user: { token: 'test-token' } })

      const config: any = { headers: {} }
      const result = interceptor(config)

      expect(result).toBe(config)
      expect(config.headers.Authorization).toBe('test-token')
      expect(config.headers['Content-Type']).toBe('application/json')
    })

    it('should not override existing request headers in interceptor', () => {
      let interceptor: any
      Object.assign(requestMock, {
        interceptors: { request: { use: (fn: any) => { interceptor = fn } } }
      })

      createHttp({ resource: 'test' }, { user: { token: 'test-token' } })

      const config: any = { headers: { Authorization: 'existing-token' } }
      interceptor(config)

      expect(config.headers.Authorization).toBe('existing-token')
    })

    it('should throw error when resource is undefined', () => {
      expect(() => createHttp({} as APIOptions)).toThrow('api option resource is undefined')
    })
  })

  describe('createAPI', () => {
    it('should create API instance with resource', () => {
      const options: APIOptions = { resource: 'test' }
      const api = createAPI(options)

      expect(api).toBeDefined()
      expect(api.resource).toBe('test')
      expect(api.host).toBe('/rest/')
    })

    it('should throw error when resource is undefined', () => {
      expect(() => createAPI({} as APIOptions)).toThrow('api option resource is undefined')
    })

    it('should use custom proxyKey as host', () => {
      const options: APIOptions = { resource: 'test', proxyKey: '/api/' }
      const api = createAPI(options)

      expect(api.host).toBe('/api/')
    })

    it('should convert auth resource to core/auth', () => {
      const options: APIOptions = { resource: 'auth/login' }
      const api = createAPI(options)

      expect(api.resource).toBe('core/auth/login')
    })

    it('should create its axios instance through createHttp', () => {
      createAPI({ resource: 'test' })

      expect(mockedAxios.create).toHaveBeenCalled()
    })
  })

  describe('API.fetch', () => {
    it('should make GET request and return response', async () => {
      const mockResponse = { data: { id: 1, name: 'test' }, headers: {} }
      requestMock.mockResolvedValue(mockResponse as any)

      const api = createAPI({ resource: 'test' })
      const result = await api.fetch('/1')

      expect(result.data).toEqual({ id: 1, name: 'test' })
      expect(requestMock).toHaveBeenCalledWith({
        method: 'GET',
        url: '/1',
        headers: expect.any(Object),
        data: undefined
      })
    })

    it('should make POST request', async () => {
      const mockResponse = { data: { success: true }, headers: {} }
      requestMock.mockResolvedValue(mockResponse as any)

      const api = createAPI({ resource: 'test' })
      const result = await api.fetch('', { method: 'POST', body: '{"name":"test"}' })

      expect(result.data).toEqual({ success: true })
      expect(requestMock).toHaveBeenCalledWith({
        method: 'POST',
        url: '',
        headers: expect.any(Object),
        data: '{"name":"test"}'
      })
    })

    it('should handle errors and reject with the raw axios error', async () => {
      const error = {
        response: {
          status: 404,
          data: { error: 'Not found' }
        }
      }
      requestMock.mockRejectedValue(error as any)

      const api = createAPI({ resource: 'test' })

      await expect(api.fetch('/invalid')).rejects.toEqual(error)
    })

    it('should remove Authorization header when ignoreAuthorization is set', async () => {
      const mockResponse = { data: { token: 'new-token' }, headers: {} }
      requestMock.mockResolvedValue(mockResponse as any)

      const api = createAPI({ resource: 'auth/login', ignoreAuthorization: true }, { user: { token: 'test-token' } })
      await api.fetch('', { method: 'POST', body: '{}' })

      const callArgs = requestMock.mock.calls[0][0] as any
      expect(callArgs.headers.Authorization).toBeUndefined()
    })

    it('should add Authorization header when user has token', async () => {
      const mockResponse = { data: { id: 1 }, headers: {} }
      requestMock.mockResolvedValue(mockResponse as any)

      const api = createAPI({ resource: 'test' }, { user: { token: 'test-token' } })
      await api.fetch('/1')

      const callArgs = requestMock.mock.calls[0][0] as any
      expect(callArgs.headers.Authorization).toBe('test-token')
    })

    it('should add custom headers', async () => {
      const mockResponse = { data: { id: 1 }, headers: {} }
      requestMock.mockResolvedValue(mockResponse as any)

      const api = createAPI({ resource: 'test', headers: { 'X-Custom': 'value' } })
      await api.fetch('/1')

      const callArgs = requestMock.mock.calls[0][0] as any
      expect(callArgs.headers['X-Custom']).toBe('value')
    })
  })

  describe('API.get', () => {
    it('should get single item by id', async () => {
      const mockResponse = { data: { id: '1', name: 'test' }, headers: {} }
      requestMock.mockResolvedValue(mockResponse as any)

      const api = createAPI({ resource: 'test' })
      const result = await api.get('1')

      expect(result).toEqual({ id: '1', name: 'test' })
    })

    it('should get without id', async () => {
      const mockResponse = { data: { items: [] }, headers: {} }
      requestMock.mockResolvedValue(mockResponse as any)

      const api = createAPI({ resource: 'test' })
      const result = await api.get()

      expect(result).toEqual(expect.objectContaining({ items: [] }))
    })
  })

  describe('API.query', () => {
    it('should query with filter', async () => {
      const mockResponse = { data: [{ id: 1 }], headers: { count: 1 } }
      requestMock.mockResolvedValue(mockResponse as any)

      const api = createAPI({ resource: 'test' })
      const result = await api.query({ name: 'test' })

      expect(result.items).toEqual([{ id: 1 }])
      expect(result.total).toBe(1)
    })

    it('should query with empty filter', async () => {
      const mockResponse = { data: [], headers: {} }
      requestMock.mockResolvedValue(mockResponse as any)

      const api = createAPI({ resource: 'test' })
      const result = await api.query()

      expect(result.items).toEqual([])
      expect(result.total).toBe(0)
    })
  })

  describe('API.save', () => {
    it('should save new item', async () => {
      const mockResponse = { data: { id: '1', name: 'new' }, headers: {} }
      requestMock.mockResolvedValue(mockResponse as any)

      const api = createAPI({ resource: 'test' })
      const result = await api.save({ name: 'new' })

      expect(result).toEqual({ id: '1', name: 'new' })
    })

    it('should save existing item', async () => {
      const mockResponse = { data: { id: '1' }, headers: {} }
      requestMock.mockResolvedValue(mockResponse as any)

      const api = createAPI({ resource: 'test' })
      const result = await api.save({ id: '1', name: 'updated' })

      expect(result).toEqual({ id: '1', name: 'updated', InsertedID: '1' })
    })

    it('should save partial data', async () => {
      const mockResponse = { data: { id: '1' }, headers: {} }
      requestMock.mockResolvedValue(mockResponse as any)

      const api = createAPI({ resource: 'test' })
      const result = await api.save({ id: '1', name: 'updated' }, true)

      expect(result).toEqual({ id: '1', name: 'updated', InsertedID: '1' })
    })
  })

  describe('API.delete', () => {
    it('should delete item by id', async () => {
      const mockResponse = { data: { success: true }, headers: {} }
      requestMock.mockResolvedValue(mockResponse as any)

      const api = createAPI({ resource: 'test' })
      const result = await api.delete('1')

      expect(result).toEqual({ success: true, id: '1' })
    })

    it('should delete without id', async () => {
      const mockResponse = { data: { success: true }, headers: {} }
      requestMock.mockResolvedValue(mockResponse as any)

      const api = createAPI({ resource: 'test' })
      const result = await api.delete()

      expect(result).toEqual({ success: true, id: '' })
    })
  })

  describe('API.convert_format', () => {
    it('should convert datetime format', () => {
      const api = createAPI({ resource: 'test' })
      const result = api.convert_format('2024-01-15T10:30:00Z', { format: 'datetime' })

      expect(result).toContain('2024-01-15')
      expect(result).toContain(':')
    })

    it('should convert date format', () => {
      const api = createAPI({ resource: 'test' })
      const result = api.convert_format('2024-01-15T10:30:00Z', { format: 'date' })

      expect(result).toBe('2024-01-15')
    })

    it('should convert array format', () => {
      const api = createAPI({ resource: 'test' })
      const result = api.convert_format([{ name: 'test' }], {
        type: 'array',
        items: { format: 'datetime' }
      })

      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('API.convert_item', () => {
    it('should convert item using properties', () => {
      const api = createAPI({
        resource: 'test',
        type: 'object',
        properties: {
          date: { format: 'date' },
          name: {}
        }
      })

      const result = api.convert_item({ date: '2024-01-15T10:30:00Z', name: 'test' })

      expect(result.date).toBe('2024-01-15')
      expect(result.name).toBe('test')
    })
  })

  describe('API.convert_where', () => {
    it('should convert where clause', () => {
      const api = createAPI({ resource: 'test' })
      const result = api.convert_where({ param_filter: { name: 'test' } })

      expect(result).toBeDefined()
    })

    it('should convert empty where clause', () => {
      const api = createAPI({ resource: 'test' })
      const result = api.convert_where({})

      expect(result).toEqual({})
    })
  })

  describe('API.count', () => {
    it('should return count', async () => {
      const mockResponse = { data: { count: 2 }, headers: {} }
      requestMock.mockResolvedValue(mockResponse as any)

      const api = createAPI({ resource: 'test' })
      const count = await api.count()

      expect(count).toBe(2)
    })
  })
})
