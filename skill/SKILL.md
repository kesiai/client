---
name: kesi-frontend
description: "KESI 前端架构师 — 接收 kesi-cli 的 scan 数据，结合项目业务域分析，输出完整的前端页面设计报告：需要哪些页面、每页展示什么数据、用表格/列表/图表/文本哪种方式、是否需要过滤器/CRUD、数据用 API/Model/ViewModel/订阅哪种方式获取、页面间如何联动。然后创建项目，交接给 kesi-ui 做 UI 实现。"
---

# KESI 前端架构设计

接收平台数据，设计前端页面方案，指导 UI 实现。

## 目录

- [前端规划报告生成](#前端规划报告生成)
- [第一部分：KESI 项目初始化与安装](#第一部分kesi-项目初始化与安装)
- [第二部分：KESI 项目结构与开发规范](#第二部分kesi-项目结构与开发规范)
- [第三部分：KESI 客户端使用指南](#第三部分kesi-客户端使用指南)

---

## 前端规划报告生成

> 从 kesi-cli 接收 scan 数据后，生成前端规划报告，作为后续组件选型和视觉设计的输入。

### 输入：scan 数据

从 kesi-cli Phase 3 交接获得：
- `kesi scan --with-sample` 输出（JSON 格式）
- 包含：表 ID、表标题、tableMajorType（device/normal/dataAuth）、字段列表、设备表数据点（tags）、样本数据

### 报告生成规则

**AI 根据扫描数据自动分析推导页面方案，用户只需确认。** 详细设计方法论参考 → [iot-product-design.md](references/iot-product-design.md)

分析维度：

**1. 页面交互模式推导规则：**

| 数据特征 | AI 推导的交互模式 |
|----------|-----------------|
| 设备表（device） | 带过滤的展示：表格 + 在线/报警状态 + 关键数据点 |
| 配置型数据（楼宇、区域、人员等基础信息） | 带过滤的展示 |
| 日志/记录型数据（巡更记录、维保记录、操作日志） | 带过滤的展示 |
| 仪表盘/概览页 | 纯展示：统计卡片 + 趋势图 + 状态概览 |
| 用户明确要求增删改查的页面 | CRUD 管理 |

> **默认为展示型页面。** AI 分析数据特征后自动决定，不需要用户逐个指定。如果用户有特殊需求（如某个页面需要 CRUD），在确认报告时提出即可。

**2. 数据展示方式推导规则：**

| 数据特征 | 推荐展示方式 |
|----------|------------|
| 设备列表（多行结构化数据） | 表格 |
| 统计指标（总数、在线率等） | 卡片 + 数字 |
| 时序数据（温度、电量趋势） | 折线图/柱状图 |
| 占比分布（设备类型、状态分布） | 饼图/环形图 |
| 地理位置数据 | 地图 |
| 设备在线/报警状态 | 表格列 + 状态标记 |

**3. 数据获取方式推导规则：**

| 场景 | 获取方式 |
|------|---------|
| 页面级数据查询（列表、统计） | `createResourceClient.query` / `.count` |
| 实时数据点订阅（设备温度、开关状态等） | `useTag` |
| 实时字段变化（在线状态、报警标记） | `useTableData` |
| 历史趋势数据 | `createHttpClient` + `core/data/query` 端点 POST 请求 |
| CRUD 操作 | `ViewModel`（内部封装 Model） |

**4. 页面生成规则：**

| 表类型 | 自动生成的页面 |
|--------|--------------|
| 存在 device 表时 | 自动生成「数据概览」仪表盘（纯展示） |
| 每个 device 表 | 生成对应的设备列表页（带过滤的展示） |
| 每个 normal 表 | 生成对应的数据列表页（带过滤的展示） |
| `dataAuth` | 组织管理页（树形结构） |

**5. 页面组织：**
- 按业务域归类页面（如：概览 / 能源 / 安防 / 楼宇管理）
- 功能相近的表可合并到同一页面
- 菜单/导航的展示形式（侧边栏/顶部导航/按钮组等）由视觉设计决定，本报告不限定

### 输出：页面设计报告格式

设计报告需要明确每个页面的：展示什么数据、用什么方式展示、数据怎么获取、页面间如何联动。

```
📋 前端页面设计报告

━━━ 业务域分析 ━━━
根据 scan 数据中的表和项目领域，分析业务场景：
- 项目类型：<智慧楼宇/智慧工厂/...>
- 核心业务域：<能源/安防/环境/...>
- 数据特征：<设备表 N 张、普通表 N 张、数据点 M 个>

━━━ 页面结构 ━━━
1. 数据概览
2. <页面A>（<数据源>）
3. <页面B>（<数据源>）
4. ...

━━━ 页面设计 ━━━
1. 数据概览（仪表盘）
   - 交互模式：纯展示
   - 展示内容：
     ├── 统计卡片：设备总数、在线率、报警数（数据源：各 device 表 count）
     ├── 趋势图：关键数据点 24h 变化（数据源：createHttpClient POST core/data/query）
     └── 设备分布：各子系统在线/离线/报警分布（数据源：createResourceClient.query）
   - 数据获取方式：createResourceClient + createHttpClient
   - 页面间联动：点击卡片可跳转到对应子系统页面

2. <表标题>页（table_id: xxx）
   - 交互模式：带过滤的展示（默认）/ CRUD（用户指定）
   - 表类型：<normal/device>
   - 展示方式：<表格/卡片列表/...>
   - 过滤器：<列出过滤字段>
   - 数据字段：<列出展示字段及其含义>
   - 数据获取方式：<createResourceClient / Model / ViewModel>
   - 实时数据（device 表）：<列出需订阅的数据点，用 useTag>
   - 页面间联动：<与其他页面的关联>

━━━ 数据获取方案 ━━━
- API Client：<列出需要手动查询的资源客户端（resource 路径）>
- useTag/useTableData：<列出需要实时订阅的数据点>
- ViewModel：<列出使用 ViewModel 的页面及其 tableId>

━━━ 页面数量 ━━━
- 共约 N 个页面
```

**重要约束：**
- 报告由 AI 根据扫描数据自动生成，用户只需确认或调整
- 本报告是前端架构设计，决定**展示什么、怎么获取、如何联动**
- 具体用什么 UI 组件实现由 kesi-ui 决定
- 视觉风格由 ui-ux-pro-max 决定
- **用户确认报告后**，才能创建项目和生成代码

### 工作流：数据扫描 → 页面设计 → 项目创建 → UI 实现

```
kesi-cli                    kesi-frontend                    kesi-ui
   │                            │                              │
   ├── scan 数据 ──────────→ 接收                              │
   │                          │                                │
   │                    分析业务域                              │
   │                    设计页面方案                              │
   │                    （展示内容/数据获取/联动）                  │
   │                          │                                │
   │                    用户确认设计报告                           │
   │                          │                                │
   │                    创建前端项目                              │
   │                    生成 API 层                              │
   │                    生成菜单路由                              │
   │                          │                                │
   │                          ├── 设计报告 + 项目 ──────────→  接收
   │                          │                          选型组件
   │                          │                          实现页面
   │                          │                                │
   │                          ├──→ ui-ux-pro-max（视觉设计）     │
```

### 项目创建

确认规划报告后，使用以下命令创建项目：

```bash
npx create-kesi-app my-project --server <服务器地址> --project-id <项目ID>
```

> 服务器地址和项目 ID 从 kesi-cli 的 `kesi config` 获取。

### 代码生成顺序（规划报告确认后）

在项目目录中，按以下顺序生成代码：

1. **API 层** — 基于 scan 数据生成 `createHttpClient` + `createResourceClient` 调用（参考 client-api.md）
2. **数据展示页**（默认）— 使用基础组件 + createResourceClient 展示数据，带过滤器（参考 kesi-ui 决策表）
3. **仪表盘/首页** — 使用基础组件 + 图表（参考 kesi-ui 的 chart-echarts）
4. **CRUD 管理页**（用户显式指定时）— 使用 ViewModel 视图系统（参考 kesi-ui 的 ViewModel 指南）
5. **菜单路由** — 根据规划报告配置路由和侧边栏
6. **实时数据** — 设备表用 useTag/useTableData（参考本文档第三部分订阅模块）

---

## 第一部分：KESI 项目初始化与安装

### 1.1 技术栈

KESI 前端项目基于 **React 19** + **shadcn/ui (base-nova)** + **Vite 8** + **TypeScript 6** + **Tailwind CSS v4**。

预装核心依赖：`@kesi/client`（平台 SDK）、`@base-ui/react`（UI 原语）、`react-router-dom`（路由）、`jotai`（状态管理）、`lucide-react`（图标）、`sonner`（Toast）。

### 1.2 一键创建项目

> **重要：** `--server` 和 `--project-id` 是必填参数，每次创建项目时必须根据实际环境填写。

```bash
# 必须指定服务器地址和项目 ID
npx create-kesi-app my-project --server <KESI 服务器地址> --project-id <项目ID>

# 示例
npx create-kesi-app my-project --server http://192.168.99.103:3030 --project-id kesi

# 交互模式（按提示逐项输入，推荐）
npx create-kesi-app
```

**CLI 选项：**

| 选项 | 必填 | 说明 |
|------|------|------|
| `--server <url>` | ✅ 是 | KESI 服务器地址（如 `http://192.168.99.103:3030`） |
| `--project-id <id>` | ✅ 是 | KESI 项目 ID |
| `--registry <url>` | 否 | kesi-ui 组件库 registry 地址（默认 `http://localhost:3000/r`） |
| `--skip-install` | 否 | 跳过 npm install（默认 `false`） |

**创建完成后：**

```bash
cd my-project
npm run dev
```

### 1.3 生成的项目结构

```
my-project/
  .env                        # VITE_KESI_PROJECT_ID
  .gitignore
  components.json             # shadcn/ui + kesi-ui registry 配置
  eslint.config.js
  index.html
  package.json
  tsconfig.json / tsconfig.app.json / tsconfig.node.json
  vite.config.ts              # 路径别名 + API 代理
  src/
    main.tsx                  # setConfig + HashRouter + Subscribe
    App.tsx                   # ProtectedRoute + 路由
    index.css                 # Tailwind v4 主题变量（light/dark）
    lib/
      utils.ts                # cn() 工具
      config.ts               # initConfig()
    components/
      layout/AppLayout.tsx    # 侧边栏布局
      ui/                     # shadcn/ui 基础组件（button, card, badge 等）
    pages/
      auth/LoginPage.tsx      # 登录页
      dashboard/DashboardPage.tsx  # 首页
    data/
      menu.ts                 # 菜单配置
```

### 1.4 添加 kesi-ui 组件

项目已配置 kesi-ui registry，可直接使用 shadcn CLI 添加组件：

```bash
# 添加表单组件
npx shadcn@latest add form-input form-select

# 添加图表
npx shadcn@latest add chart-echarts

# 添加数据视图（CRUD 页面时使用）
npx shadcn@latest add view-model view-data-table view-filter view-pagination
```

---

## 第二部分：KESI 项目结构与开发规范

### 2.1 源码目录结构

所有源代码位于 **`src`** 目录：

| 目录路径 | 用途 |
| :--- | :--- |
| `src/pages/` | 页面级组件和路由文件 |
| `src/blocks/` | 区块级可复用组件（大型功能模块） |
| `src/components/` | 业务级通用组件 |
| `src/components/ui/` | 基础 UI 组件（基于 shadcn/ui） |

### 2.2 开发规范

#### 2.2.1 组件命名规范

- **页面组件**：PascalCase，如 `UserManagementPage.tsx`
- **区块组件**：PascalCase，如 `DataTable.tsx`
- **业务组件**：PascalCase，如 `UserCard.tsx`
- **UI 组件**：kebab-case，如 `button.tsx`、`input.tsx`

#### 2.2.2 代码风格规范

- 所有组件使用 TypeScript
- 优先使用函数组件和 Hooks
- Props 定义使用 interface 或 type

---

## 第三部分：KESI 客户端使用指南

> **详细文档已拆分到 references/ 目录，按需读取。** 以下为快速索引。

### 快速上手：HTTP 模块

```typescript
import { createHttpClient, createResourceClient } from '@kesi/client'

// 1. 创建 HTTP 客户端
const client = createHttpClient({ resource: 'core/t/<tableId>/d' })

// 2. 创建资源客户端（绑定类型）
const myApi = createResourceClient<{ id?: string; [key: string]: any }>({
  client,
  resource: 'core/t/<tableId>/d',
})

const { items, total } = await myApi.query({ limit: 100 })
const count = await myApi.count()  // 计数
const item = await myApi.get('id') // 单条
```

### 常见场景示例

```typescript
// ① 设备表数据查询
const deviceApi = createResourceClient<Device>({
  client: createHttpClient({ resource: 'core/t/hvac_system/d' }),
  resource: 'core/t/hvac_system/d',
})
const { items, total } = await deviceApi.query({ limit: 20 }, { status: { $eq: 'online' } })

// ② 平台资源查询（用户、角色、报警等）
const userApi = createResourceClient<User>({
  client: createHttpClient({ resource: 'core/user' }),
  resource: 'core/user',
})
const { items: users } = await userApi.query({ limit: 10 })

// ③ 实时数据点初始化（POST core/data/latest，body 是数组）
const dataClient = createHttpClient({ resource: 'core/data' })
await dataClient.request('/latest', {
  method: 'POST',
  body: [
    { tableId: 'hvac_system', id: 'hvac_001', tagId: 'temperature' },
    { tableId: 'hvac_system', id: 'hvac_001', tagId: 'humidity' },
  ],
})

// ④ 历史趋势（POST core/data/query，body 是数组！）
const queryClient = createHttpClient({ resource: 'core/data/query' })
await queryClient.request('', {
  method: 'POST',
  body: [{
    tableId: 'energy_meter',
    tags: [`LAST("power") AS "power"`, 'id'],
    id: 'meter_001',
    where: [`time <= '${new Date().toISOString()}'`],
  }],
})
```

### 模块索引

| 模块 | 关键 API | 详细文档 |
|------|---------|---------|
| **HTTP** | `createHttpClient`、`createResourceClient`、`query`、`get`、`save`、`delete`、`count` | [client-api.md](references/client-api.md) |
| **平台数据查询** | 内置资源字段、数据表类型、设备数据点、报警查询与订阅 | [client-platform-resources.md](references/client-platform-resources.md) |
| **页面设计** | 业务领域识别、仪表盘设计、展示方式推导、页面联动 | [iot-product-design.md](references/iot-product-design.md) |
| **认证** | `useLogin`、`useLogout`、`useUser`、`useUserReg` | [client-auth.md](references/client-auth.md) |
| **表单** | `useForm`、`useFieldArray`、`Controller`、`useFieldUIState` | [client-form.md](references/client-form.md) |
| **模型** | `Model`、`TableModel`、`useModelList`、`useModelSave` 等 24+ hooks | [client-model.md](references/client-model.md) |
| **页面 Hooks** | `usePageVar`、`useDatasourceValue`、`useCellDataValue` | [client-page-hooks.md](references/client-page-hooks.md) |
| **订阅** | `Subscribe`、`useTag`、`useTableData`、`useSubscribeContext` | [client-subscribe.md](references/client-subscribe.md) |
| **事件** | `useEvents`、`useEvent`、`useEventsWithSpread` | [client-event.md](references/client-event.md) |
| **配置** | `setConfig`、`getConfig`、`getSettings`、`useMessage` | [client-config.md](references/client-config.md) |

### ViewModel 架构

> ViewModel 是基于 client 层 Model + UI 层字段组件封装的容器组件。

```
┌─ ViewModel (容器，传入 tableId) ─────────────────┐
│  内部：TableModel → 自动加载 schema + 数据        │
│  UI 注册：各种 controlType 的显示组件              │
│    ├── 表单组件（FormSchemaField）                 │
│    ├── 过滤组件（FilterSchemaField）               │
│    └── 列表组件（ListSchemaField）                 │
│                                                   │
│  子组件：                                         │
│  ├── ViewFilter   → 根据 schema 自动渲染过滤器     │
│  ├── ViewDataTable → 根据 TableColumn 渲染数据表   │
│  └── ViewPagination → 分页控制                    │
└───────────────────────────────────────────────────┘
```

- `ViewModel` 接收 `tableId` 和 `initQuery`，内部通过 `TableModel` 加载表 Schema 并管理数据状态
- `ViewFilter` 的 `filters` 是 `Array<{ key: string }>`，key 对应 schema 中的字段 key
- `ViewDataTable` 通过 `TableColumn` 子组件定义列（`name`=字段key, `title`=显示名, `width`, `fixed`）
- Schema 中定义的 `controlType` 决定了每种字段在表单/过滤器/列表中的渲染组件

### 常用模式 & 最佳实践

完整 CRUD 示例、受保护路由、错误处理、性能优化等 → [client-patterns.md](references/client-patterns.md)

### 依赖版本

```json
{
  "@kesi/client": "latest",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "react-router-dom": "^7.12.0",
  "jotai": "^2.7.0",
  "react-hook-form": "^7.x"
}
```
**基于源码：** `@kesi/client` 最新源码（`src/` 目录）逐一验证
**维护团队：** KESI 开发团队
