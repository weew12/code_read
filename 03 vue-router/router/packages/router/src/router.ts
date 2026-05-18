/**
 * Vue Router 核心模块 - 路由创建与管理
 * ====================================
 *
 * Vue Router 是 Vue 3 官方路由管理器，本文件是整个库的核心。
 * 负责创建路由实例、管理导航、执行守卫、处理历史记录等核心功能。
 *
 * 主要设计模式：
 * 1. 工厂模式：通过 createRouter() 创建路由实例
 * 2. 发布-订阅模式：使用 useCallbacks() 管理守卫回调
 * 3. 适配器模式：RouterHistory 接口支持多种历史记录实现
 * 4. 响应式设计：深度集成 Vue 3 Composition API
 *
 * 核心概念：
 * - RouterMatcher：路由匹配器，负责路径解析和参数提取
 * - RouterHistory：历史记录接口，抽象 HTML5/Hash/Memory 三种实现
 * - Navigation Guards：导航守卫，控制路由跳转的生命周期
 * - RouteRecord：路由记录，代表一条路由配置
 */

import type {
  RouteRecordRaw,
  Lazy,
  RouteLocationOptions,
  MatcherLocationRaw,
} from './types'
import { isRouteLocation, isRouteName } from './types'
import type {
  RouteLocation,
  RouteLocationRaw,
  RouteParams,
  RouteLocationNormalized,
  RouteLocationNormalizedLoaded,
  NavigationGuardWithThis,
  NavigationHookAfter,
  RouteLocationResolved,
  RouteRecordNameGeneric,
} from './typed-routes'
import type { HistoryState } from './history/common'
import { NavigationType } from './history/common'
import type { _ScrollPositionNormalized } from './scrollBehavior'
import {
  getSavedScrollPosition,
  getScrollKey,
  saveScrollPosition,
  computeScrollPosition,
  scrollToPosition,
} from './scrollBehavior'
import { createRouterMatcher } from './matcher'
import type {
  NavigationFailure,
  NavigationRedirectError,
  _ErrorListener,
} from './errors'
import { createRouterError, ErrorTypes, isNavigationFailure } from './errors'
import { applyToParams, isBrowser, assign, noop, isArray } from './utils'
import { useCallbacks } from './utils/callbacks'
import { encodeParam, decode, encodeHash } from './encoding'
import type { LocationQuery } from './query'
import {
  normalizeQuery,
  parseQuery as originalParseQuery,
  stringifyQuery as originalStringifyQuery,
} from './query'
import type { App } from 'vue'
import { shallowRef, nextTick, unref, shallowReactive } from 'vue'
import type { RouteRecordNormalized } from './matcher/types'
import {
  parseURL,
  stringifyURL,
  isSameRouteLocation,
  START_LOCATION_NORMALIZED,
} from './location'
import {
  extractChangingRecords,
  extractComponentsGuards,
  guardToPromiseFn,
} from './navigationGuards'
import { warn } from './warning'
import { RouterLink } from './RouterLink'
import { RouterView } from './RouterView'
import {
  routeLocationKey,
  routerKey,
  routerViewLocationKey,
} from './injectionSymbols'
import { addDevtools } from './devtools'
import { _LiteralUnion } from './types/utils'
import type {
  EXPERIMENTAL_RouterOptions_Base,
  EXPERIMENTAL_Router_Base,
  _OnReadyCallback,
} from './experimental/router'

/**
 * Router 构造函数选项
 *
 * @remarks
 * 创建路由实例时需要传入的配置对象，包含路由定义、历史记录、滚动行为等
 *
 * @example
 * ```typescript
 * const router = createRouter({
 *   history: createWebHistory(),
 *   routes: [
 *     { path: '/', component: Home },
 *     { path: '/users/:id', component: User },
 *   ],
 *   scrollBehavior: (to, from, savedPosition) => {
 *     return { top: 0 }
 *   }
 * })
 * ```
 */
export interface RouterOptions extends EXPERIMENTAL_RouterOptions_Base {
  /**
   * 初始路由配置数组
   *
   * @remarks
   * 路由配置可以是静态路由或动态添加的路由
   */
  routes: Readonly<RouteRecordRaw[]>
}

/**
 * Router 实例接口
 *
 * @remarks
 * 路由实例是 Vue 应用与路由系统交互的主要入口，提供导航、守卫、路由查询等功能
 */
export interface Router extends EXPERIMENTAL_Router_Base<RouteRecordNormalized> {
  /**
   * 创建 Router 时传入的原始配置
   *
   * @remarks
   * 该配置在创建后是只读的，不可修改
   */
  readonly options: RouterOptions

  /**
   * 添加子路由
   *
   * @param parentName - 父路由的名称
   * @param route - 要添加的路由配置
   * @returns 一个函数，用于移除该路由
   *
   * @example
   * ```typescript
   * router.addRoute('parent', { path: 'child', component: Child })
   * ```
   */
  addRoute(
    parentName: NonNullable<RouteRecordNameGeneric>,
    route: RouteRecordRaw
  ): () => void

  /**
   * 添加根路由
   *
   * @param route - 要添加的路由配置
   * @returns 一个函数，用于移除该路由
   */
  addRoute(route: RouteRecordRaw): () => void

  /**
   * 通过名称移除路由
   *
   * @param name - 要移除的路由名称
   */
  removeRoute(name: NonNullable<RouteRecordNameGeneric>): void

  /**
   * 清除所有路由
   *
   * @remarks
   * 移除所有动态和静态添加的路由，恢复到初始状态
   */
  clearRoutes(): void
}

/**
 * 创建 Router 实例
 *
 * @param options - Router 配置选项
 * @returns Router 实例
 *
 * @remarks
 * 这是 Vue Router 的入口函数，创建并返回一个路由实例。
 * 路由实例需要通过 app.use() 注册到 Vue 应用。
 *
 * @example
 * ```typescript
 * import { createRouter, createWebHistory } from 'vue-router'
 *
 * const router = createRouter({
 *   history: createWebHistory(),
 *   routes: [
 *     { path: '/', component: Home },
 *     { path: '/users/:id', component: User },
 *   ]
 * })
 *
 * app.use(router)
 * ```
 */
