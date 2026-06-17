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

> 从 handoff.json 接收数据后，基于业务域自主分析，按下方分析维度推导页面方案。

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

**5. UI 路由决策推导（决定 UI 实现交给谁）：**

遍历 pages 数组的 `mode` 字段，聚合出两个布尔值：

| 聚合条件 | 布尔值 | 来源 |
|----------|--------|------|
| 存在任意 `mode:"crud"` | `hasCrud` | pages 聚合 |
| 存在任意 `mode:"gis"` | `hasGis` | pages 聚合 |

再结合用户是否指定设计 skill（见下方「用户确认报告」环节的询问），按下表写出 `uiRouting.route`（UI 路由总开关）：

| hasCrud / hasGis | 用户指定设计 skill | uiRouting.route | UI 交给谁 |
|:---:|:---:|:---:|---|
| 否 | 否 | `self-loop` | kesi-frontend 自闭环（shadcn + echarts 写完所有页面） |
| 否 | 是 | `design-skill` | 用户指定的设计 skill |
| 是 | 否 | `kesi-ui` | kesi-ui（当前默认） |
| 是 | 是 | `kesi-ui+design-skill` | kesi-ui 做 CRUD/GIS 专用组件 + 设计 skill 做视觉布局 |

> 决策在 Step 1/3 业务域分析完成时算好，写进 `design-report.json` 的 `uiRouting` 字段，下游（kesi-ui / 设计 skill）只读不决策。

### ⚠️ 核心规则：表字段 vs 数据点

KESI 设备表有**两种完全不同的数据**，绝不能混淆：

| 类型 | 说明 | 查询方式 |
|------|------|---------|
| **表字段** | Schema 定义的静态属性 | `createResourceClient.query()` |
| **数据点（tags）** | 设备采集的实时传感器数据 | `fetchLatestTags` / `useTag` / `core/data/query` |

**设备传感器数据绝不能从 `createResourceClient.query()` 获取。**

### ⚠️ 核心规则：字段投影（fields vs projectAll）

后端默认只按 `tableSchema` 投影，不加投影参数自定义字段会丢失。SDK 行为：`filter.fields` 为空时自动注入 `projectAll: true`。

| 数据源 | 字段特征 | 生成代码规则 |
|--------|---------|------------|
| 自定义表 `core/t/{tableId}/d` | 动态（schema 定义，无法穷举） | **不传 fields**，依赖默认 projectAll 返回全部字段 |
| 平台资源 `core/user`、`core/role`、`core/log`、`driver/driverInstance` 等 | 固定 | **必须传 fields**，显式列出（字段表见各 `references/platform/*.md`） |

> 详见 [references/client-api.md](references/client-api.md)「字段投影规则」。

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

**用户确认报告时，必须顺带确认以下两项：**

1. 页面设计报告内容是否符合预期？
2. UI 实现是否指定一个设计 skill？（如系统中已有的 `ui-ux-pro-max` 等）

询问话术模板：

> 📋 以上为页面设计报告。请确认：
> 1. 报告内容是否符合预期？
> 2. 本项目 UI 实现，你希望指定一个设计 skill 吗？
>    - **不指定**：我（kesi-frontend）将自动用 shadcn + echarts 完成所有展示型页面 UI；
>      （如需大屏级视觉质量，建议指定设计 skill）
>    - **指定**：请给出 skill 名（例：`ui-ux-pro-max`）

根据回答填写 `uiRouting.designSkill`：

- 用户给出 skill 名 → `designSkill: "<skill名>"`
- 用户不指定 → `designSkill: null`

> skill 名仅作「例」，不硬编码依赖；用户给出的 skill 名原样回填。确认后才能创建项目和生成代码。

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

**通用前置（所有路由象限都做）：**

1. **API 层** — 生成 `createResourceClient` + `queryLatest` + `queryHistory` + `fetchLatestTags`
2. **仪表盘** — systemVariable 统计卡片 + echarts 趋势图
3. **菜单路由** — 根据报告配置路由和侧边栏
4. **实时订阅**（可选增强）— `useTag` / `useTableData` 替换 `queryLatest`

**按 `uiRouting.route` 分支的页面 UI 生成：**

- **`self-loop` / `design-skill` 象限**（无 CRUD/GIS）：
  5. **展示型页面 UI 完整实现** — 用 shadcn Table/Card + 自定义 Filter + echarts，
     把所有 `uiRouting.selfHandledPages`（mode 为 display/filter-display 的页面）的 UI 写到可运行程度。
     **不引入任何 kesi-ui 专用组件**（无 ViewModel / GIS 套件）。

