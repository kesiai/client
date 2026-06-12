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

## 自动生成的统计项

> 除手动创建的字典项外，系统会根据设备表自动生成在线统计和报警统计。
> 这些数据由后端实时计算更新，前端可直接读取，无需自行聚合计算。

### 全局报警统计（系统固定 4 条）

| id | name | type | 说明 |
|----|------|------|------|
| `warnCount` | 报警总数 | `number` | 当前报警总数 |
| `warnDeviceCount` | 报警设备数 | `number` | 有报警的设备数量 |
| `confirmCount` | 未确认报警数 | `number` | 尚未确认的报警数 |
| `processedCount` | 未处理报警数 | `number` | 尚未处理的报警数 |

```typescript
// 获取全局报警统计
const warnCount = await dictApi.get('warnCount')       // { value: 12, ... }
const warnDevices = await dictApi.get('warnDeviceCount') // { value: 3, ... }
```

### 在线统计（每张设备表自动生成 1 条）

创建设备表时系统自动生成，`id` 与设备表 ID 相同：

| 字段 | 值 |
|------|-----|
| `id` / `uid` | `{tableId}`（与设备表 ID 相同） |
| `name` | `{tableId}表在线信息统计` |
| `type` | `object` |

**value 结构：**

```typescript
interface OnlineStats {
  count: number      // 设备总数
  online: number     // 在线数
  offline: number    // 离线数
  off: number        // 断电数
  onlineRate: number // 在线率（百分比）
}
```

```typescript
// 获取空调系统在线率
const stats = await dictApi.get('hvac_system')
// stats.value = { count: 10, online: 8, offline: 2, off: 0, onlineRate: 80 }
```

### 报警级别统计（每张设备表自动生成 1 条）

| 字段 | 值 |
|------|-----|
| `id` / `uid` | `{tableId}warnstats` |
| `name` | `{tableId}表按报警级别统计设备数量` |
| `type` | `object` |

```typescript
// 获取空调系统报警级别分布
const warnStats = await dictApi.get('hvac_systemwarnstats')
```

### 总结规则

| 类别 | ID 格式 | type | 何时生成 |
|------|---------|------|---------|
| 全局报警统计 | 固定 4 个 ID（见上表） | `number` | 系统固定 |
| 在线统计 | `{tableId}` | `object` | 创建设备表时自动生成 |
| 报警级别统计 | `{tableId}warnstats` | `object` | 创建设备表时自动生成 |
| 自定义 | 自由定义 | 自由 | 手动插入 |

### 仪表盘使用场景

仪表盘页面的统计卡片应优先使用这些预计算数据，而非逐表 count 聚合：

```typescript
// ✅ 推荐：直接读取预计算的系统变量
const client = createHttpClient({ resource: 'core/systemVariable' })
const dictApi = createResourceClient<any>({ client, resource: 'core/systemVariable' })

// 全局报警数
const { value: warnCount } = await dictApi.get('warnCount')

// 各子系统在线率（遍历所有设备表 ID）
const hvacStats = await dictApi.get('hvac_system')       // { value: { onlineRate: 80, ... } }
const lightStats = await dictApi.get('lighting_system')   // { value: { onlineRate: 95, ... } }

// ❌ 不推荐：逐表 count 聚合（冗余查询）
// const total = await deviceApi.count()
// const online = await deviceApi.count({}, { online: { $eq: true } })
```

## 实时订阅

系统变量变化通过 WebSocket 推送，可用于仪表盘实时刷新：

```typescript
import { useWS } from '@kesi/client'

const { subscribe, onData } = useWS()

useEffect(() => {
  const unsubscribe = subscribe('systemvariable', {})
  return () => unsubscribe()
}, [subscribe])

onData((data) => {
  // data 为变更的系统变量数据
  // 仪表盘可在此更新统计卡片数值
})
```
