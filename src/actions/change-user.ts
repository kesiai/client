/**
 * 动作-修改用户信息（当前登录用户）
 *
 * <Button onClick={() => changeUser({ email: "me@example.com" })} />
 *
 * 平台侧：PUT core/auth/user（改当前登录用户；可改 email/phone/language 等）。
 */
import { toast } from "sonner";
import { createAPI as api } from "../api";

export interface ChangeUserOptions {
  /** 要修改的用户字段 */
  updates: Record<string, any>;
  showMessage?: boolean;
}

export async function changeUser({ updates, showMessage = true }: ChangeUserOptions) {
  try {
    if (!updates || Object.keys(updates).length === 0) throw new Error("缺少要修改的用户字段");
    await api({ name: "core/auth/user" }).fetch("", {
      method: "PUT",
      noMessage: true,
      data: updates,
    });
    if (showMessage) toast.success(`用户信息已更新（${Object.keys(updates).join(", ")}）`);
    return { success: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "修改用户信息失败";
    toast.error(`修改用户信息失败：${msg}`);
    return { success: false as const, error: msg };
  }
}
