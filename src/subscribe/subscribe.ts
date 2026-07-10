import _ from 'lodash'
import React from 'react'
import dayjs from 'dayjs'
import api from '../api'

import { queryLastData, queryMeta } from './queries'
import worker from './worker'
import type { SubTag, SubData } from './types'

import { useUpdateTagsTimeout, useUpdateTags, useUpdateReference, useUpdateData, useUpdateMeta } from './hooks'
import { useAtomCallback } from 'jotai/utils'
import { tagsState } from './atoms'
import { usePageStore } from '../page/hooks/util'
import { useWS } from './ws'

const performance = true
const debounceTime = 100

export const useDataTagSubscribe = () => {
  const subscribedTagsRef = React.useRef<SubTag[]>([])

  const unsubscribe = React.useRef<() => void>(() => {})
  const warehouse = React.useRef<Record<string, any>>({})

  const updateTags = useUpdateTags()
  const updateMeta = useUpdateMeta()

  const { subscribe, onData } = useWS()

  const update = React.useCallback(
    _.debounce((data: Record<string, any>) => {
      updateTags(data)
      warehouse.current = {}
    }, debounceTime, { 'maxWait': 1000 }),
    [updateTags]
  )

  onData((data: any) => {
    if (data && _.isPlainObject(data)) {
      const dataId = data.tableDataId || data.id
      const tableId = data.tableId
      const tags = data.fields
      const time = data.time
      const payload: Record<string, any> = {}
      Object.keys(tags).forEach((tagId: string) => {
        payload[`${tableId}|${dataId}|${tagId}`] = { value: tags[tagId], time: time }
      })
      if (performance) {
        warehouse.current = {
          ...warehouse.current,
          ...payload
        }
        update(warehouse.current)
      } else {
        updateTags(payload)
      }
    }
  })

  // Subscribe to WebSocket
  const debouncedSubscribe = React.useCallback(
    _.debounce((subTags: SubTag[]) => {
      if (unsubscribe.current) {
        unsubscribe.current()
      }
      if (subTags.length > 0) {
        unsubscribe.current = subscribe('data', subTags.map(tag => ({ tableId: tag.tableId, id: tag.dataId, tagId: tag.tagId })))
      }
    }, debounceTime),
    []
  )
  const debouncedQueryLastData = React.useCallback(
    _.debounce(queryLastData, debounceTime),
    [queryLastData]
  )

  // Query initial data and subscribe
  const subscribeTags = React.useCallback((subTags: SubTag[]) => {
    if (subTags && subTags.length > 0) {
      debouncedQueryLastData(subTags, (value) => {
        // reconnect()
        queryMeta(subTags, (meta: Record<string, any>) => {
          updateMeta(meta)
          // 发送 timeout 配置给 worker
          if (meta) {
            Object.keys(meta).forEach((key: string) => {
              const tagMeta = meta[key]
              if (tagMeta?.timeout) {
                const [tableId, dataId, tagId] = key.split('|')
                const time = value?.[key]?.time
                if (time) {
                  worker.postMessage({ type: 'tags', value: { tableId, tableDataId: dataId, tagId, time: dayjs(time).unix(), timeout: tagMeta.timeout } })
                }
              }
            })
          }
        })
        value && updateTags(value)
      })
      debouncedSubscribe(subTags)
    }
  }, [])

  // Cleanup
  React.useEffect(() => {
    return () => {
      update.cancel()
      debouncedSubscribe.cancel()
      if (unsubscribe.current) {
        unsubscribe.current()
      }
    }
  }, [])

  // Subscribe tags method
  const subscribeFunc = React.useCallback((tags: SubTag[], clearBefore: boolean | undefined) => {
    const current = subscribedTagsRef.current
    const newTags = clearBefore ? tags : tags.filter(tag =>
      !current.some(ct =>
        ct.tableId === tag.tableId &&
        ct.dataId === tag.dataId &&
        ct.tagId === tag.tagId
      )
    )
    if (newTags.length > 0) {
      subscribedTagsRef.current = clearBefore ? newTags : [...current, ...newTags]
    }
    subscribeTags(subscribedTagsRef.current)
  }, [subscribeTags])

  return { subscribe: subscribeFunc }
}

