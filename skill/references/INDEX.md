# KESI 客户端参考文档索引

> AI Agent 先读本索引定位文档，再按需 Read 对应文件。不要一次性读取所有文件。

---

## 客户端模块（references/ 根目录）

| 文件 | 模块 | 说明 | 关键 API |
|------|------|------|---------|
| [client-api.md](client-api.md) | HTTP 模块 | HTTP 客户端 + 资源 CRUD 封装 | `createHttpClient`, `createResourceClient` |
| [client-auth.md](client-auth.md) | 认证模块 | 登录、验证码、用户信息 | `useLogin`, `useUser` |
| [client-config.md](client-config.md) | 配置模块 | 全局配置、Toast 消息 | `setConfig`, `getConfig`, `useMessage` |
| [client-event.md](client-event.md) | 事件系统 | UI 交互事件绑定（点击、双击等） | `useEvents`, `useEvent` |
| [client-form.md](client-form.md) | 表单模块 | react-hook-form 封装 + 字段 UI 状态 | `useForm`, `useFieldUIState` |
| [client-model.md](client-model.md) | Model 模块 | Jotai 状态管理、24+ 数据 hooks | `Model`, `TableModel`, `useModelList`, `useModelSave` |
| [client-page-hooks.md](client-page-hooks.md) | 页面 Hooks | 页面变量、数据源、工具函数 | `usePageVar`, `useDatasourceValue` |
| [client-patterns.md](client-patterns.md) | 最佳实践 | Provider 嵌套、CRUD 示例、路由守卫 | 综合示例 |
| [client-subscribe.md](client-subscribe.md) | 订阅模块 | 实时数据点 + 表字段订阅 | `Subscribe`, `useTag`, `useTableData` |
| [api-validation.md](api-validation.md) | API 校验 | 代码生成后数据请求正确性断言（A–J 硬规则 + 认证 API） | 生成后静态验证用 |

## 平台资源 API（references/platform/）

| 文件 | 资源路径 | 说明 |
|------|---------|------|
| [platform/table-data.md](platform/table-data.md) | `core/t/{tableId}/d` | 表记录 CRUD（路径必须带 `/d`） |
| [platform/table-schema.md](platform/table-schema.md) | `core/t/schema` | 表定义 CRUD |
| [platform/device-data.md](platform/device-data.md) | `core/data`, `core/t/tags` | 设备数据点查询、当前值、历史趋势 |
| [platform/device-command.md](platform/device-command.md) | `core/t/schema/command` | 设备控制指令 |
| [platform/warning.md](platform/warning.md) | `warning/warning`, `warning/rule` | 报警事件（必须传 fields）+ 报警规则 |
| [platform/system-variable.md](platform/system-variable.md) | `core/systemVariable` | 数据字典 / 系统变量（仪表盘统计卡片用） |
| [platform/user.md](platform/user.md) | `core/user` | 用户管理 |
| [platform/role.md](platform/role.md) | `core/role` | 角色管理 |
| [platform/log.md](platform/log.md) | `core/log`, `syslog/log` | 操作日志 + 系统日志 |
| [platform/driver.md](platform/driver.md) | `driver/driverInstance` | 驱动实例管理 |
| [platform/misc.md](platform/misc.md) | `core/catalog` 等 | 数据分组、报表、数据接口 |

## 模板（references/templates/）

| 文件 | 说明 |
|------|------|
| [templates/fetch-latest-tags.md](templates/fetch-latest-tags.md) | `fetchLatestTags` 通用函数模板 + 使用示例 |

## 按场景速查

| 场景 | 推荐阅读顺序 |
|------|------------|
| 创建 API 层 | client-api.md → platform/table-data.md → templates/fetch-latest-tags.md |
| 设备数据展示 | client-api.md → platform/device-data.md → client-subscribe.md |
| CRUD 页面 | client-model.md → client-form.md → client-patterns.md |
| 仪表盘 | platform/system-variable.md → platform/device-data.md |
| 实时订阅 | client-subscribe.md → platform/device-data.md |
| 认证登录 | client-auth.md → client-config.md |
| 代码校验（生成后） | api-validation.md（数据请求 A–J + 认证 API） |

## 关键约束速记

- **表字段 vs 数据点**：`createResourceClient.query()` 只返回 schema 字段，不返回 tags 值
- **数据点必须用专用 API**：`fetchLatestTags`（当前值）/ `useTag`（实时订阅）/ `core/data/query`（历史）
- **报警查询必须传 fields**：不支持 `projectAll`
- **字段投影规则**：自定义表（`core/t/*/d`）字段动态 → **不传 fields**（SDK 自动 projectAll）；平台资源（user/role/log/driver/catalog 等）字段固定 → **必须传 fields**
- **系统变量不支持 get(id)**：`core/systemVariable` 取单条必须用 `query` 按 `id`/`uid` 过滤（仪表盘统计卡片常用）
- **表记录路径带 `/d`**：`core/t/{tableId}/d`，其他平台资源不带
