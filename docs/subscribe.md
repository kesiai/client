# Subscribe - 数据订阅模块

Subscribe 模块提供基于 WebSocket 的实时数据订阅：数据点（tag）与表数据（tabledata）的推送。

**不需要外层 Provider。** 订阅的真实生命周期挂在读取值的 Jotai atom 的 mount 上——
哪个组件读了 `useTag(...)`，就为那个 tag 建立订阅；组件卸载、refCount 归零后延迟约 2s 释放。

## 目录

- [概述](#概述)
- [核心概念](#核心概念)
- [Hooks API](#hooks-api)
- [命令式订阅](#命令式订阅)
- [数据查询](#数据查询)
- [完整示例](#完整示例)
- [最佳实践](#最佳实践)
- [API 参考](#api-参考)

---

## 概述

```
组件 → useTag(id) → tagsState(key) atom 首次被 mount
                      └─ onMount → tagRegistry.retain(key, setAtom)
                                     └─ 去重 / 防抖 / 批量 → WebSocket query
                                     └─ 推送回来 → setAtom → 组件更新
     组件卸载    → release() → refCount 归零 → releaseDelay 后回收 atom 与订阅
```

要点：

- **无需 Provider**——`useTag` / `useTableData` 可以在任意位置调用，包括分页/弹窗/编辑器预览。
- **订阅会收缩**——最后一个读者离开后订阅被释放，不再只增不减。
- **写到正确的 store**——推送通过 atom `onMount` 拿到的 `setAtom` 广播，它绑定到 mount 该 atom 的 store；嵌套 `<Page>` 时多个 store 同时存活也不会串。
- **批量合并**——100ms 窗口内的订阅变更合并成一次下发；同一行的多个 tag 合并成一次写入。

WebSocket 通道：`data`（数据点）、`tabledata`（表数据）、`computerecord`（引用/计算字段）、
`warning`（报警状态）、`time`（服务器时间）。这些通道都是模块级惰性单例，首次有需求时自动建立。

---

## 核心概念

### 订阅标签 (SubTag)

```typescript
interface SubTag {
  tableId: string    // 表ID
  dataId?: string    // 数据ID
  tagId?: string     // 标签ID
}
```

### 订阅数据 (SubData)

```typescript
interface SubData {
  tableId: string    // 表ID
  dataId?: string    // 数据ID
  fields?: string[]  // 要订阅的字段列表
}
```

### 标签值 (TagValue)

```typescript
interface TagValue {
  value?: any              // 标签值
  time?: any               // 时间戳
  warningState?: any       // 报警状态
  timeoutState?: {
    isTimeout?: boolean
    isOffline?: boolean
    level?: number
  }
  [key: string]: any
}
```

---

## Hooks API

### useTag

订阅并读取数据点。**这是最常用的入口。**

```typescript
function useTag(options: TagOptions): TagValue | undefined

interface TagOptions {
  tableId?: string
  dataId?: string
  tagId: string
  field?: string   // 只取值里的某个字段
}
```

未提供 `tableId` / `dataId` 时会从 `useCellDataValue()` 的单元格上下文补齐，
所以在表格单元格里可以只写 `tagId`。

```tsx
import { useTag } from '@kesi/client'

function TemperatureDisplay() {
  const tag = useTag({
    tableId: 'device-table',
    dataId: 'device-001',
    tagId: 'temperature'
  })

  return (
    <div>
      <p>温度: {tag?.value}°C</p>
      <p>时间: {tag?.time}</p>
      <p>状态: {tag?.timeoutState?.isOffline ? '离线' : '在线'}</p>
    </div>
  )
}
```

只取字段：

```tsx
const value = useTag({ tagId: 'temperature', field: 'value' })
```

### useTagValue

与 `useTag` 同源，同样会订阅——生命周期挂在 atom 的 mount 上，**只要读了就会 mount**。
保留它只是为了兼容既有调用点，新代码用 `useTag` 即可。

```typescript
function useTagValue(options: TagOptions): TagValue | undefined
```

### useTableData

订阅并读取表数据的字段值。

```typescript
function useTableData(options: DataPropOptions): any

interface DataPropOptions {
  field: string              // 字段名（支持 lodash 嵌套路径，如 'a.b.c'）
  dataId?: string            // 数据ID
  tableId?: string           // 表ID
  type?: string              // 'schema'（默认）| 'settings' 等
  config?: string            // '关联字段' | '选择器'
  relateShowField?: string   // 关联字段的显示字段
  enumObj?: Record<string, string>  // 枚举映射
}
```

```tsx
import { useTableData } from '@kesi/client'

function DeviceInfo() {
  const name = useTableData({ field: 'name', dataId: 'device-001', tableId: 'device-table' })
  const status = useTableData({ field: 'status', dataId: 'device-001', tableId: 'device-table' })

  return <div><p>{name}</p><p>{status}</p></div>
}
```

### useTableDataValue

```typescript
function useTableDataValue(options: DataPropOptions): any
```

同 `useTableData`，保留用于兼容。

### useReferenceValue

读取引用/计算字段的值，走 `computerecord` 通道。

```typescript
function useReferenceValue(tableId: string, tableDataId: string, field: string): any
```

### useServerTime

服务器时间。**不要用在 Jotai `<Provider>` 内部**——它读写的是默认 store。

```typescript
function useServerTime(): Dayjs
```

### useTimeSubscribe

兼容保留：显式启动 `time` 通道，返回 `null`。通常不需要，`useServerTime` 首次调用会自动启动。

```typescript
function useTimeSubscribe(): null
```

---

## 命令式订阅

除了「读了就订阅」的声明式用法，还提供一组命令式 API，用于按列表批量订阅（例如虚拟表格
在 `items` 变化时整批切换）。

```typescript
function subscribeTags(tags: SubTag[], clear?: boolean): void
function subscribeData(dataIds: SubData[], clear?: boolean): void
function clearSubscriptions(): void
```

- `clear` 缺省为 `false` → **追加**到该组的订阅集合。
- `clear` 为 `true` → **替换**该组自己的订阅集合。

与 atom 生命周期是两种并存的所有权模型，二者的 key 会分别计入 refCount。
命令式订阅由调用方自己负责收尾（用 `clear=true` 传新列表，或 `clearSubscriptions()`）。

```tsx
import { subscribeData, clearSubscriptions } from '@kesi/client'

// 列表变化时整批替换自己这组的订阅——不会影响其它组件用 useTableData 建立的订阅
useEffect(() => {
  subscribeData(subDataIds, true)
}, [items])

// 卸载时丢弃自己这组
useEffect(() => () => clearSubscriptions(), [])
```

### useSubscribeContext

兼容层。改造后不再有 React Context，也不会抛错，返回的就是上面那组模块函数：

```typescript
function useSubscribeContext(): { subscribeTags: typeof subscribeTags; subscribeData: typeof subscribeData }
```

```tsx
const { subscribeTags } = useSubscribeContext()
```

---

## 数据查询

一次性拉取（非实时通道），用于首屏兜底、导出等场景。

### queryLastData

```typescript
import { queryLastData } from '@kesi/client'

queryLastData(
  [{ tableId: 'table1', dataId: 'data1', tagId: 'tag1' }],
  (data) => {
    // data: { 'table1|data1|tag1': { value: 100, time: '...' } }
  }
)
```

### queryTableData

```typescript
import { queryTableData } from '@kesi/client'

queryTableData(
  [{ tableId: 'table1', dataId: 'data1', fields: ['name', 'status'] }],
  (data) => { /* ... */ }
)
```

### queryMeta / queryHistoryData

```typescript
queryMeta(subTags, (meta) => { /* 数据点元信息，含 timeout 配置 */ })
queryHistoryData(tags, timeRange, (data) => { /* 历史数据 */ })
```

---

## 完整示例

### 实时监控设备数据

```tsx
import { useTag } from '@kesi/client'

function DeviceMonitor() {
  const temperature = useTag({ tableId: 'device-table', dataId: 'device-001', tagId: 'temperature' })
  const pressure = useTag({ tableId: 'device-table', dataId: 'device-001', tagId: 'pressure' })

  return (
    <div className="device-monitor">
      <h2>设备监控</h2>
      <p>温度: {temperature?.value}°C</p>
      <p>压力: {pressure?.value} Pa</p>
      <p>状态: {temperature?.timeoutState?.isOffline ? '离线' : '在线'}</p>
    </div>
  )
}
```

直接渲染即可，不需要任何包裹：

```tsx
<DeviceMonitor />
```

### 批量订阅一个列表

```tsx
import { useEffect } from 'react'
import { subscribeData, useTableData } from '@kesi/client'

function AlarmTable({ rows }) {
  // 整批订阅：rows 变化时替换自己这组
  useEffect(() => {
    subscribeData(rows.map((r) => ({ tableId: 'alarm', dataId: r.id, fields: ['level'] })), true)
  }, [rows])

  return <ul>{rows.map((r) => <AlarmRow key={r.id} dataId={r.id} />)}</ul>
}

function AlarmRow({ dataId }) {
  // 读值即订阅；此处 dataId 已经由上面的 subscribeData 覆盖，两者共享同一 key
  const level = useTableData({ tableId: 'alarm', dataId, field: 'level' })
  return <li>{level}</li>
}
```

---

## 最佳实践

### 1. 优先用 useTag / useTableData

它们会自动订阅、自动释放，不需要手动 `useEffect`，也不需要关心何时退订。

```tsx
// 推荐
const tag = useTag({ tagId: 'temperature' })
```

### 2. 只在需要整批控制时才用命令式 API

`subscribeTags` / `subscribeData` 适合「订阅集合由一份列表驱动」的场景。
它们的 `clear=true` 只影响自己那一组，不会误伤其它组件。

### 3. 卸载时不要手动退订

订阅跟随 atom 的 mount/unmount 自动收缩，手动退订反而可能打断其它读到同一个 key 的组件。

### 4. 大量数据点用多个 useTag，不要自己合并成一个大对象

每个 key 是独立的 atom，只有变化的那个 key 会触发重渲染。把一堆实时值拼进一个对象会让
任意一个值变化都导致整棵子树重渲染。

### 5. 短时间内的多次订阅变更会被自动合并

订阅变更走 100ms 防抖窗口；最后一个读者离开后该 key 仍保留约 2s 才真正退订，
用来吸收 StrictMode 双调用、路由切换、tab 切换这类抖动——避免它们引发退订+重连。
不要依赖「卸载后立刻断连」。

---

## API 参考

### 导出内容

```typescript
import {
  // 声明式（读值即订阅）
  useTag,
  useTagValue,
  useTableData,
  useTableDataValue,
  useReferenceValue,

  // 命令式
  subscribeTags,
  subscribeData,
  clearSubscriptions,
  useSubscribeContext,

  // 服务器时间
  useServerTime,
  useTimeSubscribe,

  // 一次性查询
  queryLastData,
  queryMeta,
  queryTableData,
  queryHistoryData,

  // 底层（诊断/高级用法）
  tagRegistry,
  dataChannelRegistry,
  referenceChannelRegistry,
  tagKey,
  parseTagKey,
  getSubscribedTagKeys
} from '@kesi/client'

// 类型导出
import type { SubTag, SubData, TagValue, TagOptions, DataPropOptions } from '@kesi/client'
```

`getSubscribedTagKeys()` 返回当前期望的订阅 key 快照（形如 `tableId|dataId|tagId`），用于排查
「为什么这个点没有推数据」。

---

## 常见问题

### Q: 需要 `<Subscribe>` 包裹吗？

不需要，`Subscribe` 组件已经删除。直接调用 hooks 即可。

### Q: 为什么组件卸载后连接没有立刻关闭？

释放有约 2s 的延迟窗口，用来吸收 StrictMode 双调用与路由/标签切换。窗口内**该 key 仍算作
已订阅**（仍缓存值、仍留在订阅集合里），所以常见的「A 卸载、B 挂载」切换不会产生一次
退订+重连，只是往同一条连接上补发差量。窗口内重新读到同一个 key 则取消释放。

同时通道是模块级单例：只要还有任何一个 key 需要它，连接就保持。

### Q: 如何取消订阅？

声明式订阅无需手动取消——不再有组件读那个 key 时自动释放。
命令式订阅用 `subscribeTags(newTags, true)` / `subscribeData(newData, true)` 替换该组自己的集合，
或 `clearSubscriptions()` 清空两个组。

### Q: `subscribeTags([], true)` 能取消所有订阅吗？

能取消**该组**的全部订阅（包括之前用 `clear=false` 追加进来的）。它不影响声明式订阅，
也不影响其它调用方建立的订阅集合。

### Q: useTag 如何从上下文获取 dataId？

省略 `tableId` / `dataId` 时会从 `useCellDataValue()` 补齐：

```tsx
// 在表格单元格内
const tag = useTag({ tagId: 'temperature' })

// 等价于
const ctx = useCellDataValue()
const tag = useTag({
  tableId: ctx?.tableData?.table?.id ?? ctx?.tableData?._table,
  dataId: ctx?.tableData?.id,
  tagId: 'temperature'
})
```

---

## 相关文档

- [Page Hooks](./page-hooks.md) - 页面级状态管理
- [API 模块](./api.md) - HTTP 请求
