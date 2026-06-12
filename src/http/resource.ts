/**
 * 通用资源客户端（CRUD 封装）
 *
 * 基于 HttpClient 提供标准的增删改查操作。
 * 领域模块（表数据、报警、日志等）在此基础上构建。
 */

import type {
  HttpClient,
  RequestOptions,
  QueryFilter,
  PagedResponse,
  ResourceConfig,
  ApiResponse,
} from './types'

/**
 * 创建资源客户端实例。
 *
 * @param config - 资源配置
 * @returns ResourceClient 实例
 *
 * @example
 * ```ts
 * const client = createHttpClient({ resource: 'core/t/energy_meter/d' })
 * const api = createResourceClient<Meter>({ client, resource: 'core/t/energy_meter/d' })
 *
 * const { items, total } = await api.query({ limit: 20 })
 * const item = await api.get('123')
 * await api.save({ name: 'New' })
 * await api.save({ id: '123', name: 'Updated' })
 * await api.save({ id: '123', status: 'off' }, true) // PATCH
 * await api.delete('123')
 * const count = await api.count({ status: 'active' })
 * ```
 */
export function createResourceClient<T extends { id?: string }>(
  config: ResourceConfig<T>
) {
  const { client, resource, idField = 'id' } = config

  /** 处理单条数据：_id → id 归一化 */
  const processItem = (raw: Record<string, unknown>): T => {
    const item = { ...raw } as Record<string, unknown>
    // 当 idField 为 'id' 且数据有 _id 没有 id 时，自动转换
    if (idField === 'id' && raw._id !== undefined && raw.id === undefined) {
      item.id = raw._id
    }
    return item as T
  }

  return {
    client,
    resource,

    /** 分页查询 */
    async query(
      filter: QueryFilter = {},
      where?: Record<string, unknown>
    ): Promise<PagedResponse<T>> {
      const queryObj: Record<string, unknown> = {}

      // 分页
      if (filter.skip !== undefined) queryObj.skip = filter.skip
      if (filter.limit !== undefined) queryObj.limit = filter.limit

      // 排序
      if (filter.order && Object.keys(filter.order).length > 0) {
        const sort = Object.entries(filter.order).reduce(
          (acc, [field, dir]) => ({ ...acc, [field]: dir === 'ASC' ? 1 : -1 }),
          {} as Record<string, number>
        )
        queryObj.sort = sort
      }

      // 字段投影
      if (filter.fields && filter.fields.length > 0) {
        queryObj.project = filter.fields.reduce(
          (acc, f) => ({ ...acc, [f]: 1 }),
          {} as Record<string, number>
        )
      } else {
        // 未指定 fields 时，告诉后端返回所有字段
        queryObj.projectAll = true
      }

      // 分组
      if (filter.groupBy) {
        queryObj.groupBy = filter.groupBy
      }

      // where 过滤条件（调用方负责构建，直接透传）
      if (where && Object.keys(where).length > 0) {
        queryObj.filter = where
      }

      // 请求总数
      queryObj.withCount = true

      const filterString = encodeURIComponent(JSON.stringify(queryObj))
      const response = await client.request<T[]>(
        `?query=${filterString}`
      )

      const items = (Array.isArray(response.data) ? response.data : []).map(
        (raw) => processItem(raw as Record<string, unknown>)
      )

      const total = response.headers['count']
        ? Number(response.headers['count'])
        : items.length

      return { items, total }
    },

    /** 获取单条数据 */
    async get(id: string, options?: RequestOptions): Promise<T> {
      const response = await client.request<T>(`/${id}`, options)
      return processItem(response.data as Record<string, unknown>)
    },

    /** 创建或更新 */
    async save(data: Partial<T>, partial: boolean = false): Promise<T> {
      const body = { ...data }
      const hasId = body.id !== undefined && body.id !== null && body.id !== ''

      if (hasId) {
        // 更新
        const method = partial ? 'PATCH' : 'PUT'
        await client.request(`/${body.id}`, { method, body })
        return body as T
      } else {
        // 创建
        const response = await client.request<{ InsertedID?: string; id?: string }>(
          '',
          { method: 'POST', body }
        )
        return {
          ...body,
          id: response.data?.InsertedID || response.data?.id || body.id,
        } as T
      }
    },

    /** 删除 */
    async delete(id: string): Promise<void> {
      await client.request(`/${id}`, { method: 'DELETE' })
    },

    /** 计数 */
    async count(where: Record<string, unknown> = {}): Promise<number> {
      const filterString = encodeURIComponent(
        JSON.stringify({ where })
      )
      const response = await client.request<{ count: number }>(
        `/count?query=${filterString}`
      )
      return response.data.count
    },

    /** 原始请求（用于非 CRUD 操作） */
    raw<TResponse = unknown>(
      uri: string,
      options?: RequestOptions
    ): Promise<ApiResponse<TResponse>> {
      return client.request<TResponse>(uri, options)
    },
  }
}
