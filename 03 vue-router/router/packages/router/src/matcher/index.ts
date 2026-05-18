/**
 * Vue Router 路由匹配器模块
 * ============================
 *
 * 本模块是 Vue Router 的核心路由匹配系统，负责：
 * 1. 管理所有路由记录（RouteRecordMatcher）
 * 2. 提供路由的添加、删除、查询操作
 * 3. 根据路径或名称解析路由位置
 * 4. 处理路由别名（alias）
 * 5. 计算路由优先级和插入顺序
 *
 * 核心数据结构：
 * - matchers: RouteRecordMatcher[] - 按优先级排序的匹配器数组
 * - matcherMap: Map<name, RouteRecordMatcher> - 按名称索引的映射
 *
 * 路由匹配流程：
 * 1. 用户调用 createRouterMatcher() 创建匹配器实例
 * 2. addRoute() 将路由记录标准化并插入 matchers 数组
 * 3. resolve() 根据 location（名称或路径）查找匹配的路由记录
 * 4. 返回包含 matched、params、name 等信息的 MatcherLocation
 */

import type {
  RouteRecordRaw,
  MatcherLocationRaw,
  MatcherLocation,
} from '../types'
import { isRouteName } from '../types'
import type { MatcherError } from '../errors'
import { createRouterError, ErrorTypes } from '../errors'
import type { RouteRecordMatcher } from './pathMatcher'
import { createRouteRecordMatcher } from './pathMatcher'
import type { RouteRecordNormalized } from './types'

import type {
  PathParams,
  PathParserOptions,
  _PathParserOptions,
} from './pathParserRanker'

import {
  comparePathParserScore,
  PATH_PARSER_OPTIONS_DEFAULTS,
} from './pathParserRanker'

import { warn } from '../warning'
import { assign, mergeOptions, noop } from '../utils'
import type { RouteRecordNameGeneric, _RouteRecordProps } from '../typed-routes'

/**
 * 内部路由匹配器接口
 *
 * @remarks
 * 路由匹配器负责管理所有路由记录并提供解析功能。
 * 它是 Vue Router 内部使用的核心接口，不对用户直接暴露。
 *
 * @example
 * ```typescript
 * const matcher = createRouterMatcher(routes, options)
 * const location = matcher.resolve({ name: 'user', params: { id: '123' }}, currentLocation)
 * ```
 */
export interface RouterMatcher {
  /**
   * 添加一条路由记录
   *
   * @param record - 要添加的路由记录
   * @param parent - 可选的父路由匹配器（用于嵌套路由）
   * @returns 一个函数，用于移除刚添加的路由
   */
  addRoute: (record: RouteRecordRaw, parent?: RouteRecordMatcher) => () => void

  /**
   * 根据匹配器或名称移除路由
   *
   * @param matcher - 要移除的匹配器或路由名称
   */
  removeRoute(matcher: RouteRecordMatcher): void
  removeRoute(name: NonNullable<RouteRecordNameGeneric>): void

  /** 移除所有路由 */
  clearRoutes: () => void

  /** 获取所有路由匹配器 */
  getRoutes: () => RouteRecordMatcher[]

  /**
   * 根据名称获取匹配器
   *
   * @param name - 路由名称
   * @returns 匹配器，不存在则返回 undefined
   */
  getRecordMatcher: (
    name: NonNullable<RouteRecordNameGeneric>
  ) => RouteRecordMatcher | undefined

  /**
   * 解析路由位置
   *
   * @param location - 要解析的路由位置（原始形式）
   * @param currentLocation - 当前路由位置
   * @returns 解析后的完整路由位置，包含 matched、params 等信息
   */
  resolve: (
    location: MatcherLocationRaw,
    currentLocation: MatcherLocation
  ) => MatcherLocation
}

