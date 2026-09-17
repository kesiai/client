import { atom } from 'jotai'
import { atomFamily } from 'jotai-family'
import _ from 'lodash'
import type { DataPropOptions, TagValue } from './types'

import { tagRegistry, dataChannelRegistry, referenceChannelRegistry } from './channels'

// ============================================================================
// Store Atoms
//
// 这三个 family 的 atom 现在自己就是订阅生命周期的入口：
//   组件 useAtomValue(...) → atom 被 mount → onMount → registry.retain(key, setAtom)
//   最后一个组件卸载 → onMount 返回的 release → refCount 归零 → 延迟释放
//
// setAtom 由 jotai 传入，已绑定到「mount 它的那个 store」。这是必须的：
// usePageStore() 在 <Page> 外返回 undefined（jotai 视为默认 store），
// 嵌套 <Page> 又会让多个 store 同时存活，只有 setAtom 能确定写进哪一个。
// ============================================================================

const tagAtom = (key: string) => {
  const base = atom<TagValue>(tagRegistry.peek(key) ?? {})
  base.onMount = (setAtom) => tagRegistry.retain(key, setAtom)
  return base
}

const dataAtom = (dataId: string) => {
  const base = atom<any>(dataChannelRegistry.peek(dataId) ?? {})
  base.onMount = (setAtom) => dataChannelRegistry.retain(dataId, setAtom)
  return base
}

const referenceAtom = (key: string) => {
  const base = atom<any>(referenceChannelRegistry.peek(key) ?? {})
  base.onMount = (setAtom) => referenceChannelRegistry.retain(key, setAtom)
  return base
}

// Tags subscription atoms
export const tagsState = atomFamily(tagAtom, (a: string, b: string) => a === b)
// Reference/Compute atoms
export const referenceState = atomFamily(referenceAtom, (a: string, b: string) => a === b)
export const dataState = atomFamily(dataAtom, (a: string, b: string) => a === b)

// atomFamily 默认永不回收（shouldRemove 默认 null），必须在 key 被彻底释放时显式移除，
// 否则每个访问过的 key 都会永久驻留。
tagRegistry.onEvicted((key) => tagsState.remove(key))
dataChannelRegistry.onEvicted((key) => dataState.remove(key))
referenceChannelRegistry.onEvicted((key) => referenceState.remove(key))

// 没有被任何组件读取时用到的占位 atom，保证 hook 调用数稳定（key 可能后到）
export const emptyTagState = atom<TagValue>({})

export const dataPropSelector = atomFamily((op: DataPropOptions) => atom(
  (get) => {
    const data = op.dataId ? get(dataState(op.dataId)) : undefined
    const field = op.field

    let value: any
    if (!op.type || op.type == 'schema') {
      value = field == '' ? data : (field ? _.get(data, field) : undefined)
      if (op.config == '关联字段') {
        const relateShowField = op.relateShowField
        if (_.isPlainObject(value)) {
          value = relateShowField ? value?.[relateShowField] : value
        } else if (_.isArray(value)) {
          value = relateShowField ? value.map((v: any) => v?.[relateShowField]).join(',') : value
        }
      }
      if (op.config == '选择器') {
        const enumObj = op.enumObj
        if (_.isArray(value)) {
          value = enumObj ? value.map((v: any) => enumObj[v]).join(',') : value.join(',')
        } else {
          value = enumObj ? enumObj[value] : value
        }
      }
    } else {
      value = _.get(data, `_settings.${op.type}.${field}`)
    }

    return value
  }
), (a, b) => a.dataId == b.dataId && a.field == b.field && a.tableId == b.tableId && a.type == b.type)
