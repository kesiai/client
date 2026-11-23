/**
 * 数据源-实时：WebSocket 订阅设备数据点实时值 + 可选历史回填
 *
 * useDatasourceRealtime({ tags, timeLine? })
 *   → { data, loading, error }
 *
 * ==================== 输入 ====================
 * {
 *   tags: [{                    // 订阅列表（tag.id 与 tableData.id 缺一即被过滤掉）
 *     tag: { id: string },       // 数据点 ID
 *     table: { id: string },     // 设备表 ID
 *     tableData: { id: string }, // 设备记录 ID
 *   }]
 *   timeLine?: { count: number, unit?: string }  // 可选历史回填范围，如 { count: 1, unit: "h" } = 最近 1 小时
 * }
 *
 * ==================== 输出 ====================
 * data: Record<tagId, { value: any, time: string, tableDataId?: string }>
 *   // key = tag.id；WS 推送与历史回填增量合并进同一对象
 *   // time 为 "YYYY/M/D HH:mm:ss" 本地格式串
 *   // 未回填/未推送的 tag 不在 data 中
 * loading: boolean          // 仅历史回填期间为 true（WS 推送不影响）
 * error: unknown            // WS 建立失败时写入，推送/回填失败静默
 *
 * ==================== WS 推送消费的两种形态 ====================
 * 形态1：{ tableId, tableDataId, time, fields: { tagId: value } }（批量对象，按 tagId 展开）
 * 形态2：[{ tagId, value, time }]（数组增量，整条写入）
 *
 * 注意：useWS 是 React hook，必须在组件函数体顶层调用（Rules of Hooks），
 * 在 useEffect 里调用会抛 "Invalid hook call" 被静默吞掉 → 订阅永远建立不起来。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createAPI as api } from "../api";
import { useWS } from "../subscribe/ws";
import { dsDedupe, dsStableKey } from "./core";

export interface RealtimeTag {
  tag?: { id?: string };
  table?: { id?: string };
  tableData?: { id?: string };
}

export interface DatasourceRealtimeOptions {
  /** 数据点订阅列表 */
  tags: RealtimeTag[];
  /** 可选：初始历史回填的时间范围（如 { count: 1, unit: "h" } = 最近 1 小时） */
  timeLine?: { count?: number; unit?: string };
}

function processTags(tags: RealtimeTag[]): RealtimeTag[] {
  return (tags || []).filter((t) => t?.tag?.id && t?.tableData?.id);
}

export function useDatasourceRealtime(options: DatasourceRealtimeOptions) {
  const { tags: rawTags, timeLine } = options;
  // useWS 必须在组件顶层调用（内部是 useRef/useCallback，放进 useEffect 会 Invalid hook call）
  const { subscribe, onData } = useWS();
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const wsRef = useRef<{ unsubscribe?: () => void } | null>(null);

  const subTags = useMemo(() => processTags(rawTags), [rawTags]);

  // 稳定 key：订阅的 tag/dataId 列表
  const stableKey = useMemo(
    () => dsStableKey({ tags: subTags.map((t) => ({ tag: t.tag?.id, data: t.tableData?.id })) }),
    [subTags],
  );

  // WebSocket 实时订阅（subscribe/onData 是 client 内部稳定的 useCallback，可作依赖）
  useEffect(() => {
    if (subTags.length === 0) return;
    let cancelled = false;
    try {
      // 后端订阅协议字段：{ tableId, id(设备), tagId }（id 而非 dataId——字段名不匹配订阅无效）
      const subTagList = subTags.map((s) => ({
        tableId: s.table?.id,
        id: s.tableData?.id,
        tagId: s.tag?.id,
      }));
      const unsubscribe = subscribe("data", subTagList);
      wsRef.current = { unsubscribe };
      onData(function (msg: any) {
        if (cancelled) return;
        try {
          const parsed = typeof msg === "string" ? JSON.parse(msg) : msg;
          const data = parsed?.data ?? parsed;
          setData(function (prev) {
            const next = { ...prev };
            // 形态1（ws 实测）：fields 批量对象 { tableId, tableDataId, fields: { tagId: value } }
            if (data && typeof data === "object" && !Array.isArray(data) && data.fields && typeof data.fields === "object") {
              const tKey = data.tableDataId ?? data.id;
              Object.entries(data.fields).forEach(function (kv) {
                next[kv[0]] = { value: kv[1], time: data.time ? new Date(data.time).toLocaleString("zh-CN", { hour12: false }) : data.time, tableDataId: tKey };
              });
              return next;
            }
            // 形态2：数组增量 [{ tagId, value, time }]
            if (Array.isArray(data)) {
              data.forEach(function (item: any) {
                const tagKey = item.tagId || item.tag_id;
                if (tagKey) next[tagKey] = item;
              });
            }
            return next;
          });
        } catch (e) { /* 忽略解析错误 */ }
      });
      return function () {
        cancelled = true;
        unsubscribe?.();
      };
    } catch (e) {
      console.warn("[datasource-realtime] ws 订阅失败", e);
      setError(e);
    }
    return function () {
      cancelled = true;
      wsRef.current?.unsubscribe?.();
    };
  }, [stableKey, subscribe, onData]); // eslint-disable-line react-hooks/exhaustive-deps

  // 历史回填：初始时拉最近数据填充初始值
  useEffect(() => {
    if (subTags.length === 0) return;
    const timeWhere = timeLine?.count
      ? [`time >= now() - ${timeLine.count}${timeLine.unit || "h"}`]
      : [];
    // 每个数据点一个查询项（fields/tableId/id/where）——平台 core/data/query 数组形态
    const query = subTags.map((s) => {
      const tableId = s.table?.id;
      const dataId = s.tableData?.id;
      const tagId = s.tag?.id;
      return {
        fields: [tagId],
        tableId: tableId,
        id: dataId,
        where: [...timeWhere],
        limit: 10,
        order: "time desc",
      };
    });
    const qs = encodeURIComponent(JSON.stringify(query));
    setLoading(true);
    dsDedupe("realtime-backfill:" + stableKey, function () {
      return api({ name: "core/data" })
        .fetch("/query?query=" + qs)
        .then(function (res: any) {
          const results = res.json?.results;
          if (!results) return;
          const latest: Record<string, any> = {};
          results.forEach(function (r: any, idx: number) {
            const tag = subTags[idx];
            if (!tag?.tag?.id) return;
            // 取 series 最新点：{ value, time }（卡片读 data[tagId].value）
            const s = (r.series ?? [])[0];
            const values = s?.values ?? [];
            if (values.length === 0) return;
            const last = values[values.length - 1];
            latest[tag.tag.id] = { value: last[1], time: new Date(last[0]).toLocaleString("zh-CN", { hour12: false }), tagId: tag.tag.id };
          });
          setData(function (prev) { return { ...prev, ...latest }; });
        })
        .catch(function () { /* 静默 */ })
        .finally(function () { setLoading(false); });
    });
  }, [stableKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error };
}
