# 表 Schema（`core/t/schema`）

> 数据表定义的 CRUD。获取表结构、字段定义、设备配置。

```typescript
import { createHttpClient, createResourceClient } from '@kesi/client'

const client = createHttpClient({ resource: 'core/t/schema' })
const schemaApi = createResourceClient<TableSchema>({ client, resource: 'core/t/schema' })
```

## 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 表标识（存入数据库的名称） |
| `title` | string | 表名称（显示名称） |
| `description` | string | 描述 |
| `template` | string | 模版：`device`/`common`/`department`/`tableMapping`/`tableClasses`/`settable` |
| `function` | string[] | 表功能列表 |
| `showField` | string | 显示字段 |
| `catalog` | object | 所属分组 |
| `icon` | string | 图标 |
| `schema` | object | 表 Schema（含 properties/formSchema/tableSchema/filterSchema/fieldRules） |
| `device` | object | 设备配置（含 tags/commands/events，仅设备表） |
| `tableMajorType` | string | 表类型（后端注入）：`normal`/`device`/`dataAuth` |
| `fieldCount` | number | 字段数（后端注入） |
| `recordCount` | number | 记录数（后端注入） |
| `createTime` | string | 创建时间（后端注入） |
| `updateTime` | string | 更新时间（后端注入） |

## 查询示例

```typescript
// 查询所有表
const { items } = await schemaApi.query({ limit: 200 })

// 查询所有设备表
const { items } = await schemaApi.query({ limit: 100 }, { template: { $eq: 'device' } })

// 获取单张表完整 schema
const schema = await schemaApi.get('energy_meter')

// 获取子表
const client2 = createHttpClient({ resource: 'core/t/schema' })
const { data } = await client2.request('/energy_meter/children')
```
