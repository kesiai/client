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

## ⚠️ 字段投影规则（重要）

表记录的字段是**动态的**——由该表的 schema（`properties`）定义，不同表字段完全不同，无法预先列举。因此：

- **表记录查询 `不要传 fields`**：依赖 SDK 默认行为自动加 `projectAll: true`，返回所有自定义字段。
- 后端默认只按 `tableSchema` 投影，若不加 `projectAll`（或显式 `fields`），自定义字段会丢失。
- `createResourceClient` 在 `filter.fields` 为空时**自动注入** `projectAll: true`（见 SDK 源码 `resource.ts`），所以**保持 filter 不带 fields 即可**，切勿传入不全的字段列表导致静默丢字段。

> 对比：`core/user`、`core/role`、`core/log`、`driver/driverInstance` 等平台资源字段是**固定**的，查询时应**显式传 `fields`**（见各自文档）。

## CRUD 示例

```typescript
// 列表查询（不传 fields，SDK 自动 projectAll 返回所有自定义字段）
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
