# HTTP 模块

> 新版 HTTP 客户端，用于 skill 生成的前端项目。自动处理 token、projectId、timezone、language 等基础设施。

## 核心概念

两层分离：

- **`createHttpClient`** — 基础 HTTP 客户端，处理 headers/token/projectId/timezone/language/safeRequest/error
- **`createResourceClient`** — 通用 CRUD 封装，提供 query/get/save/delete/count

```typescript
import { createHttpClient, createResourceClient } from '@kesi/client'
```

---

## 创建 HTTP 客户端

```typescript
import { createHttpClient } from '@kesi/client'

const client = createHttpClient({
  resource: 'core/t/energy_meter/d',  // 资源路径（必填）
  baseURL: '/rest/',                  // 基础 URL（默认取配置）
  proxyKey: '/api/',                  // 覆盖 baseURL（优先级最高）
  defaultHeaders: {},                 // 每次请求附加的默认 headers
  noToken: ['my/public/endpoint'],    // 追加不需要 token 的资源
  noGetToken: ['my/polling/endpoint'],// GET 请求不需要 token 的资源
  safeRequest: false,                 // 是否启用安全请求模式
})
```

### 原始请求

```typescript
// GET
const res = await client.request<User[]>('')

// POST
const res = await client.request('', {
  method: 'POST',
  body: { name: 'test' },  // 自动 JSON.stringify
})

// 响应格式
res.data    // T
res.status  // number
res.headers // Record<string, string>
```

### 自动处理的基础设施

客户端每次请求自动注入：

| Header | 来源 |
|--------|------|
| `Authorization` | `getConfig().user.token`（noToken/noGetToken 列表中的资源自动跳过） |
| `x-request-project` | URL `_p_XXX` 路径段 或 `getConfig().projectId` |
| `X-Request-TimeZone` | 浏览器时区偏移，如 `+08:00` |
| `Accept-Language` | `getConfig().language` |
| `Content-Type` | `application/json` |

### 安全请求模式

启用后自动转换 HTTP 方法（某些代理环境不支持 DELETE/PUT/PATCH）：

| 原始方法 | 实际发送 | 附加 Header |
|----------|---------|-------------|
| DELETE | GET | `x-request-http-method: DELETE` |
| PUT | POST | `x-request-http-method: PUT` |
| PATCH | POST | `x-request-http-method: PATCH` |

---

## 创建资源客户端（CRUD）

```typescript
import { createHttpClient, createResourceClient } from '@kesi/client'

// 1. 创建 HTTP 客户端
const client = createHttpClient({ resource: 'core/t/energy_meter/d' })

// 2. 创建资源客户端（绑定类型）
interface EnergyMeter {
  id?: string
  name?: string
  status?: string
}

const meterApi = createResourceClient<EnergyMeter>({
  client,
  resource: 'core/t/energy_meter/d',
  idField: 'id',  // 可选，默认 'id'
})
```

---

## 查询数据

```typescript
// 分页查询
const { items, total } = await meterApi.query({
  skip: 0,
  limit: 20,
  order: { name: 'ASC' },
})

// 条件过滤（where 对象直接透传给后端）
const { items } = await meterApi.query(
  { limit: 10 },
  { status: { $eq: 'online' } }
)

// 字段投影
const { items } = await meterApi.query({
  fields: ['id', 'name', 'status'],
})

// 组合使用
const { items, total } = await meterApi.query(
  { skip: 0, limit: 20, order: { createdAt: 'DESC' }, fields: ['id', 'name'] },
  { status: { $in: ['online', 'idle'] }, type: { $regex: 'sensor' } }
)
```

**QueryFilter 类型：**

```typescript
interface QueryFilter {
  order?: Record<string, 'ASC' | 'DESC'>  // 排序
  skip?: number                            // 跳过数量
  limit?: number                           // 限制数量
  groupBy?: string                         // 分组字段
  fields?: string[]                        // 投影字段
}
```

### ⚠️ 字段投影规则（必读）

后端默认只按 `tableSchema` 投影，不加投影参数会导致自定义字段丢失。`createResourceClient` 的行为：

| filter.fields | SDK 自动行为 | 适用场景 |
|---------------|------------|---------|
| 传值 `['id','name',...]` | 转 `project: {field:1}`，按指定字段投影 | **平台资源**（user/role/log/driver/catalog 等，字段固定） |
| 不传 | 自动注入 `projectAll: true`，返回所有字段 | **自定义表** `core/t/{tableId}/d`（字段由 schema 动态定义） |

**生成代码时遵守：**
- 自定义表查询 **不要传 fields** —— 字段动态无法穷举，依赖默认 projectAll
- 平台资源查询 **必须传 fields** —— 字段固定，显式列出更安全（字段表见 `references/platform/*.md`）
- 切勿给自定义表传"不完整"的 fields，会静默丢字段

**过滤操作符：** `$eq`、`$ne`、`$gt`、`$gte`、`$lt`、`$lte`、`$regex`、`$in`、`$nin`、`$and`、`$or`

---

## CRUD 操作

```typescript
// 获取单条
const meter = await meterApi.get('meter-001')

// 创建（无 id → POST）
const created = await meterApi.save({ name: 'New Meter' })
// created.id 是后端返回的 InsertedID

// 更新（有 id → PUT）
const updated = await meterApi.save({ id: 'meter-001', name: 'Updated' })

// 部分更新（partial=true → PATCH）
await meterApi.save({ id: 'meter-001', status: 'offline' }, true)

// 删除
await meterApi.delete('meter-001')

// 计数
const count = await meterApi.count({ status: { $eq: 'online' } })
```

---

## 自定义操作（raw）

