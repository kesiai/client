# API 校验规则

> kesi-frontend **代码生成后的静态校验断言清单**。把散落在 [client-api.md](client-api.md) / [device-data.md](platform/device-data.md) / [client-subscribe.md](client-subscribe.md) 的数据请求正确性约束，汇聚成可逐条扫描的断言。
>
> 供 [../SKILL.md](../SKILL.md) 的「生成后静态验证」第 ④ 项执行。**SKILL.md 不内联这些规则**，统一引用本文件，避免重复维护。

## 使用方式

对照 `design-report.json` 的 pages 与 `handoff.json` 的 scan 数据，扫描生成的 `src/` 源码，对每条断言给出结论：

- ✅ 通过 / ⚠️ 建议项（记录告知，不阻塞）/ 🔴 必须修复（附 `文件:行号`）

> 纯静态扫描，不启动项目、不依赖网络。运行时数据问题（表空、权限 403、设备离线）本文件不覆盖——那需要连通性验证。

---

## 一、数据请求硬规则（A–J 逐条断言）

### A. 字段投影

**断言**：扫描所有 `createResourceClient` + `.query()` 调用，按 resource 分类：

- resource 形如 `core/t/{xxx}/d`（**自定义表**）→ query 的 filter **不得出现 `fields`**（依赖 SDK 自动 `projectAll` 返回全部字段）
- **平台资源**（`core/user` `core/role` `core/log` `syslog/log` `driver/driverInstance` `core/systemVariable` `core/catalog` `warning/warning` 等）→ query **必须传 `fields`**，显式列出

```typescript
// ❌ 自定义表传了不完整 fields → 静默丢字段
api.query({ filter: { fields: ['id', 'name'] } })   // resource: core/t/building/d

// ✅ 自定义表不传 fields（SDK projectAll）；平台资源显式列
api.query({})                                        // resource: core/t/building/d
userApi.query({ filter: { fields: ['id', 'name'] } }) // resource: core/user
```

依据：client-api.md「字段投影规则」、[INDEX.md](INDEX.md)「关键约束速记」

### B. 数据点来源

**断言**：`design-report.json` 中页面 `displayFields` 里 `type:"tag"` 的字段，对应代码**不能从 `createResourceClient.query()` 取值**，必须经 `fetchLatestTags` / `useTag` / `useTableData` / `core/data/query`。tagId 应来自 scan 数据的 `tags[].id`。

> `query()` 只返回 schema 字段，**不返回 tags 值**。

```typescript
// ❌ 设备温度（数据点）从 query 取——取不到
const { items } = await deviceApi.query()  // items 里没有 temperature 值

// ✅ 数据点用专用 API
const tags = await fetchLatestTags([{ tableId, id, tagId: 'temperature' }])
```

依据：SKILL.md「表字段 vs 数据点」核心规则、[templates/fetch-latest-tags.md](templates/fetch-latest-tags.md)

### C. `core/data/query` body 必须为数组

**断言**：历史趋势查询请求的 body **必须是数组**，不是单个对象。

```typescript
// ❌ 单对象
request('core/data/query', { method: 'POST', body: { tableId, tags, where } })

// ✅ 数组
request('core/data/query', { method: 'POST', body: [{ tableId, tags, where }] })
```

依据：client-api.md

### D. `core/data/latest` 点结构

**断言**：当前值请求的 body 元素必须含三个键：`{ tableId, id, tagId }`（注意请求里是 `id`）。响应映射 key 用 `${item.id || item.tableDataId}::${item.tagId}`。

```typescript
// ✅ 点结构完整
const body = [{ tableId: 'device', id: 'd001', tagId: 'temperature' }]
```

依据：client-api.md、[device-data.md](platform/device-data.md)、[templates/fetch-latest-tags.md](templates/fetch-latest-tags.md)

### E. 聚合函数约束（带 group 时）

