/**
 * 动作-调用流程（平台手动触发流程）
 *
 * <Button onClick={() => callFlow({ flowId: "flow-1", variable: { 参数1: 1 } })} />
 *
 * 平台侧：POST engine/manualTrigger body={flowId, variable}。
 */
import { toast } from "sonner";
import { createAPI as api } from "../api";

export interface CallFlowOptions {
  /** 流程 ID */
  flowId: string;
  /** 流程输入变量 */
  variable?: Record<string, any>;
  showMessage?: boolean;
}

export async function callFlow({ flowId, variable = {}, showMessage = true }: CallFlowOptions) {
  try {
    if (!flowId) throw new Error("缺少流程 ID");
    const { json } = await api({ name: "engine/manualTrigger" }).fetch("", {
      method: "POST",
      noMessage: true,
      data: { flowId, variable },
    });
    if (showMessage) toast.success(`流程 ${flowId} 已触发`);
    return { success: true as const, data: json };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "调用流程失败";
    toast.error(`调用流程失败：${msg}`);
    return { success: false as const, error: msg };
  }
}
