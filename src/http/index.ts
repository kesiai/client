/**
 * HTTP 模块统一导出
 *
 * 新版 HTTP 客户端，给 skill 生成的前端项目使用。
 * 与旧版 createAPI (src/api/) 并行存在。
 */

// 类型
export type {
  HttpClientConfig,
  RequestOptions,
  ApiResponse,
  HttpError,
  SortDirection,
  QueryFilter,
  PagedResponse,
  ResourceConfig,
} from './types'

// 客户端
export { createHttpClient } from './client'

// 资源客户端
export { createResourceClient } from './resource'

// 接口类型（用于类型标注）
export type { HttpClient, ResourceClient } from './types'
