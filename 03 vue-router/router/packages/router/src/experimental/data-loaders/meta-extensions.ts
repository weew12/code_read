/**
 * 数据加载器元扩展
 *
 * 本模块扩展了 Router 和 RouteMeta 类型，添加数据加载器相关属性。
 */
import type { EffectScope, App } from 'vue'
import type { DataLoaderEntryBase, UseDataLoader } from './createDataLoader'
import type {
  APP_KEY,
  LOADER_ENTRIES_KEY,
  LOADER_SET_KEY,
  PENDING_LOCATION_KEY,
  ABORT_CONTROLLER_KEY,
  IS_SSR_KEY,
  DATA_LOADERS_EFFECT_SCOPE_KEY,
} from './symbols'
import type { RouteLocationNormalizedLoaded } from '../../typed-routes'

/**
 * Map type for the entries used by data loaders.
 * 数据加载器条目映射类型
 * @internal
 */
export type _DefineLoaderEntryMap<
  DataLoaderEntry extends DataLoaderEntryBase<unknown> =
    DataLoaderEntryBase<unknown>,
> = WeakMap<
  // Depending on the `defineLoader()` they might use a different thing as key
  // e.g. an function for basic defineLoader, a doc instance for VueFire
  object,
  DataLoaderEntry
>

// we want to import from this meta extensions to include the changes to route
export * from './symbols'

declare module '../../router' {
  export interface Router {
    /**
     * The entries used by data loaders. Put on the router for convenience.
     * 数据加载器条目映射（WeakMap），存储在 router 上方便访问
     * @internal
     */
    [LOADER_ENTRIES_KEY]: _DefineLoaderEntryMap

    /**
     * Pending navigation that is waiting for data loaders to resolve.
     * 等待数据加载器解析的待处理导航
     * @internal
     */
    [PENDING_LOCATION_KEY]: RouteLocationNormalizedLoaded | null

    /**
     * The app instance that is used by the router.
     * 路由器使用的 App 实例
     * @internal
     */
    [APP_KEY]: App<unknown>

    /**
     * Whether the router is running in server-side rendering mode.
     * 是否运行在服务端渲染模式
     * @internal
     */
    [IS_SSR_KEY]: boolean

    /**
     * The effect scope used to run data loaders.
     * 用于运行数据加载器的 EffectScope
     * @internal
     */
    [DATA_LOADERS_EFFECT_SCOPE_KEY]: EffectScope
  }
}

declare module '../../types' {
  export interface RouteMeta {
    /**
     * The data loaders for a route record. Add any data loader to this array to have it called when the route is
     * navigated to. Note this is only needed when **not** using lazy components (`() => import('./pages/Home.vue')`) or
     * when not explicitly exporting data loaders from page components.
     * 路由记录的数据加载器数组。添加到该数组的加载器会在导航到该路由时被调用。
     * 注意：使用懒加载组件或显式从页面组件导出加载器时不需要此属性。
     */
    loaders?: UseDataLoader[]

    /**
     * Set of loaders for the current route. This is built once during navigation and is used to merge the loaders from
     * the lazy import in components or the `loaders` array in the route record.
     * 当前路由的加载器集合，在导航期间构建，用于合并来自懒加载组件的加载器。
     * @internal
     */
    [LOADER_SET_KEY]?: Set<UseDataLoader>

    /**
     * The signal that is aborted when the navigation is canceled or an error occurs.
     * 导航取消或发生错误时 abort 的信号
     * @internal
     */
    [ABORT_CONTROLLER_KEY]?: AbortController
  }
}
