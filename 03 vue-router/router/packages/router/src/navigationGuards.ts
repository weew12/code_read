/**
 * Vue Router 导航守卫模块
 * =========================
 *
 * 本模块负责处理 Vue Router 的导航守卫系统。
 * 导航守卫是 Vue Router 最强大的功能之一，允许用户在路由导航的不同阶段进行拦截和控制。
 *
 * 核心概念：
 *
 * 1. 守卫类型：
 *    - beforeRouteLeave: 离开路由时触发
 *    - beforeRouteUpdate: 路由参数变化时触发（组件被复用）
 *    - beforeRouteEnter: 进入路由时触发
 *
 * 2. 守卫执行顺序：
 *    - 组件离开守卫（从子到父）
 *    - 全局前置守卫
 *    - 组件更新守卫
 *    - 路由独享守卫
 *    - 组件进入守卫
 *    - 全局解析守卫
 *    - 全局后置守卫
 *
 * 3. 守卫返回值：
 *    - undefined/void: 继续导航
 *    - false: 中断导航
 *    - Error: 拒绝导航
 *    - RouteLocationRaw: 重定向到其他位置
 *
 * 4. next() 回调（已废弃）：
 *    - next(): 继续导航
 *    - next(false): 中断导航
 *    - next(Error): 拒绝导航
 *    - next(RouteLocationRaw): 重定向
 *    - next(Function): 添加 enter 回调
 */

import type { Lazy, RouteComponent } from './types'
import { isRouteLocation } from './types'

import type {
  RouteLocationNormalized,
  RouteLocationNormalizedLoaded,
  NavigationGuard,
  RouteLocation,
  RouteLocationRaw,
  NavigationGuardNext,
  NavigationGuardNextCallback,
} from './typed-routes'

import type { NavigationFailure, NavigationRedirectError } from './errors'
import { createRouterError, ErrorTypes } from './errors'
import type { ComponentOptions, ComputedRef } from 'vue'
import { onUnmounted, onActivated, onDeactivated } from 'vue'
import { inject, getCurrentInstance } from 'vue'
import { matchedRouteKey } from './injectionSymbols'
import type { RouteRecordNormalized } from './matcher/types'
import { isESModule, isRouteComponent } from './utils'
import { warn } from './warning'
import { isSameRouteRecord } from './location'

/**
 * 注册守卫到路由记录
 *
 * @remarks
 * 这是一个内部函数，用于将导航守卫注册到路由记录的 Set 中。
 * 守卫会自动在组件卸载或失活时移除。
 *
 * @param activeRecordRef - 当前活跃路由记录的响应式引用
 * @param name - 守卫类型 ('leaveGuards' | 'updateGuards')
 * @param guard - 导航守卫函数
 */
function registerGuard(
  activeRecordRef: ComputedRef<RouteRecordNormalized | undefined>,
  name: 'leaveGuards' | 'updateGuards',
  guard: NavigationGuard
) {
  // 获取当前活跃的路由记录
  const record = activeRecordRef.value
  if (!record) {
    if (__DEV__) {
      const fnName =
        name === 'updateGuards' ? 'onBeforeRouteUpdate' : 'onBeforeRouteLeave'
      warn(
        `No active route record was found when calling \`${fnName}()\`. ` +
          `Make sure you call this function inside a component child of <router-view>. ` +
          `Maybe you called it inside of App.vue?`
      )
    }
    return
  }

  // 追踪当前注册守卫的记录（可能因 keep-alive 而改变）
  let currentRecord = record

  // 移除守卫的函数
  const removeFromList = () => {
    currentRecord[name].delete(guard)
  }

  // 组件卸载时移除守卫
  onUnmounted(removeFromList)
  // 组件失活时移除守卫（keep-alive）
  onDeactivated(removeFromList)

  // 组件再次激活时检查
  onActivated(() => {
    // 当重新激活时，检查活跃记录是否改变（例如 keep-alive 组件为不同路由重新激活）
    // 如果改变，注册到新记录上
    const newRecord = activeRecordRef.value
    if (__DEV__ && !newRecord) {
      warn(
        'No active route record was found when reactivating component with navigation guard. ' +
          'This is likely a bug in vue-router. Please report it.'
      )
    }
    if (newRecord) {
      currentRecord = newRecord
    }
    currentRecord[name].add(guard)
  })

  // 注册守卫到当前记录
  currentRecord[name].add(guard)
}

