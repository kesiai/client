import _ from 'lodash'
import { atom, getDefaultStore, useAtomValue } from 'jotai'
import { useEffect } from 'react'
import { usePageStore } from './util'
import { getHeaders } from '../../api'

/**
 * 系统变量·字典运行时数据。
 *
 * 懒加载：首次被 useSystemVar 挂载时自动经 HTTP 拉全量系统变量写入 atom
 * （此前依赖「宿主注入」但全链路无人注入——绑定后空值的断头路）。
 * 拉取失败静默保持空对象（渲染空串，不崩）；系统变量为低频配置数据，
 * 不做 ws 增量——中台变更后刷新页面即可；后续如有推送通道 atom patch 即可接入。
 * 兼容保留「宿主注入」：外部 set systemVars atom 仍然有效。
 */
export const systemVars = atom({} as Record<string, any>)

/** 模块级单例守卫：同页多次挂载只拉一次；失败可重试 */
let sysVarsLoading: Promise<void> | null = null

function fetchSystemVars(store: ReturnType<typeof usePageStore>): Promise<void> {
  if (!sysVarsLoading) {
    const q = encodeURIComponent(JSON.stringify({ limit: 9999, project: { uid: 1, value: 1 } }))
    const base = (typeof location !== 'undefined' && location.pathname.split('/').find(p => p.startsWith('_p_')))
      ? location.pathname.slice(0, location.pathname.indexOf('/_p_')) : ''
    
    sysVarsLoading = fetch(base + '/rest/core/systemVariable?query=' + q, { headers: getHeaders() })
      .then((resp) => resp.json())
      .then((list: any) => {
        if (!Array.isArray(list)) return
        const map: Record<string, any> = {}
        for (const v of list) {
          if (v?.uid || v?.name) map[String(v.uid ?? v.name)] = v?.value
        }
        
        const actualStore = store ?? getDefaultStore()
        if (Object.keys(map).length > 0) actualStore.set(systemVars, map)
      })
      .catch(() => {
        
        // 失败解除单例锁——下次挂载可重试；不写 partial 数据
        sysVarsLoading = null
      })
  }
  return sysVarsLoading ?? Promise.resolve()
}

/**
 * 系统变量·字典取值。
 * - 无参：返回全部系统变量（含已注入/已拉取树）；
 * - 带 path（如 `weekendStart` / `params.holiday`）：按点路径取值。
 */
export function useSystemVar<T = any>(path?: string) {
  const store = usePageStore()
  const all = useAtomValue(systemVars, { store })
  useEffect(() => {
    // 首次挂载且 atom 尚无数据 → 拉一次（HTTP；写 atom 触发重渲染出值）
    if (Object.keys(all).length === 0) void fetchSystemVars(store)
  }, [])
  if (!path) return all as T
  return _.get(all, path) as T
}
