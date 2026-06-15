# 用户管理（`core/user`）

> 用户 CRUD、在线状态、角色关联。

```typescript
import { createHttpClient, createResourceClient } from '@kesi/client'

const client = createHttpClient({ resource: 'core/user' })
const userApi = createResourceClient<User>({ client, resource: 'core/user' })
```

## 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 用户 ID |
| `name` | string | 用户名（不可重复） |
| `email` | string | 邮箱 |
| `phone` | string | 电话 |
| `status` | string | 用户状态：`active`/`sleep`/`close` |
| `online` | boolean | 在线状态 |
| `identity` | boolean | 管理员身份 |
| `roles` | array | 角色列表 |
| `remark` | string | 备注 |
| `language` | string | 系统语言 |
| `createTime` | string | 创建时间 |

## 查询示例

```typescript
// 平台资源字段固定，查询时显式指定返回字段
const USER_FIELDS = ['id', 'name', 'email', 'phone', 'status', 'online', 'identity', 'roles', 'remark', 'language', 'createTime']

// 列表查询
const { items, total } = await userApi.query({ limit: 50, order: { createTime: 'DESC' }, fields: USER_FIELDS })

// 按用户名模糊搜索
const { items } = await userApi.query({ limit: 50, fields: USER_FIELDS }, { name: { $regex: 'admin' } })

// 查询在线用户
const { items } = await userApi.query({ limit: 100, fields: USER_FIELDS }, { online: { $eq: true } })

// 按状态过滤
const { items } = await userApi.query({ limit: 50, fields: USER_FIELDS }, { status: { $eq: 'active' } })

