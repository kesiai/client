# 平台数据查询指南

> KESI 平台前端数据查询的完整参考。按 API 接口模块拆分，每个文件对应一个独立模块。

## 核心规则

- **数据表记录**：`resource: 'core/t/<tableId>/d'`（**必须加 `/d` 后缀**）
- **平台资源**：`resource: '<资源路径>'`（**无 `/d` 后缀**）
- **所有字段都可用于过滤**，不受中台 filterSchema 配置限制
- **过滤操作符**：`$eq`、`$ne`、`$gt`、`$gte`、`$lt`、`$lte`、`$regex`、`$in`、`$nin`、`$and`、`$or`

> **关于 API 风格：** 下方示例使用新版 `createHttpClient` + `createResourceClient`（推荐）。旧版 `createAPI` 仍可用，新项目推荐使用新 HTTP 模块。详见 `client-api.md`。

## 模块索引

| 模块 | 端点 | 文档 |
|------|------|------|
| 用户管理 | `core/user` | [platform/user.md](platform/user.md) |
| 角色管理 | `core/role` | [platform/role.md](platform/role.md) |
| 操作日志 | `core/log`、`syslog/log` | [platform/log.md](platform/log.md) |
| 表 Schema | `core/t/schema` | [platform/table-schema.md](platform/table-schema.md) |
| 表数据 CRUD | `core/t/{tableId}/d` | [platform/table-data.md](platform/table-data.md) |
| 设备数据点 | `core/data`、`core/t/tags` | [platform/device-data.md](platform/device-data.md) |
| 设备指令 | `core/t/schema/command`、`core/t/schema/commands` | [platform/device-command.md](platform/device-command.md) |
| 报警系统 | `warning/warning`、`warning/rule` | [platform/warning.md](platform/warning.md) |
| 驱动管理 | `driver/driverInstance` | [platform/driver.md](platform/driver.md) |
| 系统变量 | `core/systemVariable` | [platform/system-variable.md](platform/system-variable.md) |
| 其他资源 | `catalog`、`report`、`ds/interface` | [platform/misc.md](platform/misc.md) |

## 注意事项

1. **资源路径规则**：数据表记录加 `/d`，平台资源不加 `/d`
2. **系统注入字段**：查询记录时后端自动附加 `id`、`_table`、`_title`、`createTime`、`updateTime`、`creator`、`modifier` 等
3. **设备表预设字段**：`id`、`name`、`connectTime`、`disable`、`online`、`off`、`warnFlag` 是固定 7 字段
4. **数据点 vs 字段**：字段是 schema 定义的结构化数据，数据点是设备采集的实时时序数据，查询方式完全不同
