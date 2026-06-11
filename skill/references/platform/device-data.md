# 设备数据点（`core/data` / `core/t/tags`）

> 设备数据点的定义查询、最新值、历史时序数据查询、实时订阅。数据点（tags）是设备采集的实时传感器数据，与普通字段完全不同。

## 查询数据点定义

**方式一：从表 schema 获取**

数据点定义存储在表 schema 的 `device.tags` 数组中：

```typescript
import { createHttpClient, createResourceClient } from '@kesi/client'

const client = createHttpClient({ resource: 'core/t/schema' })
const schemaApi = createResourceClient({ client, resource: 'core/t/schema' })
const schema = await schemaApi.get('hvac_system')
const tags = schema.device?.tags || []
```

每个 tag 的字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 数据点 ID |
| `name` | string | 数据点名称 |
| `policy` | string | 保存策略：`save`/`change`/`drop`/`period` |
| `unit` | string | 单位（如 `℃`、`%`、`kWh`） |
| `rw` | string | 读写权限：`r`（只读）/ `w`（可写）/ `rw`（读写） |
| `fixed` | number | 小数位数 |

**方式二：批量查询（推荐）**

```
POST /core/t/tags
```

```typescript
const tagClient = createHttpClient({ resource: 'core/t/tags' })
const res = await tagClient.request('', {
  method: 'POST',
  headers: { 'X-Forwarded-Method-Override': 'GET' },
  body: [
    { tableId: 'hvac_system', ids: ['device-001', 'device-002'] },
  ],
})
```

**tag 元数据用途：**
- `rw === 'r'` → 只能展示，不能控制
- `rw === 'w'` 或 `rw === 'rw'` → 可以发送控制命令
- `unit` 有值 → 展示时带单位后缀

## 查询最新数据

```
POST /core/data/latest
```

```typescript
const dataClient = createHttpClient({ resource: 'core/data' })
const res = await dataClient.request('/latest', {
  method: 'POST',
  body: [
    { tableId: 'hvac_system', id: 'device-001', tagId: 'temperature' },
  ],
})
// 响应：[{ tableId, tableDataId, tagId, time, value }, ...]
```

## 查询历史数据（时序查询）

**端点：** `POST /core/data/query`

```typescript
const queryClient = createHttpClient({ resource: 'core/data/query' })
const res = await queryClient.request('', {
  method: 'POST',
  body: [{
    tableId: 'hvac_system',
    id: 'device-001',
    fields: ['"temperature"'],
    where: ["time >= '2024-01-01T00:00:00Z'", "time <= '2024-01-02T00:00:00Z'"],
  }],
})
```

### 聚合函数

| 函数 | 说明 | 示例 |
|------|------|------|
| `LAST("tagId")` | 最后一个值 | `LAST("temperature")` |
| `FIRST("tagId")` | 第一个值 | `FIRST("temperature")` |
| `MEAN("tagId")` | 平均值 | `MEAN("temperature")` |
| `MAX("tagId")` | 最大值 | `MAX("temperature")` |
| `MIN("tagId")` | 最小值 | `MIN("temperature")` |
| `SUM("tagId")` | 求和 | `SUM("energy")` |
| `COUNT("tagId")` | 计数 | `COUNT("temperature")` |

> **规则：** 使用 `group` 时，fields 必须用聚合函数包裹。不分组时可用裸字段名。

### fields 语法

```typescript
// 裸字段（不分组）
fields: ['"temperature"', '"humidity"']

// 聚合（分组时）
fields: ['MEAN("temperature") AS "temperature"', 'MAX("humidity") AS "humidity"', 'id']

// 取最新值
fields: ['LAST("temperature") AS "temperature"', 'id']
```

### 时间分组（group）

```typescript
group: ['time(1h)']           // 按小时
group: ['time(5m)']           // 按 5 分钟
group: ['time(1d)']           // 按天
group: ['time(1w)']           // 按周
group: ['time(1mo)']          // 按月
group: ['time(1y)']           // 按年
group: ['id']                  // 按设备 ID
group: ['id', 'time(1h)']     // 按设备 + 时间
```

### 空值填充（fill）

```typescript
fill: 'null'       // 填充 null（默认）
fill: 'none'       // 不返回空时间段
fill: 'previous'   // 用前一个值填充
```

### 排序和时间条件

```typescript
order: 'time asc'   // 或 'time desc'

where: [
  "time >= '2024-01-01T00:00:00Z'",
  "time <= '2024-01-02T00:00:00Z'",
]
// 也支持：where: ["time >= now() - 24h"]
```

### 响应格式

```typescript
{
  results: [{
    series: [{
      name: string         // tableId
      columns: string[]    // 如 ['time', 'temperature', 'id']
      values: any[][]      // 数据行，每行对应 columns
      tags?: { [key: string]: string }  // 分组标签
    }]
  }]
}
```

### 完整示例

**原始历史数据（不分组）：**

```typescript
const res = await queryClient.request('', {
  method: 'POST',
  body: [{
    tableId: 'hvac_system', id: 'device-001',
    fields: ['"temperature"'],
    where: ["time >= '2024-06-01T00:00:00Z'", "time <= '2024-06-02T00:00:00Z'"],
    order: 'time asc',
  }],
})
```

**按小时聚合平均值：**

```typescript
const res = await queryClient.request('', {
  method: 'POST',
  body: [{
    tableId: 'hvac_system', id: 'device-001',
    fields: ['MEAN("temperature") AS "temperature"'],
    where: ["time >= '2024-06-01T00:00:00Z'"],
    group: ['time(1h)'], fill: 'null', order: 'time asc',
  }],
})
```

**取最新值：**

```typescript
const res = await queryClient.request('', {
  method: 'POST',
  body: [{
    tableId: 'hvac_system', id: 'device-001',
    fields: ['LAST("temperature") AS "temperature"', 'id'],
    where: ["time <= '2024-06-10T12:00:00Z'"],
  }],
})
```

## 实时订阅

设备数据点的实时订阅使用 `useTag`、`useTableData` 等 hooks → 详见 [client-subscribe.md](../client-subscribe.md)
