/**
 * 数据源-内表：查询平台表记录（GET core/t/{tableId}/d?query={...}）
 *
 * useDatasourceTable({ tableId, columns?, filter?, sorts?, limit?, interval? })
 *   → { data, loading, error, onReload }
 *
 * 返回记录数组，每个元素为 { field: value } 形态。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAPI as api } from "../api";

export interface TableSort {
  field: string;
  order: "ASC" | "DESC";
}

export interface DatasourceTableOptions {
  /** 平台表 ID（如 "device"、"alarm" 或自定义表 ID） */
  tableId: string;
  /** 返回的列投影（不传返回全部字段） */
  columns?: Record<string, number>;
  /** 过滤条件（透传给后端 query.filter） */
  filter?: Record<string, unknown>;
  /** 排序 */
  sorts?: TableSort[];
  /** 分页条数（默认 100） */
  limit?: number;
  /** 偏移量（分页用） */
  offset?: number;
  /** 轮询间隔（毫秒）；缺省只拉一次 */
  interval?: number;
  /** 聚合分组：{ 显示名: "$字段名" }（配合 groupFields 做分组统计） */
  groupBy?: Record<string, unknown>;
  /** 聚合数据列：{ 列名: { $sum/$avg/$max/$min: "$字段" } 或 { $sum: 1 } } */
  groupFields?: Record<string, unknown>;
}

export function useDatasourceTable(options: DatasourceTableOptions) {
  const { tableId, columns, filter, sorts, limit, offset, interval, groupBy, groupFields } = options;
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const paramsKey = useMemo(
    () => JSON.stringify({ tableId, columns, filter, sorts, limit, offset, groupBy, groupFields }),
    [tableId, columns, filter, sorts, limit, offset],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const query: Record<string, unknown> = {};
      // 平台查询不带投影时默认只返回 _label/id 等基础字段——数据源消费场景默认要全字段
      // 聚合形态（groupBy）投影由聚合本身决定，不叠 projectAll
      query.projectAll = !(options as any).groupBy && (options as any).projectAll !== false;
      if (filter) query.filter = filter;
      if (sorts?.length) query.sorts = sorts.map((s) => ({ [s.field]: s.order === "ASC" ? 1 : -1 }));
      if (limit) query.limit = limit;
      if (offset) query.offset = offset;
      if (columns) query.project = columns;
      // 聚合（平台 ?query 原生支持）：groupBy/groupFields 透传
      if (groupBy && Object.keys(groupBy).length > 0) query.groupBy = groupBy;
      if (groupFields && Object.keys(groupFields).length > 0) query.groupFields = groupFields;

      const qs = Object.keys(query).length
        ? "?query=" + encodeURIComponent(JSON.stringify(query))
        : "";
      const { json } = await api({ name: `core/t/${tableId}` }).fetch(`/d${qs}`);
      setData(Array.isArray(json) ? json : json?.records || []);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [paramsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!interval) return;
    const id = setInterval(fetchData, interval);
    return () => clearInterval(id);
  }, [fetchData, interval]);

  const onReload = useCallback(() => fetchData(), [fetchData]);

  return { data, loading, error, onReload };
}