/**
 * 创建路由匹配器
 *
 * @remarks
 * 这是 RouterMatcher 的工厂函数，创建并返回一个完整的路由匹配系统。
 *
 * 功能包括：
 * - 维护按优先级排序的 matchers 数组
 * - 维护按名称索引的 matcherMap
 * - 提供路由的 CRUD 操作
 * - 处理路由别名（alias）
 * - 支持嵌套路由
 *
 * 路由优先级规则（通过 binary search 插入）：
 * 1. 静态路径 > 动态路径 > 通配符路径
 * 2. 路径段数越多优先级越高
 * 3. 相同优先级时，子路由优先于父路由
 * 4. 平级时，新路由插入在旧路由之后
 *
 * @param routes - 初始路由配置数组
 * @param globalOptions - 全局路径解析选项（如是否忽略尾部斜杠）
 * @returns 路由匹配器实例
 *
 * @example
 * ```typescript
 * const matcher = createRouterMatcher([
 *   { path: '/', name: 'home', component: Home },
 *   { path: '/users/:id', name: 'user', component: User }
 * ], { strict: true })
 * ```
 */
export function createRouterMatcher(
  routes: Readonly<RouteRecordRaw[]>,
  globalOptions: PathParserOptions
): RouterMatcher {
  /**
   * 按优先级排序的匹配器数组
   *
   * @remarks
   * 使用 binary search 插入，保持有序。
   * 匹配时按顺序遍历，第一个匹配的就是目标路由。
   */
  const matchers: RouteRecordMatcher[] = []

  /**
   * 按名称索引的映射表
   *
   * @remarks
   * 仅存储原始路由（aliasOf 为 undefined），别名指向原始路由。
   */
  const matcherMap = new Map<
    NonNullable<RouteRecordNameGeneric>,
    RouteRecordMatcher
  >()

  /**
   * 合并全局配置和默认配置
   */
  globalOptions = mergeOptions<PathParserOptions>(
    PATH_PARSER_OPTIONS_DEFAULTS,
    globalOptions
  )

  /**
   * 根据名称获取匹配器
   *
   * @param name - 路由名称
   * @returns 匹配器实例
   */
  function getRecordMatcher(name: NonNullable<RouteRecordNameGeneric>) {
    return matcherMap.get(name)
  }

  /**
   * 添加路由记录
   *
   * @remarks
   * 这是路由匹配器最核心的方法之一，负责将用户定义的路由记录转换为内部表示。
   *
   * 处理流程：
   * 1. 标准化路由记录（normalizeRouteRecord）
   * 2. 处理别名（alias）
   * 3. 构建嵌套路由的完整路径
   * 4. 创建 RouteRecordMatcher 实例
   * 5. 处理子路由递归
   * 6. 插入匹配器数组（按优先级排序）
   *
   * @param record - 要添加的路由记录
   * @param parent - 可选的父匹配器（嵌套路由）
   * @param originalRecord - 原始记录（别名处理时使用）
   * @returns 移除函数
   */
  function addRoute(
    record: RouteRecordRaw,
    parent?: RouteRecordMatcher,
    originalRecord?: RouteRecordMatcher
  ) {
    // 记录是否为根级添加（非别名添加）
    const isRootAdd = !originalRecord
    const mainNormalizedRecord = normalizeRouteRecord(record)

    // 开发环境检查：子路由空路径且无名时的警告
    if (__DEV__) {
      checkChildMissingNameWithEmptyPath(mainNormalizedRecord, parent)
    }

    // 设置别名引用链
    mainNormalizedRecord.aliasOf = originalRecord && originalRecord.record

    // 合并路由特定选项
    const options: PathParserOptions = mergeOptions(globalOptions, record)

    // 创建规范化记录数组，支持多别名
    const normalizedRecords: RouteRecordNormalized[] = [mainNormalizedRecord]

    // 处理别名配置
    if ('alias' in record) {
      const aliases =
        typeof record.alias === 'string' ? [record.alias] : record.alias!
      for (const alias of aliases) {
        normalizedRecords.push(
          normalizeRouteRecord(
            assign({}, mainNormalizedRecord, {
              // 保留原始组件缓存
              components: originalRecord
                ? originalRecord.record.components
                : mainNormalizedRecord.components,
              path: alias,
              aliasOf: originalRecord
                ? originalRecord.record
                : mainNormalizedRecord,
            })
          )
        )
      }
    }

    let matcher: RouteRecordMatcher
    let originalMatcher: RouteRecordMatcher | undefined

    // 遍历每个规范化记录（包括主记录和别名）
    for (const normalizedRecord of normalizedRecords) {
      const { path } = normalizedRecord

      /**
       * 构建嵌套路由的完整路径
       *
       * @remarks
       * 如果子路由不是绝对路径（不以 / 开头），则需要拼接父路径。
       * 只有当父路径不以 / 结尾且子路径非空时，才添加 / 分隔符。
       *
       * @example
       * parent: '/users' + child: 'profile' => '/users/profile'
       * parent: '/users/' + child: 'profile' => '/users/profile'
       */
      if (parent && path[0] !== '/') {
        const parentPath = parent.record.path
        const connectingSlash =
          parentPath[parentPath.length - 1] === '/' ? '' : '/'
        normalizedRecord.path =
          parent.record.path + (path && connectingSlash + path)
      }

      // ============================================
      // 检查 catch all 路由（旧版 * 通配符）
      // ============================================
      if (__DEV__ && normalizedRecord.path === '*') {
        throw new Error(
          'Catch all routes ("*") must now be defined using a param with a custom regexp.\n' +
            'See more at https://router.vuejs.org/guide/migration/#Removed-star-or-catch-all-routes.'
        )
      }

      // 创建匹配器实例（预创建，以便传递给子路由）
      matcher = createRouteRecordMatcher(normalizedRecord, parent, options)

      // 检查绝对路径参数
      if (__DEV__ && parent && path[0] === '/')
        checkMissingParamsInAbsolutePath(matcher, parent)

      // 如果是别名，记录到原始匹配器的 alias 数组
      if (originalRecord) {
        originalRecord.alias.push(matcher)
        if (__DEV__) {
          checkSameParams(originalRecord, matcher)
        }
      } else {
        // 第一个记录是原始记录，其他是别名
        originalMatcher = originalMatcher || matcher
        if (originalMatcher !== matcher) originalMatcher.alias.push(matcher)

        // 根级添加时处理同名的移除
        if (isRootAdd && record.name && !isAliasRecord(matcher)) {
          if (__DEV__) {
            checkSameNameAsAncestor(record, parent)
          }
          removeRoute(record.name)
        }
      }

      /**
       * 只有可匹配的路由才能被插入
       *
       * @remarks
       * 可匹配 = 有 name 或 components 或 redirect。
       * 这允许传递无组件的路由记录作为中间层。
       */
      if (isMatchable(matcher)) {
        insertMatcher(matcher)
      }

      // 递归处理子路由
      if (mainNormalizedRecord.children) {
        const children = mainNormalizedRecord.children
        for (let i = 0; i < children.length; i++) {
          addRoute(
            children[i],
            matcher,
            originalRecord && originalRecord.children[i]
          )
        }
      }

      // 更新原始记录引用（用于别名添加子路由）
      originalRecord = originalRecord || matcher
    }

    // 返回移除函数（如果是别名则由原始匹配器处理）
    return originalMatcher
      ? () => {
          removeRoute(originalMatcher!)
        }
      : noop
  }

  /**
   * 移除路由
   *
   * @remarks
   * 支持两种移除方式：
   * 1. 按名称移除：同时移除 matcherMap 中的映射和 matchers 中的匹配器
   * 2. 按匹配器移除：直接移除该匹配器
   *
   * 注意：递归移除所有子路由和别名。
   *
   * @param matcherRef - 匹配器实例或路由名称
   */
  function removeRoute(
    matcherRef: NonNullable<RouteRecordNameGeneric> | RouteRecordMatcher
  ) {
    if (isRouteName(matcherRef)) {
      const matcher = matcherMap.get(matcherRef)
      if (matcher) {
        matcherMap.delete(matcherRef)
        matchers.splice(matchers.indexOf(matcher), 1)
        // 递归移除子路由和别名
        matcher.children.forEach(removeRoute)
        matcher.alias.forEach(removeRoute)
      }
    } else {
      const index = matchers.indexOf(matcherRef)
      if (index > -1) {
        matchers.splice(index, 1)
        if (matcherRef.record.name) matcherMap.delete(matcherRef.record.name)
        matcherRef.children.forEach(removeRoute)
        matcherRef.alias.forEach(removeRoute)
      }
    }
  }

  /** 获取所有路由匹配器 */
  function getRoutes() {
    return matchers
  }

  /**
   * 插入匹配器到数组
   *
   * @remarks
   * 使用 binary search 找到正确的插入位置，保持 matchers 按优先级排序。
   * 仅将原始记录（无名或非别名）添加到 matcherMap。
   *
   * @param matcher - 要插入的匹配器
   */
  function insertMatcher(matcher: RouteRecordMatcher) {
    const index = findInsertionIndex(matcher, matchers)
    matchers.splice(index, 0, matcher)
    // only add the original record to the name map
    if (matcher.record.name && !isAliasRecord(matcher))
      matcherMap.set(matcher.record.name, matcher)
  }

  /**
   * 解析路由位置
   *
   * @remarks
   * 根据 location（可以是名称、路径或相对位置）解析出完整的路由信息。
   *
   * 解析策略：
   * 1. 有 name：直接从 matcherMap 查找
   * 2. 有 path：遍历 matchers 查找第一个匹配的正则表达式
   * 3. 两者都没有：基于 currentLocation 推断
   *
   * 返回值包含：
   * - name: 路由名称
   * - path: 完整路径
   * - params: 从 URL 解析的参数
   * - matched: 匹配的路由记录链（用于嵌套路由）
   * - meta: 合并后的 meta 字段
   *
   * @param location - 要解析的原始路由位置
   * @param currentLocation - 当前路由位置（用于相对路径解析）
   * @returns 解析后的路由位置
   */
  function resolve(
    location: Readonly<MatcherLocationRaw>,
    currentLocation: Readonly<MatcherLocation>
  ): MatcherLocation {
    let matcher: RouteRecordMatcher | undefined
    let params: PathParams = {}
    let path: MatcherLocation['path']
    let name: MatcherLocation['name']

    /**
     * 按名称解析
     *
     * @remarks
     * 直接从 matcherMap 查找，速度最快。
     * 会验证 params 是否有效（开发环境警告无效参数）。
     * 参数处理策略：
     * 1. 保留来自 currentLocation 的参数（仅保留当前路由存在的参数）
     * 2. 合并 location.params（仅保留目标路由定义的参数）
     */
    if ('name' in location && location.name) {
      matcher = matcherMap.get(location.name)

      if (!matcher)
        throw createRouterError<MatcherError>(ErrorTypes.MATCHER_NOT_FOUND, {
          location,
        })

      // 开发环境验证参数的合法性
      if (__DEV__) {
        const invalidParams: string[] = Object.keys(
          location.params || {}
        ).filter(paramName => !matcher!.keys.find(k => k.name === paramName))

        if (invalidParams.length) {
          warn(
            `Discarded invalid param(s) "${invalidParams.join(
              '", "'
            )}" when navigating. See https://github.com/vuejs/router/blob/main/packages/router/CHANGELOG.md#414-2022-08-22 for more details.`
          )
        }
      }

      name = matcher.record.name
      params = assign(
        // 从当前位置提取参数（仅保留可选参数和父路由参数）
        pickParams(
          currentLocation.params,
          matcher.keys
            .filter(k => !k.optional)
            .concat(
              matcher.parent ? matcher.parent.keys.filter(k => k.optional) : []
            )
            .map(k => k.name)
        ),
        // 合并目标路由参数（仅保留目标定义的参数）
        location.params &&
          pickParams(
            location.params,
            matcher.keys.map(k => k.name)
          )
      )
      // 生成路径字符串
      path = matcher.stringify(params)

      /**
       * 按路径解析
       *
       * @remarks
       * 遍历 matchers 数组，找到第一个匹配的路由记录。
       * 使用预编译的正则表达式进行匹配。
       */
    } else if (location.path != null) {
      path = location.path

      if (__DEV__ && !path.startsWith('/')) {
        warn(
          `The Matcher cannot resolve relative paths but received "${path}". Unless you directly called \`matcher.resolve("${path}")\`, this is probably a bug in vue-router. Please open an issue at https://github.com/vuejs/router/issues/new/choose.`
        )
      }

      matcher = matchers.find(m => m.re.test(path))

      if (matcher) {
        params = matcher.parse(path)!
        name = matcher.record.name
      }

      /**
       * 相对路径解析
       *
       * @remarks
       * 当 location 既没有 name 也没有 path 时，
       * 基于 currentLocation 推断目标路由。
       */
    } else {
      // 从当前路由的名称或路径推断目标
      matcher = currentLocation.name
        ? matcherMap.get(currentLocation.name)
        : matchers.find(m => m.re.test(currentLocation.path))
      if (!matcher)
        throw createRouterError<MatcherError>(ErrorTypes.MATCHER_NOT_FOUND, {
          location,
          currentLocation,
        })
      name = matcher.record.name
      // 保留当前参数并合并新参数
      params = assign({}, currentLocation.params, location.params)
      path = matcher.stringify(params)
    }

    /**
     * 构建匹配路由链
     *
     * @remarks
     * 从当前匹配器向上遍历到根，构建 matched 数组。
     * 使用 unshift 将父路由添加到数组开头，保证顺序正确（父在前）。
     */
    const matched: MatcherLocation['matched'] = []
    let parentMatcher: RouteRecordMatcher | undefined = matcher
    while (parentMatcher) {
      matched.unshift(parentMatcher.record)
      parentMatcher = parentMatcher.parent
    }

    return {
      name,
      path,
      params,
      matched,
      meta: mergeMetaFields(matched),
    }
  }

    // 添加初始路由
    routes.forEach(route => addRoute(route))

    /** 清空所有路由 */
    function clearRoutes() {
      matchers.length = 0
      matcherMap.clear()
    }

    return {
      addRoute,
      resolve,
      removeRoute,
      clearRoutes,
      getRoutes,
      getRecordMatcher,
    }
  }

