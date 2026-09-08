import _ from 'lodash'
import { useContext } from 'react'
import { type CellDataValue, CellDataContext } from '../context'

/**
 * 当前单元格/行的上下文数据。
 * - 无参：返回整个上下文值（兼容历史用法）；
 * - 带 path（如 `data.name` / `tableData.id`）：按点路径取值，缺省返回 undefined。
 */
export function useCellDataValue<T = CellDataValue>(path?: string) {
  const { value } = useContext(CellDataContext)
  if (!path) return value as T
  return _.get(value, path)
}
