/**
 * 类型安全导航守卫类型
 *
 * 本模块定义导航守卫的返回类型和接口。
 */
import type { _Awaitable } from '../types/utils'
import type {
  RouteLocationNormalizedLoaded,
  RouteLocationNormalized,
  RouteLocationRaw,
} from './route-location'
import type { NavigationFailure } from '../errors'
import type { ComponentPublicInstance } from 'vue'

/**
 * Return types for a Navigation Guard. Based on `TypesConfig`
 * 导航守卫的返回类型
 */
export type NavigationGuardReturn = void | Error | boolean | RouteLocationRaw

/**
 * Navigation Guard with a type parameter for `this`.
 * 带 this 类型参数的导航守卫
 */
export interface NavigationGuardWithThis<T> {
  (
    this: T,
    to: RouteLocationNormalized,
    from: RouteLocationNormalizedLoaded,
    /**
     * @deprecated Return a value from the guard instead of calling `next(value)`.
     * The callback will be removed in a future version of Vue Router.
     */
    next: NavigationGuardNext
  ): _Awaitable<NavigationGuardReturn>
}

/**
 * In `router.beforeResolve((to) => {})`, the `to` is typed as `RouteLocationNormalizedLoaded`, not
 * `RouteLocationNormalized` like in `router.beforeEach()`. In practice it doesn't change much as users do not rely on
 * the difference between them but if we update the type in vue-router, we will have to update this type too.
 * @internal
 */
export interface _NavigationGuardResolved {
  (
    this: undefined,
    to: RouteLocationNormalizedLoaded,
    from: RouteLocationNormalizedLoaded,
    /**
     * @deprecated Return a value from the guard instead of calling `next(value)`.
     * The callback will be removed in a future version of Vue Router.
     */
    next: NavigationGuardNext
  ): _Awaitable<NavigationGuardReturn>
}

/**
 * Navigation Guard.
 * 导航守卫接口
 */
export interface NavigationGuard {
  (
    to: RouteLocationNormalized,
    from: RouteLocationNormalizedLoaded,
    /**
     * @deprecated Return a value from the guard instead of calling `next(value)`.
     * The callback will be removed in a future version of Vue Router.
     */
    next: NavigationGuardNext
  ): _Awaitable<NavigationGuardReturn>
}

/**
 * Navigation hook triggered after a navigation is settled.
 * 导航完成后触发的钩子
 */
export interface NavigationHookAfter {
  (
    to: RouteLocationNormalizedLoaded,
    from: RouteLocationNormalizedLoaded,
    failure?: NavigationFailure | void
  ): unknown
}

/**
 * Callback passed to navigation guards to continue or abort the navigation.
 * 传递给导航守卫的回调函数，用于继续或中止导航
 *
 * @deprecated Prefer returning a value from the guard instead of calling
 * `next(value)`. The callback will be removed in a future version of Vue Router.
 */
export interface NavigationGuardNext {
  (): void
  (error: Error): void
  (location: RouteLocationRaw): void
  (valid: boolean | undefined): void
  (cb: NavigationGuardNextCallback): void
}

/**
 * Callback that can be passed to `next()` in `beforeRouteEnter()` guards.
 * beforeRouteEnter 守卫中可传递给 next() 的回调
 */
export type NavigationGuardNextCallback = (
  vm: ComponentPublicInstance
) => unknown