/**
 * 从参数对象中提取指定键
 *
 * @param params - 源参数对象
 * @param keys - 要提取的键名数组
 * @returns 只包含指定键的新参数对象
 *
 * @example
 * ```typescript
 * pickParams({ id: '1', name: 'John', extra: 'x' }, ['id', 'name'])
 * // => { id: '1', name: 'John' }
 * ```
 */
function pickParams(
  params: MatcherLocation['params'],
  keys: string[]
): MatcherLocation['params'] {
  const newParams = {} as MatcherLocation['params']

  for (const key of keys) {
    if (key in params) newParams[key] = params[key]
  }

  return newParams
}

/**
 * 标准化路由记录
 *
 * @remarks
 * 将用户定义的 RouteRecordRaw 转换为内部使用的 RouteRecordNormalized。
 * 创建深拷贝并添加内部字段（如 instances、guards 等）。
 *
 * 注意：mods 属性被定义为不可枚举，用于高级用例（如数据加载器）。
 *
 * @param record - 原始路由记录
 * @returns 标准化后的路由记录
 */
export function normalizeRouteRecord(
  record: RouteRecordRaw & { aliasOf?: RouteRecordNormalized }
): RouteRecordNormalized {
  const normalized: Omit<RouteRecordNormalized, 'mods'> = {
    path: record.path,
    redirect: record.redirect,
    name: record.name,
    meta: record.meta || {},
    aliasOf: record.aliasOf,
    beforeEnter: record.beforeEnter,
    props: normalizeRecordProps(record),
    children: record.children || [],
    instances: {},
    leaveGuards: new Set(),
    updateGuards: new Set(),
    enterCallbacks: {},
    components:
      'components' in record
        ? record.components || null
        : record.component && { default: record.component },
  }

  // mods 包含模块，仅供内部高级用例使用
  Object.defineProperty(normalized, 'mods', {
    value: {},
  })

  return normalized as RouteRecordNormalized
}

