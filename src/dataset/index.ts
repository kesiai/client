/**
 * 数据源 hooks（数据源面板按此清单识别可用动作；表达式引用由服务端 import guard 自动补全）。
 * 实例配置（datasources）不在此层——那是应用侧数据，由各项目自行维护。
 */
export { dsDedupe, dsSet, dsSnapshot, dsStableKey, dsSubscribe } from "./core";
export { useDatasourceApi, type DatasourceApiOptions, type NameValueItem } from "./datasource-api";
export { useDatasourceHistory, type DatasourceHistoryOptions, type DataItemConfig, type TimeRangeConfig, type GroupConfig } from "./datasource-history";
export { useDatasourceInterface, type DatasourceInterfaceOptions } from "./datasource-interface";
export { useDatasourceMessage, type DatasourceMessageOptions, type MessageColumn, type MessageFieldFormat } from "./datasource-message";
export { useDatasourceRealtime, type DatasourceRealtimeOptions, type RealtimeTag } from "./datasource-realtime";
export { useDatasourceTable, type DatasourceTableOptions } from "./datasource-table";
export { useDatasourceView, type DatasourceViewOptions } from "./datasource-view";
