/**
 * 动作-修改表数据
 *
 * <Button onClick={() => changeTableData({ table: "资产表", id: recordId, data: { 名称: "新值" } })} />
 *
 * PATCH core/t/{tableId}/d/{recordId}；data 为要修改的字段键值（深合并，未传字段保持原值）。
 * 返回 { success, error? }；失败有 toast。
 */
import { toast } from "sonner";
import { createAPI as api } from "../api";

export interface ChangeTableDataOptions {
  /** 平台表 ID（如 "资产表"） */
  table: string;
  /** 记录 ID */
  id: string;
  /** 要修改的字段（深合并） */
  data: Record<string, any>;
  /** 是否弹成功提示（默认 true） */
  showMessage?: boolean;
}

export async function changeTableData({ table, id, data, showMessage = true }: ChangeTableDataOptions) {
  try {
    if (!table || !id) throw new Error("缺少表 ID 或记录 ID");
    await api({ name: `core/t/${table}/d` }).fetch(`/${id}`, {
      method: "PATCH",
      noMessage: true,
      data,
    });
    if (showMessage) toast.success(`表 ${table} 记录 ${id} 已更新`);
    return { success: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "修改表数据失败";
    toast.error(`修改表数据失败：${msg}`);
    return { success: false as const, error: msg };
  }
}

/** 新增表记录：POST core/t/{tableId}/d */
export async function createTableData({ table, data, showMessage = true }: { table: string; data: Record<string, any>; showMessage?: boolean }) {
  try {
    if (!table) throw new Error("缺少表 ID");
    const { json } = await api({ name: `core/t/${table}/d` }).fetch("", {
      method: "POST",
      noMessage: true,
      data,
    });
    if (showMessage) toast.success(`表 ${table} 已新增记录`);
    return { success: true as const, data: json };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "新增表记录失败";
    toast.error(`新增表记录失败：${msg}`);
    return { success: false as const, error: msg, data: null };
  }
}

/** 删除表记录：DELETE core/t/{tableId}/d/{id} */
export async function deleteTableData({ table, id, showMessage = true }: { table: string; id: string; showMessage?: boolean }) {
  try {
    if (!table || !id) throw new Error("缺少表 ID 或记录 ID");
    await api({ name: `core/t/${table}/d` }).fetch(`/${id}`, {
      method: "DELETE",
      noMessage: true,
    });
    if (showMessage) toast.success(`表 ${table} 记录 ${id} 已删除`);
    return { success: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "删除表记录失败";
    toast.error(`删除表记录失败：${msg}`);
    return { success: false as const, error: msg };
  }
}