/**
 * 标准化路由的 props 配置
 *
 * @remarks
 * 将 props 统一转换为对象形式，与 components 对应。
 *
 * 支持的形式：
 * - boolean: 所有组件使用相同的 props
 * - object: 每个组件使用不同的 props
 * - undefined/false: 没有 props
 *
 * @param record - 路由记录
 * @returns 以组件名为键的对象
 */
export function normalizeRecordProps(
  record: RouteRecordRaw
): Record<string, _RouteRecordProps> {
  const propsObject = {} as Record<string, _RouteRecordProps>
  const props = record.props || false
  if ('component' in record) {
    propsObject.default = props
  } else {
    for (const name in record.components)
      propsObject[name] = typeof props === 'object' ? props[name] : props
  }

  return propsObject
}

/**
 * 检查匹配器是否是别名
 *
 * @remarks
 * 通过向上遍历父链，检查是否存在 aliasOf 引用。
 * 如果存在，说明当前匹配器是某个路由的别名。
 *
 * @param record - 要检查的匹配器
 * @returns 是否为别名
 */
function isAliasRecord(record: RouteRecordMatcher | undefined): boolean {
  while (record) {
    if (record.record.aliasOf) return true
    record = record.parent
  }

  return false
}

/**
 * 合并匹配路由的 meta 字段
 *
 * @remarks
 * 从父到子遍历，将所有 meta 字段合并为一个对象。
 * 后面的路由的 meta 会覆盖前面的。
 *
 * @param matched - 匹配的路由记录数组
 * @returns 合并后的 meta 对象
 */
