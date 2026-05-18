/**
 * 数据加载器导出入口
 *
 * 本模块统一导出数据加载器（Data Loader）相关的类型和函数。
 *
 * 导出门类：
 * - 数据加载器核心类型（UseDataLoader 等）
 * - 新数据获取机制（DataLoaderPlugin、reroute 等）
 * - 上下文管理（getCurrentContext、withLoaderContext 等）
 * - 元扩展符号（meta-extensions）
 */
export type {
  UseDataLoader,
  UseDataLoaderInternals,
  UseDataLoaderResult,
  DataLoaderContextBase,
  DataLoaderEntryBase,
  DefineDataLoaderOptionsBase_LaxData,
  DefineDataLoaderOptionsBase_DefinedData,
  DefineLoaderFn,
  DefineDataLoaderOptionsBase,
} from '../createDataLoader'
export { toLazyValue } from '../createDataLoader'

export {
  DataLoaderPlugin,
  NavigationResult,
  NavigationResult as _NavigationResult,
  reroute,
  useIsDataLoading,
} from '../navigation-guard'
export type {
  DataLoaderPluginOptions,
  SetupLoaderGuardOptions,
  _DataLoaderRedirectResult,
} from '../navigation-guard'

export {
  getCurrentContext,
  setCurrentContext,
  type _PromiseMerged,
  assign,
  isSubsetOf,
  trackRoute,
  withLoaderContext,
  currentContext,
} from '../utils'

export * from '../meta-extensions'

export type { ErrorDefault } from '../types-config'
