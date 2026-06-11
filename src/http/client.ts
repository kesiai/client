/**
 * 基础 HTTP 客户端
 *
 * 纯 HTTP 层，自动处理：
 * - Auth token 注入（含 noToken/noGetToken 排除列表）
 * - Project ID 注入（URL _p_XXX 路径 或 getConfig().projectId）
 * - Timezone header（X-Request-TimeZone）
 * - Language header（Accept-Language）
 * - safeRequest 方法伪装（DELETE→GET, PUT/PATCH→POST）
 * - 错误归一化（axios error → { data, status }）
 */

import axios, { type AxiosRequestConfig } from 'axios'
import { getConfig } from '../config'
import { noToken as defaultNoToken, noGetToken as defaultNoGetToken } from '../api/noToken'
import type {
  HttpClientConfig,
  RequestOptions,
  ApiResponse,
  HttpError,
} from './types'

// ---- 工具函数 ----

/** 获取时区偏移字符串，如 "+08:00"、"-05:00" */
function getTimezoneOffset(): string {
  const offset = new Date().getTimezoneOffset()
  const absOffset = Math.abs(offset)
  const hours = String(Math.floor(absOffset / 60)).padStart(2, '0')
  const minutes = String(absOffset % 60).padStart(2, '0')
  const sign = offset <= 0 ? '+' : '-'
  return `${sign}${hours}:${minutes}`
}

/** 解析项目 ID：URL _p_XXX 段 > getConfig().projectId */
function resolveProjectId(): string | undefined {
  if (typeof location !== 'undefined') {
    const segment = location.pathname
      .split('/')
      .find((p) => p.startsWith('_p_'))
    if (segment) return segment.substring(3)
  }
  return getConfig().projectId as string | undefined
}

/** 解析基础 URL：proxyKey > baseURL > getConfig().rest > '/rest/' */
function resolveBaseURL(proxyKey?: string, baseURL?: string): string {
  if (proxyKey) return proxyKey
  if (baseURL) return baseURL
  return getConfig().rest || '/rest/'
}

/** 判断资源是否应跳过 token 注入 */
function shouldSkipToken(
  resource: string,
  method: string,
  noTokenList: string[],
  noGetTokenList: string[]
): boolean {
  if (noTokenList.includes(resource)) return true
  if (method === 'GET' && noGetTokenList.includes(resource)) return true
  return false
}

/** 是否为登录资源 */
function isLoginResource(resource: string): boolean {
  return resource.includes('/auth/login')
}

/** safeRequest 转换：DELETE→GET, PUT/PATCH→POST */
function applySafeRequest(
  method: string
): { method: string; originalMethod: string | null } {
  const overrideMethods = ['DELETE', 'PATCH', 'PUT']
  if (!overrideMethods.includes(method)) {
    return { method, originalMethod: null }
  }
  return {
    method: method === 'DELETE' ? 'GET' : 'POST',
    originalMethod: method,
  }
}

// ---- createHttpClient ----

/**
 * 创建 HTTP 客户端实例。
 *
 * @param config - 配置，resource 为必填
 * @returns HttpClient 实例
 *
 * @example
 * ```ts
 * const client = createHttpClient({ resource: 'core/t/energy_meter/d' })
 * const res = await client.request<User[]>('')
 * const res = await client.request('', { method: 'POST', body: { name: 'test' } })
 * ```
 */
export function createHttpClient(
  config: HttpClientConfig & { resource: string }
) {
  const resource = config.resource.startsWith('auth/')
    ? 'core/' + config.resource
    : config.resource

  const baseURL = resolveBaseURL(config.proxyKey, config.baseURL)

  // 合并 token 排除列表：内置默认 + 调用方追加
  const noTokenList = [...defaultNoToken(), ...(config.noToken ?? [])]
  const noGetTokenList = [...defaultNoGetToken(), ...(config.noGetToken ?? [])]

  /** safeRequest 模式：显式配置 > 全局 settings */
  const isSafeRequest = (): boolean => {
    if (config.safeRequest !== undefined) return config.safeRequest
    return getConfig().settings?.safeRequest ?? false
  }

  /** 构建每次请求的 headers */
  const buildHeaders = (
    method: string,
    requestHeaders?: Record<string, string>
  ): Record<string, string> => {
    const ctx = getConfig()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-TimeZone': getTimezoneOffset(),
      ...(config.defaultHeaders ?? {}),
    }

    // Auth token
    const skipToken = shouldSkipToken(resource, method, noTokenList, noGetTokenList)
    if (!skipToken && ctx.user?.token) {
      headers['Authorization'] = ctx.user.token
    }

    // 登录资源：去掉 Authorization
    if (isLoginResource(resource)) {
      delete headers['Authorization']
    }

    // Project ID
    const projectId = resolveProjectId()
    if (projectId) {
      headers['x-request-project'] = projectId
    }

    // Language
    if (ctx.language) {
      headers['Accept-Language'] = ctx.language
    }

    // 合并请求级别的 headers（可覆盖上面的默认值）
    if (requestHeaders) {
      for (const [k, v] of Object.entries(requestHeaders)) {
        if (k === 'Authorization' && isLoginResource(resource)) continue
        headers[k] = v
      }
    }

    // safeRequest：附加原始方法 header
    if (isSafeRequest()) {
      const { originalMethod } = applySafeRequest(method)
      if (originalMethod) {
        headers['x-request-http-method'] = originalMethod
      }
    }

    return headers
  }

  return {
    resource,
    baseURL,

    async request<T = unknown>(
      uri: string,
      options: RequestOptions = {}
    ): Promise<ApiResponse<T>> {
      const method = options.method ?? 'GET'
      const headers = buildHeaders(method, options.headers)

      // safeRequest 方法转换
      let actualMethod = method
      if (isSafeRequest()) {
        const transformed = applySafeRequest(method)
        actualMethod = transformed.method
      }

      // 构建 URL
      let url = baseURL + resource + uri
      if (options.params) {
        const qs = new URLSearchParams(options.params).toString()
        if (qs) url += (url.includes('?') ? '&' : '?') + qs
      }

      const axiosConfig: AxiosRequestConfig = {
        method: actualMethod,
        url,
        headers,
        data: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: options.signal,
      }

      try {
        const response = await axios(axiosConfig)
        return {
          data: response.data as T,
          status: response.status,
          headers: (response.headers ?? {}) as Record<string, string>,
        }
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          const httpError: HttpError = {
            data: error.response?.data ?? { _error: error.message },
            status: error.response?.status ?? 0,
          }
          throw httpError
        }
        throw {
          data: { _error: (error as Error).message },
          status: 0,
        } satisfies HttpError
      }
    },
  }
}
