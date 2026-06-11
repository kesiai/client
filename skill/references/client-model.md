# 模型模块（Jotai 状态管理）

## Model 组件

```typescript
import { Model } from '@kesi/client'

<Model
  name="user"                    // 模型名称（从注册表获取 schema）
  schema={customSchema}          // 自定义 schema（可选，优先于 name）
  modelKey="unique-key"          // 模型唯一键（可选）
  initialValues={{ archived: true }}
  atoms={customAtoms}
  forceNewAtoms={false}
>
  <UserList />
</Model>
```

## TableModel 组件

```typescript
import { TableModel } from '@kesi/client'

<TableModel
  tableId="device-table"                // 表格 ID（必填）
  loadingComponent={<div>加载中...</div>}
  initQuery={{ skip: 0, limit: 20 }}
  initialValues={{ archived: true }}
  schemaTransform={(s) => s}
>
  <UserList />
</TableModel>
```

## 核心 Hooks

```typescript
import {
  useModel,            // 获取模型上下文 { model, atoms, api, ... }
  useModelList,        // 获取列表数据（自动加载）→ { items, loading, selected, fields }
  useModelGet,         // 获取单条数据 → { data, loading, model, title }
  useModelSave,        // 保存数据 → { saveItem }
  useModelDelete,      // 删除数据 → { deleteItem }
  useModelGetItems,    // 手动查询 → { getItems }
  useModelItem,        // 组合 get/save/delete
  useModelQuery,       // 简单查询
  useModelPermission,  // 获取权限 → { canAdd, canEdit, canDelete }
  useModelEffect,      // 监听选项/条件变化自动查询
  useModelPagination,  // 分页控制
  useModelCount,       // 获取总数
  useModelPageSize,    // 页大小控制
  useModelFields,      // 字段显示控制
  useModelSelect,      // 选择管理
} from '@kesi/client'
```

## 使用示例

```typescript
// 列表
const { items, loading } = useModelList()

// 单条
const { data, loading } = useModelGet({ id })

// 保存（自动判断创建/更新）
const { saveItem } = useModelSave()
await saveItem(data)

// 删除
const { deleteItem } = useModelDelete({ id })
await deleteItem()

// 手动查询
const { getItems } = useModelGetItems()
const { items, total } = await getItems({
  option: { skip: 0, limit: 10 },
  wheres: { name: { $regex: keyword } }
})
```

## 高级 Hooks

| Hook | 签名 | 返回值 |
|------|------|--------|
| `useModelValue(atom)` | `(atom, fkey?)` | `T` — atom 的值 |
| `useModelState(atom)` | `(atom, fkey?)` | `[T, setter]` |
| `useSetModelState(atom)` | `(atom, fkey?)` | `setter` |
| `useModelCallback(fn)` | `(cb, deps?)` | `callback` |
| `useModelPagination()` | 无 | `{ items, activePage, changePage }` |
| `useModelCount()` | 无 | `{ count }` |
| `useModelSelect()` | 无 | `{ count, selected, isSelectedAll, onSelect, onSelectAll }` |
| `useModelListRow({id})` | `{ id }` | `{ selected, item, changeSelect, actions }` |
| `useModelListHeader({field})` | `{ field }` | `{ title }` |
| `useModelListOrder({field})` | `{ field }` | `{ changeOrder, canOrder, order }` |
| `useModelListItem({field, item})` | `{ field, item?, nest? }` | 单元格数据 |