/**
 * 添加离开路由守卫
 *
 * @remarks
 * 在组件中调用，用于添加一个在离开当前路由时触发的守卫。
 * 类似于 beforeRouteLeave 生命周期钩子，但可以在任何组件中使用。
 * 守卫会在组件卸载时自动移除。
 *
 * @param leaveGuard - 导航守卫函数
 *
 * @example
 * ```typescript
 * export default {
 *   setup() {
 *     onBeforeRouteLeave((to, from) => {
 *       const answer = window.confirm('真的要离开吗？')
 *       if (!answer) return false
 *     })
 *   }
 * }
 * ```
 */
export function onBeforeRouteLeave(leaveGuard: NavigationGuard) {
  // 确保在 setup 函数中调用
  if (__DEV__ && !getCurrentInstance()) {
    warn(
      'getCurrentInstance() returned null. onBeforeRouteLeave() must be called at the top of a setup function'
    )
    return
  }

  // 注入当前活跃的路由记录
  const activeRecordRef = inject(
    matchedRouteKey,
    // 避免警告
    {} as any
  ) as ComputedRef<RouteRecordNormalized | undefined>

  registerGuard(activeRecordRef, 'leaveGuards', leaveGuard)
}

/**
 * 添加更新路由守卫
 *
 * @remarks
 * 在组件中调用，用于添加一个在路由参数变化时触发的守卫。
 * 类似于 beforeRouteUpdate 生命周期钩子，但可以在任何组件中使用。
 * 守卫会在组件卸载时自动移除。
 *
 * @param updateGuard - 导航守卫函数
 *
 * @example
 * ```typescript
 * export default {
 *   setup() {
 *     onBeforeRouteUpdate((to, from) => {
 *       // 路由参数变化，可以更新组件数据
 *       this.fetchData(to.params.id)
 *     })
 *   }
 * }
 * ```
 */
export function onBeforeRouteUpdate(updateGuard: NavigationGuard) {
  // 确保在 setup 函数中调用
  if (__DEV__ && !getCurrentInstance()) {
    warn(
      'getCurrentInstance() returned null. onBeforeRouteUpdate() must be called at the top of a setup function'
    )
    return
  }

  // 注入当前活跃的路由记录
  const activeRecordRef = inject(
    matchedRouteKey,
    // 避免警告
    {} as any
  ) as ComputedRef<RouteRecordNormalized | undefined>

  registerGuard(activeRecordRef, 'updateGuards', updateGuard)
}

/**
 * 将导航守卫转换为 Promise 函数
 *
 * @remarks
 * 这是守卫系统的核心转换函数。
 * 它将一个导航守卫函数转换为一个返回 Promise 的函数。
 * Promise 会在守卫通过时 resolve，在守卫拒绝或重定向时 reject。
 *
 * 守卫可以有以下行为：
 * 1. 返回 undefined/void: 自动调用 next()
 * 2. 返回 false: 中断导航 (next(false))
 * 3. 返回 Error: 拒绝导航
 * 4. 返回 RouteLocationRaw: 重定向
 * 5. 返回 Promise: 等待 Promise resolve
 *
 * @param guard - 导航守卫函数
 * @param to - 目标路由
 * @param from - 源路由
 * @param record - 路由记录（用于获取组件实例）
 * @param name - 组件名称（用于获取正确的实例）
 * @param runWithContext - 在 Vue 上下文执行的函数
 *
 * @example
 * ```typescript
 * // 基本的守卫转换
 * const guardPromise = guardToPromiseFn(beforeEachGuard, to, from)
 * await guardPromise()
 *
 * // 带组件实例的守卫
 * const guardPromise = guardToPromiseFn(
 *   beforeRouteEnterGuard,
 *   to,
 *   from,
 *   record,
 *   'default',
 *   runWithContext
 * )
 * await guardPromise()
 * ```
 */
