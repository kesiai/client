/**
 * 数据源-历史数据：查询平台历史数据（core/data/query）
 *
 * useDatasourceHistory({ items, timeRange, group?, ... })
 *   → { data, loading, error, onReload }
 *
 * 移植自 kesi-ui 的 datasource-history 数据源组件（makeQuery/queryData 全逻辑）。
 * 本文件是项目源码，可按需修改（shadcn 形态）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import isNumber from "lodash/isNumber";
import isEmpty from "lodash/isEmpty";
import isNil from "lodash/isNil";
import { createAPI as api } from "../api";
import { dsDedupe, dsSet, dsSnapshot, dsStableKey, dsSubscribe } from "./core";

// ==================== Types ====================

export interface TimeRangeConfig {
  type?: "forward" | "backward" | "now" | "before" | "after" | "between" | "lte" | "gte";
  count?: number;
  unit?: string;
  fromNow?: boolean;
  time?: string;
  historyTime?: string;
  range?: {
    gte?: string;
    lte?: string;
    date?: string;
    record?: { id?: string; table?: { id?: string } };
    financialMonth?: { financialMonth?: string; financialDate?: number; financialTime?: string };
    radioType?: number;
  };
}

export interface GroupConfig {
  count?: number;
  unit?: string;
  fill?: { value: string };
  isClassMode?: boolean;
  table?: string;
  record?: string;
}

export interface DataItemConfig {
  uid?: string;
  id?: string;
  key?: string;
  /** InfluxQL 查询字段（如 mean("WD")）；缺省时由 tag.id 自动构造 */
  fields?: string[];
  /** 设备表 ID（简写形态，等价 table:{id}） */
  table?: string;
  /** 数据点（简写形态：{ id: "WD" }），fields 缺省时用它构造查询字段 */
  tag?: { id: string };
  model?: { id?: string };
  groupType?: string;
  group?: string;
  fixed?: number;
  func?: string;
  query?: any[];
  title?: string;
  [key: string]: unknown;
}

export interface QueryResult {
  series?: Array<{ values: Array<[string, number]>; tags?: Record<string, string> }>;
}

// ==================== Utility Functions ====================

const toFixed = (value: number, precision = 2): number | null => {
  if (!isNumber(value)) return value;
  return Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision);
};

const convertField = (params: { field?: string; groupType?: string; method?: string }): string => {
  const { field, groupType, method } = params;
  if (field == null) return "MEAN(NULL)";
  if (field.indexOf("(") < 0) return `${groupType && method ? method : "MEAN"}(${field})`;
  return field;
};

const hasGroup = (group?: GroupConfig): boolean => !!(group && group.count && group.unit);

const mergeSeriesById = (series: any[]): any[] => {
  if (series?.length > 1) {
    const resultValues = series[0].values.map((item: any) => [item[0], 0]);
    series.forEach((serie) => {
      serie.values.forEach((value: any, index: number) => {
        resultValues[index][1] = resultValues[index][1] + value[1];
      });
    });
    return [{ values: resultValues }];
  }
  return series;
};

/** 时间查询条件（移植 datasource-utils 的 timeQuery） */
export const timeQuery = (timeRange: any): string[] | null => {
  const { type, count, unit, fromNow, time, range, historyTime } = timeRange;
  const start = historyTime ? dayjs(historyTime) : dayjs();
  const end = historyTime ? dayjs(historyTime) : dayjs();

  if (type == "forward" && count && unit) {
    if (!fromNow) {
      return [
        `time >= '${start.startOf(unit).subtract(count, unit).toISOString()}'`,
        `time < '${end.startOf(unit).toISOString()}'`,
      ];
    }
    return [`time >= '${start.subtract(count, unit).toISOString()}'`, `time < '${end.toISOString()}'`];
  }
  if (type == "backward" && count && unit) {
    if (!fromNow) {
      return [
        `time < '${start.endOf(unit).add(count, unit).toISOString()}'`,
        `time > '${end.endOf(unit).toISOString()}'`,
      ];
    }
    return [`time < '${start.add(count, unit).toISOString()}'`, `time > '${end.toISOString()}'`];
  }
  if (type == "now" && unit) {
    return [`time > '${start.startOf(unit).toISOString()}'`, `time <= '${end.toISOString()}'`];
  }
  if (type == "before" && time) return [`time < '${dayjs(time).toISOString()}'`];
  if (type == "after" && time) return [`time >= '${dayjs(time).toISOString()}'`];
  if (type == "between" && range && range.lte && range.gte) {
    return [`time >= '${dayjs(range.gte).toISOString()}'`, `time <= '${dayjs(range.lte).toISOString()}'`];
  }
  if (type == "lte" && time) return [`time <= '${dayjs(time).toISOString()}'`];
  if (type == "gte" && time) return [`time >= '${dayjs(time).toISOString()}'`];
  return null;
};

