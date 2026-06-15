# 驱动管理（`driver/driverInstance`）

> 驱动实例查询、驱动 Schema 查询。

```typescript
import { createHttpClient, createResourceClient } from '@kesi/client'

const client = createHttpClient({ resource: 'driver/driverInstance' })
const driverApi = createResourceClient<Driver>({ client, resource: 'driver/driverInstance' })
```

## 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 驱动实例 ID |
| `name` | string | 驱动名称（不可重复） |
| `driverType` | string | 驱动类型：`modbus`/`opcua`/`mqtt` 等 |
| `driverVersion` | string | 驱动版本 |
| `state` | string | 运行状态：`none`/`restarting`/`running`/`stop` |
| `runMode` | string | 运行模式：`one`/`cluster`/`node` |
| `disable` | boolean | 是否禁用 |
| `ports` | string | 端口 |
| `createTime` | string | 创建时间 |

## 查询示例

```typescript
// 平台资源字段固定，查询时显式指定返回字段
const DRIVER_FIELDS = ['id', 'name', 'driverType', 'driverVersion', 'state', 'runMode', 'disable', 'ports', 'createTime']

// 列表
const { items } = await driverApi.query({ limit: 50, fields: DRIVER_FIELDS })

// 按类型过滤
const { items } = await driverApi.query({ limit: 50, fields: DRIVER_FIELDS }, { driverType: { $eq: 'modbus' } })

// 按状态过滤
const { items } = await driverApi.query({ limit: 50, fields: DRIVER_FIELDS }, { state: { $eq: 'running' } })

// 详情（get 不需要 fields）
const driver = await driverApi.get('driver-001')
```

## 驱动 Schema（`driver/driver/{type}/schema`）

查询驱动类型支持的数据点字段定义和设置配置：

```typescript
const schemaClient = createHttpClient({ resource: 'driver/driver/modbus/schema' })
const { data } = await schemaClient.request('')
// 返回：tags 字段定义、settings 配置定义
```
