/**
 * 数据源共享缓存原语
 *
 * 数据按 key 单例存放（模块级 store）；同一配置的多处调用共享同一份数据与请求
 * （SWR / useTag 同款语义）。各 datasource-*.ts hook 基于这里的三件套实现：
 *   dsSubscribe / dsSnapshot → useSyncExternalStore 订阅
 *   dsSet                    → 写入并通知订阅者
 *   dsDedupe                 → 同 key 请求去重
 */

export interface DsEntry {
  data: unknown;
  loading: boolean;
  error?: unknown;
  /** 最近一次成功取数时间戳（0 = 尚无数据） */
  fetchedAt: number;
}

const store = new Map<string, DsEntry>();
const inflight = new Map<string, Promise<unknown>>();
const listeners = new Map<string, Set<() => void>>();

export function dsSubscribe(key: string, cb: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(cb);
  return () => {
    set.delete(cb);
  };
}

export function dsSnapshot(key: string): DsEntry | undefined {
  return store.get(key);
}

export function dsSet(key: string, patch: Partial<DsEntry>): void {
  const prev = store.get(key) ?? { data: null, loading: false, fetchedAt: 0 };
  store.set(key, { ...prev, ...patch });
  listeners.get(key)?.forEach((cb) => cb());
}

/** 同 key 请求去重：请求在飞时直接复用其 Promise */
export function dsDedupe<T>(key: string, run: () => Promise<T>): Promise<T> {
  const p = inflight.get(key) as Promise<T> | undefined;
  if (p) return p;
  const created = run().finally(() => inflight.delete(key));
  inflight.set(key, created);
  return created;
}

/** 配置对象 → 稳定缓存 key（键序无关：同配置必同 key） */
export function dsStableKey(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, function (_k, v) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        sorted[k] = (v as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return v;
  });
}
