/**
 * 动作-修改数据点配置（设备点位定义，非实时值）
 *
 * <Button onClick={() => changeDataPoint({
 *   tableId: "mqtt", tableDataId: "aa", tagId: "按位",
 *   key: "errview", value: "显示默认值",
 * })} />   — 资产（记录）数据点
 *
 * changeDataPoint({ tableId: "mqtt", tagId: "按位", key: "unit", value: "℃" })
 * → 模型（表定义）数据点。
 *
 * 平台侧（资产点）：查 core/t/{tid}/d → 改 _settings.device.tags 中对应 tag → POST core/t/record 整包保存。
 * 平台侧（模型点）：查 core/t/schema → 改 device.tags → PATCH core/t/schema/{tid}。
 */
import { toast } from "sonner";
import { createAPI as api } from "../api";

export interface ChangeDataPointOptions {
  /** 设备表 ID */
  tableId: string;
  /** 记录 ID（传则为资产数据点，不传则为模型数据点） */
  tableDataId?: string;
  /** 数据点 ID（tag id） */
  tagId: string;
  /** 要修改的数据点属性名（如 errview / unit / fixed / polish） */
  key: string;
  /** 新值 */
  value: any;
  showMessage?: boolean;
}

function setByPath(obj: any, path: string, value: any) {
  const keys = path.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof cur[keys[i]] !== "object" || cur[keys[i]] === null) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

export async function changeDataPoint({ tableId, tableDataId, tagId, key, value, showMessage = true }: ChangeDataPointOptions) {
  try {
    if (!tableId || !tagId) throw new Error("缺少 tableId 或 tagId");

    if (tableDataId) {
      // ===== 资产数据点：GET 单条 → 改 _settings.device.tags → POST core/t/record =====
      // 注意：_settings 仅 GET 单条（core/t/{tid}/d/{id}）返回，query 列表不含
      const { json: record } = await api({ name: `core/t/${tableId}/d` }).fetch(`/${tableDataId}`);
      const settings = record?._settings;
      if (!settings) throw new Error("找不到资产数据（_settings）");

      let hit = false;
      (settings.device?.tags || []).forEach((tag: any) => {
        if (tag.id === tagId) {
          setByPath(tag, key, value);
          hit = true;
        }
      });
      if (!hit) throw new Error(`记录中找不到数据点 ${tagId}`);

      await api({ name: "core/t" }).fetch("/record", {
        method: "POST",
        noMessage: true,
        data: { ...settings, tableInfo: { id: tableId }, tableData: { id: tableDataId }, id: tableDataId },
      });
    } else {
      // ===== 模型数据点：GET schema → 改 device.tags → PATCH core/t/schema/{tid} =====
      const { json: schema } = await api({ name: "core/t/schema" }).fetch(`/${tableId}`);
      if (!schema) throw new Error("找不到表模型数据");

      let hit = false;
      (schema.device?.tags || []).forEach((tag: any) => {
        if (tag.id === tagId) {
          setByPath(tag, key, value);
          hit = true;
        }
      });
      if (!hit) throw new Error(`模型中找不到数据点 ${tagId}`);

      await api({ name: "core/t" }).fetch(`/schema/${tableId}`, {
        method: "PATCH",
        noMessage: true,
        data: schema,
      });
    }

    if (showMessage) toast.success(`数据点 ${tagId}.${key} 已更新`);
    return { success: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "修改数据点失败";
    toast.error(`修改数据点失败：${msg}`);
    return { success: false as const, error: msg };
  }
}
