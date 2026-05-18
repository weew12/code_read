/**
 * 类型守卫
 * ==========
 *
 * 本模块提供运行时类型检查。
 */

import type { RouteLocationRaw, RouteRecordNameGeneric } from '../typed-routes'

/**
 * 检查是否为有效的路由位置
 */
export function isRouteLocation(route: any): route is RouteLocationRaw {
  return typeof route === 'string' || (route && typeof route === 'object')
}

/**
 * 检查是否为有效的路由名称
 */
export function isRouteName(
  name: unknown
): name is NonNullable<RouteRecordNameGeneric> {
  return typeof name === 'string' || typeof name === 'symbol'
}
