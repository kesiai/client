/**
 * 事件动作（shadcn 形态）：项目源码，可安装可修改。
 * 每个动作是事件回调里直接调用的真代码函数：
 *
 * <Button onClick={() => pageJump({ url: "/test-form" })}>跳转</Button>
 * <Button onClick={() => changeVar("count", 1)}>计数</Button>
 * <Button onClick={() => changeTableData({ table: "资产表", id, data: { 名称: "x" } })}>改表</Button>
 */
export { changeVar, changeVars, usePageVar, usePageVars, getPageVar } from "./page-var";
export { pageJump, type PageJumpOptions } from "./page-jump";
export { sendRequest, type SendRequestOptions } from "./send-request";
export { changeTableData, createTableData, deleteTableData, type ChangeTableDataOptions } from "./change-table-data";
export { changeDict, listDict, type ChangeDictOptions } from "./change-dict";
export { changeDataPoint, type ChangeDataPointOptions } from "./change-data-point";
export { changeSystemSetting, type ChangeSettingOptions } from "./change-setting";
export { changeUser, type ChangeUserOptions } from "./change-user";
export { callFlow, type CallFlowOptions } from "./call-flow";
export { executeCommand, type ExecuteCommandOptions } from "./execute-command";