function mergeMetaFields(matched: MatcherLocation['matched']) {
  return matched.reduce(
    (meta, record) => assign(meta, record.meta),
    {} as MatcherLocation['meta']
  )
}

type ParamKey = RouteRecordMatcher['keys'][number]

/**
 * 比较两个参数键是否相同
 */
function isSameParam(a: ParamKey, b: ParamKey): boolean {
  return (
    a.name === b.name &&
    a.optional === b.optional &&
    a.repeatable === b.repeatable
  )
}

/**
 * 检查别名与原始路由是否有相同的必需参数
 *
 * @remarks
 * 别名必须与原始路由有完全相同的必需参数定义。
 * 这是因为别名和原始路由共享同一个路径正则表达式。
 */
function checkSameParams(a: RouteRecordMatcher, b: RouteRecordMatcher) {
  for (const key of a.keys) {
    if (!key.optional && !b.keys.find(isSameParam.bind(null, key)))
      return warn(
        `Alias "${b.record.path}" and the original record: "${a.record.path}" must have the exact same param named "${key.name}"`
      )
  }
  for (const key of b.keys) {
    if (!key.optional && !a.keys.find(isSameParam.bind(null, key)))
      return warn(
        `Alias "${b.record.path}" and the original record: "${a.record.path}" must have the exact same param named "${key.name}"`
      )
  }
}

