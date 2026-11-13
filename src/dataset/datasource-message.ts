/**
 * 数据源-消息：查询平台消息（core/message，支持过滤/排序/分页/分组）
 *
 * useDatasourceMessage({ initFilter?, sorts?, limit?, group?, columns?, interval? })
 *   → { data, loading, error, onReload }
 *
 * 对应 kesi-ui 的 datasource-message 数据源组件的查询逻辑（shadcn hook 形态）。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { createAPI as api } from "../api";

export interface MessageSort {
  value: string;
  order: "ASC" | "DESC";
}

export interface MessageGroup {
  field?: string;
  /** 日期分组算子（天/周/月/年/时/分…），缺省按字段值分组 */
  dateOperator?: string;
}

export interface MessageColumn {
  /** 聚合结果列名（缺省「个数」） */
  name?: string;
  /** 聚合目标字段 */
  field?: string;
  /** 聚合方法（$count/$sum/$avg/$first/$last/$max/$min） */
  accumulator?: "$count" | "$avg" | "$first" | "$last" | "$max" | "$min" | "$sum";
  /** 自定义聚合表达式（accumulator/field 都空时直接作为 groupFields 值） */
  expression?: unknown;
}

/** 字段格式化（旧版 feildFormat）：time 字段用日期格式串，数值字段用数字格式 */
export interface MessageFieldFormat {
  field?: string;
  format?: string;
}

export interface DatasourceMessageOptions {
  /** 过滤条件（透传给后端 query.filter） */
  initFilter?: Record<string, unknown>;
  /** 排序配置 */
  fieldOrder?: MessageSort[];
  /** 分组查询（需 isGroup） */
  isGroup?: boolean;
  /** 分组字段配置 */
  group?: MessageGroup[];
  /** 分组聚合的列配置 */
  columns?: MessageColumn[];
  /** 分页条数（默认 1000） */
  limit?: number;
  /** 字段格式化（旧版 feildFormat） */
  feildFormat?: MessageFieldFormat[];
  /** 轮询间隔（毫秒）；缺省只拉一次 */
  interval?: number;
}

const DEFAULT_PROJECT_PROJECTION = {
  isDelete: 1,
  data: 1,
  messageType: 1,
  optType: 1,
  record: 1,
  createTime: 1,
};

// 日期分组算子（对齐 kesi-ui 参考实现的 makeDateOperation）
function makeDateOperation(g: MessageGroup): unknown {
  const fieldId = typeof g.field === "object" && g.field !== null ? (g.field as any).id : g.field;
  if (!fieldId) return null;
  const $field = "$" + fieldId;
  switch (g.dateOperator) {
    case "天": return { $dateToString: { format: "%Y-%m-%d", date: $field } };
    case "周": return { $dateToString: { format: "%Y-%V", date: $field } };
    case "月": return { $dateToString: { format: "%Y-%m", date: $field } };
    case "年": return { $year: $field };
    case "一小时内的分钟数": return { $minute: $field };
    case "一天内的小时数": return { $hour: $field };
    case "一周内的天数": return { $dayOfWeek: $field };
    case "一月内的天数": return { $dayOfMonth: $field };
    case "一年内的天数": return { $dayOfYear: $field };
    case "一年内的星期数": return { $week: $field };
    case "一年内的月数": return { $month: $field };
    default: return `$${fieldId}`;
  }
}

// 构造分组查询（对齐参考实现 makeQuery：groupBy/groupFields 均为对象形态）
function makeGroupQuery(group: MessageGroup[], columns: MessageColumn[]): { groupBy: Record<string, unknown>; groupFields: Record<string, unknown> } {
  const groupBy: Record<string, unknown> = {};
  const groupFields: Record<string, unknown> = {};
  group.forEach((g) => {
    if (!g.field) return;
    groupBy[g.field] = g.dateOperator ? makeDateOperation(g) : `$${g.field}`;
  });
  columns.forEach((c) => {
    const name = c.name || "个数";
    if (c.accumulator === "$count") {
      groupFields[name] = { $sum: 1 };
    } else if (c.accumulator && c.field) {
      groupFields[name] = { [c.accumulator]: `$${c.field}` };
    } else if (c.expression !== undefined && c.expression !== null) {
      // 旧版表达式列：自定义聚合表达式直接作为 groupFields 值
      groupFields[name] = c.expression;
    }
  });
  return { groupBy, groupFields };
}