**断言**：`core/data/query` 带 `group` 时，`fields` 每项**必须用聚合函数包裹**（`LAST` / `FIRST` / `MEAN` / `MAX` / `MIN` / `SUM` / `COUNT`）；裸字段名仅在**无 group** 时允许。取最新值用 `LAST("tagId") AS "tagId"`，并带 `id`。

```typescript
// ❌ 带 group 用裸字段
{ group: ['1h'], fields: ['temperature'] }

// ✅ 带 group 用聚合函数
{ group: ['1h'], fields: ['id', 'LAST("temperature") AS "temperature"'] }
```

依据：[device-data.md](platform/device-data.md)

### F. resource 一致性

**断言**：每个 `createResourceClient` 的 `resource` 与其内部 `createHttpClient` 的 `resource` 字符串**一致**（拼写错位会导致 404）。

```typescript
// ❌ 两处 resource 不一致
const client = createHttpClient({ resource: 'core/t/building/d' })
const api = createResourceClient({ client, resource: 'core/t/building_info/d' })

// ✅ 一致
const resource = 'core/t/building/d'
const api = createResourceClient({ client: createHttpClient({ resource }), resource })
```

依据：client-api.md

### G. 仪表盘统计卡片不得逐表 count()

**断言**：Dashboard 页面的统计卡片数据源**不得**是循环 `api.count()` 聚合，应来自 `core/systemVariable`（配合 queryLatest / queryHistory）。

```typescript
// ❌ 逐表 count 聚合统计
for (const t of tables) total += await api(t).count()

// ✅ systemVariable
const { items } = await sysVarApi.query({ filter: { fields: ['id', 'uid', 'value'] } })
```

依据：SKILL.md「页面设计报告」规则、[system-variable.md](platform/system-variable.md)

### H. 订阅 Provider 前置

**断言**：任何页面用了 `useTag` / `useTableData` 时，`src/main.tsx` 根必须有 `<Subscribe>` 包裹（模板默认满足，若生成代码改了入口需复核）。

```typescript
// ✅ main.tsx
<Subscribe><App /></Subscribe>
```

依据：[client-subscribe.md](client-subscribe.md)

### I. 接口文档对照

**断言**：A–H 是通用约束，但每个具体接口还有自己的文档约定。对每个 API 请求，按 resource 路径定位对应的 references 文档，**回查文档**验证：路径（含 `/d` 等后缀）、HTTP 方法、请求参数结构、必传项、固定字段。不要只凭通用规则，要对照该接口的 source 文档。

接口 → 文档映射（见 [INDEX.md](INDEX.md)「平台资源 API」）：

| resource 模式 | 对照文档 |
|---|---|
| `core/t/{tableId}/d` | [table-data.md](platform/table-data.md) |
| `core/data` `core/data/query` `core/data/latest` | [device-data.md](platform/device-data.md) |
| `core/user` | [user.md](platform/user.md) |
| `core/role` | [role.md](platform/role.md) |
| `core/log` `syslog/log` | [log.md](platform/log.md) |
| `driver/driverInstance` | [driver.md](platform/driver.md) |
| `core/systemVariable` | [system-variable.md](platform/system-variable.md) |
| `warning/warning` `warning/rule` | [warning.md](platform/warning.md) |
| `core/catalog` 等 | [misc.md](platform/misc.md) |

> 例：代码里查 `warning` 资源 → 回查 warning.md，确认**必须传 fields**（不支持 projectAll）；查 `systemVariable` 单条 → 回查确认不支持 `get(id)`，必须 `query` 按 `id`/`uid` 过滤。这些是 A–H 之外的**接口特有约束**，不回查文档会漏。

### J. 轮询 vs WebSocket 订阅

**断言**：扫描轮询模式（`setInterval` / 递归 `setTimeout` / `refetchInterval` 等定时重复请求），对每个轮询判断两件事：

