# 页面 Hooks

## 页面变量管理

```typescript
import { usePageVar, usePageVarValue, useSetPageVar } from '@kesi/client'

const [theme, setTheme] = usePageVar('theme')      // 读写
const language = usePageVarValue('language')         // 只读
```

## 数据源管理

```typescript
import { useDatasourceValue, useDatasetSet, useDatasetsValue } from '@kesi/client'

const users = useDatasourceValue('users')            // 获取数据源值
const setDataset = useDatasetSet('users')            // 设置数据源值
const datasets = useDatasetsValue(['ds1', 'ds2'])   // 批量获取
const userName = useDatasourceValue('users.0.name')  // 嵌套路径
```

## 单元格数据上下文

```typescript
import { useCellDataValue } from '@kesi/client'

const { value } = useCellDataValue()
```

## 其他页面 Hooks

```typescript
import {
  usePageVarCallback,   // 页面变量回调
  useFunctions,         // 获取/设置函数
  useFunctionsValue,    // 只读获取函数值
  useFunctionsSet,      // 设置函数
  useFunctionsGet,      // 获取函数 getter
  useScale,             // 缩放比例
  useViewValue,         // 视图属性值
  usePlayback,          // 播放控制
  useIteration,         // 迭代数据
  useIterationValue,    // 只读迭代值
} from '@kesi/client'
```
