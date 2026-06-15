# 其他系统资源

> 数据分组、报表、数据接口等。平台资源字段固定，查询时必须显式传 `fields`。

## 数据分组（`core/catalog`）

```typescript
const client = createHttpClient({ resource: 'core/catalog' })
const catalogApi = createResourceClient<Catalog>({ client, resource: 'core/catalog' })
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 分组 ID |
| `name` | string | 分组名称 |
| `parentId` | string | 父分组 ID |
| `parent` | object | 父分组对象 |
| `order` | number | 排序 |
| `description` | string | 描述 |

### 查询示例

```typescript
const CATALOG_FIELDS = ['id', 'name', 'parentId', 'parent', 'order', 'description']

// 列表
const { items } = await catalogApi.query({ limit: 50, fields: CATALOG_FIELDS })

// 按父分组过滤
const { items } = await catalogApi.query({ limit: 50, fields: CATALOG_FIELDS }, { parentId: { $eq: 'root' } })
```

## 报表（`report/report`）

```typescript
const client = createHttpClient({ resource: 'report/report' })
const reportApi = createResourceClient<Report>({ client, resource: 'report/report' })
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 报表 ID |
| `name` | string | 报表名称 |
| `reportType` | string | 类型：`normal`/`free` |
| `tableInfo` | object | 设备表 |
| `type` | string | 统计类型：`time`/`node` |
| `interval` | string | 统计周期：`hours`/`days`/`weeks`/`months`/`years` |

### 查询示例

```typescript
const REPORT_FIELDS = ['id', 'name', 'reportType', 'tableInfo', 'type', 'interval']

// 列表
const { items } = await reportApi.query({ limit: 50, fields: REPORT_FIELDS })

// 按统计类型过滤
const { items } = await reportApi.query({ limit: 50, fields: REPORT_FIELDS }, { type: { $eq: 'time' } })
```

## 数据接口（`ds/interface`）

```typescript
const client = createHttpClient({ resource: 'ds/interface' })
const interfaceApi = createResourceClient<Interface>({ client, resource: 'ds/interface' })
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 接口 ID |
| `dataGroup` | object | 所属分组 `{id, name, type}` |
| `key` | string | 接口标识 |
| `name` | string | 接口名称 |
| `setting` | object | 接口配置 |

### 查询示例

```typescript
const INTERFACE_FIELDS = ['id', 'dataGroup', 'key', 'name', 'setting']

// 列表
const { items } = await interfaceApi.query({ limit: 50, fields: INTERFACE_FIELDS })

// 按标识模糊搜索
const { items } = await interfaceApi.query({ limit: 50, fields: INTERFACE_FIELDS }, { key: { $regex: 'sensor' } })
```
