/**
 * Vue Router Composition API
 * ==========================
 *
 * 本模块提供组合式 API，让你在 setup 函数中使用路由功能。
 */

import { inject } from 'vue'
import { routerKey, routeLocationKey } from './injectionSymbols'
import type { Router } from './router'
import type { RouteMap } from './typed-routes/route-map'
import type { RouteLocationNormalizedLoaded } from './typed-routes'

/**
 * 获取 Router 实例
 *
 * @remarks
 * 等同于模板中使用的 $router。
 */
export function useRouter(): Router {
  return inject(routerKey)!
}

/**
 * 获取当前路由位置
 *
 * @remarks
 * 等同于模板中使用的 $route。
 */
export function useRoute<Name extends keyof RouteMap = keyof RouteMap>(
  _name?: Name
) {
  return inject(routeLocationKey) as RouteLocationNormalizedLoaded<
    Name | RouteMap[Name]['childrenNames']
  >
}