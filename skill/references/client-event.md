# 事件系统

## useEvents Hook

```typescript
import { useEvents } from '@kesi/client'

const events = useEvents({
  click: [
    { type: 'changeVar', params: { var: { counter: 1 } } },
    { type: 'pageJump', params: { url: '/detail', openWay: '_self' } }
  ],
  doubleClick: [
    { type: 'sendRequest', params: { url: '/api/action', method: 'POST' } }
  ]
})

return <button onClick={events.click} onDoubleClick={events.doubleClick}>点击我</button>
```

## useEvent Hook

```typescript
import { useEvent } from '@kesi/client'

const { handler, loading, error } = useEvent('click', [
  { type: 'changeVar', params: { varValue: { status: 'active' } }, confirm: { title: '确认', message: '确定执行？' } }
])
```

## useEventsWithSpread Hook

```typescript
import { useEventsWithSpread } from '@kesi/client'

const events = useEventsWithSpread({
  click: [{ type: 'changeVar', params: { var: { count: 1 } } }],
  mouseEnter: [{ type: 'changeVar', params: { var: { hover: true } } }]
})
return <div {...events}>悬停或点击我</div>
```

## 事件类型

`click` | `doubleClick` | `mouseEnter` | `mouseLeave` | `change` | `submit` | `focus` | `blur` | `input`

## 动作类型

`pageJump` | `changeVar` | `changeTableData` | `changeDict` | `changeDataPoint` | `changeSystemSetting` | `changeUser` | `callFlow` | `executeCommand` | `sendRequest`

## 动作结构

```typescript
interface Action {
  type: ActionType
  params: any
  confirm?: { title?: string; message?: string; confirmText?: string; cancelText?: string }
  delay?: number
}
```

## 全局对话框

```typescript
import {
  useGlobalDialogs, showConfirmDialog, closeConfirmDialog,
  showFormDialog, closeFormDialog,
  showSchemaFormDialog, closeSchemaFormDialog
} from '@kesi/client'

showConfirmDialog({ title: '确认', message: '确定执行？' })
showFormDialog({ fields: [{ name: 'input', label: '输入' }] })
showSchemaFormDialog({ schema: mySchema })
```
