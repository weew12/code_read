/**
 * Vue Router 注入符号
 * ====================
 *
 * 本模块定义 Vue 依赖注入的 Symbol 键。
 * 使用 Symbol 确保不会有命名冲突。
 *
 * 注入层次：
 * - routerKey: Router 实例
 * - routeLocationKey: 当前路由位置
 * - routerViewLocationKey: RouterView 使用的路由位置
 * - matchedRouteKey: 当前 RouterView 匹配的路由记录
 * - viewDepthKey: 嵌套深度
 */

import type { InjectionKey, ComputedRef, Ref } from 'vue'
import type { RouteLocationNormalizedLoaded } from './typed-routes'
import type { RouteRecordNormalized } from './matcher/types'
import type { Router } from './router'

/**
 * 当前 RouterView 匹配的路由记录
 *
 * @remarks
 * 用于 onBeforeRouteUpdate 和 onBeforeRouteLeave。
 * rvlm = Router View Location Matched
 */
export const matchedRouteKey = Symbol(
  __DEV__ ? 'router view location matched' : ''
) as InjectionKey<ComputedRef<RouteRecordNormalized | undefined>>

/**
 * RouterView 嵌套深度
 *
 * @remarks
 * 用于控制渲染 matched 数组中的哪个组件。
 * rvd = Router View Depth
 */
export const viewDepthKey = Symbol(
  __DEV__ ? 'router view depth' : ''
) as InjectionKey<Ref<number> | number>

/**
 * Router 实例
 *
 * @remarks
 * 用于 useRouter() 和测试环境覆盖。
 * r = router
 */
export const routerKey = Symbol(__DEV__ ? 'router' : '') as InjectionKey<Router>

/**
 * 当前路由位置
 *
 * @remarks
 * 用于 useRoute() 和测试环境覆盖。
 * rl = route location
 */
export const routeLocationKey = Symbol(
  __DEV__ ? 'route location' : ''
) as InjectionKey<RouteLocationNormalizedLoaded>

/**
 * RouterView 使用的路由位置
 *
 * @remarks
 * 内部使用，当传入 route prop 时覆盖。
 */
export const routerViewLocationKey = Symbol(
  __DEV__ ? 'router view location' : ''
) as InjectionKey<Ref<RouteLocationNormalizedLoaded>>