// ==================== 查询构建（移植 makeQuery） ====================

const makeQuery = (
  item: DataItemConfig,
  range: TimeRangeConfig,
  noTime?: boolean,
  group?: GroupConfig,
  statisType?: string,
  type?: string,
  startTime?: any,
  getOtherCondition?: (query: any) => any,
  sortByTime?: boolean,
): any | null => {
  const timeWhere = timeQuery(range);
  if (!timeWhere) return null;

  // fields 兜底构造（对齐 kesi-ui：无分组=裸 tag，有分组/noTime=聚合函数）。
  // 调用方可直接传 tag:{id}/table:{id} 简化形态，也可自带 fields。
  const hasGroupFn = !!(group && group.count && group.unit);
  let fields = item.fields;
  if (!fields?.length && item.tag?.id) {
    fields = [hasGroupFn || noTime ? `${item.func || "mean"}("${item.tag.id}")` : item.tag.id];
  }
  if (!fields?.length) return null;

  const query: any = {
    fields,
    id: item.id,
    tableId: item?.table || item?.model?.id,
    where: [...timeWhere],
    order: sortByTime ? "time desc" : "time asc",
    otherCondition:
      item.id && item.query?.length && item.query[0]?.length && item.query[0][0]?.field && item.query[0][0]?.method
        ? getOtherCondition?.(item.query)
        : null,
    fill: null,
  };

  if (!noTime) {
    const isClassGroup = group && group.isClassMode;
    if (isClassGroup) {
      query.type = "class";
      query.bcTable = group.table;
      query.bcTableData = group.record;
    } else {
      let groupQuery = group && group.count && group.unit ? `time(${group.count}${group.unit})` : "";
      if (group && group.unit === "fm") {
        groupQuery = `time(${group.count}m)`;
        query.type = "month";
      }
      if (item.groupType === "id") {
        query.group = ["id"];
      } else if (item.groupType === "department") {
        query.group = ["department"];
      } else if (item.groupType === "other") {
        query.group = [`"${item.group}"`];
      }
      if (groupQuery) {
        query.group = [...(query.group || []), groupQuery];
        query.fill = group?.fill?.value || "null";
      }
    }
  }

  if (statisType && statisType === "moment" && type && !isEmpty(startTime)) {
    query.type = type;
    query.startTime = startTime;
  }

  return query;
};



// ==================== queryData（series 整形 → dataset 输出，移植 queryData） ====================

interface DatasetDimensions {
  name: string;
  title?: string;
  type: string;
  tag?: string;
}

export interface DatasetResult {
  title?: string;
  dimensions: DatasetDimensions[];
  source: any[];
}

const findLongestArrayProperty = (obj: Record<string, any[]>): string | null => {
  let longestProp: string | null = null;
  let maxLength = 0;
  for (const prop in obj) {
    if (Array.isArray(obj[prop]) && obj[prop].length > maxLength) {
      maxLength = obj[prop].length;
      longestProp = prop;
    }
  }
  return longestProp;
};

const hasGroupFlagFn = (group?: GroupConfig): boolean => !!(group && group.count && group.unit);

