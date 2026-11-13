/**
 * 动作-发送请求：任意平台接口 / 第三方 HTTP
 *
 * <Button onClick={() => sendRequest({ url: "/rest/ds/p/check", method: "POST", body: {} })} />
 * <Button onClick={async () => {
 *   const ret = await sendRequest({ url: "/rest/core/t/资产表/d?query=" + encodeURIComponent('{"limit":5}') });
 *   console.log(ret.data);
 * }} />
 *
 * 默认带平台认证头（Authorization + x-request-project），第三方接口可用 headers 覆盖。
 * 成功/失败有 toast 提示；需要结果时 await 拿返回值。
 */
import { toast } from "sonner";
import { getHeaders } from "../api";

export interface SendRequestOptions {
  /** 请求地址（同源平台路径或完整 URL） */
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** 请求体（对象自动 JSON 序列化） */
  body?: unknown;
  /** 附加/覆盖请求头 */
  headers?: Record<string, string>;
  /** 是否弹成功提示（默认 false，失败始终提示） */
  showMessage?: boolean;
}

function platformHeaders(): Record<string, string> {
  try { return { ...getHeaders() }; } catch { return {}; }
}

export async function sendRequest({ url, method = "GET", body, headers, showMessage = false }: SendRequestOptions) {
  try {
    const hasBody = body !== undefined;
    const res = await fetch(url, {
      method,
      headers: {
        ...platformHeaders(),
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...(headers ?? {}),
      },
      body: hasBody ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json().catch(() => null);
    if (showMessage) toast.success(`请求成功 ${url}`);
    return { success: true as const, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "请求失败";
    toast.error(`请求失败：${msg}`);
    return { success: false as const, error: msg, data: null };
  }
}