export function guardToPromiseFn(
  guard: NavigationGuard,
  to: RouteLocationNormalized,
  from: RouteLocationNormalizedLoaded
): () => Promise<void>
export function guardToPromiseFn(
  guard: NavigationGuard,
  to: RouteLocationNormalized,
  from: RouteLocationNormalizedLoaded,
  record: RouteRecordNormalized,
  name: string,
  runWithContext: <T>(fn: () => T) => T
): () => Promise<void>
export function guardToPromiseFn(
  guard: NavigationGuard,
  to: RouteLocationNormalized,
  from: RouteLocationNormalizedLoaded,
  record?: RouteRecordNormalized,
  name?: string,
  runWithContext: <T>(fn: () => T) => T = fn => fn()
): () => Promise<void> {
  // 保存 enterCallbackArray 的引用，防止在新导航发生时意外推送回调
  // 只有在 beforeRouteEnter 守卫中才会用到
  const enterCallbackArray =
    record &&
    // name 在 record 存在时才有定义（由函数重载保证）
    (record.enterCallbacks[name!] = record.enterCallbacks[name!] || [])

  // 返回一个函数，执行守卫并返回 Promise
  return () =>
    new Promise((resolve, reject) => {
      /**
       * next 回调函数
       *
       * @remarks
       * 在 Vue Router 4 中，推荐直接返回守卫值而非调用 next()。
       * 此函数同时支持旧式 next() 回调以保持向后兼容。
       *
       * @param valid - 验证结果
       */
      const next: NavigationGuardNext = (
        valid?: boolean | RouteLocationRaw | NavigationGuardNextCallback | Error
      ) => {
        // ============================================
        // 情况1：导航被中断
        // ============================================
        if (valid === false) {
          reject(
            createRouterError<NavigationFailure>(
              ErrorTypes.NAVIGATION_ABORTED,
              {
                from,
                to,
              }
            )
          )
        }
        // ============================================
        // 情况2：导航被拒绝（错误）
        // ============================================
        else if (valid instanceof Error) {
          reject(valid)
        }
        // ============================================
        // 情况3：导航被重定向
        // ============================================
        else if (isRouteLocation(valid)) {
          reject(
            createRouterError<NavigationRedirectError>(
              ErrorTypes.NAVIGATION_GUARD_REDIRECT,
              {
                from: to,
                to: valid,
              }
            )
          )
        }
        // ============================================
        // 情况4：继续导航或添加 enter 回调
        // ============================================
        else {
          // 如果有 enterCallbackArray（beforeRouteEnter 守卫中）
          // 且 next 被调用时传入的是函数，则添加到回调数组
          if (
            enterCallbackArray &&
            // 由于 enterCallbackArray 为真，record 和 name 也为真
            record!.enterCallbacks[name!] === enterCallbackArray &&
            typeof valid === 'function'
          ) {
            enterCallbackArray.push(valid)
          }
          resolve()
        }
      }

      // ============================================
      // 执行守卫
      // ============================================
      // 使用 Promise.resolve 包装，允许同时支持同步和异步守卫
      // 在 Vue 上下文（如 setup）中执行守卫
      const guardReturn = runWithContext(() =>
        guard.call(
          record && record.instances[name!],
          to,
          from,
          // 在开发环境下，包装 next 回调以警告废弃用法
          __DEV__
            ? withDeprecationWarning(canOnlyBeCalledOnce(next, to, from))
            : next
        )
      )

      // 将守卫返回值转换为 Promise
      let guardCall = Promise.resolve(guardReturn)

      // ============================================
      // 自动调用 next（仅当守卫没有接收第三个参数时）
      // ============================================
      // 这是 Vue Router 4 的新写法：直接返回守卫值而非调用 next
      // 如果守卫声明少于 3 个参数，说明使用新写法，自动调用 next
      if (guard.length < 3) guardCall = guardCall.then(next)

      // ============================================
      // 开发环境：警告未正确使用守卫
      // ============================================
      if (__DEV__ && guard.length > 2) {
        const message = `The "next" callback was never called inside of ${
          guard.name ? '"' + guard.name + '"' : ''
        }:\n${guard.toString()}\n. If you are returning a value instead of calling "next", make sure to remove the "next" parameter from your function.`
        if (typeof guardReturn === 'object' && 'then' in guardReturn) {
          // 守卫返回 Promise，检查 next 是否被调用
          guardCall = guardCall.then(resolvedValue => {
            // @ts-expect-error: _called 在 canOnlyBeCalledOnce 中添加
            if (!next._called) {
              warn(message)
              return Promise.reject(new Error('Invalid navigation guard'))
            }
            return resolvedValue
          })
        } else if (guardReturn !== undefined) {
          // 守卫返回了值但没有调用 next
          // @ts-expect-error: _called 在 canOnlyBeCalledOnce 中添加
          if (!next._called) {
            warn(message)
            reject(new Error('Invalid navigation guard'))
            return
          }
        }
      }

      // 捕获守卫中抛出的错误
      guardCall.catch(err => reject(err))
    })
}

