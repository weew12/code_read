/**
 * 路由参数类型工具
 * =================
 *
 * 本模块提供类型安全的路由参数类型。
 *
 * 类型参数 isRaw 控制是否包含原始类型：
 * - false: string 类型（URL 中的编码值）
 * - true: string | number（允许原始值）
 *
 * 例如路由 `/users/:id`：
 * - RouteParams<'users'> = { id: string }
 * - RouteParamsRaw<'users'> = { id: string | number }
 */

import type { RouteMap } from './route-map'

/**
 * 可变参数（:id+）：至少一个参数
 */
export type ParamValueOneOrMore<isRaw extends boolean> = [
  ParamValue<isRaw>,
  ...ParamValue<isRaw>[]
]

/**
 * 可选可变参数（:id*）：零个或多个参数
 */
export type ParamValueZeroOrMore<isRaw extends boolean> = true extends isRaw
  ? ParamValue<isRaw>[] | undefined | null
  : ParamValue<isRaw>[] | undefined

/**
 * 可选参数（:id?）：零个或一个参数
 */
export type ParamValueZeroOrOne<isRaw extends boolean> = true extends isRaw
  ? string | number | null | undefined
  : string

/**
 * 标准参数（:id）
 */
export type ParamValue<isRaw extends boolean> = true extends isRaw
  ? string | number
  : string

/**
 * 根据路由名称获取类型安全的参数
 */
export type RouteParams<Name extends keyof RouteMap = keyof RouteMap> =
  RouteMap[Name]['params']

/**
 * 根据路由名称获取类型安全的原始参数
 */
export type RouteParamsRaw<Name extends keyof RouteMap = keyof RouteMap> =
  RouteMap[Name]['paramsRaw']
