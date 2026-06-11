# 常用模式 & 最佳实践

## Provider 嵌套

```typescript
<Subscribe>
  <Model name="user">
    <YourComponent />
  </Model>
</Subscribe>
```

## 完整 CRUD 示例

```typescript
import { Model, useModelList, useModelSave, useModelDelete } from '@kesi/client'

function UserManagement() {
  const { items, loading } = useModelList()
  const { saveItem } = useModelSave()
  const { deleteItem } = useModelDelete()

  if (loading) return <div>加载中...</div>

  return (
    <div>
      <UserForm onSubmit={async (data) => { await saveItem(data) }} />
      <UserTable data={items} onDelete={async (id) => { await deleteItem(id) }} />
    </div>
  )
}

function App() {
  return <Model name="user"><UserManagement /></Model>
}
```

## 受保护路由

```typescript
import { useUser } from '@kesi/client'

function ProtectedRoute({ children }) {
  const { user } = useUser()
  if (!user) return <Navigate to="/login" />
  return children
}
```

## TypeScript 类型安全

```typescript
import { createHttpClient, createResourceClient } from '@kesi/client'

interface User { id?: string; name: string; email: string }

const client = createHttpClient({ resource: 'core/user' })
const userApi = createResourceClient<User>({ client, resource: 'core/user' })
const user = await userApi.get('id')
console.log(user?.name)  // 类型为 string
```

## 错误处理

```typescript
try {
  await saveItem(data)
} catch (err) {
  message.error(err?.formError || '保存失败')
}
```

## 性能优化

- `useModelList` 自动加载列表
- `useModelGetItems` 手动查询
- `useTag` 自动订阅
- `useTagValue` / `useTableDataValue` 只读访问（不触发订阅副作用）

## 故障排查

| 问题 | 检查 |
|------|------|
| API 请求失败 | 用户是否认证、setConfig 的 rest/projectId 是否正确 |
| Model hooks 报错 | 组件是否在 `<Model>` Provider 内部 |
| 订阅不更新 | `<Subscribe>` 是否包裹组件、WebSocket 连接状态 |
| 表单验证不生效 | register() 规则、formState.errors 对象 |
