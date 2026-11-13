/**
 * 动作-页面变量：组件间共享的前端状态（kesi「画面变量」的应用侧形态）
 *
 * changeVar("a.b", 1)                    — 写（事件回调里直接调）
 * const v = usePageVar("a.b", 默认值)     — 读（组件里订阅，写后自动重渲染）
 * const s = usePageVars()                — 读全部
 *
 * 同一页面多组件共享同一份 store；无持久化，刷新即重置。
 */
import { useSyncExternalStore, useCallback } from "react";

// ==================== 模块级单例 store ====================

let state: Record<string, any> = {};
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((cb) => cb());
}

/** 按 "a.b.c" 点路径读写（lodash set/get 语义，自主实现避免依赖） */
function setPath(obj: any, path: string, value: any) {
  const keys = path.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof cur[keys[i]] !== "object" || cur[keys[i]] === null) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

function getPath(obj: any, path: string): any {
  return path.split(".").reduce((cur, k) => (cur == null ? undefined : cur[k]), obj);
}

// ==================== 写 ====================

/**
 * 修改页面变量（事件回调里直接调用）
 *
 * <Button onClick={() => changeVar("count", (useCountRef as any).v + 1)} />
 * <Button onClick={() => changeVar("form.name", "新名字")} />
 */
export function changeVar(path: string, value: any) {
  // 惰性 clone 顶层，保证 useSyncExternalStore 的引用比较能感知变化
  state = { ...state };
  setPath(state, path, value);
  emit();
  return value;
}

/** 批量写：changeVars({ a: 1, "b.c": 2 }) */
export function changeVars(patch: Record<string, any>) {
  state = { ...state };
  Object.entries(patch).forEach(([p, v]) => setPath(state, p, v));
  emit();
}

// ==================== 读 ====================

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * 订阅读取一个页面变量
 *
 * const count = usePageVar("count", 0)
 */
export function usePageVar<T = any>(path: string, initialValue?: T): T {
  const getSnapshot = useCallback(() => {
    const v = getPath(state, path);
    return v === undefined ? initialValue : v;
  }, [path, initialValue]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** 订阅读取全部页面变量 */
export function usePageVars(): Record<string, any> {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** 非 React 场景读取（动作间联动） */
export function getPageVar(path: string): any {
  return getPath(state, path);
}
