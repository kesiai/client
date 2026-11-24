/**
 * 数据源-历史数据：查询平台历史数据（POST core/data/query）
 *
 * useDatasourceHistory({ items, timeRange, group?, noTime?, xFormat?, statisType?, type?, startTime?, sortByTime?, interval?, getOtherCondition? })
 *   → { data, loading, error, onReload }
 *
 * ==================== 输入 ====================
 * {
 *   items: DataItemConfig[]          // 数据点配置，每项生成一个 query：
 *   //   { id?, table?, model?: { id? }, tag?: { id }, fields?, func?, fixed?,
 *   //     groupType?: "id"|"department"|"other", group?, query?, title?, key? }
 *   //   fields 缺省时由 tag.id 构造：无分组=裸 tag，有分组/noTime=`${func||"mean"}("tagId")`
 *   timeRange: TimeRangeConfig       // 时间条件（timeQuery）：
 *   //   { type: "forward"|"backward"|"now"|"before"|"after"|"between"|"lte"|"gte",
 *   //     count?, unit?, fromNow?, time?, historyTime?,
 *   //     range?: { gte?, lte?, ... } }
 *   //   type + 必要参数不满足时 makeQuery 返回 null（该项不查询）
 *   group?: { count, unit, fill?, isClassMode?, table?, record? }   // 时间分组
 *   noTime?: boolean                 // true → 统计模式（不按时间序列）
 *   xFormat?: string                 // X 轴时间格式化（dayjs format），设置后 time 列变字符串
 *   statisType?: "moment"            // 瞬时值（配 type+startTime）
 *   type?: string / startTime?: any
 *   sortByTime?: boolean             // true → "time desc"（默认 "time asc"）
 *   interval?: number                // 轮询毫秒，缺省只拉一次（并发去重，见 inflightRef）
 *   getOtherCondition?: (query) => any   // item 自带 query 时构造 otherCondition
 * }
 *
 * ==================== 输出（接口原始结构，直返不再整形） ====================
 * data: QueryResult[] | null
 *
 * core/data/query 的原始 results，与请求 queries 按下标一一对应：
 *   QueryResult = {
 *     count?: number
 *     series?: [{ name?, columns?, tags?: Record<string,string>,
 *                 values: [[time, value], ...] }]   // 原始时间序列
 *   }
 *
 * 常用取值链（单 item）：data?.[0]?.series?.[0]?.values?.at(-1)?.[1]  // 最新值
 *
 * 特殊值：推导不出时间窗/fields（makeQuery 全 null）或接口无 results → null
 * loading: boolean / error: unknown / onReload: () => void
 *
 * 注：xFormat 仅影响旧的 queryData 整形输出，直返原始结构后不再生效（保留参数位兼容）。
 *
 * 移植自 kesi-ui 的 datasource-history 数据源组件（makeQuery/timeQuery/查询执行）；
 * 输出不再做 queryData 整形，直接返回接口原始 results。
 * 本文件是项目源码，可按需修改（shadcn 形态）。
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import dayjs from "dayjs";
import isEmpty from "lodash/isEmpty";
import { createAPI as api } from "../api";
import { dsStableKey } from "./core";

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
  count?: number;
  series?: Array<{
    name?: string;
    columns?: string[];
    tags?: Record<string, string>;
    values: Array<[string, number]>;
  }>;
}

// ==================== Utility Functions ====================


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
  /** 额外查询条件（当 item 自带 query 时透传给查询构造） */
  getOtherCondition?: (query: any) => any;
  /** 轮询间隔（毫秒）；缺省只拉一次 */
  interval?: number;
}

/** 按 key 单例的运行状态（模块级，同配置共享） */
const statusMap = new Map<string, { data: unknown; loading: boolean; error: unknown }>();
const statusListeners = new Map<string, Set<() => void>>();

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
        // 可构建性由 makeQuery 唯一判定（推导不出 fields/时间窗 → null → filter(Boolean) 兜底）。
        // 不设第二道资格过滤——曾因「要求 uid/id 或分组配置」与面板设计形态（table+tag+func）
        // 漂移，items 全被滤掉 → .data 恒为 null
        const queries = items
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

        // 直返接口原始 results（不做 queryData 整形）——与请求 queries 下标一一对应
        statusEmit(key, { data: results, loading: false, error: null });
        return results;
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