/**
 * queryData 完整移植：查询结果 → 三种 dataset 输出模式
 * 1) noTime → 统计数据（dimensions+source）
 * 2) hasGroup 且无 groupType → 时间+多列合并 dataset
 * 3) 其他 → 多 dataset 数组（每 key 一个）
 */
const buildDatasets = (
  items: DataItemConfig[],
  timeRange: TimeRangeConfig,
  group: GroupConfig | undefined,
  series: Record<string, any[]>,
  noTime?: boolean,
  xFormat?: string,
): DatasetResult | DatasetResult[] | null => {
  const hasGroupFlag = hasGroupFlagFn(group);
  const keysOfSeries = Object.keys(series);

  if (noTime) {
    // 统计数据
    const source = keysOfSeries
      .map((key) => {
        const item = items.find((i) => i.key === key);
        if (series[key] && series[key].length > 0) {
          return [item?.title || item?.name, !isNil(series[key][0][1]) ? series[key][0][1] : null, key];
        }
        return null;
      })
      .filter(Boolean);
    return {
      dimensions: [
        { name: "name", title: "数据项", type: "ordinal" },
        { name: "value", title: "数据值", type: "number" },
        { name: "key", title: "数据ID", type: "ordinal" },
      ],
      source: source as any[],
    };
  }

  if (hasGroupFlag && !items.find((item) => item.groupType)) {
    // 时间+多列合并 dataset
    const maxLen = findLongestArrayProperty(series);
    if (!maxLen) return null;
    const times = series[maxLen]?.map((s: any) => s[0]);
    const source = times?.map((t: any, i: number) => [
      t,
      ...keysOfSeries.map((key) => {
        if (series[key]) {
          const val = !isNil(series[key][i]) ? series[key][i][1] : null;
          return val == null ? null : val;
        }
        return null;
      }),
    ]);
    const dimensions: DatasetDimensions[] = [
      { name: "time", title: "时间", type: xFormat ? "ordinal" : "time" },
      ...keysOfSeries.map((key) => {
        const item = items.find((i) => i.key === key);
        return { name: item?.title || item?.name || key || "", type: "number", tag: item?.key };
      }),
    ];
    return { dimensions, source };
  }

  // 多 dataset 数组（每 key 一个）
  return keysOfSeries.map((key) => {
    const item = items.find((i) => i.key === key);
    const title = item?.name;
    const dimensions: DatasetDimensions[] = [
      { name: item?.title || item?.name || key || "", type: "number", tag: item?.key },
    ];
    const source = series[key];
    const finalDimensions = [...dimensions];
    if (item?.groupType) {
      if (hasGroupFlag) {
        finalDimensions.unshift({ name: "time", title: "时间", type: xFormat ? "ordinal" : "time" });
      }
      let d1: DatasetDimensions = { name: item.group || "", title: item.group || "", type: "string" };
      if (item.groupType === "id") {
        d1 = { name: "id", title: "设备编号", type: "string" };
      } else if (item.groupType === "department") {
        d1 = { name: "department", title: "部门", type: "string" };
      }
      finalDimensions.unshift(d1);
    } else {
      finalDimensions.unshift({ name: "time", title: "时间", type: xFormat ? "ordinal" : "time" });
    }
    return { title, dimensions: finalDimensions, source } as DatasetResult;
  });
};

/**
 * 执行查询并整形（移植 queryData 主体）
 */
