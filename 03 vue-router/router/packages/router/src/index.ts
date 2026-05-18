/**
 * Vue Router 主入口
 * ==================
 *
 * 这是 Vue Router 的公共 API 导出文件。
 *
 * 主要导出：
 * - createRouter: 创建路由实例
 * - createWebHistory: HTML5 History 模式
 * - createWebHashHistory: Hash 模式
 * - createMemoryHistory: Memory 模式
 * - RouterLink / RouterView: 组件
 * - useRouter / useRoute: Composition API
 * - 导航守卫相关函数
 * - 类型导出
 */

export { createWebHistory } from './history/html5'
export { createMemoryHistory } from './history/memory'
export { createWebHashHistory } from './history/hash'
export { createRouterMatcher } from './matcher'
export type { RouterMatcher } from './matcher'

export { parseQuery, stringifyQuery } from './query'
export type {
  LocationQuery,
  LocationQueryRaw,
  LocationQueryValue,
  LocationQueryValueRaw,
} from './query'

export type { RouterHistory, HistoryState } from './history/common'

export type { RouteRecord, RouteRecordNormalized } from './matcher/types'

export type {
  PathParserOptions,
  _PathParserOptions,
} from './matcher/pathParserRanker'

export {
  routeLocationKey,
  routerViewLocationKey,
  routerKey,
  matchedRouteKey,
  viewDepthKey,
} from './injectionSymbols'

export { START_LOCATION_NORMALIZED as START_LOCATION } from './location'
export type {
  _RouteLocationBase,
  MatcherLocationAsPath,
  LocationAsRelativeRaw,
  RouteQueryAndHash,
  RouteParamValue,
  RouteParamValueRaw,
  RouteLocationNamedRaw,
  RouteLocationPathRaw,
  RouteLocationMatched,
  RouteLocationOptions,
  _RouteRecordBase,
  RouteRecordRaw,
  RouteRecordSingleView,
  RouteRecordSingleViewWithChildren,
  RouteRecordMultipleViews,
  RouteRecordMultipleViewsWithChildren,
  RouteRecordRedirect,
  RouteMeta,
  RouteComponent,
  RouteParamsGeneric,
  RouteParamsRawGeneric,
  MatcherLocation,
} from './types'
export type { _Awaitable } from './types/utils'

// Experimental Type Safe API
export type {
  RouteMap,
  RouteMapGeneric,
  RouteLocationRaw,
  RouteLocation,
  RouteLocationGeneric,
  RouteLocationTyped,
  RouteLocationTypedList,
  RouteLocationNormalizedGeneric,
  RouteLocationNormalized,
  RouteLocationNormalizedTyped,
  RouteLocationNormalizedTypedList,
  RouteLocationNormalizedLoadedGeneric,
  RouteLocationNormalizedLoaded,
  RouteLocationNormalizedLoadedTyped,
  RouteLocationNormalizedLoadedTypedList,
  RouteLocationResolvedGeneric,
  RouteLocationResolved,
  RouteLocationResolvedTyped,
  RouteLocationResolvedTypedList,
  RouteLocationAsRelativeGeneric,
  RouteLocationAsRelative,
  RouteLocationAsRelativeTyped,
  RouteLocationAsRelativeTypedList,
  RouteLocationAsStringTyped,
  RouteLocationAsString,
  RouteLocationAsStringTypedList,
  RouteLocationAsPathGeneric,
  RouteLocationAsPath,
  RouteLocationAsPathTyped,
  RouteLocationAsPathTypedList,
  RouteRecordInfoGeneric,
  RouteRecordInfo,
  RouteRecordNameGeneric,
  RouteRecordName,
  _RouteRecordProps,
  RouteRecordRedirectOption,
  RouteParams,
  RouteParamsRaw,
  ParamValue,
  ParamValueOneOrMore,
  ParamValueZeroOrMore,
  ParamValueZeroOrOne,
  NavigationGuard,
  NavigationGuardWithThis,
  NavigationHookAfter,
  NavigationGuardReturn,
  NavigationGuardNext,
  NavigationGuardNextCallback,
} from './typed-routes'

export { createRouter } from './router'
export type { Router, RouterOptions } from './router'
export type { RouterScrollBehavior } from './scrollBehavior'

export { NavigationFailureType, isNavigationFailure } from './errors'
export type {
  NavigationFailure,
  ErrorTypes,
  NavigationRedirectError,
} from './errors'

export {
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  loadRouteLocation,
} from './navigationGuards'
export { RouterLink, useLink } from './RouterLink'
export type {
  _RouterLinkI,
  RouterLinkProps,
  UseLinkOptions,
  UseLinkReturn,
} from './RouterLink'
export { RouterView } from './RouterView'
export type { RouterViewProps } from './RouterView'
export type { TypesConfig } from './config'

export * from './useApi'

/**
 * Vue 类型扩展
 *
 * @remarks
 * 为 Vue 添加以下全局扩展：
 * - ComponentCustomOptions: 组件守卫选项
 * - ComponentCustomProperties: $route 和 $router
 * - GlobalComponents: RouterLink 和 RouterView
 */
import type { TypesConfig } from './config'
import type { Router } from './router'
import type { RouterLink } from './RouterLink'
import type { RouterView } from './RouterView'
import type {
  NavigationGuard,
  NavigationGuardWithThis,
  RouteLocationNormalizedLoaded,
} from './typed-routes'

declare module 'vue' {
  export interface ComponentCustomOptions {
    /**
     * 路由进入守卫
     *
     * @param to - 目标路由
     * @param from - 来源路由
     * @param next - 确认回调
     */
    beforeRouteEnter?: TypesConfig extends Record<'beforeRouteEnter', infer T>
      ? T
      : NavigationGuardWithThis<undefined>

    /**
     * 路由更新守卫
     *
     * @param to - 目标路由
     * @param from - 来源路由
     * @param next - 确认回调
     */
    beforeRouteUpdate?: TypesConfig extends Record<'beforeRouteUpdate', infer T>
      ? T
      : NavigationGuard

    /**
     * 路由离开守卫
     *
     * @param to - 目标路由
     * @param from - 来源路由
     * @param next - 确认回调
     */
    beforeRouteLeave?: TypesConfig extends Record<'beforeRouteLeave', infer T>
      ? T
      : NavigationGuard
  }

  export interface ComponentCustomProperties {
    /**
     * 当前路由位置
     */
    $route: TypesConfig extends Record<'$route', infer T>
      ? T
      : RouteLocationNormalizedLoaded

    /**
     * Router 实例
     */
    $router: TypesConfig extends Record<'$router', infer T> ? T : Router
  }

  export interface GlobalComponents {
    RouterView: TypesConfig extends Record<'RouterView', infer T>
      ? T
      : typeof RouterView
    RouterLink: TypesConfig extends Record<'RouterLink', infer T>
      ? T
      : typeof RouterLink
  }
}