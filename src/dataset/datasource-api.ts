/**
 * 数据源-平台接口：HTTP 拉数（可选轮询），对齐旧版 airiot_api
 *
 * useDatasourceApi({ url, method?, headers?, body?, table?, appkey?, appsecret?, predata?, interval? })
 *   → { data, loading, error, onReload }
 *
 * ==================== 输入 ====================
 * {
 *   url: string                        // 支持模板变量 {table}/{appkey}/{appsecret}，实例传对应字段时替换
 *   method?: string                    // 默认 "GET"（实例传 string，内部归一化大写）
 *   headers?: [{ name, value }] | Record<string, string>  // 叠加在平台认证头之上（可覆盖）
 *   body?:    [{ name, value }] | Record<string, unknown> // GET 拼查询串；其他方法作 JSON 请求体
 *   table?: string                     // {table} 变量值（预设「表记录查询」）
 *   appkey?/appsecret?: string         // {appkey}/{appsecret} 变量值（预设「获取 token」）
 *   predata?: boolean                  // 返回数组 → 转换为 {dimensions, source} 图表形态
 *   interval?: number                  // 轮询毫秒，缺省只拉一次
 * }
 *
 * ==================== 输出 ====================
 * data: unknown                      // 默认 = HTTP 响应 JSON 原样（结构由接口决定）
 *   // predata=true 时固定为：
 *   //   { dimensions: string[],      // 所有记录字段的并集（按首次出现顺序）
 *   //     source: unknown[][] }      // 每行与 dimensions 对齐；数组值 JSON.stringify；非对象返回包成 [{ result: 值 }]
 * loading: boolean
 * error: unknown                     // 非 2xx 抛 Error(`HTTP ${status}`)，其余异常原样
 * onReload: () => void
 *
 * 同配置多处调用共享同一份数据与请求（key 去重，见 ./core）。
 * 平台认证头（Authorization + x-request-project）默认注入。
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { getHeaders } from "../api";
import { dsDedupe, dsSet, dsSnapshot, dsStableKey, dsSubscribe, type DsEntry } from "./core";

export interface NameValueItem {
  name?: string;
  value?: string;
}

export interface DatasourceApiOptions {
  url: string;
  /** 实例经 datasources map 传入时是 string，内部归一化大写 */
  method?: string;
  /** 请求头：旧版数组 [{name, value}] 或对象 */
  headers?: NameValueItem[] | Record<string, string>;
  /** 请求参数：GET 拼查询串 / 其他方法作 JSON 请求体；数组 [{name, value}] 或对象 */
  body?: NameValueItem[] | Record<string, unknown>;
  /** URL 模板变量：{table}（预设「表记录查询」） */
  table?: string;
  /** URL 模板变量：{appkey}/{appsecret}（预设「获取 token」） */
  appkey?: string;
  appsecret?: string;
  /** 预处理数据：接口返回数组时转换为 {dimensions, source}（旧版 predata） */
  predata?: boolean;
  /** 轮询间隔（毫秒）；缺省只拉一次 */
  interval?: number;
}

function keyOf(o: DatasourceApiOptions): string {
  return "api:" + dsStableKey({
    url: o.url,
    method: (o.method ?? "GET").toUpperCase(),
    headers: o.headers ?? null,
    body: o.body ?? null,
    table: o.table ?? "",
    appkey: o.appkey ?? "",
    appsecret: o.appsecret ?? "",
    predata: !!o.predata,
  });
}

// 数组/对象 → 键值对象（旧版 arrayToKv）
function toKv(input: NameValueItem[] | Record<string, unknown> | undefined): Record<string, string> {
  if (!input) return {};
  if (!Array.isArray(input)) {
    const out: Record<string, string> = {};
    Object.entries(input).forEach(([k, v]) => { out[k] = String(v ?? ""); });
    return out;
  }
  const out: Record<string, string> = {};
  input.forEach(function(item) {
    if (item && item.name && String(item.name).trim()) out[String(item.name).trim()] = String(item.value ?? "");
  });
  return out;
}

// 平台认证头：默认注入（Authorization + x-request-project），第三方接口经 headers 覆盖
function platformHeaders(): Record<string, string> {
  // 复用 client 统一认证头（Authorization + x-request-project，来自认证存储）
  try { return { ...getHeaders() }; } catch { return {}; }
}

// GET 时把参数拼进 URL（已有 query 用 & 连接）
function urlWithParams(url: string, kv: Record<string, string>): string {
  const pairs = Object.entries(kv).filter(([k]) => k);
  if (pairs.length === 0) return url;
  const sep = url.indexOf("?") >= 0 ? "&" : "?";
  return url + sep + pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
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

async function doFetch(key: string, o: DatasourceApiOptions): Promise<unknown> {
  return dsDedupe(key, async () => {
    dsSet(key, { loading: true });
    try {
      const method = (o.method ?? "GET").toUpperCase();
      // URL 模板变量替换（旧版预设：{table}/{appkey}/{appsecret}）
      let url = o.url
        .replace("{table}", o.table ?? "")
        .replace("{appkey}", o.appkey ?? "")
        .replace("{appsecret}", o.appsecret ?? "");
      const headerKv = { ...platformHeaders(), ...toKv(o.headers) };
      const bodyKv = toKv(o.body);
      const hasBody = method !== "GET" && Object.keys(bodyKv).length > 0;
      if (method === "GET") url = urlWithParams(url, bodyKv);
      const res = await fetch(url, {
        method,
        // 无 body 的 GET 不带 Content-Type（避免触发 CORS preflight）
        headers: {
          ...headerKv,
          ...(hasBody ? { "Content-Type": "application/json" } : {}),
        },
        body: hasBody ? JSON.stringify(bodyKv) : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      dsSet(key, { data: o.predata ? predataTransform(data) : data, loading: false, error: undefined, fetchedAt: Date.now() });
      return data;
    } catch (e) {
      dsSet(key, { loading: false, error: e });
      throw e;
    }
  });
}

export function useDatasourceApi(options: DatasourceApiOptions) {
  const key = useMemo(
    () => keyOf(options),
    // url/method 是 key 的稳定成分；headers/body 经 keyOf 序列化，内容不变则 key 不变
    [options.url, options.method, options.interval],
  );

  const entry = useSyncExternalStore(
    (cb) => dsSubscribe(key, cb),
    () => dsSnapshot(key),
  );

  // 自动首拉：key 变化且尚无任何缓存条目时拉取（去重保证并发安全）
  useEffect(() => {
    if (!dsSnapshot(key)) {
      doFetch(key, options).catch(() => {}); // 失败经 store.error 反映
    }
  }, [key]);

  // 轮询（可选）
  useEffect(() => {
    if (!options.interval) return;
    const id = setInterval(() => {
      doFetch(key, options).catch(() => {});
    }, options.interval);
    return () => clearInterval(id);
  }, [key, options.interval]);

  const onReload = useCallback(() => {
    doFetch(key, options).catch(() => {});
  }, [key]);

  const snapshot: DsEntry = entry ?? { data: null, loading: false, fetchedAt: 0 };
  return {
    data: snapshot.data as any,
    loading: snapshot.loading,
    error: snapshot.error,
    onReload,
  };
}
