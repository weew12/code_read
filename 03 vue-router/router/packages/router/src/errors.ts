/**
 * Vue Router 错误类型定义
 * ========================
 *
 * 本模块定义 Vue Router 中所有与导航相关的错误类型。
 *
 * 错误类型层次：
 * - ErrorTypes (枚举值，用于位运算)
 * - NavigationFailureType (用户面向的类型)
 * - NavigationFailure (失败的导航错误)
 * - NavigationRedirectError (重定向错误)
 * - MatcherError (路由未找到错误)
 *
 * 位运算标志：
 * 错误类型使用位标志，可以组合检查：
 * - NAVIGATION_ABORTED (4) | NAVIGATION_CANCELLED (8) 可以检查"中止或取消"
 */

import type { MatcherLocationRaw, MatcherLocation } from './types'
import type {
  RouteLocationRaw,
  RouteLocationNormalized,
  RouteLocationNormalizedLoaded,
} from './typed-routes'
import { assign } from './utils'

/**
 * 错误类型标志（内部版本）
 *
 * @remarks
 * 使用位标志以便组合检查。
 * 注意：必须使用字面量值，不能使用表达式如 1 << 2。
 */
export const enum ErrorTypes {
  /** 路由匹配器中未找到对应路由 */
  MATCHER_NOT_FOUND = 1,
  /** 导航守卫执行了重定向 */
  NAVIGATION_GUARD_REDIRECT = 2,
  /** 导航被守卫中止（返回 false 或 next(false)） */
  NAVIGATION_ABORTED = 4,
  /** 导航被取消（更新的导航已开始执行） */
  NAVIGATION_CANCELLED = 8,
  /** 导航重复（已处于同一位置） */
  NAVIGATION_DUPLICATED = 16,
}

const NavigationFailureSymbol = Symbol(__DEV__ ? 'navigation failure' : '')

/**
 * 路由匹配错误
 *
 * @remarks
 * 当尝试导航到不存在的路由时抛出。
 */
export interface MatcherError extends Error {
  type: ErrorTypes.MATCHER_NOT_FOUND
  location: MatcherLocationRaw
  currentLocation?: MatcherLocation
}

/**
 * 导航失败类型枚举
 *
 * @remarks
 * 可以传递给 isNavigationFailure 检查特定类型的失败。
 */
export enum NavigationFailureType {
  /**
   * 中止的导航
   *
   * @remarks
   * 由于导航守卫返回 false 或调用 next(false) 而失败。
   */
  aborted = ErrorTypes.NAVIGATION_ABORTED,

  /**
   * 取消的导航
   *
   * @remarks
   * 由于更新的导航开始执行（不一定是完成）而失败。
   */
  cancelled = ErrorTypes.NAVIGATION_CANCELLED,

  /**
   * 重复的导航
   *
   * @remarks
   * 由于已处于同一位置而尝试重复导航。
   */
  duplicated = ErrorTypes.NAVIGATION_DUPLICATED,
}

/**
 * 导航失败错误
 *
 * @remarks
 * 包含有关失败导航的详细信息。
 */
export interface NavigationFailure extends Error {
  /**
   * 导航失败类型
   */
  type:
    | ErrorTypes.NAVIGATION_CANCELLED
    | ErrorTypes.NAVIGATION_ABORTED
    | ErrorTypes.NAVIGATION_DUPLICATED

  /**
   * 来源路由位置
   */
  from: RouteLocationNormalized

  /**
   * 目标路由位置
   */
  to: RouteLocationNormalized
}

/**
 * 导航重定向错误（内部使用）
 *
 * @remarks
 * 用于在导航守卫中检测重定向。
 * 与普通 NavigationFailure 不同，to 字段是 RouteLocationRaw 而非 Normalized。
 *
 * @internal
 */
export interface NavigationRedirectError extends Omit<
  NavigationFailure,
  'to' | 'type'
> {
  type: ErrorTypes.NAVIGATION_GUARD_REDIRECT
  to: RouteLocationRaw
}

/**
 * 错误消息映射（开发环境）
 *
 * @internal
 */
