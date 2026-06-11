# 表数据（`core/t/{tableId}/d`）

> 中台创建的数据表的记录 CRUD。所有字段都可用于过滤。

**⚠️ resource 必须加 `/d` 后缀：** `core/t/{tableId}/d`（不是 `core/t/{tableId}`）

```typescript
import { createHttpClient, createResourceClient } from '@kesi/client'

const client = createHttpClient({ resource: 'core/t/hvac_system/d' })
const tableApi = createResourceClient<Record>({ client, resource: 'core/t/hvac_system/d' })
```

## 系统注入字段

每条记录自动携带以下系统字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 记录 ID |
| `_table` | string | 所属表 ID |
| `_title` | string | 所属表标题 |
| `_department` | object | 所属组织 |
| `createTime` | string | 创建时间 |
| `updateTime` | string | 更新时间 |
| `creator` | object | 创建人 `{id, name}` |
| `modifier` | object | 修改人 `{id, name}` |
| `editPermission` | boolean | 编辑权限 |
| `deletePermission` | boolean | 删除权限 |

用户自定义字段通过 schema 的 `properties` 定义，查询时与系统字段一起返回。

## 设备表预设字段

设备表（`template: "device"`）额外包含 7 个预设字段：

| key | type | 说明 |
|-----|------|------|
| `id` | string | 设备编号 |
| `name` | string | 设备名称 |
| `connectTime` | string | 最后通信时间 |
| `disable` | boolean | 是否禁用 |
| `online` | boolean | 在线状态 |
| `off` | boolean | 断电状态 |
| `warnFlag` | boolean | 报警状态 |

设备表还有 `_settings`（设备配置对象）。

## CRUD 示例

```typescript
// 列表查询（所有 schema 字段都可用于过滤）
const { items, total } = await tableApi.query({ limit: 50 })

// 条件过滤
const { items } = await tableApi.query(
  { limit: 50 },
  { name: { $regex: '空调' } }
)

// 设备表：查询在线设备
const { items } = await tableApi.query(
  { limit: 50 },
  { online: { $eq: true } }
)

// 设备表：组合过滤
const { items } = await tableApi.query(
  { limit: 50 },
  { $and: [{ online: { $eq: true } }, { disable: { $ne: true } }] }
)

// 排序 + 分页
const { items } = await tableApi.query(
  { skip: 20, limit: 10, order: { createTime: 'DESC' } }
)

// 获取单条
const item = await tableApi.get('record-001')

// 创建
const created = await tableApi.save({ name: '新设备', building: 'A栋' })

// 更新
const updated = await tableApi.save({ id: 'record-001', name: '更新名称' })

// 部分更新
await tableApi.save({ id: 'record-001', status: 'offline' }, true)

// 删除
await tableApi.delete('record-001')

// 计数
const count = await tableApi.count({ online: { $eq: true } })
```
