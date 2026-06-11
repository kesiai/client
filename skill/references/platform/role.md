# 角色管理（`core/role`）

> 角色 CRUD、权限配置、用户关联。

```typescript
import { createHttpClient, createResourceClient } from '@kesi/client'

const client = createHttpClient({ resource: 'core/role' })
const roleApi = createResourceClient<Role>({ client, resource: 'core/role' })
```

## 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 角色 ID |
| `name` | string | 角色名称（不可重复） |
| `description` | string | 描述 |
| `users` | array | 用户列表（`[{id, name}]`） |
| `disabled` | boolean | 是否禁用（禁用后该角色用户无法登录） |
| `permission` | string[] | 权限列表 |
| `isBlackList` | boolean | 是否黑名单模式 |
| `createTime` | string | 创建时间 |

## 查询示例

```typescript
// 查询所有未禁用角色
const { items } = await roleApi.query({ limit: 50 }, { disabled: { $ne: true } })

// 按名称搜索
const { items } = await roleApi.query({ limit: 20 }, { name: { $regex: '管理' } })
```
