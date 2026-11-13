/**
 * 动作-修改系统配置
 *
 * <Button onClick={() => changeSystemSetting({ language: "zh-CN" })} />
 *
 * 平台侧：PATCH core/setting（按键合并，只传要改的键）。
 * ⚠️ 未知字段被平台静默忽略；字段名必须是平台真实配置键。
 */
import { toast } from "sonner";
import { createAPI as api } from "../api";

export interface ChangeSettingOptions {
  /** 要修改的配置键值（按键合并） */
  updates: Record<string, any>;
  showMessage?: boolean;
}

export async function changeSystemSetting({ updates, showMessage = true }: ChangeSettingOptions) {
  try {
    if (!updates || Object.keys(updates).length === 0) throw new Error("缺少要修改的配置项");
    await api({ name: "core/setting" }).fetch("", {
      method: "PATCH",
      noMessage: true,
      data: updates,
    });
    if (showMessage) toast.success(`系统配置已更新（${Object.keys(updates).join(", ")}）`);
    return { success: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "修改系统配置失败";
    toast.error(`修改系统配置失败：${msg}`);
    return { success: false as const, error: msg };
  }
}