export function createRouter(options: RouterOptions): Router {
  // ============================================
  // 1. 初始化路由匹配器 (RouterMatcher)
  // ============================================
  // RouterMatcher 负责管理所有路由记录、路径解析、参数提取、路由排名等核心功能
  const matcher = createRouterMatcher(options.routes, options)

  // ============================================
  // 2. 获取查询解析器
  // ============================================
  // parseQuery: 将 URL 查询字符串解析为对象
  // stringifyQuery: 将查询对象序列化为 URL 查询字符串
  // 支持自定义查询解析器，如使用 qs 或 nuqs
  const parseQuery = options.parseQuery || originalParseQuery
  const stringifyQuery = options.stringifyQuery || originalStringifyQuery

  // ============================================
  // 3. 获取历史记录实例
  // ============================================
  // RouterHistory 是路由系统的适配器接口
  // 支持三种历史记录实现：
  // - HTML5 History: createWebHistory() - 使用 history.pushState
  // - Hash History: createWebHashHistory() - 使用 location.hash
  // - Memory History: createMemoryHistory() - 不依赖 URL，用于 SSR
  const routerHistory = options.history
  if (__DEV__ && !routerHistory)
    throw new Error(
      'Provide the "history" option when calling "createRouter()":' +
        ' https://router.vuejs.org/api/interfaces/RouterOptions.html#history'
    )

  // ============================================
  // 4. 创建导航守卫管理器
  // ============================================
  // 使用 useCallbacks 创建三个守卫回调容器：
  // - beforeGuards: 全局前置守卫，在每次导航之前执行
  // - beforeResolveGuards: 全局解析守卫，在解析完路由后、执行组件加载前执行
  // - afterGuards: 全局后置守卫，在导航完成后执行
  const beforeGuards = useCallbacks<NavigationGuardWithThis<undefined>>()
  const beforeResolveGuards = useCallbacks<NavigationGuardWithThis<undefined>>()
  const afterGuards = useCallbacks<NavigationHookAfter>()

  // ============================================
  // 5. 创建响应式当前路由
  // ============================================
  // 使用 shallowRef 创建响应式引用，避免深度响应式带来的性能开销
  // currentRoute 是 Vue Router 响应式系统的核心，路由变化时会自动更新
  const currentRoute = shallowRef<RouteLocationNormalizedLoaded>(
    START_LOCATION_NORMALIZED
  )

  // 待处理的导航位置，用于检测导航冲突
  let pendingLocation: RouteLocation = START_LOCATION_NORMALIZED

  // ============================================
  // 6. 滚动行为配置
  // ============================================
  // 如果提供了 scrollBehavior 且浏览器支持 scrollRestoration
  // 设置为 manual 以便 Vue Router 控制滚动恢复
  if (isBrowser && options.scrollBehavior && 'scrollRestoration' in history) {
    history.scrollRestoration = 'manual'
  }

  // ============================================
  // 7. 参数编解码函数
  // ============================================
  // normalizeParams: 将参数值规范化为字符串
  // encodeParams: 对参数进行 URL 编码（如 %20 替换空格）
  // decodeParams: 对参数进行 URL 解码
  // 这些函数用于确保 URL 参数的正确编解码处理

  const normalizeParams = applyToParams.bind(
    null,
    paramValue => '' + paramValue
  )
  const encodeParams = applyToParams.bind(null, encodeParam)
  const decodeParams: (params: RouteParams | undefined) => RouteParams =
    // @ts-expect-error: intentionally avoid the type check
    applyToParams.bind(null, decode)

  // ============================================
  // 8. 动态路由管理函数
  // ============================================

  /**
   * 添加路由
   *
   * @remarks
   * 支持两种调用方式：
   * 1. addRoute(route) - 添加根路由
   * 2. addRoute(parentName, route) - 添加子路由
   *
   * @param parentOrRoute - 父路由名称或路由配置
   * @param route - 路由配置（当第一个参数是名称时）
   * @returns 一个函数，用于移除添加的路由
   */
  function addRoute(
    parentOrRoute: NonNullable<RouteRecordNameGeneric> | RouteRecordRaw,
    route?: RouteRecordRaw
  ) {
    let parent: Parameters<(typeof matcher)['addRoute']>[1] | undefined
    let record: RouteRecordRaw

    // 判断是添加子路由还是根路由
    if (isRouteName(parentOrRoute)) {
      // 子路由：查找父路由匹配器
      parent = matcher.getRecordMatcher(parentOrRoute)
      if (__DEV__ && !parent) {
        warn(
          `Parent route "${String(parentOrRoute)}" not found when adding child route`,
          route
        )
      }
      record = route!
    } else {
      // 根路由
      record = parentOrRoute
    }

    return matcher.addRoute(record, parent)
  }

  /**
   * 移除路由
   *
   * @param name - 路由名称
   */
  function removeRoute(name: NonNullable<RouteRecordNameGeneric>) {
    const recordMatcher = matcher.getRecordMatcher(name)
    if (recordMatcher) {
      matcher.removeRoute(recordMatcher)
    } else if (__DEV__) {
      warn(`Cannot remove non-existent route "${String(name)}"`)
    }
  }

  /**
   * 获取所有路由记录
   *
   * @returns 路由记录数组
   */
  function getRoutes() {
    return matcher.getRoutes().map(routeMatcher => routeMatcher.record)
  }

  /**
   * 检查路由是否存在
   *
   * @param name - 路由名称
   * @returns 是否存在
   */
  function hasRoute(name: NonNullable<RouteRecordNameGeneric>): boolean {
    return !!matcher.getRecordMatcher(name)
  }

  // ============================================
  // 9. 路由解析
  // ============================================

  /**
   * 解析路由位置
   *
   * @remarks
   * 将原始路由位置（字符串或对象）解析为完整的路由信息。
   * 解析过程包括：
   * 1. URL 解析（处理查询参数、hash、相对路径）
   * 2. 路径匹配（找到对应的路由记录）
   * 3. 参数提取（从路径中解析动态参数）
   * 4. 参数解码（URL 解码）
   *
   * @param rawLocation - 原始路由位置（字符串或对象）
   * @param currentLocation - 当前路由位置（用于相对路径解析）
   * @returns 解析后的路由位置
   *
   * @example
   * ```typescript
   * // 字符串路径
   * router.resolve('/users/123')
   *
   * // 对象形式
   * router.resolve({ name: 'user', params: { id: '123' } })
   *
   * // 带查询参数和 hash
   * router.resolve('/users/123?sort=name#profile')
   * ```
   */
  function resolve(
    rawLocation: RouteLocationRaw,
    currentLocation?: RouteLocationNormalizedLoaded
  ): RouteLocationResolved {
    // 如果没有提供当前路由，使用响应式的当前路由
    currentLocation = assign({}, currentLocation || currentRoute.value)

    // ============================================
    // 9.1 字符串路径解析
    // ============================================
    if (typeof rawLocation === 'string') {
      // 解析 URL：提取 path、query、hash，处理相对路径
      const locationNormalized = parseURL(
        parseQuery,
        rawLocation,
        currentLocation.path
      )

      // 使用 matcher 解析路径，找到匹配的路由记录
      const matchedRoute = matcher.resolve(
        { path: locationNormalized.path },
        currentLocation
      )

      // 创建 href（带 base 前缀）
      const href = routerHistory.createHref(locationNormalized.fullPath)

      // 开发环境警告
      if (__DEV__) {
        // 检测双斜杠开头
        if (href.startsWith('//'))
          warn(
            `Location "${rawLocation}" resolved to "${href}". A resolved location cannot start with multiple slashes.`
          )
        // 检测无匹配路由
        else if (!matchedRoute.matched.length) {
          warn(`No match found for location with path "${rawLocation}"`)
        }
      }

      // 返回解析后的完整路由信息
      return assign(locationNormalized, matchedRoute, {
        params: decodeParams(matchedRoute.params),
        hash: decode(locationNormalized.hash),
        redirectedFrom: undefined,
        href,
      })
    }

    // ============================================
    // 9.2 开发环境验证
    // ============================================
    if (__DEV__ && !isRouteLocation(rawLocation)) {
      warn(
        `router.resolve() was passed an invalid location. This will fail in production.\n- Location:`,
        rawLocation
      )
      return resolve({})
    }

    // ============================================
    // 9.3 对象形式路径解析
    // ============================================
    let matcherLocation: MatcherLocationRaw

    if (rawLocation.path != null) {
      // 如果提供了 path，解析相对路径
      if (
        __DEV__ &&
        'params' in rawLocation &&
        !('name' in rawLocation) &&
        // @ts-expect-error: the type is never
        Object.keys(rawLocation.params).length
      ) {
        warn(
          `Path "${rawLocation.path}" was passed with params but they will be ignored. Use a named route alongside params instead.`
        )
      }
      matcherLocation = assign({}, rawLocation, {
        path: parseURL(parseQuery, rawLocation.path, currentLocation.path).path,
      })
    } else {
      // 如果没有提供 path，使用 name 和 params
      // 移除空的参数
      const targetParams = assign({}, rawLocation.params)
      for (const key in targetParams) {
        if (targetParams[key] == null) {
          delete targetParams[key]
        }
      }
      // 传递编码后的参数，让 matcher 生成编码后的 path 和 fullPath
      matcherLocation = assign({}, rawLocation, {
        params: encodeParams(targetParams),
      })
      // 当前路由参数是解码后的，需要编码以防 matcher 合并参数
      currentLocation.params = encodeParams(currentLocation.params)
    }

    // 使用 matcher 解析
    const matchedRoute = matcher.resolve(matcherLocation, currentLocation)
    const hash = rawLocation.hash || ''

    // 开发环境 hash 格式警告
    if (__DEV__ && hash && !hash.startsWith('#')) {
      warn(
        `A \`hash\` should always start with the character "#". Replace "${hash}" with "#${hash}".`
      )
    }

    // matcher 可能合并了当前路由的参数，需要重新解码
    matchedRoute.params = normalizeParams(decodeParams(matchedRoute.params))

    // 构建完整路径
    const fullPath = stringifyURL(
      stringifyQuery,
      assign({}, rawLocation, {
        hash: encodeHash(hash),
        path: matchedRoute.path,
      })
    )

    const href = routerHistory.createHref(fullPath)

    // 开发环境警告
    if (__DEV__) {
      if (href.startsWith('//')) {
        warn(
          `Location "${rawLocation}" resolved to "${href}". A resolved location cannot start with multiple slashes.`
        )
      } else if (!matchedRoute.matched.length) {
        warn(
          `No match found for path "${
            rawLocation.path != null ? rawLocation.path : rawLocation
          }"`
        )
      }
    }

    // 返回解析后的完整路由信息
    return assign(
      {
        fullPath,
        // 保持 hash 编码，以便 fullPath = path + encodedQuery + hash
        hash,
        query:
          // 如果使用默认的 stringifyQuery，执行标准化查询
          // 如果用户使用自定义查询库（如 qs），保持原样
          stringifyQuery === originalStringifyQuery
            ? normalizeQuery(rawLocation.query)
            : ((rawLocation.query || {}) as LocationQuery),
      },
      matchedRoute,
      {
        redirectedFrom: undefined,
        href,
      }
    )
  }

  // ============================================
  // 10. 辅助函数
  // ============================================

  /**
   * 将路由位置转换为对象形式
   *
   * @param to - 路由位置（字符串或对象）
   * @returns 路由位置对象
   */
  function locationAsObject(
    to: RouteLocationRaw | RouteLocationNormalized
  ): Exclude<RouteLocationRaw, string> | RouteLocationNormalized {
    return typeof to === 'string'
      ? parseURL(parseQuery, to, currentRoute.value.path)
      : assign({}, to)
  }

  /**
   * 检查导航是否被取消
   *
   * @remarks
   * 当有新的导航发生时，之前的导航会被视为取消。
   * 这用于防止多个导航同时进行时出现竞态条件。
   *
   * @param to - 目标路由
   * @param from - 源路由
   * @returns 如果取消返回 NavigationFailure，否则返回 void
   */
  function checkCanceledNavigation(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized
  ): NavigationFailure | void {
    // 如果待处理位置不是目标位置，说明有新的导航发生
    if (pendingLocation !== to) {
      return createRouterError<NavigationFailure>(
        ErrorTypes.NAVIGATION_CANCELLED,
        {
          from,
          to,
        }
      )
    }
  }

  // ============================================
  // 11. 导航方法
  // ============================================

  /**
   * 导航到指定位置
   *
   * @param to - 目标位置
   * @returns Promise<NavigationFailure | void>
   *
   * @remarks
   * push 是 Vue Router 中最重要的方法之一。
   * 它会触发完整的导航流程，包括守卫执行、组件加载、URL 更新等。
   *
   * @example
   * ```typescript
   * router.push('/users/123')
   * router.push({ name: 'user', params: { id: '123' } })
   * ```
   */
  function push(to: RouteLocationRaw) {
    return pushWithRedirect(to)
  }

  /**
   * 替换当前历史记录
   *
   * @param to - 目标位置
   * @returns Promise<NavigationFailure | void>
   *
   * @remarks
   * replace 与 push 类似，但不会在历史记录中创建新条目。
   * 它会替换当前的 history 状态。
   */
  function replace(to: RouteLocationRaw) {
    return push(assign(locationAsObject(to), { replace: true }))
  }

  /**
   * 处理路由重定向
   *
   * @param to - 目标路由
   * @param from - 当前路由
   * @returns 如果需要重定向返回新的目标位置，否则返回 void
   */
  function handleRedirectRecord(
    to: RouteLocation,
    from: RouteLocationNormalizedLoaded
  ): RouteLocationRaw | void {
    const lastMatched = to.matched[to.matched.length - 1]
    if (lastMatched && lastMatched.redirect) {
      const { redirect } = lastMatched

      // redirect 可以是字符串或函数
      let newTargetLocation =
        typeof redirect === 'function' ? redirect(to, from) : redirect

      // 如果是字符串，转换为对象形式
      if (typeof newTargetLocation === 'string') {
        newTargetLocation =
          newTargetLocation.includes('?') || newTargetLocation.includes('#')
            ? (newTargetLocation = locationAsObject(newTargetLocation))
            : // 强制清空参数，让 router 重新解析
              { path: newTargetLocation }
        // @ts-expect-error: 当传递字符串时，强制清空参数让 router 重新解析
        newTargetLocation.params = {}
      }

      // 开发环境验证重定向有效性
      if (
        __DEV__ &&
        newTargetLocation.path == null &&
        !('name' in newTargetLocation)
      ) {
        warn(
          `Invalid redirect found:\n${JSON.stringify(
            newTargetLocation,
            null,
            2
          )}\n when navigating to "${
            to.fullPath
          }". A redirect must contain a name or path. This will break in production.`
        )
        throw new Error('Invalid redirect')
      }

      // 合并重定向配置，保留原始的 query 和 hash
      return assign(
        {
          query: to.query,
          hash: to.hash,
          // 如果重定向有 path，不传递参数
          // 否则传递原始参数
          params: newTargetLocation.path != null ? {} : to.params,
        },
        newTargetLocation
      )
    }
  }

  /**
   * 导航核心实现（含重定向处理）
   *
   * @remarks
   * 这是 push 方法的核心实现，处理以下步骤：
   * 1. 解析目标位置
   * 2. 处理重定向
   * 3. 检查重复导航
   * 4. 执行守卫
   * 5. 完成导航
   *
   * @param to - 目标位置
   * @param redirectedFrom - 重定向来源（内部使用）
   */
  function pushWithRedirect(
    to: RouteLocationRaw | RouteLocation,
    redirectedFrom?: RouteLocation
  ): Promise<NavigationFailure | void | undefined> {
    // 解析目标位置
    const targetLocation: RouteLocation = (pendingLocation = resolve(to))
    const from = currentRoute.value
    const data: HistoryState | undefined = (to as RouteLocationOptions).state
    const force: boolean | undefined = (to as RouteLocationOptions).force

    // 检测 replace 选项
    const replace = (to as RouteLocationOptions).replace === true

    // 处理重定向
    const shouldRedirect = handleRedirectRecord(targetLocation, from)

    // 如果需要重定向，递归处理
    if (shouldRedirect)
      return pushWithRedirect(
        assign(locationAsObject(shouldRedirect), {
          state:
            typeof shouldRedirect === 'object'
              ? assign({}, data, shouldRedirect.state)
              : data,
          force,
          replace,
        }),
        // 保持原始的 redirectedFrom
        redirectedFrom || targetLocation
      )

    // 已经是最终目标（无重定向）
    const toLocation = targetLocation as RouteLocationNormalized

    // 记录重定向来源
    toLocation.redirectedFrom = redirectedFrom

    let failure: NavigationFailure | void | undefined

    // 检查是否为重复导航（非 force 模式下）
    if (!force && isSameRouteLocation(stringifyQuery, from, targetLocation)) {
      // 创建重复导航错误
      failure = createRouterError<NavigationFailure>(
        ErrorTypes.NAVIGATION_DUPLICATED,
        {
          to: toLocation,
          from,
        }
      )
      // 触发滚动，允许滚动到相同锚点
      handleScroll(
        from,
        from,
        // 这是一个 push，由 history.listen 触发的重定向会变成 push
        true,
        // 这不可能是首次导航，因为初始位置不能手动导航
        false
      )
    }

    // 执行导航或返回失败
    return (failure ? Promise.resolve(failure) : navigate(toLocation, from))
      .catch((error: NavigationFailure | NavigationRedirectError) =>
        isNavigationFailure(error)
          ? // 导航重定向仍然标记 router 为就绪
            isNavigationFailure(error, ErrorTypes.NAVIGATION_GUARD_REDIRECT)
            ? error
            : markAsReady(error) // 也返回错误
          : // 拒绝任何未知错误
            triggerError(error, toLocation, from)
      )
      .then((failure: NavigationFailure | NavigationRedirectError | void) => {
        if (failure) {
          // 处理导航重定向
          if (
            isNavigationFailure(failure, ErrorTypes.NAVIGATION_GUARD_REDIRECT)
          ) {
            // 检测无限重定向
            if (
              __DEV__ &&
              // 正在重定向到相同位置
              isSameRouteLocation(
                stringifyQuery,
                resolve(failure.to),
                toLocation
              ) &&
              // 已经重定向多次
              redirectedFrom &&
              // @ts-expect-error: 仅在开发环境添加
              (redirectedFrom._count = redirectedFrom._count
                ? // @ts-expect-error
                  redirectedFrom._count + 1
                : 1) > 30
            ) {
              warn(
                `Detected a possibly infinite redirection in a navigation guard when going from "${from.fullPath}" to "${toLocation.fullPath}". Aborting to avoid a Stack Overflow.\n Are you always returning a new location within a navigation guard? That would lead to this error. Only return when redirecting or aborting, that should fix this. This might break in production if not fixed.`
              )
              return Promise.reject(
                new Error('Infinite redirect in navigation guard')
              )
            }

            // 继续重定向
            return pushWithRedirect(
              // 保持选项
              assign(
                {
                  // 保留现有的 replace 选项，但允许重定向覆盖
                  replace,
                },
                locationAsObject(failure.to),
                {
                  state:
                    typeof failure.to === 'object'
                      ? assign({}, data, failure.to.state)
                      : data,
                  force,
                }
              ),
              // 保留原始的 redirectedFrom
              redirectedFrom || toLocation
            )
          }
        } else {
          // 导航成功，完成导航
          failure = finalizeNavigation(
            toLocation as RouteLocationNormalizedLoaded,
            from,
            true, // isPush
            replace,
            data
          )
        }

        // 触发后置守卫
        triggerAfterEach(
          toLocation as RouteLocationNormalizedLoaded,
          from,
          failure
        )
        return failure
      })
  }

  /**
   * 取消导航检查并返回 rejected Promise
   *
   * @remarks
   * 这是一个辅助函数，用于在守卫队列中检查导航是否被取消。
   * 如果被取消，守卫链会中断并跳到 catch 块。
   *
   * @param to - 目标路由
   * @param from - 源路由
   */
  function checkCanceledNavigationAndReject(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized
  ): Promise<void> {
    const error = checkCanceledNavigation(to, from)
    return error ? Promise.reject(error) : Promise.resolve()
  }

  /**
   * 在 Vue 应用上下文中执行函数
   *
   * @remarks
   * Vue Router 需要在 Vue 应用上下文中执行守卫，以确保 this 绑定正确。
   * 这主要用于支持 Vue 组合式 API 中的 getCurrentInstance()。
   *
   * @param fn - 要执行的函数
   */
  function runWithContext<T>(fn: () => T): T {
    const app: App | undefined = installedApps.values().next().value
    // 支持 Vue < 3.3 的 runWithContext
    return app && typeof app.runWithContext === 'function'
      ? app.runWithContext(fn)
      : fn()
  }

  // TODO: refactor the whole before guards by internally using router.beforeEach

  /**
   * 执行导航守卫链
   *
   * @remarks
   * 这是 Vue Router 守卫系统的核心实现。
   * 导航守卫按照以下顺序执行：
   *
   * 1. **beforeRouteLeave** - 组件离开守卫（从子到父，后进先出）
   * 2. **beforeEach** - 全局前置守卫
   * 3. **beforeRouteUpdate** - 组件更新守卫
   * 4. **beforeEnter** - 路由独享守卫
   * 5. **beforeRouteEnter** - 组件进入守卫
   * 6. **beforeResolve** - 全局解析守卫
   *
   * 守卫执行遵循"短路"原则：
   * - 返回 false 中断导航
   * - 返回 Error 拒绝导航
   * - 返回 RouteLocationRaw 重定向到其他位置
   *
   * @param to - 目标路由
   * @param from - 源路由
   */
  function navigate(
    to: RouteLocationNormalized,
    from: RouteLocationNormalizedLoaded
  ): Promise<any> {
    let guards: Lazy<any>[]

    // ============================================
    // 第一阶段：提取变化的路由记录
    // ============================================
    // extractChangingRecords 将路由分为三类：
    // - leavingRecords: 正在离开的路由记录
    // - updatingRecords: 正在更新的路由记录（被重用）
    // - enteringRecords: 正在进入的路由记录
    const [leavingRecords, updatingRecords, enteringRecords] =
      extractChangingRecords(to, from)

    // ============================================
    // 第二阶段：beforeRouteLeave 守卫
    // ============================================
    // 提取组件的 beforeRouteLeave 守卫
    // 逆序遍历（从子到父）确保子组件的守卫先执行
    guards = extractComponentsGuards(
      leavingRecords.reverse(),
      'beforeRouteLeave',
      to,
      from
    )

    // 添加路由记录的 leaveGuards
    // leavingRecords 已经是逆序
    for (const record of leavingRecords) {
      record.leaveGuards.forEach(guard => {
        guards.push(guardToPromiseFn(guard, to, from))
      })
    }

    // 创建取消导航检查
    const canceledNavigationCheck = checkCanceledNavigationAndReject.bind(
      null,
      to,
      from
    )

    guards.push(canceledNavigationCheck)

    // ============================================
    // 执行离开守卫队列
    // ============================================
    return (
      runGuardQueue(guards)
        .then(() => {
          // ============================================
          // 第三阶段：全局 beforeEach 守卫
          // ============================================
          guards = []
          for (const guard of beforeGuards.list()) {
            guards.push(guardToPromiseFn(guard, to, from))
          }
          guards.push(canceledNavigationCheck)

          return runGuardQueue(guards)
        })
        .then(() => {
          // ============================================
          // 第四阶段：beforeRouteUpdate 守卫
          // ============================================
          // 提取组件的 beforeRouteUpdate 守卫
          guards = extractComponentsGuards(
            updatingRecords,
            'beforeRouteUpdate',
            to,
            from
          )

          // 添加路由记录的 updateGuards
          for (const record of updatingRecords) {
            record.updateGuards.forEach(guard => {
              guards.push(guardToPromiseFn(guard, to, from))
            })
          }
          guards.push(canceledNavigationCheck)

          // 执行更新守卫队列
          return runGuardQueue(guards)
        })
        .then(() => {
          // ============================================
          // 第五阶段：beforeEnter 守卫
          // ============================================
          guards = []
          for (const record of enteringRecords) {
            // 不对重用的视图触发 beforeEnter
            if (record.beforeEnter) {
              if (isArray(record.beforeEnter)) {
                // 支持数组形式的 beforeEnter
                for (const beforeEnter of record.beforeEnter)
                  guards.push(guardToPromiseFn(beforeEnter, to, from))
              } else {
                guards.push(guardToPromiseFn(record.beforeEnter, to, from))
              }
            }
          }
          guards.push(canceledNavigationCheck)

          // 执行 beforeEnter 守卫队列
          return runGuardQueue(guards)
        })
        .then(() => {
          // ============================================
          // 第六阶段：beforeRouteEnter 守卫
          // ============================================
          // NOTE: 此时 to.matched 已标准化，不包含 () => Promise<Component>

          // 清除现有的 enterCallbacks
          // 这些由 extractComponentsGuards 添加
          to.matched.forEach(record => (record.enterCallbacks = {}))

          // 提取组件的 beforeRouteEnter 守卫
          guards = extractComponentsGuards(
            enteringRecords,
            'beforeRouteEnter',
            to,
            from,
            runWithContext
          )
          guards.push(canceledNavigationCheck)

          // 执行进入守卫队列
          return runGuardQueue(guards)
        })
        .then(() => {
          // ============================================
          // 第七阶段：全局 beforeResolve 守卫
          // ============================================
          guards = []
          for (const guard of beforeResolveGuards.list()) {
            guards.push(guardToPromiseFn(guard, to, from))
          }
          guards.push(canceledNavigationCheck)

          return runGuardQueue(guards)
        })
        // 捕获导航取消错误
        .catch(err =>
          isNavigationFailure(err, ErrorTypes.NAVIGATION_CANCELLED)
            ? err
            : Promise.reject(err)
        )
    )
  }

  /**
   * 触发后置守卫
   *
   * @remarks
   * 在导航确认后调用，不关心导航结果。
   * 通常用于分析、埋点等操作。
   *
   * @param to - 目标路由
   * @param from - 源路由
   * @param failure - 导航失败（如果有）
   */
  function triggerAfterEach(
    to: RouteLocationNormalizedLoaded,
    from: RouteLocationNormalizedLoaded,
    failure?: NavigationFailure | void
  ): void {
    // 导航确认后，调用 afterGuards
    // TODO: wrap with error handlers
    afterGuards
      .list()
      .forEach(guard => runWithContext(() => guard(to, from, failure)))
  }

  /**
   * 完成导航
   *
   * @remarks
   * 执行导航的最后步骤：
   * 1. 检查导航是否被取消
   * 2. 更新 URL（push/replace）
   * 3. 更新当前路由（响应式）
   * 4. 处理滚动行为
   * 5. 标记路由就绪
   *
   * @param toLocation - 目标路由
   * @param from - 源路由
   * @param isPush - 是否是 push 操作
   * @param replace - 是否是 replace 操作
   * @param data - 历史状态数据
   */
  function finalizeNavigation(
    toLocation: RouteLocationNormalizedLoaded,
    from: RouteLocationNormalizedLoaded,
    isPush: boolean,
    replace?: boolean,
    data?: HistoryState
  ): NavigationFailure | void {
    // 有更新的导航发生
    const error = checkCanceledNavigation(toLocation, from)
    if (error) return error

    // 判断是否是首次导航
    const isFirstNavigation = from === START_LOCATION_NORMALIZED
    const state: Partial<HistoryState> | null = !isBrowser ? {} : history.state

    // ============================================
    // 更新 URL
    // ============================================
    // 仅在用户执行 push/replace 时更新，且不是初始导航
    // 因为初始导航只是反映 URL，不需要 push
    if (isPush) {
      // 初始导航时，复用历史状态中的滚动位置
      if (replace || isFirstNavigation)
        routerHistory.replace(
          toLocation.fullPath,
          assign(
            {
              scroll: isFirstNavigation && state && state.scroll,
            },
            data
          )
        )
      else routerHistory.push(toLocation.fullPath, data)
    }

    // ============================================
    // 更新当前路由（触发响应式更新）
    // ============================================
    currentRoute.value = toLocation

    // ============================================
    // 处理滚动行为
    // ============================================
    handleScroll(toLocation, from, isPush, isFirstNavigation)

    // ============================================
    // 标记路由就绪
    // ============================================
    markAsReady()
  }

  // ============================================
  // 12. 历史记录监听设置
  // ============================================

  let removeHistoryListener: undefined | null | (() => void)

  /**
   * 设置历史记录监听器
   *
   * @remarks
   * 当用户通过浏览器的前进/后退按钮时，会触发 popstate 事件。
   * 此时需要执行完整的导航流程，包括守卫执行和组件加载。
   */
  function setupListeners() {
    // 避免因无效的首次导航而设置两次监听器
    if (removeHistoryListener) return

    removeHistoryListener = routerHistory.listen((to, _from, info) => {
      // 如果 router 已停止监听，忽略事件
      if (!router.listening) return

      // 解析目标位置
      const toLocation = resolve(to) as RouteLocationNormalized

      // 处理可能的重定向记录
      // 这可能发生在动态路由或 hash history 手动导航时
      //（手动更改 url 或调用 history.hash = '#/somewhere'）
      const shouldRedirect = handleRedirectRecord(
        toLocation,
        router.currentRoute.value
      )
      if (shouldRedirect) {
        pushWithRedirect(
          assign(shouldRedirect, { replace: true, force: true }),
          toLocation
        ).catch(noop)
        return
      }

      pendingLocation = toLocation
      const from = currentRoute.value

      // ============================================
      // 保存滚动位置
      // ============================================
      // TODO: 应该移到 web history 模块
      if (isBrowser) {
        saveScrollPosition(
          getScrollKey(from.fullPath, info.delta),
          computeScrollPosition()
        )
      }

      // 执行导航
      navigate(toLocation, from)
        .catch((error: NavigationFailure | NavigationRedirectError) => {
          // ============================================
          // 处理导航中止/取消
          // ============================================
          if (
            isNavigationFailure(
              error,
              ErrorTypes.NAVIGATION_ABORTED | ErrorTypes.NAVIGATION_CANCELLED
            )
          ) {
            return error
          }

          // ============================================
          // 处理导航重定向
          // ============================================
          if (
            isNavigationFailure(error, ErrorTypes.NAVIGATION_GUARD_REDIRECT)
          ) {
            // 这里本可以调用 routerHistory.go(-info.delta, false)
            // 但这容易出问题，因为没有办法等待 pushWithRedirect 完成
            // 使用 setTimeout(16ms) 似乎可行，但不能保证所有浏览器都有效
            // 所以不恢复历史条目，而是触发新的导航

            // 错误已经在 router.push 中处理，避免重复记录
            pushWithRedirect(
              assign(locationAsObject((error as NavigationRedirectError).to), {
                force: true,
              }),
              toLocation
            )
              .then(failure => {
                // hash history 手动导航 #916 导致 URL 不变但实际改变了
                // 需要手动回退
                if (
                  isNavigationFailure(
                    failure,
                    ErrorTypes.NAVIGATION_ABORTED |
                      ErrorTypes.NAVIGATION_DUPLICATED
                  ) &&
                  !info.delta &&
                  info.type === NavigationType.pop
                ) {
                  routerHistory.go(-1, false)
                }
              })
              .catch(noop)
            // 避免进入 then 分支
            return Promise.reject()
          }

          // 未知方向时不恢复历史
          if (info.delta) {
            routerHistory.go(-info.delta, false)
          }
          // 转移错误到全局处理
          return triggerError(error, toLocation, from)
        })
        .then((failure: NavigationFailure | void) => {
          failure =
            failure ||
            finalizeNavigation(
              // 导航后，所有匹配的组件都已解析
              toLocation as RouteLocationNormalizedLoaded,
              from,
              false
            )

          // 回退导航
          if (failure) {
            if (
              info.delta &&
              // 新导航已触发，不想回退，因为这会在显示不同路由时改变当前历史条目
              !isNavigationFailure(failure, ErrorTypes.NAVIGATION_CANCELLED)
            ) {
              routerHistory.go(-info.delta, false)
            } else if (
              info.type === NavigationType.pop &&
              isNavigationFailure(
                failure,
                ErrorTypes.NAVIGATION_ABORTED | ErrorTypes.NAVIGATION_DUPLICATED
              )
            ) {
              // hash history 手动导航 #916
              // 这像 push 但缺少方向信息
              routerHistory.go(-1, false)
            }
          }

          // 触发后置守卫
          triggerAfterEach(
            toLocation as RouteLocationNormalizedLoaded,
            from,
            failure
          )
        })
        // 避免控制台出现未捕获的 rejected 警告
        // 它们由 triggerErrors 记录
        .catch(noop)
    })
  }

  // ============================================
  // 13. 初始化与错误处理
  // ============================================

  let readyHandlers = useCallbacks<_OnReadyCallback>()
  let errorListeners = useCallbacks<_ErrorListener>()
  let ready: boolean

  /**
   * 触发错误监听器并抛出错误
   *
   * @param error - 要抛出的错误
   * @param to - 导航目标位置
   * @param from - 导航源位置
   * @returns rejected Promise
   */
  function triggerError(
    error: any,
    to: RouteLocationNormalized,
    from: RouteLocationNormalizedLoaded
  ): Promise<unknown> {
    markAsReady(error)

    // 调用已注册的错误监听器
    const list = errorListeners.list()
    if (list.length) {
      list.forEach(handler => handler(error, to, from))
    } else {
      // 无监听器时输出到控制台
      if (__DEV__) {
        warn('uncaught error during route navigation:')
      }
      console.error(error)
    }

    // 无论如何都 reject 错误
    return Promise.reject(error)
  }

  /**
   * 返回 Promise，表示路由是否就绪
   *
   * @returns Promise<void>
   *
   * @remarks
   * 当路由完成初始导航后 resolved。
   * 可用于 SSR 等待路由就绪。
   *
   * @example
   * ```typescript
   * await router.isReady()
   * ```
   */
  function isReady(): Promise<void> {
    if (ready && currentRoute.value !== START_LOCATION_NORMALIZED)
      return Promise.resolve()
    return new Promise((resolve, reject) => {
      readyHandlers.add([resolve, reject])
    })
  }

  /**
   * 标记路由为就绪状态
   *
   * @remarks
   * 这是内部方法，用于标记路由初始化完成。
   * 只能调用一次，后续调用无效。
   *
   * @param err - 可选的错误
   */
  function markAsReady<E = any>(err: E): E
  function markAsReady<_E = any>(): void
  function markAsReady<E = any>(err?: E): E | void {
    if (!ready) {
      // 如果发生错误，仍未就绪
      ready = !err

      // 设置历史监听器
      setupListeners()

      // 解析所有待处理的 ready 回调
      readyHandlers
        .list()
        .forEach(([resolve, reject]) => (err ? reject(err) : resolve()))

      // 重置处理器
      readyHandlers.reset()
    }
    return err
  }

  // ============================================
  // 14. 滚动行为处理
  // ============================================

  /**
   * 处理滚动行为
   *
   * @remarks
   * 滚动行为控制用户导航到新路由时页面的滚动位置。
   * 支持：
   * - 保存滚动位置（用于后退/前进）
   * - 恢复滚动位置
   * - 自定义滚动行为（用户提供的 scrollBehavior）
   *
   * @param to - 目标路由
   * @param from - 源路由
   * @param isPush - 是否是 push 操作
   * @param isFirstNavigation - 是否是首次导航
   */
  function handleScroll(
    to: RouteLocationNormalizedLoaded,
    from: RouteLocationNormalizedLoaded,
    isPush: boolean,
    isFirstNavigation: boolean
  ): Promise<unknown> {
    const { scrollBehavior } = options
    // 非浏览器环境或未提供 scrollBehavior，直接返回
    if (!isBrowser || !scrollBehavior) return Promise.resolve()

    // 获取滚动位置
    // 优先级：
    // 1. 后退/前进导航时保存的位置
    // 2. 首次导航或非 push 时从 history.state 恢复
    // 3. 默认 null
    const scrollPosition: _ScrollPositionNormalized | null =
      (!isPush && getSavedScrollPosition(getScrollKey(to.fullPath, 0))) ||
      ((isFirstNavigation || !isPush) &&
        (history.state as HistoryState) &&
        history.state.scroll) ||
      null

    // 等待 DOM 更新后执行滚动行为
    return nextTick()
      .then(() => scrollBehavior(to, from, scrollPosition))
      .then(position => position && scrollToPosition(position))
      .catch(err => triggerError(err, to, from))
  }

  // ============================================
  // 15. 历史控制
  // ============================================

  const go = (delta: number) => routerHistory.go(delta)

  // ============================================
  // 16. 安装状态跟踪
  // ============================================

  let started: boolean | undefined
  const installedApps = new Set<App>()

  // ============================================
  // 17. Router 实例对象
  // ============================================

  const router = {
    // 当前路由（响应式）
    currentRoute,
    // 是否监听历史变化
    listening: true,

    // 路由管理
    addRoute,
    removeRoute,
    clearRoutes: matcher.clearRoutes,
    hasRoute,
    getRoutes,
    resolve,
    options,

    // 导航方法
    push,
    replace,
    go,
    back: () => go(-1),
    forward: () => go(1),

    // 导航守卫
    beforeEach: beforeGuards.add,
    beforeResolve: beforeResolveGuards.add,
    afterEach: afterGuards.add,

    // 错误处理
    onError: errorListeners.add,
    isReady,

    /**
     * 安装 Router 到 Vue 应用
     *
     * @param app - Vue 应用实例
     */
    install(app: App) {
      // ============================================
      // 注册全局组件
      // ============================================
      app.component('RouterLink', RouterLink)
      app.component('RouterView', RouterView)

      // ============================================
      // 注入 $router 和 $route
      // ============================================
      // $router: Router 实例，提供导航方法
      app.config.globalProperties.$router = router as Router

      // $route: 当前路由位置（响应式）
      // 使用 Object.defineProperty 确保是响应式的
      Object.defineProperty(app.config.globalProperties, '$route', {
        enumerable: true,
        get: () => unref(currentRoute),
      })

      // ============================================
      // 触发首次导航（仅客户端）
      // ============================================
      // 在服务端渲染时不需要，因为会产生额外不必要的导航
      if (
        isBrowser &&
        // 用于避免在多个应用中使用路由时多次 push
        !started &&
        // 确保是初始位置
        currentRoute.value === START_LOCATION_NORMALIZED
      ) {
        started = true
        push(routerHistory.location).catch(err => {
          if (__DEV__) warn('Unexpected error when starting the router:', err)
        })
      }

      // ============================================
      // 创建响应式路由对象
      // ============================================
      // 这是 $route 的实际实现
      // 使用 Object.defineProperty 代理到 currentRoute
      const reactiveRoute = {} as RouteLocationNormalizedLoaded
      for (const key in START_LOCATION_NORMALIZED) {
        Object.defineProperty(reactiveRoute, key, {
          get: () => currentRoute.value[key as keyof RouteLocationNormalized],
          enumerable: true,
        })
      }

      // ============================================
      // 提供响应式注入
      // ============================================
      // 这些注入供 RouterLink、RouterView 以及用户使用
      app.provide(routerKey, router as Router)
      app.provide(routeLocationKey, shallowReactive(reactiveRoute))
      app.provide(routerViewLocationKey, currentRoute)

      // ============================================
      // 跟踪安装的应用
      // ============================================
      const unmountApp = app.unmount
      installedApps.add(app)

      // ============================================
      // 处理应用卸载
      // ============================================
      app.unmount = function () {
        installedApps.delete(app)

        // 当没有应用再使用路由时清理
        if (installedApps.size < 1) {
          // 使当前导航失效
          pendingLocation = START_LOCATION_NORMALIZED
          // 移除历史监听器
          removeHistoryListener && removeHistoryListener()
          removeHistoryListener = null
          // 重置状态
          currentRoute.value = START_LOCATION_NORMALIZED
          started = false
          ready = false
        }

        // 调用原始的 unmount
        unmountApp()
      }

      // ============================================
      // DevTools 集成
      // ============================================
      if (
        (__DEV__ || __FEATURE_PROD_DEVTOOLS__) &&
        isBrowser &&
        !__STRIP_DEVTOOLS__
      ) {
        addDevtools(app, router as Router, matcher)
      }
    },
  } satisfies Pick<Router, Extract<keyof Router, string>>

  /**
   * 执行守卫队列
   *
   * @remarks
   * 这是一个辅助函数，使用 reduce 累积执行守卫队列。
   * 每个守卫都是返回 Promise 的函数，前一个 Promise 完成后执行下一个。
   *
   * @param guards - 守卫函数数组
   */
  function runGuardQueue(guards: Lazy<any>[]): Promise<any> {
    return guards.reduce(
      (promise, guard) => promise.then(() => runWithContext(guard)),
      Promise.resolve()
    )
  }

  // ============================================
  // 返回 Router 实例
  // ============================================

  return router as Router
}