不属于标准 CRUD 的操作，使用 `raw()` 直接调用底层 HTTP 客户端：

```typescript
// 批量操作
await meterApi.raw('/batch-update', {
  method: 'POST',
  body: { ids: ['1', '2', '3'], status: 'offline' },
})

// 调用子资源
const stats = await meterApi.raw<Stats>('/meter-001/statistics')

// 或直接用 client
const res = await client.request('/custom-endpoint', {
  method: 'POST',
  body: { data: 'value' },
})
```

---

## 平台资源查询

KESI 平台内置 63+ 个资源端点，都可以用 `createResourceClient` 直接查询：

```typescript
// 用户管理
const userClient = createHttpClient({ resource: 'core/user' })
const userApi = createResourceClient<{ id?: string; name?: string }>({ client: userClient, resource: 'core/user' })
const { items: users } = await userApi.query({ limit: 10 })

// 角色管理
const roleApi = createResourceClient<Role>({ client: createHttpClient({ resource: 'core/role' }), resource: 'core/role' })

// 数据字典
const varApi = createResourceClient<SystemVar>({ client: createHttpClient({ resource: 'core/systemVariable' }), resource: 'core/systemVariable' })

// 表 Schema
const schemaApi = createResourceClient<TableSchema>({ client: createHttpClient({ resource: 'core/t/schema' }), resource: 'core/t/schema' })

// 报警事件
const warningApi = createResourceClient<Warning>({ client: createHttpClient({ resource: 'warning/warning' }), resource: 'warning/warning' })

// 操作日志
const logApi = createResourceClient<Log>({ client: createHttpClient({ resource: 'core/log' }), resource: 'core/log' })

// 驱动实例
const driverApi = createResourceClient<Driver>({ client: createHttpClient({ resource: 'driver/driverInstance' }), resource: 'driver/driverInstance' })
```

**常用平台资源路径：**

| 资源路径 | 说明 |
|----------|------|
| `core/user` | 用户管理 |
| `core/role` | 角色管理 |
| `core/systemVariable` | 数据字典 |
| `core/t/schema` | 数据表定义 |
| `core/log` | 操作日志 |
| `core/department` | 组织架构 |
| `driver/driverInstance` | 驱动实例 |
| `warning/warning` | 报警事件 |
| `warning/warning/archive` | 报警归档 |
| `warning/rule` | 报警规则 |
| `core/catalog` | 数据分组 |

---

## 设备数据查询

### 获取最新数据点值（初始化拉取）

页面加载时先拉一次最新值，再让 hooks 接管实时更新：

```typescript
// POST core/data/latest — 批量获取最新数据点值
const dataClient = createHttpClient({ resource: 'core/data' })
const res = await dataClient.request<Array<{ tableId: string; tableDataId: string; tagId: string; time: string; value: unknown }>>(
  '/latest',
  {
    method: 'POST',
    body: [
      { tableId: 'hvac_system', id: 'hvac_001', tagId: 'temperature' },
      { tableId: 'hvac_system', id: 'hvac_001', tagId: 'humidity' },
      { tableId: 'energy_meter', id: 'meter_001', tagId: 'power' },
    ],
  }
)
// res.data 是数组，每项：{ tableId, tableDataId(或id), tagId, time, value }
// 用 `${tableId}|${tableDataId}|${tagId}` 做 key 映射
```

### 历史趋势查询

**⚠️ 重要：`core/data/query` 接口需要传数组，不是单个对象。**

```typescript
// POST core/data/query — 历史趋势数据（注意：body 是数组！）
const queryClient = createHttpClient({ resource: 'core/data/query' })
const res = await queryClient.request('', {
  method: 'POST',
  body: [
    {
      tableId: 'energy_meter',                          // 表 ID
      tags: [`LAST("power") AS "power"`, 'id'],        // SQL 表达式 + id 字段
      id: 'meter_001',                                  // 设备 ID
      where: [`time <= '${new Date().toISOString()}'`], // 时间条件
    },
  ],
})
// res.data.results — 数组，每项有 series[{name, columns, values}]
// values[0] = time, values[1] = 数据值, values[2] = 设备 id
// columns[1] = tagId
```

### 获取设备字段初始值

```typescript
// GET core/t/<tableId>/d/<dataId> — 获取单条设备记录（含 online、warnFlag 等字段）
const client = createHttpClient({ resource: 'core/t/hvac_system/d/hvac_001' })
const res = await client.request<Record<string, unknown>>('')
// res.data = { id, name, online, warnFlag, disable, ... }
```

---

## 按领域模块组织

推荐按 Apifox 的模块划分，每个模块独立文件：

```typescript
// data/api/tables.ts — 表数据
const client = createHttpClient({ resource: 'core/t' })
export const createTableApi = <T extends { id?: string }>(tableId: string) =>
  createResourceClient<T>({ client, resource: `core/t/${tableId}/d` })

// data/api/alarms.ts — 报警
const alarmClient = createHttpClient({ resource: 'core/alarm' })
export const alarmApi = createResourceClient<Alarm>({
  client: alarmClient,
  resource: 'core/alarm',
})
export const confirmAlarm = (ids: string[]) =>
  alarmClient.request('/confirm-all', { method: 'POST', body: { ids } })

// data/api/logs.ts — 日志
const logClient = createHttpClient({ resource: 'engine/log/job' })
export const logApi = createResourceClient<JobLog>({
  client: logClient,
  resource: 'engine/log/job',
})
```

---

## 错误处理

所有错误统一为 `{ data, status }` 格式：

```typescript
try {
  const item = await meterApi.get('invalid-id')
} catch (err) {
  // err.data — 错误响应体（或 { _error: message })
  // err.status — HTTP 状态码（网络错误为 0）
}
```