// 过滤结果数据（feildFormat 结构化格式处理，v1 透传原数据）
const filterResultData = (data: any) => data;

// 旧版 dateFormat 轻量实现：YYYY/MM/DD/HH/mm/ss token 替换
function formatTime(value: unknown, format: string): string {
  const d = new Date(String(value ?? ""));
  if (isNaN(d.getTime())) return String(value ?? "");
  const pad = (n: number) => (n < 10 ? "0" + n : String(n));
  return format
    .replace(/YYYY/g, String(d.getFullYear()))
    .replace(/MM/g, pad(d.getMonth() + 1))
    .replace(/DD/g, pad(d.getDate()))
    .replace(/HH/g, pad(d.getHours()))
    .replace(/mm/g, pad(d.getMinutes()))
    .replace(/ss/g, pad(d.getSeconds()));
}

// 应用旧版 feildFormat：createTime 等时间字段按日期格式，其余按数字格式（千分位/小数）
function applyFieldFormat(list: unknown[], feildFormat?: MessageFieldFormat[]): unknown[] {
  if (!feildFormat || feildFormat.length === 0) return list;
  const TIME_FIELDS = ["createTime"];
  return list.map(function(item: any) {
    if (!item || typeof item !== "object") return item;
    const next = { ...item };
    feildFormat.forEach(function(ff) {
      if (!ff.field || !(ff.field in next)) return;
      const raw = next[ff.field];
      if (raw === undefined || raw === null) return;
      if (TIME_FIELDS.indexOf(ff.field) >= 0) {
        next[ff.field] = formatTime(raw, ff.format || "YYYY-MM-DD HH:mm:ss");
      } else {
        const n = Number(raw);
        if (!isNaN(n)) {
          // 数字格式：'0.00' 等小数位写法 → toFixed
          const m = /^0\.(0+)$/.exec(ff.format ?? "");
          next[ff.field] = m ? n.toFixed(m[1].length) : n.toLocaleString("zh-CN");
        }
      }
    });
    return next;
  });
}

export function useDatasourceMessage(options: DatasourceMessageOptions) {
  const { initFilter, fieldOrder, isGroup, group, columns, limit, feildFormat, interval } = options;
  const [data, setData] = useState<unknown>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // 参数内容的稳定序列化作为拉取依赖
  const paramsKey = useMemo(
    () => JSON.stringify({ initFilter, fieldOrder, isGroup, group, columns, limit, feildFormat }),
    [initFilter, fieldOrder, isGroup, group, columns, limit, feildFormat],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const filter = initFilter ?? {};

      const query: Record<string, unknown> = {
        project: DEFAULT_PROJECT_PROJECTION,
        filter,
        sorts: fieldOrder?.map((order) => ({ [order.value]: order.order === "ASC" ? 1 : -1 })),
      };

      if (isGroup && group && group.length > 0 && columns) {
        // 分组查询：groupBy=分组字段对象，groupFields=聚合列对象（对齐参考实现）
        const { groupBy, groupFields } = makeGroupQuery(group, columns);
        query.groupBy = groupBy;
        query.groupFields = groupFields;
      }

      query.limit = limit || 1000;

      const queryString = encodeURIComponent(JSON.stringify(query));
      const { json } = await api({ name: "core/message" }).fetch(`?query=${queryString}`);

      setData(applyFieldFormat(filterResultData(json || []), feildFormat));
      setError(null);
    } catch (e) {
      setError(e);
      setData([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  // 首次拉取
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 轮询（可选）
  useEffect(() => {
    if (!interval) return;
    const id = setInterval(fetchData, interval);
    return () => clearInterval(id);
  }, [fetchData, interval]);

  const onReload = useCallback(() => fetchData(), [fetchData]);

  return { data, loading, error, onReload };
}