/**
 * 检查子路由空路径且无名的情况
 *
 * @remarks
 * 如果父路由有名称，子路由是空路径且没有名称和子路由，
 * 这通常是一个错误配置。
 */
export function checkChildMissingNameWithEmptyPath(
  mainNormalizedRecord: RouteRecordNormalized,
  parent?: RouteRecordMatcher
) {
  if (
    parent &&
    parent.record.name &&
    !mainNormalizedRecord.name &&
    !mainNormalizedRecord.path &&
    mainNormalizedRecord.children.length === 0
  ) {
    warn(
      `The route named "${String(
        parent.record.name
      )}" has a child without a name, an empty path, and no children. This is probably a mistake: using that name won't render the empty path child so you probably want to move the name to the child instead. If this is intentional, add a name to the child route to silence the warning.`
    )
  }
}

/**
 * 检查路由名称是否与祖先路由冲突
 */
function checkSameNameAsAncestor(
  record: RouteRecordRaw,
  parent?: RouteRecordMatcher
) {
  for (let ancestor = parent; ancestor; ancestor = ancestor.parent) {
    if (ancestor.record.name === record.name) {
      throw new Error(
        `A route named "${String(record.name)}" has been added as a ${
          parent === ancestor ? 'child' : 'descendant'
        } of a route with the same name. Route names must be unique and a nested route cannot use the same name as an ancestor.`
      )
    }
  }
}

