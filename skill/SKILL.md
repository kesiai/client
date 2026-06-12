---
name: kesi-frontend
description: "KESI 前端架构师 — 接收 kesi-cli 的 scan 数据，结合项目业务域分析，输出完整的前端页面设计报告：需要哪些页面、每页展示什么数据、用表格/列表/图表/文本哪种方式、是否需要过滤器/CRUD、数据用 API/Model/ViewModel/订阅哪种方式获取、页面间如何联动。然后创建项目，交接给 kesi-ui 做 UI 实现。"
---

# KESI 前端架构设计

接收平台数据，设计前端页面方案，指导 UI 实现。

> 参考文档索引：[references/INDEX.md](references/INDEX.md) — 按需查阅，不要一次性读取所有文件。

---

## 目录

- [输入验证与交接](#输入验证与交接)
- [前端规划报告生成](#前端规划报告生成)
- [项目创建与代码生成](#项目创建与代码生成)
- [技术栈与开发规范](#技术栈与开发规范)
- [交接给 kesi-ui](#交接给-kesi-ui)

---

## 输入验证与交接

### 输入来源

从 kesi-cli Phase 3 交接获得 `handoff.json`。

### 验证清单

接收 handoff.json 后，**必须先验证以下各项**：

1. ✅ `handoff.json` 存在且可解析
2. ✅ `version` 字段为 `"1.0"`
3. ✅ `tables` 数组非空
4. ✅ 每个 device 表都有 `tags` 数组
5. ✅ `server.url` 和 `server.projectId` 非空

如果任何一项失败 → 报告具体缺失项，要求用户回到 kesi-cli 补全。

---

## 前端规划报告生成

> 从 handoff.json 接收数据后，生成前端规划报告。详细设计方法论参考 → [references/iot-product-design.md](references/iot-product-design.md)

```
━━━ kesi-frontend Step 1/3 ━━━
📋 当前任务：分析业务域 + 生成页面设计报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 分析维度

**1. 页面交互模式推导：**

| 数据特征 | AI 推导的交互模式 |
|----------|-----------------|
| 设备表（device） | 带过滤的展示：表格 + 在线/报警状态 + 关键数据点 |
| 配置型数据（楼宇、区域、人员等） | 带过滤的展示 |
| 日志/记录型数据 | 带过滤的展示 |
| 仪表盘/概览页 | 纯展示：统计卡片 + 趋势图 + 状态概览 |
| 用户明确要求增删改查 | CRUD 管理 |

> **默认为展示型页面。** AI 分析数据特征后自动决定。

**2. 数据展示方式推导：**

| 数据特征 | 推荐展示方式 |
|----------|------------|
| 设备列表（多行结构化数据） | 表格 |
| 统计指标（总数、在线率等） | 卡片 + 数字 |
| 时序数据（温度、电量趋势） | 折线图/柱状图 |
| 占比分布 | 饼图/环形图 |
| 地理位置数据 | 地图 |
| 设备在线/报警状态 | 表格列 + 状态标记 |

**3. 数据获取方式推导：**

| 场景 | 获取方式 | 详细文档 |
|------|---------|---------|
| 页面级数据查询 | `createResourceClient.query` / `.count` | [references/client-api.md](references/client-api.md) |
| 实时数据点订阅 | `useTag` | [references/client-subscribe.md](references/client-subscribe.md) |
| 实时字段变化 | `useTableData` | [references/client-subscribe.md](references/client-subscribe.md) |
| 历史趋势数据 | `createHttpClient` + POST `core/data/query` | [references/platform/device-data.md](references/platform/device-data.md) |
| CRUD 操作 | `ViewModel` | 交接给 kesi-ui |

**4. 页面生成规则：**

| 表类型 | 自动生成的页面 |
|--------|--------------|
| 存在 device 表时 | 自动生成「数据概览」仪表盘（纯展示） |
| 每个 device 表 | 对应的设备列表页 |
| 每个 normal 表 | 对应的数据列表页 |
| `dataAuth` | 组织管理页（树形结构） |

### ⚠️ 核心规则：表字段 vs 数据点

KESI 设备表有**两种完全不同的数据**，绝不能混淆：

| 类型 | 说明 | 查询方式 |
|------|------|---------|
| **表字段** | Schema 定义的静态属性 | `createResourceClient.query()` |
| **数据点（tags）** | 设备采集的实时传感器数据 | `fetchLatestTags` / `useTag` / `core/data/query` |

**设备传感器数据绝不能从 `createResourceClient.query()` 获取。**

### 输出：页面设计报告格式

```
📋 前端页面设计报告

━━━ 业务域分析 ━━━
- 项目类型：<智慧楼宇/智慧工厂/...>
- 核心业务域：<能源/安防/环境/...>
- 数据特征：<设备表 N 张、普通表 N 张、数据点 M 个>

━━━ 页面结构 ━━━
1. 数据概览
2. <页面A>（<数据源>）
3. <页面B>（<数据源>）

━━━ 页面设计 ━━━
1. 数据概览（仪表盘）
   - 交互模式：纯展示
   - 展示内容：
     ├── 统计卡片：设备总数、在线率、报警数（数据源：systemVariables）
     ├── 趋势图：关键数据点 24h 变化（数据源：queryHistory）
     └── 设备分布：各子系统在线/离线/报警分布
   - 数据获取：systemVariable + queryLatest + queryHistory
   - ⚠️ 禁止用逐表 count() 聚合统计卡片

2. <表标题>页（table_id: xxx）
   - 交互模式：带过滤的展示 / CRUD
   - 表类型：<normal/device>
   - 展示方式：<表格/卡片列表/...>
   - 过滤器：<列出过滤字段>
   - 数据字段：<列出展示字段>
   - 实时数据（device 表）：<列出需订阅的数据点>
   - 页面间联动：<关联页面>

━━━ 数据获取方案 ━━━
- API Client：<资源客户端列表>
- useTag/useTableData：<实时订阅列表>

━━━ 页面数量 ━━━
- 共约 N 个页面
```

**用户确认报告后，才能创建项目和生成代码。**

---

## 项目创建与代码生成

```
━━━ kesi-frontend Step 2/3 ━━━
📋 当前任务：创建项目 + 生成代码
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 创建项目

```bash
npx create-kesi-app my-project --server <服务器地址> --project-id <项目ID>
```

> 服务器地址和项目 ID 从 `handoff.json` 的 `server` 字段获取。

### 创建后验证

```bash
# 检查项目目录
ls <projectPath>/package.json <projectPath>/vite.config.ts <projectPath>/tsconfig.json

# 检查核心依赖
cat <projectPath>/package.json | grep -E '"@kesi/client"|"react"|"react-router-dom"'
```

任何检查失败 → 报告缺失项，不继续生成代码。

### 代码生成顺序

> `fetchLatestTags` 通用函数模板：[references/templates/fetch-latest-tags.md](references/templates/fetch-latest-tags.md)

1. **API 层** — 生成 `createResourceClient` + `queryLatest` + `queryHistory` + `fetchLatestTags`
2. **数据展示页** — 组合 `query()` + `fetchLatestTags()` 模式
3. **仪表盘** — systemVariable 统计卡片 + echarts 趋势图
4. **CRUD 管理页**（用户指定时）— 使用 ViewModel 系统
5. **菜单路由** — 根据报告配置路由和侧边栏
6. **实时订阅**（可选增强）— `useTag` / `useTableData` 替换 `queryLatest`

### 文件操作安全规则

1. **新增文件**：直接 Write
2. **修改已有文件**：必须使用 Edit（不是 Write），保留未改动部分
3. **覆盖已有文件**：先 Read 确认内容，告知用户将被覆盖的部分

### 大库策略（scan 数据 > 50KB 时）

- 按业务域分批生成页面
- 每批 3-5 个页面，生成后验证 TypeScript 编译
- 先生成骨架（import + 组件结构），再逐个填充逻辑

---

## 交接给 kesi-ui

```
━━━ kesi-frontend Step 3/3 ━━━
📋 当前任务：交接设计报告 + 项目给 kesi-ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 交接 Schema（写入 `design-report.json`）

```json
{
  "version": "1.0",
  "source": "kesi-frontend",
  "target": "kesi-ui",
  "projectPath": "<项目路径>",
  "pages": [
    {
      "id": "<pageId>",
      "title": "<页面标题>",
      "route": "<路由路径>",
      "mode": "display|filter-display|crud|gis",
      "tableId": "<数据表ID>",
      "displayFields": [
        { "key": "<fieldKey>", "title": "<标题>", "type": "field|tag" }
      ],
      "filterFields": ["<fieldKey>"],
      "subscription": {
        "tags": ["<tagId>"],
        "tableData": false
      },
      "layout": "table|cards|chart|map|mixed"
    }
  ],
  "dashboard": {
    "cards": [],
    "charts": [],
    "systemVariables": []
  }
}
```

### 交接话术

> ✅ 前端项目已创建，代码已生成。请使用 `/kesi-ui` skill，读取 `design-report.json` 实现 UI 组件。

---

## 技术栈与开发规范

### 技术栈

React 19 + shadcn/ui (base-nova) + Vite 8 + TypeScript 6 + Tailwind CSS v4

预装核心依赖：`@kesi/client`、`@base-ui/react`、`react-router-dom`、`jotai`、`lucide-react`、`sonner`

### 项目结构

```
my-project/
  .env                        # VITE_KESI_PROJECT_ID
  components.json             # shadcn/ui + kesi-ui registry 配置
  vite.config.ts              # 路径别名 + API 代理
  src/
    main.tsx                  # setConfig + HashRouter + Subscribe
    App.tsx                   # ProtectedRoute + 路由
    lib/
      utils.ts                # cn()
      config.ts               # initConfig()
    components/
      layout/AppLayout.tsx    # 侧边栏布局
      ui/                     # shadcn/ui 基础组件
    pages/
      auth/LoginPage.tsx
      dashboard/DashboardPage.tsx
    data/
      menu.ts                 # 菜单配置
```

### 开发规范

- 页面组件：PascalCase（`UserManagementPage.tsx`）
- 区块组件：PascalCase（`DataTable.tsx`）
- UI 组件：kebab-case（`button.tsx`）
- 所有组件使用 TypeScript 函数组件 + Hooks

### 客户端 API 速查

> 完整文档按需查阅 [references/INDEX.md](references/INDEX.md)

```typescript
import { createHttpClient, createResourceClient } from '@kesi/client'

// 创建资源客户端
const api = createResourceClient<T>({
  client: createHttpClient({ resource: 'core/t/<tableId>/d' }),
  resource: 'core/t/<tableId>/d',
})
const { items, total } = await api.query({ limit: 100 })
const count = await api.count()
```

### 模块索引

| 模块 | 关键 API | 详细文档 |
|------|---------|---------|
| HTTP | `createHttpClient`, `createResourceClient` | [references/client-api.md](references/client-api.md) |
| 平台数据 | 资源字段、数据点、报警 | [references/client-platform-resources.md](references/client-platform-resources.md) |
| 认证 | `useLogin`, `useUser` | [references/client-auth.md](references/client-auth.md) |
| 表单 | `useForm`, `useFieldUIState` | [references/client-form.md](references/client-form.md) |
| Model | `Model`, `TableModel`, 24+ hooks | [references/client-model.md](references/client-model.md) |
| 订阅 | `Subscribe`, `useTag`, `useTableData` | [references/client-subscribe.md](references/client-subscribe.md) |
| 事件 | `useEvents`, `useEvent` | [references/client-event.md](references/client-event.md) |
| 配置 | `setConfig`, `getConfig` | [references/client-config.md](references/client-config.md) |
| 最佳实践 | Provider 嵌套、CRUD 示例 | [references/client-patterns.md](references/client-patterns.md) |
