/**
 * 数据源-视图数据：查询平台数据视图（POST ds/view/preview?id={viewId}&mode=live）
 *
 * useDatasourceView({ view | viewId, dimension?, stack?, measure?, where?, interval? })
 *   → { data, loading, error, onReload }
 *
 * ==================== 输入 ====================
 * {
 *   viewId?: string        // 视图 ID 简写（内部查 ds/view 列表补全定义）；与 view 二选一
 *   view?: { id?, name?, config?, datasetId?, style? }  // 完整视图定义
 *   dimension?: string[]   // 维度字段名数组（覆盖 config.group；空数组 → noGroupBy）
 *   stack?: string         // 堆叠项字段（覆盖 config.stack）
 *   measure?: [{           // 指标列
 *     field?: string,      //   源字段；acc="count" 时忽略
 *     name?: string,       //   别名
 *     acc?: string,        //   聚合器（"count" 记作 *，其余透传 option.aggregator）；缺省原样取数
 *   }]
 *   where?: [{ field: string, method?: "eq"|"ne"|"gt"|"lt"|"gte"|"lte"|"like"|"between", value?: unknown }]
 *   interval?: number      // 轮询毫秒，缺省只拉一次
 * }
 *
 * 对齐旧版 viewdata：dimension/stack/measure/where 按旧版 dataMerge 语义覆盖 preview 请求的 config。
 *
 * ==================== 输出 ====================
 * data: { dimensions: string[], source: any[][] }   // echarts dataset 格式
 *   // dimensions = 列名数组（preview 响应 fields[].name，与 source 列对齐）
 *   // source     = 行二维数组（preview 响应 data 原样）
 *   // 视图缺失/解析失败时为 { dimensions: [], source: [] }
 * loading: boolean
 * error: unknown
 * onReload: () => void
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { createAPI as api } from "../api";

export interface DatasourceViewOptions {
  /** 视图 ID 简写：内部自动拉取完整视图定义 */
  viewId?: string;
  /** 数据视图定义（一般为 ds/view 列表返回的完整记录）；与 viewId 二选一 */
  view?: {
    id?: string;
    name?: string;
    config?: any;
    datasetId?: string;
    style?: any;
  };
  /** 维度：字段名数组（覆盖 config.group） */
  dimension?: string[];
  /** 堆叠项字段（覆盖 config.stack） */
  stack?: string;
  /** 指标：字段+聚合（acc 缺省为原样取数；name 为别名；count 记作 *） */
  measure?: Array<{ field?: string; name?: string; acc?: string }>;
  /** 过滤：[{field, method(eq/ne/gt/lt/gte/lte/like/between), value}]（覆盖 config.where） */
  where?: Array<{ field?: string; method?: string; value?: unknown }>;
  /** 轮询间隔（毫秒）；缺省只拉一次 */
  interval?: number;
}

interface ViewPreviewResponse {
  data?: any[][];
  fields?: Array<{ name?: string; originalName?: string }>;
}

// 旧版 dataMerge 语义：dimension/measure/where/stack 合并进 preview 的 config
function mergeViewConfig(
  baseConfig: any,
  opts: { dimension?: string[]; stack?: string; measure?: Array<{ field?: string; name?: string; acc?: string }>; where?: Array<{ field?: string; method?: string; value?: unknown }> },
): any {
  const cfg: any = { ...(baseConfig ?? {}) };
  if (opts.dimension) {
    cfg.group = opts.dimension;
    cfg.noGroupBy = opts.dimension.length === 0;
  }
  if (opts.measure && opts.measure.length > 0) {
    cfg.fields = opts.measure.map(function(m) {
      if (m.acc) {
        // 聚合指标：count 记作 *（旧版「记录数」语义）
        const name = m.acc === "count" ? "*" : (m.field || "");
        return { name, alias: m.name || null, option: { aggregator: m.acc } };
      }
      return { name: m.field || "", alias: m.name || null };
    });
  }
  if (opts.where && opts.where.length > 0) {
    cfg.where = opts.where
      .filter(function(w) { return w.field; })
      .map(function(w) { return { name: w.field, op: (w.method || "eq").toLowerCase(), value: w.value }; });
  }
  if (opts.stack) cfg.stack = [opts.stack];
  return cfg;
}

export function useDatasourceView(options: DatasourceViewOptions) {
  const { viewId, view, dimension, stack, measure, where, interval } = options;
  const [data, setData] = useState<{ dimensions: string[]; source: any[][] }>({ dimensions: [], source: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const paramsKey = useMemo(
    () => JSON.stringify({ viewId, view, dimension, stack, measure, where, interval }),
    [viewId, view, dimension, stack, measure, where, interval],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 解析视图定义：viewId 简写 → 查 ds/view 列表取完整记录
      let def = view;
      let id = viewId || view?.id || "";
      if (!def && id) {
        const { json } = await api({ name: "ds/view" }).fetch(
          `?query=${encodeURIComponent(JSON.stringify({ limit: 200 }))}`,
        );
        const list = Array.isArray(json) ? json : [];
        def = list.find((v: any) => v?.id === id);
      }
      if (!def || !id) {
        setData({ dimensions: [], source: [] });
        setError(null);
        return;
      }
      const requestBody = {
        config: mergeViewConfig(def.config, { dimension, stack, measure, where }),
        datasetId: def.datasetId,
        name: def.name,
        style: def.style,
      };
      const { json } = await api({ name: "ds/view/preview" }).fetch(
        `?id=${encodeURIComponent(id)}&mode=live`,
        { method: "POST", body: JSON.stringify(requestBody) },
      );
      const ret = (json || {}) as ViewPreviewResponse;
      const dimensions = (ret.fields || [])
        .map((f) => f?.name || f?.originalName || "")
        .filter(Boolean);
      const source = Array.isArray(ret.data) ? ret.data : [];
      setData({ dimensions, source });
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