/**
 * 检查绝对路径路由是否缺少父路由的必需参数
 */
function checkMissingParamsInAbsolutePath(
  record: RouteRecordMatcher,
  parent: RouteRecordMatcher
) {
  for (const key of parent.keys) {
    if (!record.keys.find(isSameParam.bind(null, key)))
      return warn(
        `Absolute path "${record.record.path}" must have the exact same param named "${key.name}" as its parent "${parent.record.path}".`
      )
  }
}

/**
 * 二分查找插入位置
 *
 * @remarks
 * 路由按优先级排序，插入时需要找到正确的位置。
 *
 * 排序规则：
 * 1. 首先按分数（score）排序，分数高的在前
 * 2. 分数相同时，优先插入到祖先后代之后（descendants after ancestors）
 * 3. 仍然相同则插入到现有路由之后
 *
 * @param matcher - 要插入的匹配器
 * @param matchers - 现有的匹配器数组
 * @returns 插入位置索引
 */
function findInsertionIndex(
  matcher: RouteRecordMatcher,
  matchers: RouteRecordMatcher[]
) {
  // 第一阶段：基于分数的二分查找
  let lower = 0
  let upper = matchers.length

  while (lower !== upper) {
    const mid = (lower + upper) >> 1
    const sortOrder = comparePathParserScore(matcher, matchers[mid])

    if (sortOrder < 0) {
      upper = mid
    } else {
      lower = mid + 1
    }
  }

  // 第二阶段：检查是否有相同分数的祖先
  const insertionAncestor = getInsertionAncestor(matcher)

  if (insertionAncestor) {
    upper = matchers.lastIndexOf(insertionAncestor, upper - 1)

    if (__DEV__ && upper < 0) {
      warn(
        `Finding ancestor route "${insertionAncestor.record.path}" failed for "${matcher.record.path}"`
      )
    }
  }

  return upper
}

/**
 * 查找与目标匹配器有相同分数的祖先匹配器
 */
function getInsertionAncestor(matcher: RouteRecordMatcher) {
  let ancestor: RouteRecordMatcher | undefined = matcher

  while ((ancestor = ancestor.parent)) {
    if (
      isMatchable(ancestor) &&
      comparePathParserScore(matcher, ancestor) === 0
    ) {
      return ancestor
    }
  }
}

/**
 * 检查匹配器是否可匹配
 *
 * @remarks
 * 可匹配的路由必须有 name、components 或 redirect。
 * 没有这些属性的路由只能作为中间层（用于分组），不能作为最终路由。
 */
function isMatchable({ record }: RouteRecordMatcher): boolean {
  return !!(
    record.name ||
    (record.components && Object.keys(record.components).length) ||
    record.redirect
  )
}

/**
 * Check if a path and its alias have the same required params
 *
 * @param a - original record
 * @param b - alias record
 */
function checkSameParams(a: RouteRecordMatcher, b: RouteRecordMatcher) {
  for (const key of a.keys) {
    if (!key.optional && !b.keys.find(isSameParam.bind(null, key)))
      return warn(
        `Alias "${b.record.path}" and the original record: "${a.record.path}" must have the exact same param named "${key.name}"`
      )
  }
  for (const key of b.keys) {
    if (!key.optional && !a.keys.find(isSameParam.bind(null, key)))
      return warn(
        `Alias "${b.record.path}" and the original record: "${a.record.path}" must have the exact same param named "${key.name}"`
      )
  }
}

