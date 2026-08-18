# HTTP 模块

> `@kesi/client` 的 HTTP 客户端，用于 skill 生成的前端项目。自动处理 token、projectId、timezone、language 等基础设施。

## 核心概念

一个入口工厂 `createAPI`，直接返回带 CRUD 能力的 Model API 实例：

- **`createAPI`**（别名 `api`）— 创建 Model API 实例：`fetch/query/get/getOrigin/delete/save/count`，同时处理 headers/token/projectId/timezone/language/safeRequest/error
- **`createHttp`**（别名 `createAxios`）— 只要裸 HTTP 时使用，返回配置好拦截器的 axios 实例（`AxiosInstance`）

```typescript
import { createAPI, createHttp } from '@kesi/client'
```

---

## 创建 Model API 实例

```typescript
import { createAPI } from '@kesi/client'

const meterApi = createAPI({
  resource: 'core/t/energy_meter/d', // 资源路径（必填；以 'auth' 开头会自动加 'core/' 前缀）
  proxyKey: '/api/',                  // 覆盖 baseURL（优先级最高，默认取 getConfig().rest）
  ignoreAuthorization: true,          // 该资源所有请求不携带 Authorization（登录/注册/公开接口）
  idProp: 'id',                       // 可选，记录主键字段（默认 '_id' → 'id'）
  projectAll: true,                   // 查询时注入 projectAll: true，返回所有字段（自定义表用）
  projectFields: ['id', 'name'],      // 查询时固定投影这些字段
})
```

### 原始请求（fetch）

`fetch` 是统一出口，任何非标准 CRUD 操作都走它：

```typescript
// GET — uri 相对 resource 拼接
const res = await meterApi.fetch('')
// res.data    — 响应体
// res.json    — res.data 的别名
// res.status  — number
// res.headers — AxiosHeaders

// POST — 请求体放 data
const res = await meterApi.fetch('/batch-update', {
  method: 'POST',
  data: { ids: ['1', '2', '3'] },
})

// 带查询参数
const res = await meterApi.fetch('', { params: { query: JSON.stringify({...}) } })

// 单次请求跳过 token
const res = await meterApi.fetch('', { ignoreAuthorization: true })
```

### 裸 axios 实例（createHttp）

需要 axios 全部能力（拦截器、并发等）时：

```typescript
import { createHttp } from '@kesi/client'

const http = createHttp({ resource: 'core/user' })
const res = await http.request({ url: '', method: 'GET', params: { limit: 10 } })
// resource 前缀和默认 headers 由请求拦截器注入
```

### 自动处理的基础设施

实例每次请求自动注入：

| Header | 来源 |
|--------|------|
| `Authorization` | `getConfig().user.token`（`ignoreAuthorization: true` 时跳过） |
| `x-request-project` | URL `_p_XXX` 路径段 或 `getConfig().projectId` |
| `X-Request-TimeZone` | 浏览器时区偏移，如 `+08:00` |
| `Accept-Language` | `getConfig().language` |
| `Content-Type` | `application/json` |

### 安全请求模式

由 `getConfig().settings.safeRequest` 全局开启。开启后自动转换 HTTP 方法（某些代理环境不支持 DELETE/PUT/PATCH）：

| 原始方法 | 实际发送 | 附加 Header |
|----------|---------|-------------|
| DELETE | GET | `x-request-http-method: DELETE` |
| PUT | POST | `x-request-http-method: PUT` |
| PATCH | POST | `x-request-http-method: PATCH` |

---

## 查询数据

```typescript
// 分页查询
const { items, total } = await meterApi.query({
  skip: 0,
  limit: 20,
  order: { name: 'ASC' },
})

// 条件过滤（wheres 转换为 filter 参数）
const { items } = await meterApi.query(
  { limit: 10 },
  { status: { $eq: 'online' } }
)

// 字段投影（也可在 createAPI 时用 projectFields 固定）
const { items } = await meterApi.query({
  fields: ['id', 'name', 'status'],
})

// 组合使用
const { items, total } = await meterApi.query(
  { skip: 0, limit: 20, order: { createdAt: 'DESC' }, fields: ['id', 'name'] },
  { status: { $in: ['online', 'idle'] }, type: { $regex: 'sensor' } }
)

// 不要 total 时（略快）
const { items } = await meterApi.query({ limit: 10 }, {}, false)
```

**QueryFilter 类型：**

```typescript
interface QueryOptions {
  order?: Record<string, 'ASC' | 'DESC'>  // 排序
  skip?: number                            // 跳过数量
  limit?: number                           // 限制数量
  groupBy?: string                         // 分组字段
  fields?: string[]                        // 投影字段
}
```

### ⚠️ 字段投影规则（必读）

