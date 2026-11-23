/**
 * 数据源-数据接口：调用平台注册的数据接口（ds/p/{key}，POST）
 *
 * useDatasourceInterface({ op | opKey, params?, predata?, interval? })
 *   → { data, loading, error, onReload }
 *
 * ==================== 输入 ====================
 * {
 *   op?: { key?, id?, name? }   // 接口对象（分组下拉选中带出）；op.key 优先
 *   opKey?: string              // 接口 key 简写（与 op 二选一）
 *   params?: Record<string, unknown>  // 接口入参（POST body，按接口请求变量表单生成）
 *   predata?: boolean           // 返回数组 → 转换为 {dimensions, source} 图表形态
 *   interval?: number           // 轮询毫秒，缺省只拉一次
 * }
 *
 * ==================== 输出 ====================
 * data: unknown                // 默认 = 接口响应 JSON 原样（结构由接口定义决定）
 *   // predata=true 时固定为：
 *   //   { dimensions: string[],   // 所有记录字段并集（按首次出现顺序）
 *   //     source: unknown[][] }   // 每行与 dimensions 对齐；数组值 JSON.stringify；非对象返回包成 [{ result: 值 }]
 *   // op/opKey 都缺省时不发请求，data 保持 null
 * loading: boolean
 * error: unknown
 * onReload: () => void
 *
 * 对齐旧版 data-api「数据接口」数据源。
 */
import { useCallback, useEffect, useState } from "react";
import { createAPI as api } from "../api";

export interface DatasourceInterfaceOptions {
  /** 平台接口对象（旧版形态：分组下拉选中带出 {key, id, name}） */
  op?: { key?: string; id?: string; name?: string };
  /** 接口 key 简写（与 op 二选一，op.key 优先） */
  opKey?: string;
  /** 接口入参（POST body，一般由接口的请求变量表单生成） */
  params?: Record<string, unknown>;
  /** 预处理数据：接口返回数组时转换为 {dimensions, source}（旧版 predata） */
  predata?: boolean;
  /** 轮询间隔（毫秒）；缺省只拉一次 */
  interval?: number;
}

// 旧版 filterResult：数组 → {dimensions, source}（对象包成单行，其他包 {result}）
function predataTransform(json: unknown): unknown {
  let items: unknown[] = [];
  if (json && typeof json === "object" && !Array.isArray(json)) items = [json];
  else if (Array.isArray(json)) items = json;
  else items = [{ result: json }];
  const dimensions: string[] = [];
  const source: unknown[][] = [];
  items.forEach(function(item) {
    if (item && typeof item === "object") {
      Object.keys(item as object).forEach(function(k) {
        if (dimensions.indexOf(k) < 0) dimensions.push(k);
      });
    }
  });
  items.forEach(function(item) {
    const row: unknown[] = [];
    dimensions.forEach(function(k) {
      const v = (item as any)?.[k];
      row.push(Array.isArray(v) ? JSON.stringify(v) : v);
    });
    source.push(row);
  });
  return { dimensions, source };
}

export function useDatasourceInterface(options: DatasourceInterfaceOptions) {
  const { op, opKey, params, predata, interval } = options;
  const key = op?.key || opKey;
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // params 的内容序列化作为依赖（引用变化但内容不变不重拉）
  const paramsKey = JSON.stringify(params ?? {});

  const fetchData = useCallback(
    async (currentParams?: Record<string, unknown>) => {
      const url = key ? `ds/p/${key}` : null;
      if (!url) return;
      setLoading(true);
      try {
        const { json } = await api({ name: url }).fetch("", {
          method: "POST",
          body: JSON.stringify(currentParams ?? {}),
        });
        setData(predata ? predataTransform(json) : json);
        setError(null);
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    },
    [key, predata],
  );

  // 首次与 op/params 内容变化时拉取
  useEffect(() => {
    fetchData(params);
    // paramsKey 保证内容不变不重复拉
  }, [key, paramsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // 轮询（可选，毫秒）
  useEffect(() => {
    if (!interval) return;
    const id = setInterval(() => fetchData(params), interval);
    return () => clearInterval(id);
  }, [fetchData, interval, paramsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const onReload = useCallback(() => fetchData(params), [fetchData, paramsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, onReload };
}
