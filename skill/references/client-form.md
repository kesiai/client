# 表单模块（React Hook Form）

表单模块基于 **react-hook-form**，所有表单相关 hooks 均为 re-export。

## useForm Hook

```typescript
import { useForm } from '@kesi/client'

function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { name: '', email: '' }
  })

  const onSubmit = (data) => { console.log(data) }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name', { required: '名称必填' })} />
      {errors.name && <span>{errors.name.message}</span>}
      <input {...register('email', { required: '邮箱必填' })} />
      {errors.email && <span>{errors.email.message}</span>}
      <button type="submit">提交</button>
    </form>
  )
}
```

## 字段 UI 状态管理

> **重要：** `useFieldUIState` 返回的是**元组** `[状态, 设置函数, 重置函数]`，不是对象。

```typescript
import { useFieldUIState, useFieldUIStateValue, useSetFieldUIState } from '@kesi/client'

// 完整元组
const [fieldState, setFieldState, resetFieldState] = useFieldUIState('fieldName')
// fieldState: { visible?, disabled?, loading?, readonly?, required?, custom? }

// 只读
const state = useFieldUIStateValue('fieldName')

// 仅设置
const setUIState = useSetFieldUIState('fieldName')
setUIState({ visible: false })
setUIState({ disabled: true })
setUIState({ loading: true })
setUIState({ readonly: true })
setUIState({ required: true })
```

## 字段数组

```typescript
import { useFieldArray } from '@kesi/client'

const { fields, append, remove } = useFieldArray({ control, name: 'phoneNumbers' })
```

## Controller 组件

```typescript
import { Controller } from '@kesi/client'

<Controller name="fieldName" control={control} render={({ field }) => <CustomInput {...field} />} />
```

## 表单上下文

```typescript
import { FormProvider, useFormContext } from '@kesi/client'

// 父组件
<FormProvider {...formMethods}><ChildForm /></FormProvider>

// 子组件
const { register, handleSubmit, store, setFieldUIState } = useFormContext()
```
