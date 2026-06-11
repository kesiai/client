# 系统变量（`core/systemVariable`）

> 数据字典/系统变量的 CRUD 和实时订阅。

```typescript
import { createHttpClient, createResourceClient } from '@kesi/client'

const client = createHttpClient({ resource: 'core/systemVariable' })
const dictApi = createResourceClient<SystemVariable>({ client, resource: 'core/systemVariable' })
```

## 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 字典 ID |
| `name` | string | 名称 |
| `uid` | string | 编号（汉字、字母、数字、特殊字符!@$-_:） |
| `type` | string | 类型：`number`/`string`/`boolean`/`date`/`object`/`array` |
| `value` | any | 值（根据 type 不同） |
| `createTime` | string | 创建时间 |

## 查询示例

```typescript
// 查询所有
const { items } = await dictApi.query({ limit: 100 })

// 按类型过滤
const { items } = await dictApi.query({ limit: 100 }, { type: { $eq: 'string' } })

// 按编号精确查找
const { items } = await dictApi.query({ limit: 10 }, { uid: { $eq: 'deviceStatus' } })

// 按名称模糊搜索
const { items } = await dictApi.query({ limit: 50 }, { name: { $regex: '状态' } })

// 获取单条
const item = await dictApi.get('variable-id')
```

## 实时订阅

系统变量变化通过 WebSocket 推送：

```typescript
import { useWS } from '@kesi/client'

const { subscribe, onData } = useWS()

useEffect(() => {
  const unsubscribe = subscribe('systemvariable', {})
  return () => unsubscribe()
}, [subscribe])

onData((data) => {
  // data 为变更的系统变量数据
})
```