/**
 * 包装 next 回调以警告废弃用法（仅开发环境）
 *
 * @remarks
 * 在 Vue Router 4 中，推荐直接返回守卫值而非调用 next()。
 * 此函数检测并警告旧式的 next() 用法。
 *
 * @param next - 原始的 next 回调
 * @returns 包装后的 next 回调
 *
 * @internal
 */
function withDeprecationWarning(
  next: NavigationGuardNext
): NavigationGuardNext {
  let warned = false
  return function (this: any) {
    if (!warned) {
      warned = true
      warn(
        'The `next()` callback in navigation guards is deprecated. Return the value instead of calling `next(value)`.'
      )
    }
    return next.apply(this, arguments as any)
  }
}

/**
 * 包装 next 回调，确保只被调用一次
 *
 * @remarks
 * 在导航守卫中，next() 只能被调用一次。
 * 如果被调用多次，会发出警告。
 *
 * @param next - 原始的 next 回调
 * @param to - 目标路由
 * @param from - 源路由
 * @returns 包装后的 next 回调
 */
function canOnlyBeCalledOnce(
  next: NavigationGuardNext,
  to: RouteLocationNormalized,
  from: RouteLocationNormalized
): NavigationGuardNext {
  let called = 0
  return function () {
    // 警告多次调用
    if (called++ === 1)
      warn(
        `The "next" callback was called more than once in one navigation guard when going from "${from.fullPath}" to "${to.fullPath}". It should be called exactly one time in each navigation guard. This will fail in production.`
      )
    // @ts-expect-error: 添加到原始函数以便检查
    next._called = true
    if (called === 1) next.apply(null, arguments as any)
  }
}

/**
 * 守卫类型联合
 *
 * @internal
 */
type GuardType = 'beforeRouteEnter' | 'beforeRouteUpdate' | 'beforeRouteLeave'

/**
 * 从路由记录中提取组件守卫
 *
 * @remarks
 * 这个函数遍历匹配的路由记录，提取并转换组件中的导航守卫。
 * 支持两种组件定义方式：
 * 1. 选项式 API：通过组件选项（如 beforeRouteEnter）
 * 2. 组合式 API：通过 defineAsyncComponent 懒加载
 *
 * @param matched - 匹配的路由记录数组
 * @param guardType - 要提取的守卫类型
 * @param to - 目标路由
 * @param from - 源路由
 * @param runWithContext - 在 Vue 上下文执行的函数
 *
 * @example
 * ```typescript
 * // 提取 beforeRouteEnter 守卫
 * const guards = extractComponentsGuards(
 *   enteringRecords,
 *   'beforeRouteEnter',
 *   to,
 *   from,
 *   runWithContext
 * )
 * ```
 */
