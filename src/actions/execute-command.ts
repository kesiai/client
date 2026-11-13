/**
 * 动作-执行指令（设备控制下发）
 *
 * <Button onClick={() => executeCommand({ table: "A1", deviceId: "sd", command: "表单数字", params: { sa: 5 } })} />
 *
 * command 传指令名时自动查表 schema（device.commands）补全指令定义。
 * 平台侧：POST driver/driver/command body={指令定义, params, tableData: 设备id, table: 表id, _nonce}。
 */
import { toast } from "sonner";
import { createAPI as api } from "../api";

export interface ExecuteCommandOptions {
  /** 设备表 ID */
  table: string;
  /** 设备记录 ID */
  deviceId: string;
  /** 指令名（自动查 schema）或完整指令定义对象 */
  command: string | Record<string, any>;
  /** 指令参数 */
  params?: Record<string, any>;
  showMessage?: boolean;
}

export async function executeCommand({ table, deviceId, command, params = {}, showMessage = true }: ExecuteCommandOptions) {
  try {
    if (!table || !deviceId) throw new Error("缺少表 ID 或设备 ID");

    let def: Record<string, any>;
    if (typeof command === "string") {
      // GET 单条 schema 返回完整 device.commands（query 列表不含）
      const { json: schema } = await api({ name: "core/t/schema" }).fetch(`/${table}`);
      const found = ((schema?.device as any)?.commands || []).find((c: any) => c.name === command);
      if (!found) throw new Error(`表 ${table} 中找不到指令 "${command}"`);
      def = found;
    } else {
      def = command;
    }
    if (!def?.name) throw new Error("指令缺少 name");

    const body = {
      ...def,
      id: undefined,
      name: def.name,
      params,
      _nonce: Math.random(),
      tableData: deviceId,
      table,
    };
    // 移除显式 undefined 键
    Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);

    const { json } = await api({ name: "driver/driver/command" }).fetch("", {
      method: "POST",
      noMessage: true,
      data: body,
    });
    if (showMessage) toast.success(`指令 ${def.name} 已下发（${table}/${deviceId}）`);
    return { success: true as const, data: json };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "执行指令失败";
    toast.error(`执行指令失败：${msg}`);
    return { success: false as const, error: msg };
  }
}
