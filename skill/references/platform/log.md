# 日志（`core/log` / `syslog/log`）

> 操作日志和系统日志查询。

## 操作日志（`core/log`）

```typescript
import { createHttpClient, createResourceClient } from '@kesi/client'

const client = createHttpClient({ resource: 'core/log' })
const logApi = createResourceClient<Log>({ client, resource: 'core/log' })
```

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 日志 ID |
| `time` | string | 操作时间 |
| `user` | object | 操作人 `{id, name}` |
| `type` | string | 操作类型（登录、发送指令等） |
| `level` | string | 级别：`INFO`/`WARN`/`ERROR`/`DEBUG` |
| `remoteAddr` | string | 操作 IP |
| `logObj` | string | 操作对象 |
| `status` | string | 操作状态：`success`/`failure`/`partial` |
| `diff` | string | 操作内容 |
| `detail` | string | 失败原因 |
| `message` | string | 日志信息 |
| `data` | string | 操作相关数据 |
| `flow` | object | 流程信息 `{id, name}` |

### 查询示例

```typescript
// 平台资源字段固定，查询时显式指定返回字段
const LOG_FIELDS = ['id', 'time', 'user', 'type', 'level', 'remoteAddr', 'logObj', 'status', 'diff', 'detail', 'message', 'data', 'flow']

// 查询错误日志
const { items } = await logApi.query(
  { limit: 50, order: { time: 'DESC' }, fields: LOG_FIELDS },
  { level: { $eq: 'ERROR' } }
)

// 按操作人过滤
const { items } = await logApi.query(
  { limit: 50, fields: LOG_FIELDS },
  { 'user.name': { $eq: 'admin' } }
)

// 按操作类型过滤
const { items } = await logApi.query(
  { limit: 50, fields: LOG_FIELDS },
  { type: { $regex: '登录' } }
)
```

## 系统日志（`syslog/log`）

```typescript
const sysClient = createHttpClient({ resource: 'syslog/log' })
const sysLogApi = createResourceClient<SysLog>({ client: sysClient, resource: 'syslog/log' })
```

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 日志 ID |
| `time` | string | 操作时间 |
| `level` | string | 日志等级：`DEBUG`/`INFO`/`WARN`/`ERROR` |
| `service` | string | 服务名称 |
| `module` | string | 模块名称 |
| `msg` | string | 内容 |
| `data` | string | 数据 |
| `detail` | string | 详细信息 |

### 查询示例

```typescript
// 平台资源字段固定，查询时显式指定返回字段
const SYS_LOG_FIELDS = ['id', 'time', 'level', 'service', 'module', 'msg', 'data', 'detail']

// 查询错误日志
const { items } = await sysLogApi.query(
  { limit: 50, order: { time: 'DESC' }, fields: SYS_LOG_FIELDS },
  { level: { $eq: 'ERROR' } }
)

// 按服务名过滤
const { items } = await sysLogApi.query(
  { limit: 50, fields: SYS_LOG_FIELDS },
  { service: { $eq: 'driver-service' } }
)
```