export function extractComponentsGuards(
  matched: RouteRecordNormalized[],
  guardType: GuardType,
  to: RouteLocationNormalized,
  from: RouteLocationNormalizedLoaded,
  runWithContext: <T>(fn: () => T) => T = fn => fn()
) {
  const guards: Array<() => Promise<void>> = []

  // 遍历所有匹配的路由记录
  for (const record of matched) {
    // ============================================
    // 开发环境验证
    // ============================================
    if (
      __DEV__ &&
      !record.components &&
      // 在新记录中，没有 children，只有 parents
      record.children &&
      !record.children.length
    ) {
      warn(
        `Record with path "${record.path}" is either missing a "component(s)"` +
          ` or "children" property.`
      )
    }

    // 遍历路由记录中的所有组件
    for (const name in record.components) {
      let rawComponent = record.components[name]

      // ============================================
      // 开发环境验证
      // ============================================
      if (__DEV__) {
        // 验证组件是有效的
        if (
          !rawComponent ||
          (typeof rawComponent !== 'object' &&
            typeof rawComponent !== 'function')
        ) {
          warn(
            `Component "${name}" in record with path "${record.path}" is not` +
              ` a valid component. Received "${String(rawComponent)}".`
          )
          // 抛出错误以确保停止，但也要发出警告确保用户看到
          throw new Error('Invalid route component')
        }

        // 检测常见错误：Promise 而非函数
        // 用户可能写了 import('/component.vue') 而不是 () => import('/component.vue')
        else if ('then' in rawComponent) {
          warn(
            `Component "${name}" in record with path "${record.path}" is a ` +
              `Promise instead of a function that returns a Promise. Did you ` +
              `write "import('./MyPage.vue')" instead of ` +
              `"() => import('./MyPage.vue')" ? This will break in ` +
              `production if not fixed.`
          )
          const promise = rawComponent
          // 自动转换为函数形式
          rawComponent = () => promise
        }

        // 检测 defineAsyncComponent 的错误用法
        else if (
          (rawComponent as any).__asyncLoader &&
          // 每个组件只警告一次
          !(rawComponent as any).__warnedDefineAsync
        ) {
          ;(rawComponent as any).__warnedDefineAsync = true
          warn(
            `Component "${name}" in record with path "${record.path}" is defined ` +
              `using "defineAsyncComponent()". ` +
              `Write "() => import('./MyPage.vue')" instead of ` +
              `"defineAsyncComponent(() => import('./MyPage.vue'))".`
          )
        }
      }

      // ============================================
      // 跳过未挂载组件的 update 和 leave 守卫
      // ============================================
      // 对于 beforeRouteUpdate 和 beforeRouteLeave，如果组件未挂载，不需要执行守卫
      if (guardType !== 'beforeRouteEnter' && !record.instances[name]) continue

      // ============================================
      // 处理普通组件（选项式 API）
      // ============================================
      if (isRouteComponent(rawComponent)) {
        // __vccOpts 由 vue-class-component 添加，包含常规选项
        const options: ComponentOptions =
          (rawComponent as any).__vccOpts || rawComponent
        const guard = options[guardType]
        guard &&
          guards.push(
            guardToPromiseFn(guard, to, from, record, name, runWithContext)
          )
      }
      // ============================================
      // 处理异步组件（懒加载）
      // ============================================
      else {
        // 开始请求 chunk（如果还没有）
        let componentPromise: Promise<
          RouteComponent | null | undefined | void
        > = (rawComponent as Lazy<RouteComponent>)()

        // ============================================
        // 开发环境验证 Promise
        // ============================================
        if (__DEV__ && !('catch' in componentPromise)) {
          warn(
            `Component "${name}" in record with path "${record.path}" is a function that does not return a Promise. If you were passing a functional component, make sure to add a "displayName" to the component. This will break in production if not fixed.`
          )
          // 修复为 resolved Promise
          componentPromise = Promise.resolve(componentPromise as RouteComponent)
        }

        // ============================================
        // 返回懒加载守卫
        // ============================================
        guards.push(() =>
          componentPromise.then(resolved => {
            // 验证组件已解析
            if (!resolved)
              throw new Error(
                `Couldn't resolve component "${name}" at "${record.path}"`
              )

            // 处理 ES 模块默认导出
            const resolvedComponent = isESModule(resolved)
              ? resolved.default
              : resolved

            // 保存解析后的模块，供 data loaders 等插件使用
            record.mods[name] = resolved

            // 用解析后的组件替换函数
            // 不可能是 null 或 undefined，因为我们进入了 for 循环
            record.components![name] = resolvedComponent

            // __vccOpts 由 vue-class-component 添加，包含常规选项
            const options: ComponentOptions =
              (resolvedComponent as any).__vccOpts || resolvedComponent
            const guard = options[guardType]

            // 转换并执行守卫
            return (
              guard &&
              guardToPromiseFn(guard, to, from, record, name, runWithContext)()
            )
          })
        )
      }
    }
  }

  return guards
}

