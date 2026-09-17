# 数据订阅模块

**不需要 Provider。** 订阅生命周期挂在读取值的 atom 上：组件读 `useTag(...)` 就建立订阅，
组件卸载、没有其它读者后自动释放。直接调用 hooks 即可，不要包任何东西。

## 订阅数据标签

```typescript
import { useTag } from '@kesi/client'

// 读值即订阅
const temperature = useTag({
  tableId: 'device-table',
  dataId: 'device-001',
  tagId: 'temperature'
})
// temperature?.value, temperature?.time, temperature?.timeoutState?.isOffline
```

在表格单元格内可以省略 `tableId` / `dataId`，会从 `useCellDataValue()` 补齐：

```typescript
const temperature = useTag({ tagId: 'temperature' })

// 只取某个字段
const value = useTag({ tagId: 'temperature', field: 'value' })
```

`useTagValue` 与 `useTag` 同源（同样会订阅），保留仅为兼容。

## 订阅表格数据

```typescript
import { useTableData } from '@kesi/client'

const name = useTableData({ field: 'name', dataId: 'device-001', tableId: 'device-table' })
const nested = useTableData({ field: 'a.b.c', dataId, tableId })  // 支持嵌套路径
```

`useTableDataValue` 与 `useTableData` 同源，保留仅为兼容。

## 命令式订阅（按列表整批控制）

只有当订阅集合由一份列表驱动时才需要（例如虚拟表格在 items 变化时整批切换）：

```typescript
import { subscribeTags, subscribeData, clearSubscriptions } from '@kesi/client'

subscribeData(rows.map(r => ({ tableId: 'alarm', dataId: r.id, fields: ['level'] })), true)
// clear=true → 替换「本组」的订阅集合；clear=false/省略 → 追加
// 只影响这一组，不会误伤其它组件用 useTag/useTableData 建立的订阅

clearSubscriptions()  // 丢弃两组命令式订阅
```

`useSubscribeContext()` 是兼容层，返回 `{ subscribeTags, subscribeData }`，不再抛错。

## 其他订阅 Hooks

```typescript
import {
  useReferenceValue,   // 读取引用/计算字段值
  useServerTime,       // 服务器时间（Dayjs），不要用在 Jotai <Provider> 内部
} from '@kesi/client'

const serverTime = useServerTime()
const refValue = useReferenceValue('table1', 'data1', 'field')
```

## 注意

- 不要手动退订声明式订阅，也不要为了「取消订阅」而卸载时清理——跟着组件卸载自动收缩。
- 组件卸载后连接不会立刻关闭：有约 2s 的延迟释放窗口用来吸收 StrictMode 双调用与路由切换。
- 大量实时数据点请用多个 `useTag`，不要自己合并成一个大对象——每个 key 是独立 atom，
  只有变化的那个 key 会触发重渲染。