1. **能否用 ws 订阅替代**：KESI 的实时能力走 `/ws`——`useTag`（实时数据点）/ `useTableData`（实时表字段）。若轮询取的是设备数据点或实时表字段，**应优先改订阅**，避免无谓轮询。

2. **是否真的需要 ws**：订阅是长连接，不是所有场景都划算。按下表决策：

| 轮询场景 | 建议 | 理由 |
|---|---|---|
| 实时设备数据点（温度、状态、在线） | ✅ 改 `useTag` | 高实时，ws 推送更省、更及时 |
| 实时表字段变化 | ✅ 改 `useTableData` | 同上 |
| 报警实时推送 | ✅ 改订阅 | 事件驱动，轮询有延迟 |
| 仪表盘统计卡片（低频聚合） | ⚠️ 轮询可接受 | 聚合数据，低频刷新，ws 不划算 |
| 历史趋势刷新 | ❌ 不用 ws | 历史数据非实时，一次性查询 / 手动刷新即可 |

```typescript
// ❌ 设备温度用轮询
useEffect(() => {
  const t = setInterval(() => fetchLatest(), 5000)
  return () => clearInterval(t)
}, [])

// ✅ 实时数据点改订阅（ws）
const { value } = useTag({ tableId, id, tagId: 'temperature' })
```

依据：[client-subscribe.md](client-subscribe.md)、[device-data.md](platform/device-data.md)

---

## 二、认证 API 要点

| 检查点 | 约定 | 依据 |
|--------|------|------|
| 登录端点 | 固定 `core/auth/login`，登出 `core/auth/logout` | client-auth.md |
| 密码传输 | 前端 `sha1(password)`，非明文 | client-auth.md |
| 发起方式 | 用 `useLogin().onLogin`，**不要**手写 fetch 到 `core/auth/login` | client-auth.md |
| token 持久化 | `onLogin` 已处理；remember=true→localStorage，否则 sessionStorage；key 固定 `'user'`，7 天有效 | client-auth.md |
| 会话恢复 | `main.tsx` 必须调 `loadUser()`（否则刷新即登出） | client-auth.md |

> 登录页的**组件结构**检查（ProtectedRoute 守卫、路由挂载、Subscribe 包裹）见 SKILL.md「生成后静态验证」②③。

---

## 三、扫描方法建议

```bash
# 定位所有资源客户端与查询调用
grep -rn "createResourceClient" src/
grep -rn "\.query(" src/

# 定位设备数据点请求（应为数组、点结构、聚合约束）
grep -rn "core/data/query\|core/data/latest" src/

# 定位订阅使用，回查 main.tsx 是否有 <Subscribe>
grep -rn "useTag\|useTableData" src/
grep -n "Subscribe" src/main.tsx

# 仪表盘统计是否误用 count()
grep -rn "\.count()" src/pages/dashboard/ 2>/dev/null

# 定位轮询请求（评估能否改用 ws 订阅，见规则 J）
grep -rn "setInterval\|setTimeout\|refetchInterval" src/
```

---

## 四、验证报告格式

输出每项结论 + 问题定位：

```
API 校验报告
─────────────────────────
A. 字段投影        ✅ / ⚠️ src/pages/xxx.tsx:42
B. 数据点来源      ✅
C. query body 数组 🔴 src/lib/api.ts:88  ← 必须修复
D. latest 点结构   ✅
E. 聚合约束        ✅
F. resource 一致   ✅
G. 仪表盘统计      ✅
H. 订阅 Provider   ✅
I. 接口文档对照    ✅
J. 轮询 vs 订阅    ⚠️ src/pages/xxx.tsx:30（建议改订阅）
认证 API           ✅
─────────────────────────
🔴 必须修复 1 项 / ⚠️ 建议项 1 项
```

> 🔴 必须修复后才能交接；⚠️ 记录告知，不阻塞。`self-loop` 路由下（UI 由 kesi-frontend 自闭环）尤须保证 A/B 无违反。