后端默认只按 `tableSchema` 投影，不加投影参数会导致自定义字段丢失。投影在 **createAPI 时**声明（`projectAll` / `projectFields`），查询时传 `fields` 追加：

| 创建选项 | 行为 | 适用场景 |
|---------------|------------|---------|
| `projectAll: true` | 注入 `projectAll: true`，返回所有字段 | **自定义表** `core/t/{tableId}/d`（字段由 schema 动态定义） |
| `projectFields: ['id','name',...]` | 转 `project: {field:1}`，按指定字段投影 | **平台资源**（user/role/log/driver/catalog 等，字段固定） |

**生成代码时遵守：**
- 自定义表的 API 实例 **创建时传 `projectAll: true`**，查询时不传 fields —— 字段动态无法穷举
- 平台资源的 API 实例 **创建时传 `projectFields`**（或查询时传 fields）—— 字段固定，显式列出更安全（字段表见 `references/platform/*.md`）
- 切勿给自定义表传"不完整"的 fields，会静默丢字段

**过滤操作符：** `$eq`、`$ne`、`$gt`、`$gte`、`$lt`、`$lte`、`$regex`、`$in`、`$nin`、`$and`、`$or`

---

## CRUD 操作

```typescript
// 获取单条
const meter = await meterApi.get('meter-001')

// 获取单条（原始响应，不做 convert_item 转换）
const raw = await meterApi.getOrigin('meter-001')

// 创建（无 id → POST）
const created = await meterApi.save({ name: 'New Meter' })
// created.id 是后端返回的 InsertedID

// 更新（有 id → PUT）
const updated = await meterApi.save({ id: 'meter-001', name: 'Updated' })

// 部分更新（partial=true → PATCH）
await meterApi.save({ id: 'meter-001', status: 'offline' }, true)

// 删除
await meterApi.delete('meter-001')

// 计数（注意：条件包在 where 里）
const count = await meterApi.count({ where: { status: 'online' } })
```

---

## 自定义操作

不属于标准 CRUD 的操作，直接用 `fetch`：

```typescript
// 批量操作
await meterApi.fetch('/batch-update', {
  method: 'POST',
  data: { ids: ['1', '2', '3'], status: 'offline' },
})

// 调用子资源
const stats = await meterApi.fetch('/meter-001/statistics')
// stats.data 即 Stats 载荷
```

---

## 平台资源查询

KESI 平台内置 63+ 个资源端点，都可以用 `createAPI` 直接查询：

```typescript
// 用户管理
const userApi = createAPI({ resource: 'core/user', projectFields: ['id', 'name'] })
const { items: users } = await userApi.query({ limit: 10 })

// 角色管理
const roleApi = createAPI({ resource: 'core/role' })

// 数据字典
const varApi = createAPI({ resource: 'core/systemVariable' })

// 表 Schema
const schemaApi = createAPI({ resource: 'core/t/schema' })

// 报警事件
const warningApi = createAPI({ resource: 'warning/warning' })

// 操作日志
const logApi = createAPI({ resource: 'core/log' })

// 驱动实例
const driverApi = createAPI({ resource: 'driver/driverInstance' })
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
const dataApi = createAPI({ resource: 'core/data' })
const res = await dataApi.fetch(
  '/latest',
  {
    method: 'POST',
    data: [
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
// POST core/data/query — 历史趋势数据（注意：data 是数组！）
const queryApi = createAPI({ resource: 'core/data/query' })
const res = await queryApi.fetch('', {
  method: 'POST',
  data: [
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
const deviceApi = createAPI({ resource: 'core/t/hvac_system/d/hvac_001' })
const res = await deviceApi.fetch('')
// res.data = { id, name, online, warnFlag, disable, ... }
```

---

## 按领域模块组织

推荐按 Apifox 的模块划分，每个模块独立文件：

```typescript
// data/api/tables.ts — 表数据
export const createTableApi = (tableId: string) =>
  createAPI({ resource: `core/t/${tableId}/d`, projectAll: true })

// data/api/alarms.ts — 报警
export const alarmApi = createAPI({ resource: 'core/alarm' })
export const confirmAlarm = (ids: string[]) =>
  alarmApi.fetch('/confirm-all', { method: 'POST', data: { ids } })

// data/api/logs.ts — 日志
export const logApi = createAPI({ resource: 'engine/log/job' })
```

---

## 错误处理

`fetch` 失败抛出 AxiosError（附加 `json` 字段），CRUD 方法同样透传：

```typescript
try {
  const item = await meterApi.get('invalid-id')
} catch (err: any) {
  // err.response.data — 错误响应体（err.json 是它的别名，网络错误时为 { _error: message }）
  // err.response.status — HTTP 状态码
}
```