- **`kesi-ui` / `kesi-ui+design-skill` 象限**（有 CRUD/GIS）：
  5. **数据展示页** — 组合 `query()` + `fetchLatestTags()` 模式生成展示型页面；
     CRUD 管理页（mode=crud）与 GIS 页面（mode=gis）的 UI **留给 kesi-ui**（ViewModel / GIS 套件），
     本步仅留占位，不实现专用组件。

### 文件操作安全规则

1. **新增文件**：直接 Write
2. **修改已有文件**：必须使用 Edit（不是 Write），保留未改动部分
3. **覆盖已有文件**：先 Read 确认内容，告知用户将被覆盖的部分

### 大库策略（scan 数据 > 50KB 时）

- 按业务域分批生成页面
- 每批 3-5 个页面，生成后验证 TypeScript 编译
- 先生成骨架（import + 组件结构），再逐个填充逻辑

### 生成后静态验证（自检 gate，交接前必须执行）

> 所有页面代码生成完成后、交接给 UI 实现 skill 之前，必须通过以下静态验证。这是保证「**有登录页**」+「**可登出**」+「**数据请求正确**」的代码层质量门，不依赖网络、不需启动项目。

**① TypeScript 编译**

```bash
cd <projectPath> && npx tsc -b
```

- 零错误通过 → ✅（模板无独立 typecheck script，用 `tsc -b`）
- 有错误 → 🔴 必须修复后才能交接

**② 项目结构断言（登录页链路）**

检查以下文件存在且内容符合约定：

- `src/pages/auth/LoginPage.tsx` 存在，且使用 `useLogin().onLogin`（不是手写 fetch 到 `core/auth/login`）
- `src/App.tsx` 含 `ProtectedRoute` 守卫：`useUser().user == null` → `Navigate to="/login"`
- `src/main.tsx` 调用了 `loadUser()`（刷新恢复会话）且根有 `<Subscribe>` 包裹
- `.env` 含 `VITE_PROJECT_ID`

**③ 登录链路 checklist**

1. LoginPage 组件存在且挂 `/login` 路由
2. 用 `useLogin().onLogin` 发起登录
3. ProtectedRoute 守卫存在（未登录跳 `/login`）
4. main.tsx 调用 `loadUser()`
5. `<Subscribe>` 在根
6. （建议项）是否处理 `showCode` 验证码 / `needChangePwd` 分支

> 认证 API 细节（`core/auth/login` 端点、SHA1 密码、token 持久化）见 [references/api-validation.md](references/api-validation.md)「认证 API」。

**③′ 登出链路 checklist**

> `useLogout().onLogout` 固定调用 `core/auth/logout`，清空 user 并 `navigate('/logout')`。因此「可登出」= 存在登出入口 **且** `/logout` 路由可达（否则点击登出后白屏 404）。

1. 登出入口存在 — 受保护布局（`AppLayout` / 顶部栏 / 用户菜单）中有「退出」按钮，绑定 `useLogout().onLogout`（不是手写 fetch 到 `core/auth/logout`）
2. `useLogout` 来源正确 — 从 `@kesi/client` 导入，而非自造登出函数
3. `/logout` 路由可达 — `App.tsx` 注册了 `/logout`（落地页：重定向回 `/login` 或渲染「已退出」提示页）。**注意 `onLogout` 内部硬编码 `navigate('/logout')`，漏配此路由 = 登出后 404**
4. 守卫闭环 — 登出后 `user` 置 `null`，ProtectedRoute 应把用户挡回 `/login`（与登录链路 ③-3 同一套守卫，无需重复实现）
5. 残留 token 清理 — 验证 `onLogout` 已清理 `localStorage`/`sessionStorage` 中的 `user` key（SDK 已内置，自造函数常漏）

**④ 数据请求正确性 — 硬规则扫描**

> 完整断言清单（A–J 十条硬规则 + 认证 API 要点 + 扫描方法 + 报告格式）见 **[references/api-validation.md](references/api-validation.md)**。本文件不内联，避免与 references 重复维护。

对照 `design-report.json` 的 pages 与 handoff.json 的 scan 数据，扫描生成的源码。十条硬规则覆盖：

- **A** 字段投影（自定义表不传 fields / 平台资源必传）
- **B** 数据点来源（tag 不能从 query 取）
- **C** `core/data/query` body 必须数组
- **D** `core/data/latest` 点结构 `{tableId,id,tagId}`
- **E** 带 group 必须聚合函数
- **F** resource 与 client.resource 一致
- **G** 仪表盘禁逐表 count()
- **H** 订阅需 `<Subscribe>` 包根
- **I** 接口文档对照（每个请求回查 platform 文档验证路径/方法/必传项）
- **J** 轮询 vs 订阅（轮询请求评估能否改 ws 订阅、是否值得）

