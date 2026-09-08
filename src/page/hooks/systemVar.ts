import _ from 'lodash'
import { atom, useAtomValue } from 'jotai'
import { usePageStore } from './util'

/**
 * 系统变量·字典运行时数据（宿主/页面可注入 systemVars atom；缺省为空对象）
 */
export const systemVars = atom({} as Record<string, any>)

/**
 * 系统变量·字典取值。
 * - 无参：返回全部系统变量（注入树）；
 * - 带 path（如 `weekendStart` / `params.holiday`）：按点路径取值。
 */
export function useSystemVar<T = any>(path?: string) {
  const all = useAtomValue(systemVars, { store: usePageStore() })
  if (!path) return all as T
  return _.get(all, path) as T
}