const queryData = (
  items: DataItemConfig[],
  timeRange: TimeRangeConfig,
  results: any[] | undefined,
  group?: GroupConfig,
  noTime?: boolean,
  xFormat?: string,
): DatasetResult | DatasetResult[] | null | undefined => {
  const hasGroupFlag = hasGroupFlagFn(group);

  const series = items.reduce(
    (prev: Record<string, any[]>, item: DataItemConfig, index: number) => {
      const result = results?.[index];
      const { key, fixed, groupType } = item;
      const itemGroup = item.group;

      if (result?.series && hasGroupFlag && !item.uid && !item.id && !groupType) {
        result.series = mergeSeriesById(result.series);
      }

      if (groupType) {
        if (group && group.count && group.unit) {
          const newseries: any[] = [];
          result?.series?.forEach((s: any) => {
            const col1 = s?.tags?.[groupType || ""] || s?.tags?.[itemGroup || ""];
            s?.values.forEach((vs: any) => {
              const col2 = xFormat ? dayjs(new Date(vs[0])).format(xFormat) : new Date(vs[0]);
              const col3 = toFixed(vs[1], !isNil(fixed) ? fixed : 3);
              newseries.push([col1, col2, col3]);
            });
          });
          prev[key!] = newseries;
        } else {
          prev[key!] = (result?.series || []).map((s: any) => [
            s?.tags?.[groupType || ""] || s?.tags?.[itemGroup || ""],
            toFixed(s?.values?.[0]?.[1], !isNil(fixed) ? fixed : 3),
          ]);
        }
      } else {
        prev[key!] = result?.series
          ? result.series[0]?.values.map((vs: any) => {
              if (xFormat) {
                return [dayjs(new Date(vs[0])).format(xFormat), toFixed(vs[1], !isNil(fixed) ? fixed : 3)];
              }
              return [new Date(vs[0]), toFixed(vs[1], !isNil(fixed) ? fixed : 3)];
            })
          : [];
      }
      return prev;
    },
    {},
  );

  if (noTime) {
    const source = Object.keys(series)
      .map((key) => {
        const item = items.find((i) => i.key === key);
        if (series[key] && series[key].length > 0) {
          return [item?.title || item?.name, !isNil(series[key][0][1]) ? series[key][0][1] : null, key];
        }
        return null;
      })
      .filter(Boolean);
    return {
      dimensions: [
        { name: "name", title: "数据项", type: "ordinal" },
        { name: "value", title: "数据值", type: "number" },
        { name: "key", title: "数据ID", type: "ordinal" },
      ],
      source: source as any[],
    };
  } else if (hasGroupFlag && !items.find((item) => item.groupType)) {
    const maxLen = findLongestArrayProperty(series);
    if (!maxLen) return undefined;
    const times = series[maxLen]?.map((s: any) => s[0]);
    const source = times?.map((t: any, i: number) => [
      t,
      ...Object.keys(series).map((key) => {
        if (series[key]) {
          return !isNil(series[key][i]) ? series[key][i][1] : null;
        }
        return null;
      }),
    ]);
    const dims: DatasetDimensions[] = [
      { name: "time", title: "时间", type: xFormat ? "ordinal" : "time" },
      ...Object.keys(series).map((key) => {
        const item = items.find((i) => i.key === key);
        return { name: item?.title || item?.name || key || "", type: "number", tag: item?.key };
      }),
    ];
    return { dimensions: dims, source };
  } else {
    return Object.keys(series).map((key) => {
      const item = items.find((i) => i.key === key);
      const title = item?.name;
      const dimensions: DatasetDimensions[] = [
        { name: item?.title || item?.name || key || "", type: "number", tag: item?.key },
      ];
      const source = series[key];
      const finalDimensions = [...dimensions];
      if (item?.groupType) {
        if (hasGroupFlag) {
          finalDimensions.unshift({ name: "time", title: "时间", type: xFormat ? "ordinal" : "time" });
        }
        let d1: DatasetDimensions = { name: item.group || "", title: item.group || "", type: "string" };
        if (item.groupType === "id") {
          d1 = { name: "id", title: "设备编号", type: "string" };
        } else if (item.groupType === "department") {
          d1 = { name: "department", title: "部门", type: "string" };
        }
        finalDimensions.unshift(d1);
      } else {
        finalDimensions.unshift({ name: "time", title: "时间", type: xFormat ? "ordinal" : "time" });
      }
      return { title, dimensions: finalDimensions, source } as DatasetResult;
    });
  }
};


// ==================== hook ====================

