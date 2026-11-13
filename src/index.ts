import { createAPI, createHttp, getHeaders } from './api'

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
  useLogin, useLogout, useUser, useUserReg, useUserAttr
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
  createAPI,
  createHttp,
  getHeaders
}

export const createAxios = createHttp

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

export * from './dataset'
export * from './actions'
// usePageVar/usePageVars 与 page 系统（src/page/hooks/pagevar）同名冲突：
// 显式再导出，事件动作的页面变量实现（actions/page-var）优先
export { usePageVar, usePageVars, getPageVar } from './actions/page-var'
