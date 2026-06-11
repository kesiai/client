# 数据订阅模块

## Subscribe Provider

```typescript
import { Subscribe } from '@kesi/client'

function App() {
  return (
    <Subscribe>
      <YourComponents />
    </Subscribe>
  )
}
```

## 订阅数据标签

```typescript
import { useTag, useTagValue } from '@kesi/client'

// 自动订阅（组件挂载时订阅，卸载时取消）
const temperature = useTag({
  tableId: 'device-table',
  dataId: 'device-001',
  tagId: 'temperature'
})

// 只读获取（不触发订阅）
const tempValue = useTagValue({ tableId, dataId, tagId })
// temperature?.value, temperature?.timeoutState?.isOffline
```

## 订阅表格数据

```typescript
import { useTableData, useTableDataValue } from '@kesi/client'

const name = useTableData({ field: 'name', dataId: 'device-001', tableId: 'device-table' })
const nameValue = useTableDataValue({ tableId, dataId, field })
```

## 手动订阅管理

```typescript
import { useSubscribeContext } from '@kesi/client'

const { subscribeTags, subscribeData } = useSubscribeContext()

useEffect(() => {
  subscribeTags([{ tableId, dataId, tagId }], true)  // true = 清除之前的订阅
  subscribeData([{ tableId, dataId, fields: ['f1', 'f2'] }], true)
}, [subscribeTags, subscribeData])
```

## 更新标签和数据

```typescript
import { useUpdateTags, useUpdateData, useUpdateReference, useUpdateMeta } from '@kesi/client'

const updateTags = useUpdateTags()
updateTags({ 'table|data|tag': { value: 100, quality: 'good' } })

const updateData = useUpdateData()
updateData({ 'table|data': { name: '更新后的名称' } })
```

## 其他订阅 Hooks

```typescript
import {
  useReferenceValue,       // 只读获取引用/计算值
  useUpdateTagsTimeout,    // 设置标签超时状态
  useServerTime,           // 获取服务器时间（Dayjs 对象）
} from '@kesi/client'

const serverTime = useServerTime()  // Dayjs 对象
const refValue = useReferenceValue('table1', 'data1', 'field')

```
