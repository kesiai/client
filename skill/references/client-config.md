# 配置模块

## 全局配置

```typescript
import { setConfig, getConfig } from '@kesi/client'

setConfig({
  language: 'zh-CN',
  module: 'admin',
  rest: '/api/',
  projectId: 'project-123'
})

const config = getConfig()
```

**Config 类型：**

```typescript
interface Config {
  rest?: string                   // REST API 基础路径
  projectId?: string              // 项目 ID
  user?: UserInfo                 // 当前用户
  toast?: ToastComponent          // Toast 通知组件
  language?: string               // 语言代码
  module?: string                 // 模块名称
  settings?: AppSettings          // 应用设置
  [key: string]: any
}
```

## Toast 消息

```typescript
import { useMessage } from '@kesi/client'

const message = useMessage()
message.success('操作成功')
message.error('操作失败')
message.warning('警告消息')
message.info('提示消息')
```

## 服务器设置

```typescript
import { getSettings } from '@kesi/client'

// 注意：getSettings 是普通异步函数，不是 React hook
const settings = await getSettings()
```