**验证报告输出**：列出每项 ✅/⚠️/🔴，附问题 `文件:行号`。

- ① 编译 🔴 → 必须修复后才能交接
- 其余 ⚠️ → 记录并告知用户，不阻塞交接
- `self-loop` 路由下（UI 由 kesi-frontend 自闭环）尤须保证展示页无 A/B 规则违反

---

## 交接给 kesi-ui

```
━━━ kesi-frontend Step 3/3 ━━━
📋 当前任务：交接设计报告 + 项目给 kesi-ui
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 交接 Schema（写入 `design-report.json`）

> **路由字段 `uiRouting`**：kesi-frontend 算好后写入，下游 kesi-ui / 设计 skill 只读不决策。其中 `route` 是 UI 路由总开关。
> 注意：顶层历史字段 `target`（产出物目标）保持不变，**真正的 UI 路由信号是 `uiRouting.route`**，二者不要混淆。

```json
{
  "version": "1.0",
  "source": "kesi-frontend",
  "target": "kesi-ui",
  "projectPath": "<项目路径>",
  "uiRouting": {
    "hasCrud": false,
    "hasGis": false,
    "designSkill": null,
    "route": "self-loop|kesi-ui|design-skill|kesi-ui+design-skill",
    "crudPages": ["<需 kesi-ui ViewModel 套件的 pageId>"],
    "gisPages": ["<需 kesi-ui GIS 套件的 pageId>"],
    "selfHandledPages": ["<display/filter-display 页面 pageId，自闭环时由 kesi-frontend 写完>"]
  },
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

### 交接话术（按 `uiRouting.route` 选择）

> 决策结果 `uiRouting.route = <值>`，对应话术如下：

**① `self-loop`（kesi-frontend 自闭环，不交接）：**
> ✅ 前端项目已创建，所有展示型页面 UI 已由 kesi-frontend 用 shadcn + echarts 完整实现。
> 本项目无 CRUD/GIS 需求，无需调用 kesi-ui。
> （如后续需要大屏级视觉增强，可指定设计 skill 重新实现。）

**② `design-skill`（交给用户指定的设计 skill）：**
> ✅ 前端项目已创建，数据接入代码已生成。
> UI 视觉实现交给设计 skill `/<designSkill>`，请读取 `design-report.json` 完成页面 UI。
> （本项目无 CRUD/GIS，kesi-ui 不参与。）

**③ `kesi-ui`（当前默认，有 CRUD/GIS 未指定设计 skill）：**
> ✅ 前端项目已创建，代码已生成。请使用 `/kesi-ui` skill，读取 `design-report.json` 实现 UI 组件。

**④ `kesi-ui+design-skill`（组合，有 CRUD/GIS 且指定了设计 skill）：**
> ✅ 前端项目已创建，代码已生成。UI 实现分两步：
> 1. `/kesi-ui`：实现 CRUD/GIS 专用组件（见 `uiRouting.crudPages` / `gisPages`）
> 2. `/<designSkill>`：负责整体视觉与布局风格

---

## 技术栈与开发规范

### 技术栈

React 19 + shadcn/ui (base-nova) + Vite 8 + TypeScript 6 + Tailwind CSS v4

预装核心依赖：`@kesi/client`、`@base-ui/react`、`react-router-dom`、`jotai`、`lucide-react`、`sonner`

### 项目结构

```
my-project/
  .env                        # VITE_PROJECT_ID
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
| 平台资源 | 用户/角色/日志/驱动/字典/分组/报表 | [references/INDEX.md](references/INDEX.md) → 「平台资源 API」节 |
| 认证 | `useLogin`, `useUser` | [references/client-auth.md](references/client-auth.md) |
| 表单 | `useForm`, `useFieldUIState` | [references/client-form.md](references/client-form.md) |
| Model | `Model`, `TableModel`, 24+ hooks | [references/client-model.md](references/client-model.md) |
| 订阅 | `Subscribe`, `useTag`, `useTableData` | [references/client-subscribe.md](references/client-subscribe.md) |
| 事件 | `useEvents`, `useEvent` | [references/client-event.md](references/client-event.md) |
| 配置 | `setConfig`, `getConfig` | [references/client-config.md](references/client-config.md) |
| 最佳实践 | Provider 嵌套、CRUD 示例 | [references/client-patterns.md](references/client-patterns.md) |
