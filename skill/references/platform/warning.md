# 报警系统

> 报警事件查询、确认、处理，报警规则管理，报警归档，以及报警实时订阅。

## 报警事件（`warning/warning`）

> ⚠️ **报警 API 查询时需要指定返回字段**，否则后端可能不返回字段数据。

```typescript
const client = createHttpClient({ resource: 'warning/warning' })
const warningApi = createResourceClient<Warning>({
  client,
  resource: 'warning/warning',
})
```

**固定字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 报警 ID |
| `time` | string | 报警时间 |
| `type` | string | 报警类型 |
| `level` | string | 级别：`低`/`中`/`高` |
| `status` | string | 确认状态：`未确认`/`已确认` |
| `processed` | string | 处理状态：`未处理`/`已处理` |
| `handle` | boolean | 需要处理 |
| `table` | object | 数据表 `{id, name, title}` |
| `tableData` | object | 设备 `{id, name, uid}` |
| `tableDataId` | string | 设备编号 |
| `desc` | string | 报警描述 |
| `remark` | string | 报警处理 |
| `fields` | array | 报警数值 `[{name, value, unit, fixed}]` |
| `confirmUser` | object | 确认人 `{id, name}` |
| `confirmTime` | string | 确认时间 |
| `handleUser` | object | 处理人 `{id, name}` |
| `handleTime` | string | 处理时间 |

**过滤查询示例：**

```typescript
// 查询未处理报警（按时间倒序）
const { items } = await warningApi.query(
  { limit: 50, order: { time: 'DESC' } },
  { processed: { $eq: '未处理' } }
)

// 按级别过滤
const { items } = await warningApi.query(
  { limit: 50 },
  { level: { $eq: '高' } }
)

// 按设备过滤
const { items } = await warningApi.query(
  { limit: 50 },
  { tableDataId: { $eq: 'device-001' } }
)

// 按表过滤
const { items } = await warningApi.query(
  { limit: 50 },
  { 'table.id': { $eq: 'hvac_system' } }
)

// 组合过滤：未处理 + 高级别
const { items } = await warningApi.query(
  { limit: 50, order: { time: 'DESC' } },
  { $and: [{ processed: { $eq: '未处理' } }, { level: { $eq: '高' } }] }
)

// 统计未确认报警数
const count = await warningApi.count({ status: { $eq: '未确认' } })
```

**确认和处理操作：**

```typescript
// 确认报警（PATCH）
await warningApi.save({
  id: 'alarm-001',
  status: 1,
  confirmNote: '已确认',
  confirmUser: 'user-id',
}, true)

// 标记恢复（PATCH）
await warningApi.save({
  id: 'alarm-001',
  status: 2,
  recoverNote: '已处理',
}, true)

// 批量确认（使用 raw）
await warningApi.raw('/batch-confirm', {
  method: 'POST',
  body: { ids: ['alarm-001', 'alarm-002'], note: '批量确认', userId: 'user-id' },
})
```

## 报警规则（`warning/rule`）

```typescript
const client = createHttpClient({ resource: 'warning/rule' })
const ruleApi = createResourceClient<WarningRule>({
  client,
  resource: 'warning/rule',
})
```

**固定字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 规则 ID |
| `name` | string | 规则名称 |
| `level` | string | 级别（1-4，数字） |
| `enable` | boolean | 是否启用 |
| `description` | string | 描述 |

## 报警统计

```typescript
// 报警统计
const stats = await warningApi.raw<WarningStats>('/statistics')

// 最新报警
const latest = await warningApi.raw<WarningItem[]>('/latest', {
  method: 'POST',
  body: { limit: 10 },
})
```

## 报警归档（`warning/warning/archive`）

结构与报警事件相同，用于存储已归档的历史报警。

```typescript
const client = createHttpClient({ resource: 'warning/warning/archive' })
const warningArchiveApi = createResourceClient<WarningArchive>({
  client,
  resource: 'warning/warning/archive',
})
```

## 报警实时订阅

报警通过 WebSocket 实时推送。使用 `useWS` hook 订阅 `warning` 频道。

### 前置条件

在 `main.tsx` 中包裹 `<Subscribe>` Provider（脚手架已自动配置）：

```typescript
import { Subscribe } from '@kesi/client'

<Subscribe>
  <App />
</Subscribe>
```

### 使用 useWS 订阅报警

```typescript
import { useWS } from '@kesi/client'

function AlarmMonitor() {
  const { subscribe, onData, onStatus } = useWS()

  React.useEffect(() => {
    // 订阅 warning 频道，传入过滤条件
    const unsubscribe = subscribe('warning', { recoveryStatus: '已恢复' })

    return () => unsubscribe()
  }, [subscribe])

  // 接收实时报警数据
  onData((data) => {
    // data 结构：
    // {
    //   table: { id: string },           // 所属表
    //   tableData: { id: string },       // 所属设备
    //   fields: Array<{ id, level }>,    // 触发报警的数据点
    //   className: string,              // 样式类名
    //   level: number,                  // 报警级别
    //   recoveryTime?: any,             // 恢复时间
    // }
    console.log('收到报警推送:', data)
  })

  // 监听连接状态
  onStatus((status) => {
    // status: 'connecting' | 'connected' | 'close' | 'error'
  })
}
```

### subscribe 参数

```
subscribe(subType, query) → unsubscribe 函数
```

| 参数 | 说明 |
|------|------|
| `subType` | 频道类型，报警固定为 `'warning'` |
| `query` | 过滤条件对象，如 `{ recoveryStatus: '已恢复' }` |

`<Subscribe>` 内部已自动订阅 `warning` 频道，通过 `onData` 回调即可接收所有报警推送。

### 报警状态变化

| 事件 | 推送内容 | warningState |
|------|---------|-------------|
| 新报警 | `level > 0`，无 recoveryTime | `{ className, level }` |
| 已恢复 | 有 recoveryTime | `{ className, level, recoveryTime }` |
