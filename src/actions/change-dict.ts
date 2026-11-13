/**
 * 动作-修改数据字典（平台系统变量）
 *
 * <Button onClick={() => changeDict("通知开关", true)} />
 * <Button onClick={() => changeDict("全局配置", { 阈值: 80 })} />   — 整值替换（对象整体传）
 *
 * 平台侧：GET core/systemVariable（按 name 查）→ PATCH core/systemVariable/{id}。
 * 标量值按变量的 type 自动转换（number/boolean/object/array）。
 */
import { toast } from "sonner";
import { createAPI as api } from "../api";

function convertValueByType(value: any, type?: string): any {
  try {
    if (type === "number") return Number(value);
    if (type === "boolean") return !!(value && value !== "false");
    if (type === "object") return typeof value === "object" ? value : JSON.parse(value);
    if (type === "array") return Array.isArray(value) ? value : JSON.parse(value);
    return value;
  } catch {
    return value; // 转换失败保留原值
  }
}

export interface ChangeDictOptions {
  /** 系统变量名（数据字典项） */
  name: string;
  /** 新值（整值替换） */
  value: any;
  showMessage?: boolean;
}

export async function changeDict({ name, value, showMessage = true }: ChangeDictOptions) {
  try {
    if (!name) throw new Error("缺少系统变量名");
    const q = encodeURIComponent(JSON.stringify({ filter: { name }, limit: 1 }));
    const { json } = await api({ name: "core/systemVariable" }).fetch(`?query=${q}`);
    const target = (Array.isArray(json) ? json : [])[0];
    if (!target?.id) throw new Error(`找不到名为 "${name}" 的系统变量`);

    const resultValue = convertValueByType(value, target.type);
    await api({ name: "core/systemVariable" }).fetch(`/${target.id}`, {
      method: "PATCH",
      noMessage: true,
      data: { value: resultValue },
    });
    if (showMessage) toast.success(`数据字典 ${name} 已更新`);
    return { success: true as const, data: resultValue };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "修改数据字典失败";
    toast.error(`修改数据字典失败：${msg}`);
    return { success: false as const, error: msg };
  }
}

/** 查询系统变量列表（联调/展示用） */
export async function listDict() {
  const q = encodeURIComponent(JSON.stringify({ limit: 100 }));
  const { json } = await api({ name: "core/systemVariable" }).fetch(`?query=${q}`);
  return Array.isArray(json) ? json : [];
}