export const useTableDataSubscribe = () => {
  const subscribedDataRef = React.useRef<SubData[]>([])

  const unsubscribe = React.useRef<() => void>(() => {})
  const warehouseNode = React.useRef<Record<string, any>>({})
  const updateData = useUpdateData()

  const { onData: onDataNode, subscribe: subscribeNode } = useWS()

  const updateNode = React.useCallback(
    _.debounce((data: Record<string, any>) => {
      updateData(data)
      warehouseNode.current = {}
    }, debounceTime, { 'maxWait': 1000 }),
    [updateData]
  )

  // Handle incoming data
  onDataNode((data: any) => {
    if (performance && data?.tableDataId) {
      warehouseNode.current = {
        ...warehouseNode.current,
        [data?.tableDataId]: { ...(warehouseNode.current[data?.tableDataId] || {}), ...data }
      }
      updateNode(warehouseNode.current)
    } else {
      updateData({ [data?.tableDataId]: data })
    }
  })

  // Subscribe to WebSocket
  const debouncedSubscribeNode = React.useCallback(
    _.debounce((subDataIds: SubData[]) => {
      if (unsubscribe.current) {
        unsubscribe.current()
      }
      if (subDataIds.length > 0) {
        unsubscribe.current = subscribeNode('tabledata', subDataIds.map(data => ({ tableId: data.tableId, id: data.dataId, fields: data.fields })))
      }
    }, debounceTime),
    []
  )

  // Cleanup
  React.useEffect(() => {
    return () => {
      updateNode.cancel()
      debouncedSubscribeNode.cancel()
      if (unsubscribe.current) {
        unsubscribe.current()
      }
    }
  }, [])

  // Subscribe data method
  const subscribeData = React.useCallback((dataIds: SubData[], clearBefore: boolean | undefined) => {
    const current = subscribedDataRef.current
    const newDataIds = clearBefore ? dataIds : dataIds.filter(dataId =>
      !current.some(cd =>
        cd.tableId === dataId.tableId &&
        cd.dataId === dataId.dataId &&
        _.isEqual(cd.fields, dataId.fields)
      )
    )
    if (newDataIds.length > 0) {
      subscribedDataRef.current = clearBefore ? newDataIds : [...current, ...newDataIds]
    }
    debouncedSubscribeNode(subscribedDataRef.current)
  }, [debouncedSubscribeNode])

  return { subscribe: subscribeData }
}

export const useTagWarningSubscribe = () => {
  const store = usePageStore()
  const updateTagWarning = useAtomCallback(React.useCallback((get, set, warningInfo: any) => {
    const fields = warningInfo?.fields
    const table = warningInfo?.table
    const tableData = warningInfo?.tableData
    if (!table?.id || !tableData?.id || !fields) return

    fields.forEach((field: any) => {
      const key = `${table.id}|${tableData.id}|${field.id}`
      const prev = get(tagsState(key))
      set(tagsState(key), {
        ...prev,
        warningState: {
          className: warningInfo.className,
          level: field.level || warningInfo.level,
          recoveryTime: warningInfo.recoveryTime,
        }
      })
    })
  }, []), { store })

  // WS 订阅报警推送
  const { onData: onWarningData, subscribe: subscribeWarning } = useWS()

  onWarningData((data: any) => {
    if (data) updateTagWarning(data)
  })

  React.useEffect(() => {
    subscribeWarning('warning', { recoveryStatus: '已恢复' })
  }, [subscribeWarning])

  // 初始查询报警状态
  const getTableWarning = React.useCallback(async (subTags: SubTag[]) => {
    if (!_.isArray(subTags) || !subTags) return
    console.log('Getting table warning for subscribed tags:', subTags)
    const subKeys: Record<string, boolean> = {}
    const t: Record<string, string[]> = {}

    subTags.forEach((tag: SubTag) => {
      subKeys[`${tag.tableId}-${tag.dataId}-${tag.tagId}`] = true
      t[tag.tableId] = [...(t[tag.tableId] || []), tag.dataId!]
    })

    const reqData: { tableId: string; data: string[] }[] = []
    Object.keys(t).forEach((ele: string) => {
      reqData.push({ tableId: ele, data: [...new Set(t[ele])].filter(Boolean) as string[] })
    })

    const f = encodeURIComponent(JSON.stringify(reqData))
    api({ name: 'warning/warning/stats/latest' })
      .fetch(`?tableData=${f}`, {})
      .then((res) => {
        const w = res?.json
        if (w && w.length > 0) {
          w.forEach((warningInfo: any) => {
            const fields = warningInfo?.fields
            const table = warningInfo?.table
            const tableData = warningInfo?.tableData
            table?.id && tableData?.id && fields?.forEach((field: any) => {
              const key = `${table.id}-${tableData.id}-${field.id}`
              if (subKeys[key]) {
                updateTagWarning(warningInfo)
              }
            })
          })
        }
      })
      .catch((error: any) => {
        console.error('获取记录报警信息失败!', error?.detail || error?.json?.detail)
      })
  }, [updateTagWarning])

  const debouncedGetTableWarning = React.useCallback(
    _.debounce(getTableWarning, 500),
    [getTableWarning]
  )

  return { subscribe: debouncedGetTableWarning }
}

export const useTagsTimeoutSubscribe = () => {
  const timeoutSetter = useUpdateTagsTimeout()

  React.useEffect(() => {
    worker.onmessage = (event) => {
      timeoutSetter(event.data)
    }
  }, [timeoutSetter])

  return null
}

export const useComputeSubscribe = () => {
  const updateReference = useUpdateReference()
  const { onData: onDataCompute, subscribe: subscribeCompute } = useWS()

  onDataCompute((data: any) => {
    updateReference(data)
  })

  React.useEffect(() => {
    const projectId = location.pathname.split('/').find(p => p.startsWith('_p_'))?.substring(3)
    subscribeCompute('computerecord', { projectId })
  }, [subscribeCompute])

  return null
}