/**
 * A route with a name and a child with an empty path without a name should warn when adding the route
 *
 * @param mainNormalizedRecord - RouteRecordNormalized
 * @param parent - RouteRecordMatcher
 */
export function checkChildMissingNameWithEmptyPath(
  mainNormalizedRecord: RouteRecordNormalized,
  parent?: RouteRecordMatcher
) {
  if (
    parent &&
    parent.record.name &&
    !mainNormalizedRecord.name &&
    !mainNormalizedRecord.path &&
    mainNormalizedRecord.children.length === 0
  ) {
    warn(
      `The route named "${String(
        parent.record.name
      )}" has a child without a name, an empty path, and no children. This is probably a mistake: using that name won't render the empty path child so you probably want to move the name to the child instead. If this is intentional, add a name to the child route to silence the warning.`
    )
  }
}

function checkSameNameAsAncestor(
  record: RouteRecordRaw,
  parent?: RouteRecordMatcher
) {
  for (let ancestor = parent; ancestor; ancestor = ancestor.parent) {
    if (ancestor.record.name === record.name) {
      throw new Error(
        `A route named "${String(record.name)}" has been added as a ${
          parent === ancestor ? 'child' : 'descendant'
        } of a route with the same name. Route names must be unique and a nested route cannot use the same name as an ancestor.`
      )
    }
  }
}

function checkMissingParamsInAbsolutePath(
  record: RouteRecordMatcher,
  parent: RouteRecordMatcher
) {
  for (const key of parent.keys) {
    if (!record.keys.find(isSameParam.bind(null, key)))
      return warn(
        `Absolute path "${record.record.path}" must have the exact same param named "${key.name}" as its parent "${parent.record.path}".`
      )
  }
}

/**
 * Performs a binary search to find the correct insertion index for a new matcher.
 *
 * Matchers are primarily sorted by their score. If scores are tied then we also consider parent/child relationships,
 * with descendants coming before ancestors. If there's still a tie, new routes are inserted after existing routes.
 *
 * @param matcher - new matcher to be inserted
 * @param matchers - existing matchers
 */
function findInsertionIndex(
  matcher: RouteRecordMatcher,
  matchers: RouteRecordMatcher[]
) {
  // First phase: binary search based on score
  let lower = 0
  let upper = matchers.length

  while (lower !== upper) {
    const mid = (lower + upper) >> 1
    const sortOrder = comparePathParserScore(matcher, matchers[mid])

    if (sortOrder < 0) {
      upper = mid
    } else {
      lower = mid + 1
    }
  }

  // Second phase: check for an ancestor with the same score
  const insertionAncestor = getInsertionAncestor(matcher)

  if (insertionAncestor) {
    upper = matchers.lastIndexOf(insertionAncestor, upper - 1)

    if (__DEV__ && upper < 0) {
      // This should never happen
      warn(
        `Finding ancestor route "${insertionAncestor.record.path}" failed for "${matcher.record.path}"`
      )
    }
  }

  return upper
}

function getInsertionAncestor(matcher: RouteRecordMatcher) {
  let ancestor: RouteRecordMatcher | undefined = matcher

  while ((ancestor = ancestor.parent)) {
    if (
      isMatchable(ancestor) &&
      comparePathParserScore(matcher, ancestor) === 0
    ) {
      return ancestor
    }
  }

  return
}

/**
 * Checks if a matcher can be reachable. This means if it's possible to reach it as a route. For example, routes without
 * a component, or name, or redirect, are just used to group other routes.
 * @param matcher
 * @param matcher.record record of the matcher
 * @returns
 */
function isMatchable({ record }: RouteRecordMatcher): boolean {
  return !!(
    record.name ||
    (record.components && Object.keys(record.components).length) ||
    record.redirect
  )
}

export type { PathParserOptions, _PathParserOptions }
