# fetchLatestTags 通用函数模板

> 每个项目都应在 API 层提供此函数，用于批量获取设备数据点并合并到记录。

```typescript
/**
 * 批量获取设备数据点最新值，合并到记录对象上
 * @param tableId 设备表 ID
 * @param records 设备记录列表（来自 createResourceClient.query）
 * @param tagIds 需要获取的数据点 ID 列表（来自 scan 数据的 tags[].id）
 * @returns 合并了数据点的记录列表
 */
async function fetchLatestTags<T extends Record<string, any>>(
  tableId: string,
  records: T[],
  tagIds: string[],
): Promise<T[]> {
  if (!records.length || !tagIds.length) return records
  const points = records.flatMap(r => tagIds.map(tagId => ({ tableId, id: r.id, tagId })))
  try {
    const dataClient = createHttpClient({ resource: 'core/data' })
    const res: any = await dataClient.request('/latest', { method: 'POST', body: points })
    const arr = Array.isArray(res) ? res : (res?.data ?? [])
    const latestMap: Record<string, any> = {}
    for (const item of arr) {
      latestMap[`${item.id || item.tableDataId}::${item.tagId}`] = item.value
    }
    return records.map(r => {
      const merged = { ...r }
      for (const tagId of tagIds) {
        const val = latestMap[`${r.id}::${tagId}`]
        if (val !== undefined) (merged as any)[tagId] = val
      }
      return merged
    })
  } catch { return records }
}
```

## 使用示例

```typescript
// 1. 查设备列表（只返回表字段：name, building, online 等）
const deviceApi = createResourceClient<Device>({
  client: createHttpClient({ resource: 'core/t/hvac_system/d' }),
  resource: 'core/t/hvac_system/d',
})
const { items } = await deviceApi.query({ limit: 20 })

// 2. 批量获取数据点，合并到记录
const devices = await fetchLatestTags('hvac_system', items, ['currentTemp', 'setTemp', 'humidity'])

// 3. 现在可以直接访问合并后的字段
console.log(devices[0].currentTemp) // 数据点值已合并
console.log(devices[0].name)        // 原始表字段
```

## 重要提醒

- **表字段 vs 数据点**：`createResourceClient.query()` 只返回 Schema 定义的 fields，不返回 tags 值
- **数据点必须用专用 API**：`fetchLatestTags`（当前值）/ `useTag`（实时订阅）/ `core/data/query`（历史趋势）
- **从 scan 数据识别数据点**：每个 device 表的 `tags[]` 数组列出了所有数据点 ID