const ErrorTypeMessages = {
  [ErrorTypes.MATCHER_NOT_FOUND]({ location, currentLocation }: MatcherError) {
    return `No match for\n ${JSON.stringify(location)}${
      currentLocation
        ? '\nwhile being at\n' + JSON.stringify(currentLocation)
        : ''
    }`
  },
  [ErrorTypes.NAVIGATION_GUARD_REDIRECT]({
    from,
    to,
  }: NavigationRedirectError) {
    return `Redirected from "${from.fullPath}" to "${stringifyRoute(to}" via a navigation guard.`
  },
  [ErrorTypes.NAVIGATION_ABORTED]({ from, to }: NavigationFailure) {
    return `Navigation aborted from "${from.fullPath}" to "${to.fullPath}" via a navigation guard.`
  },
  [ErrorTypes.NAVIGATION_CANCELLED]({ from, to }: NavigationFailure) {
    return `Navigation cancelled from "${from.fullPath}" to "${to.fullPath}" with a new navigation.`
  },
  [ErrorTypes.NAVIGATION_DUPLICATED]({ from, to: _to }: NavigationFailure) {
    return `Avoided redundant navigation to current location: "${from.fullPath}".`
  },
}

/**
 * 所有可能的内部错误类型
 */
type RouterError = NavigationFailure | NavigationRedirectError | MatcherError

/**
 * 创建类型化的路由错误
 *
 * @param type - 错误类型
 * @param params - 错误参数字段
 * @returns 错误对象
 *
 * @example
 * ```typescript
 * throw createRouterError<MatcherError>(ErrorTypes.MATCHER_NOT_FOUND, {
 *   location: { name: 'unknown' }
 * })
 * ```
 */
export function createRouterError<E extends RouterError>(
  type: E['type'],
  params: Omit<E, 'type' | keyof Error>
): E {
  // 开发环境或 CJS 版本保留完整错误消息
  if (__DEV__ || !__BROWSER__) {
    return assign(
      new Error(ErrorTypeMessages[type](params as any)),
      {
        type,
        [NavigationFailureSymbol]: true,
      } as { type: typeof type },
      params
    ) as E
  } else {
    return assign(
      new Error(),
      {
        type,
        [NavigationFailureSymbol]: true,
      } as { type: typeof type },
      params
    ) as E
  }
}

/**
 * 检查是否为导航失败
 *
 * @remarks
 * 可以检查特定类型的失败或任意类型的失败。
 *
 * @param error - 要检查的对象
 * @param type - 可选的错误类型标志
 * @returns 是否是导航失败
 *
 * @example
 * ```typescript
 * router.afterEach((to, from, failure) => {
 *   // 检查任意导航失败
 *   if (isNavigationFailure(failure)) {
 *     // ...
 *   }
 *
 *   // 检查重复导航
 *   if (isNavigationFailure(failure, NavigationFailureType.duplicated)) {
 *     // ...
 *   }
 * })
 * ```
 */
export function isNavigationFailure(
  error: any,
  type?: ErrorTypes.NAVIGATION_GUARD_REDIRECT
): error is NavigationRedirectError
export function isNavigationFailure(
  error: any,
  type?: ErrorTypes | NavigationFailureType
): error is NavigationFailure
export function isNavigationFailure(
  error: any,
  type?: number
): error is NavigationFailure {
  return (
    error instanceof Error &&
    NavigationFailureSymbol in error &&
    (type == null || !!((error as unknown as NavigationFailure).type & type))
  )
}

/**
 * 日志记录的属性键
 */
const propertiesToLog = ['params', 'query', 'hash'] as const

/**
 * 将路由对象转换为字符串
 *
 * @internal
 */
function stringifyRoute(to: RouteLocationRaw): string {
  if (typeof to === 'string') return to
  if (to.path != null) return to.path
  const location = {} as Record<string, unknown>
  for (const key of propertiesToLog) {
    if (key in to) location[key] = to[key]
  }
  return JSON.stringify(location, null, 2)
}

/**
 * 错误监听器类型
 *
 * @remarks
 * 用于 router.onError() 回调。
 *
 * @param error - 抛出的错误
 * @param to - 目标位置
 * @param from - 来源位置
 *
 * @internal
 */
export interface _ErrorListener {
  (
    error: any,
    to: RouteLocationNormalized,
    from: RouteLocationNormalizedLoaded
  ): any
}