export interface DatasourceHistoryOptions {
  /** 数据点配置（每个 item 生成一个 query） */
  items: DataItemConfig[];
  /** 时间范围 */
  timeRange: TimeRangeConfig;
  /** 时间分组配置 */
  group?: GroupConfig;
  /** 查询不含时间条件 */
  noTime?: boolean;
  /** X 轴日期格式 */
  xFormat?: string;
  /** 瞬时值统计类型 */
  statisType?: string;
  /** 查询类型 */
  type?: string;
  /** 班次开始时间 */
  startTime?: any;
  /** 按时间排序 */
  sortByTime?: boolean;
  /** 轮询间隔（毫秒）；缺省只拉一次 */
  interval?: number;
}

/** 按 key 单例的运行状态（模块级，同配置共享） */
const statusMap = new Map<string, { data: unknown; loading: boolean; error: unknown }>();
const statusListeners = new Map<string, Set<() => void>>();

function statusSubscribe(key: string, cb: () => void) {
  if (!statusListeners.has(key)) statusListeners.set(key, new Set());
  statusListeners.get(key)!.add(cb);
  return () => statusListeners.get(key)!.delete(cb);
}
function statusSnapshot(key: string) {
  return statusMap.get(key) ?? { data: null, loading: false, error: null };
}
function statusEmit(key: string, patch: Partial<{ data: unknown; loading: boolean; error: unknown }>) {
  const prev = statusMap.get(key) ?? { data: null, loading: false, error: null };
  statusMap.set(key, { ...prev, ...patch });
  statusListeners.get(key)?.forEach((cb) => cb());
}

export function useDatasourceHistory(options: DatasourceHistoryOptions) {
  const key = useMemo(
    () => "history:" + dsStableKey(options as unknown as Record<string, unknown>),
    [options.items, options.timeRange, options.group, options.noTime, options.xFormat, options.statisType, options.type, options.startTime, options.sortByTime, options.interval], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const inflightRef = useRef<Promise<unknown> | null>(null);

  const query = useCallback(async () => {
    if (inflightRef.current) return inflightRef.current;

    const p = (async () => {
      statusEmit(key, { loading: true });
      try {
        const items = options.items ?? [];
        const filterItems = items.filter(
          (f: any) => f?.uid || f?.id || (f?.table && (options.group && options.group.count && options.group.unit || f.groupType)),
        );
        const queries = filterItems
          .map((item: any) =>
            makeQuery(item, options.timeRange, options.noTime, options.group, options.statisType, options.type, options.startTime, options.getOtherCondition, options.sortByTime),
          )
          .filter(Boolean);
        if (queries.length === 0) {
          statusEmit(key, { data: null, loading: false });
          return null;
        }

        const { results } = await api({ name: "core/data" })
          .fetch("/query", { method: "POST", body: JSON.stringify(queries) })
          .then(({ json }) => json);

        if (!results) {
          statusEmit(key, { data: null, loading: false });
          return null;
        }

        const shaped = queryData(items, options.timeRange, results, options.group, options.noTime, options.xFormat);
        statusEmit(key, { data: shaped, loading: false, error: null });
        return shaped;
      } catch (e) {
        statusEmit(key, { loading: false, error: e });
        throw e;
      }
    })();

    inflightRef.current = p.finally(() => {
      inflightRef.current = null;
    });
    return p;
  }, [key, options.items, options.timeRange, options.group, options.noTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // 首次自动拉取（同 key 已有数据或已在加载则跳过）
  useEffect(() => {
    const snap = statusSnapshot(key);
    if (!snap.data && !snap.loading) {
      query().catch(() => {});
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // 轮询（可选）
  useEffect(() => {
    if (!options.interval) return;
    const id = setInterval(() => query().catch(() => {}), options.interval);
    return () => clearInterval(id);
  }, [key, options.interval]); // eslint-disable-line react-hooks/exhaustive-deps

  const onReload = useCallback(() => query().catch(() => {}), [query]);

  const snapshot = statusSnapshot(key);
  return { data: snapshot.data, loading: snapshot.loading, error: snapshot.error, onReload };
}
