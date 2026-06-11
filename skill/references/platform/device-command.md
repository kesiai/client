# 设备指令（`core/t/schema/command` / `core/t/schema/commands`）

> 设备指令是下发给设备的控制命令（如调节温度、开关设备、设置亮度）。由前端主动发起。

## 查询指令定义

### 单表查询

```
GET /core/t/schema/command/<tableId>
```

```typescript
import { createHttpClient } from '@kesi/client'

const client = createHttpClient({ resource: 'core/t/schema/command' })
const res = await client.request('/lighting_system')
// res.data = [{ ...command }]
```

### 批量查询

```
POST /core/t/schema/commands
Body: ["tableId1", "tableId2"]
```

```typescript
const client = createHttpClient({ resource: 'core/t/schema/commands' })
const res = await client.request('', {
  method: 'POST',
  data: ['lighting_system', 'hvac_system'],
})
// res.data = { lighting_system: [...], hvac_system: [...] }
```

### 从表 Schema 获取

指令定义也存储在表 schema 的 `device.commands` 数组中：

```typescript
const schemaClient = createHttpClient({ resource: 'core/t/schema' })
const schemaApi = createResourceClient({ client: schemaClient, resource: 'core/t/schema' })
const schema = await schemaApi.get('lighting_system')
const commands = schema.device?.commands || []
```

## 指令数据结构

每个 command 的完整字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 指令 ID |
| `name` | string | 指令名称（如「设置亮度」） |
| `showName` | string | 显示名称（按钮文字） |
| `description` | string | 指令描述 |
| `retry` | number | 重试次数 |
| `tag` | { id, name } | 关联的数据点 |
| `ops` | CommandOp[] | 操作参数列表 |
| `writeIn` | WriteInConfig | 写入（输入）配置 |
| `writeOut` | WriteOutConfig | 输出（回读）配置 |

### writeIn — 写入配置

| 字段 | 类型 | 说明 |
|------|------|------|
| `ioway` | string | 写入方式：`"默认写入"` / `"表单写入"` |
| `type` | string | 值类型：`"select"` / `"input"` / `"tagValue"` / `"object"` / `"array"` / `"table"` |
| `tag` | { id, name } | 当 type=tagValue 时的目标点位 |
| `schema` | object | 表单 schema 定义（字段名 → 字段定义） |
| `formValue` | object | 表单默认值 |
| `select` | Array | select 类型的选项列表 |
| `mod` | number | 缩放比例 |

### writeOut — 输出配置

结构和 writeIn 类似，用于指令输出/回读。

### 指令示例

**默认写入（自动执行，无需用户输入）：**

```json
{
  "name": "设置亮度",
  "showName": "",
  "writeIn": {
    "ioway": "默认写入",
    "schema": {
      "luminosity_adjustment": {
        "default": 22,
        "title": "",
        "type": "number"
      }
    },
    "type": "string"
  },
  "writeOut": { "type": "object" }
}
```

**表单写入（需要用户输入参数）：**

```json
{
  "name": "设置阀门开度",
  "showName": "设阀",
  "writeIn": {
    "ioway": "表单写入",
    "type": "input",
    "schema": {
      "valve_value": {
        "type": "number",
        "title": "开度值",
        "min": 0,
        "max": 100
      }
    }
  }
}
```

## 发送指令

### 接口

```
POST /driver/driver/command
```

### 请求 Body

将完整的 command 对象展开，附加 `table`、`tableData`、`params`：

```json
{
  "id": "设置亮度",
  "name": "设置亮度",
  "showName": "",
  "writeIn": { ... },
  "writeOut": { ... },
  "table": "lighting_system",
  "tableData": "light_002",
  "params": { "luminosity_adjustment": 22 }
}
```

| 字段 | 说明 |
|------|------|
| `...command` | 完整的 command 定义对象（所有字段展开） |
| `table` | 表 ID |
| `tableData` | 设备记录 ID |
| `params` | 指令参数，根据 `writeIn.ioway` 决定内容 |

### 前端调用示例

```typescript
import { createAPI } from '@kesi/client'

const cmdApi = createAPI({
  name: 'driver/driver/command',
  resource: 'driver/driver/command',
  idProp: 'id',
})

await cmdApi.fetch('', {
  method: 'POST',
  body: JSON.stringify({
    ...command,           // 完整 command 对象
    table: tableId,       // 表 ID
    tableData: deviceId,  // 设备 ID
    params,               // 指令参数
  }),
})
```

### params 的生成逻辑

根据 `command.writeIn.ioway` 区分：

#### 默认写入（`ioway === "默认写入"`）

直接取 `writeIn.schema` 中的 `default` 值，无需用户输入：

```typescript
function buildDefaultParams(writeIn: WriteInConfig): Record<string, any> {
  const schema = writeIn?.schema || {}
  const params: Record<string, any> = {}
  for (const [key, field] of Object.entries(schema)) {
    if (field.default !== undefined) {
      params[key] = field.default
    }
  }
  return params
}

// 调用：直接执行，不弹表单
const params = buildDefaultParams(cmd.writeIn)
await sendCommand(cmd, params)
```

#### 表单写入（`ioway === "表单写入"`）

需要弹出表单让用户按 `writeIn.schema` 填写参数：

```typescript
// 1. 用 writeIn.schema 渲染表单
// 2. 用户填写后得到 formValues
// 3. 以 formValues 作为 params 发送指令
await sendCommand(cmd, formValues)
```

### CLI 调用

```bash
# 默认写入（自动取 default 值）
kesi control-send --table lighting_system --device light_002 --command "设置亮度"

# 表单写入（需要 --params 传入用户输入）
kesi control-send --table hvac_system --device hvac_002 --command "设置温度" --params '{"temp": 26}'

# 批量执行
kesi control-batch --json '[{"table":"lighting_system","device":"light_002","command":"设置亮度"}]'
```

## 指令在 scan 数据中的位置

`kesi scan` 输出中，设备表会包含 `commands` 字段：

```json
{
  "id": "lighting_system",
  "title": "照明控制系统",
  "tableMajorType": "device",
  "tags": [...],
  "commands": [
    {
      "id": "设置亮度",
      "name": "设置亮度",
      "showName": "",
      "writeIn": { "ioway": "默认写入", "schema": {...} },
      "writeOut": { "type": "object" }
    }
  ]
}
```

> 无指令的设备表不会输出 `commands` 字段。
