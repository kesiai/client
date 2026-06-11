/**
 * HTTP 模块类型定义
 *
 * 新版 HTTP 客户端，给 skill 生成的前端项目使用。
 * 与旧版 createAPI 并行存在，不互相依赖。
 */

// ---- 基础客户端配置 ----

/** 创建 HttpClient 实例的配置 */
export interface HttpClientConfig {
  /** 基础 URL 前缀。默认取 getConfig().rest 或 '/rest/' */
  baseURL?: string

  /**
   * 代理键，覆盖 baseURL 和 getConfig().rest。
   * 优先级：proxyKey > baseURL > getConfig().rest > '/rest/'
   */
  proxyKey?: string

  /** 每次请求都会合并的默认 headers */
  defaultHeaders?: Record<string, string>

  /**
   * 追加到内置 noToken 列表的资源路径。
   * 这些资源在任何 HTTP 方法下都不会附加 Authorization header。
   */
  noToken?: string[]

  /**
   * 追加到内置 noGetToken 列表的资源路径。
   * 这些资源仅在 GET 请求时不附加 Authorization header。
   */
  noGetToken?: string[]

  /**
   * 是否启用安全请求模式。
   * 启用后 DELETE→GET、PUT/PATCH→POST，原始方法通过 header 传递。
   * 默认取 getConfig().settings.safeRequest
   */
  safeRequest?: boolean
}

// ---- 请求选项 ----

/** 单次请求的配置，可覆盖客户端级别的默认值 */
export interface RequestOptions {
  /** HTTP 方法 */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

  /** 请求体（自动 JSON.stringify，不需要调用方手动转换） */
  body?: unknown

  /** 本次请求的额外 headers（会覆盖客户端默认 headers） */
  headers?: Record<string, string>

  /** URL 查询参数 */
  params?: Record<string, string>

  /** AbortSignal，用于请求取消 */
  signal?: AbortSignal
}

// ---- 响应 ----

/** 统一的 HTTP 响应格式 */
export interface ApiResponse<T = unknown> {
  /** 解析后的响应体 */
  data: T
  /** HTTP 状态码 */
  status: number
  /** 响应 headers（小写 key） */
  headers: Record<string, string>
}

/** HTTP 错误 */
export interface HttpError {
  /** 错误响应体 */
  data: unknown
  /** HTTP 状态码，网络错误时为 0 */
  status: number
}

// ---- 查询/分页 ----

/** 排序方向 */
export type SortDirection = 'ASC' | 'DESC'

/** 查询过滤条件 */
export interface QueryFilter {
  /** 排序：字段名 → 方向 */
  order?: Record<string, SortDirection>
  /** 跳过记录数（分页偏移） */
  skip?: number
  /** 返回记录数上限 */
  limit?: number
  /** 分组字段 */
  groupBy?: string
  /** 字段投影：只返回指定字段 */
  fields?: string[]
}

/** 分页响应 */
export interface PagedResponse<T> {
  items: T[]
  total: number
}

// ---- 资源客户端 ----

/** 创建 ResourceClient 的配置 */
export interface ResourceConfig<T extends { id?: string } = { id?: string }> {
  /** HTTP 客户端实例 */
  client: HttpClient
  /** 资源路径，如 'core/t/energy_meter/d' */
  resource: string
  /** ID 字段名，默认 'id' */
  idField?: keyof T & string
}

// ---- 客户端接口 ----

/** 基础 HTTP 客户端接口 */
export interface HttpClient {
  /** 资源路径 */
  readonly resource: string
  /** 基础 URL */
  readonly baseURL: string

  /**
   * 发送 HTTP 请求。
   * 自动处理 token/projectId/timezone/language/safeRequest。
   */
  request<T = unknown>(uri: string, options?: RequestOptions): Promise<ApiResponse<T>>
}

/** 资源客户端接口（通用 CRUD） */
export interface ResourceClient<T extends { id?: string }> {
  /** 底层 HTTP 客户端 */
  readonly client: HttpClient
  /** 资源路径 */
  readonly resource: string

  /** 分页查询 */
  query(filter?: QueryFilter, where?: Record<string, unknown>): Promise<PagedResponse<T>>
  /** 获取单条数据 */
  get(id: string, options?: RequestOptions): Promise<T>
  /** 创建或更新（有 id → PUT/PATCH，无 id → POST） */
  save(data: Partial<T>, partial?: boolean): Promise<T>
  /** 删除 */
  delete(id: string): Promise<void>
  /** 计数 */
  count(where?: Record<string, unknown>): Promise<number>
  /** 原始请求（用于非 CRUD 操作） */
  raw<TResponse = unknown>(uri: string, options?: RequestOptions): Promise<ApiResponse<TResponse>>
}
