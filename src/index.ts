import createAPI from './api'

export {
  Model, TableModel,
  ModelContext,
  modelRegistry,
  useModel,
  useModelValue,
  useModelState,
  useSetModelState,
  useModelCallback,
  useModelGet,
  useModelSave,
  useModelDelete,
  useModelGetItems,
  useModelItem,
  useModelQuery,
  useModelPermission,
  useModelEvent,
  useModelEffect,
  useModelPagination,
  useModelCount,
  useModelPageSize,
  useModelFields,
  useModelList,
  useModelSelect,
  useModelListRow,
  useModelListHeader,
  useModelListOrder,
  useModelListItem
} from './model'

export {
  useLogin, useLogout, useUser, useUserReg
} from './auth'

export {  getSettings, useMessage
} from './hooks'

export { getConfig, setConfig
} from './config'

export type {
  Config,
  ToastComponent,
  UserInfo,
  AppSettings,
  UserExpandSettings
} from './config'

export const api = createAPI

export {
  createAPI
}

export * from './events'

export * from './form'

export * from './page'

export * from './subscribe'

export * from './subscribe/ws'

export type {
  ModelSchema, ModelAtoms
} from './model'

export type {
  UseFormPropsExtended
} from './form'

// 新 HTTP 模块（给生成的前端项目使用）
export { createHttpClient, createResourceClient } from './http'

export type {
  HttpClient,
  HttpClientConfig,
  RequestOptions,
  ApiResponse,
  HttpError,
  SortDirection,
  QueryFilter,
  PagedResponse,
  ResourceConfig,
  ResourceClient,
} from './http'