/**
 * 确保路由已加载
 *
 * @remarks
 * 用于确保异步组件已被解析。
 * 可以传递给 RouterView 作为 prop。
 *
 * @param route - 要加载的路由
 * @returns Promise，解析后返回加载的路由
 *
 * @example
 * ```typescript
 * const route = await loadRouteLocation(router.currentRoute)
 * ```
 */
export function loadRouteLocation(
  route: RouteLocation | RouteLocationNormalized
): Promise<RouteLocationNormalizedLoaded> {
  // 如果所有记录都是重定向，拒绝加载
  return route.matched.every(record => record.redirect)
    ? Promise.reject(new Error('Cannot load a route that redirects.'))
    : Promise.all(
        route.matched.map(
          record =>
            record.components &&
            Promise.all(
              Object.keys(record.components).reduce(
                (promises, name) => {
                  const rawComponent = record.components![name]

                  // 如果是懒加载函数，解析它
                  if (
                    typeof rawComponent === 'function' &&
                    !('displayName' in rawComponent)
                  ) {
                    promises.push(
                      (rawComponent as Lazy<RouteComponent>)().then(
                        resolved => {
                          if (!resolved)
                            return Promise.reject(
                              new Error(
                                `Couldn't resolve component "${name}" at "${record.path}". Ensure you passed a function that returns a promise.`
                              )
                            )

                          // 处理 ES 模块默认导出
                          const resolvedComponent = isESModule(resolved)
                            ? resolved.default
                            : resolved

                          // 保存解析后的模块
                          record.mods[name] = resolved

                          // 用解析后的组件替换函数
                          record.components![name] = resolvedComponent

                          return
                        }
                      )
                    )
                  }
                  return promises
                },
                [] as Array<Promise<RouteComponent | null | undefined>>
              )
            )
        )
      ).then(() => route as RouteLocationNormalizedLoaded)
}

/**
 * 提取变化的路由记录
 *
 * @remarks
 * 当导航从 from 变化到 to 时，将路由记录分为三类：
 *
 * 1. **leavingRecords**：正在离开的路由记录
 *    - 在 from 中存在但在 to 中不存在
 *
 * 2. **updatingRecords**：正在更新的路由记录（组件被复用）
 *    - 在 from 和 to 中都存在（相同引用）
 *
 * 3. **enteringRecords**：正在进入的路由记录
 *    - 在 to 中存在但不在 from 中
 *
 * 这个分类对于确定哪些守卫应该执行至关重要。
 *
 * @param to - 目标路由
 * @param from - 源路由
 * @returns 包含三个数组的元组 [leavingRecords, updatingRecords, enteringRecords]
 *
 * @example
 * ```typescript
 * const [leaving, updating, entering] = extractChangingRecords(to, from)
 *
 * // leaving 中的记录需要执行 beforeRouteLeave
 * // updating 中的记录需要执行 beforeRouteUpdate
 * // entering 中的记录需要执行 beforeRouteEnter
 * ```
 */
export function extractChangingRecords(
  to: RouteLocationNormalized,
  from: RouteLocationNormalizedLoaded
): [
  leavingRecords: RouteRecordNormalized[],
  updatingRecords: RouteRecordNormalized[],
  enteringRecords: RouteRecordNormalized[],
] {
  const leavingRecords: RouteRecordNormalized[] = []
  const updatingRecords: RouteRecordNormalized[] = []
  const enteringRecords: RouteRecordNormalized[] = []

  // 获取最大长度，遍历两个 matched 数组
  const len = Math.max(from.matched.length, to.matched.length)
  for (let i = 0; i < len; i++) {
    // 检查 from 中的记录
    const recordFrom = from.matched[i]
    if (recordFrom) {
      // 如果在 to 中找到相同记录，则是更新
      if (to.matched.find(record => isSameRouteRecord(record, recordFrom)))
        updatingRecords.push(recordFrom)
      // 否则是离开
      else leavingRecords.push(recordFrom)
    }

    // 检查 to 中的记录
    const recordTo = to.matched[i]
    if (recordTo) {
      // 如果在 from 中没有找到相同记录，则是进入
      // 类型不重要，因为我们是按引用比较
      if (!from.matched.find(record => isSameRouteRecord(record, recordTo))) {
        enteringRecords.push(recordTo)
      }
    }
  }

  return [leavingRecords, updatingRecords, enteringRecords]
}