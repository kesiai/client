# 其他系统资源

> 数据分组、报表、数据接口等。

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
