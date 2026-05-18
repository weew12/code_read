/**
 * Vue Router 位置解析模块
 * =========================
 *
 * 本模块负责 URL 的解析和字符串化，是路由系统的基础设施。
 *
 * 核心功能：
 *
 * 1. URL 解析 (parseURL)：
 *    - 将字符串路径解析为标准化对象
 *    - 分离 path、query、hash
 *    - 处理相对路径
 *
 * 2. URL 字符串化 (stringifyURL)：
 *    - 将路由对象组合为完整 URL 字符串
 *
 * 3. 相对路径解析 (resolveRelativePath)：
 *    - 处理以 . 或 .. 开头的相对路径
 *    - 支持 ../ 向上遍历
 *
 * 4. 路由比较 (isSameRouteLocation)：
 *    - 比较两个路由位置是否指向同一路由
 *    - 包括 params、query、hash 的比较
 */

import type { LocationQuery, LocationQueryRaw } from './query'
import type { RouteParamValue, RouteParamsGeneric } from './types'
import type { RouteRecord } from './matcher/types'
import { warn } from './warning'
import { isArray } from './utils'
import { decode, encodeHash } from './encoding'
import type {
  RouteLocation,
  RouteLocationNormalizedLoaded,
} from './typed-routes'

/**
 * parseURL 返回的标准化位置对象
 *
 * @remarks
 * 表示已解析的路由位置，包含 path、fullPath、query、hash。
 *
 * @internal
 */
export interface LocationNormalized {
  /** 路径部分（不含 query 和 hash） */
  path: string
  /** 完整路径（包含 query 和 hash） */
  fullPath: string
  /** hash 部分（不含 #） */
  hash: string
  /** 查询参数对象 */
  query: LocationQuery
}

/**
 * stringifyURL 接受的参数对象
 *
 * @internal
 */
interface LocationPartial {
  /** 路径 */
  path: string
  /** 查询参数（原始形式） */
  query?: LocationQueryRaw
  /** hash */
  hash?: string
}

/**
 * 去除尾部斜杠的正则
 *
 * @remarks
 * 用于 normalizePath 等功能，确保路径一致性
 */
const TRAILING_SLASH_RE = /\/$/

/**
 * 去除路径末尾的斜杠
 *
 * @param path - 原始路径
 * @returns 去除尾部斜杠的路径
 *
 * @example
 * ```typescript
 * removeTrailingSlash('/users/') // '/users'
 * removeTrailingSlash('/users') // '/users'
 * ```
 */
export const removeTrailingSlash = (path: string) =>
  path.replace(TRAILING_SLASH_RE, '')

/**
 * 将 URI 转换为标准化的历史位置
 *
 * @remarks
 * 这是 Vue Router 解析 URL 的核心函数。
 * 它执行以下操作：
 * 1. 分离 query 和 hash（通过 ? 和 # 的位置）
 * 2. 解析 query 参数
 * 3. 处理相对路径
 *
 * @param parseQuery - 查询字符串解析函数
 * @param location - 要解析的 URI
 * @param currentLocation - 当前绝对位置，用于解析相对路径。默认为 '/'
 * @returns 标准化后的位置对象
 *
 * @example
 * ```typescript
 * // 基本解析
 * parseURL(parseQuery, '/users/123?sort=name')
 * // => { path: '/users/123', fullPath: '/users/123?sort=name', query: { sort: 'name' }, hash: '' }
 *
 * // 带 hash
 * parseURL(parseQuery, '/users#profile')
 * // => { path: '/users', fullPath: '/users#profile', query: {}, hash: '#profile' }
 *
 * // 相对路径
 * parseURL(parseQuery, './sibling', '/parent/child')
 * // => { path: '/parent/sibling', ... }
 * ```
 */
export function parseURL(
  parseQuery: (search: string) => LocationQuery,
  location: string,
  currentLocation: string = '/'
): LocationNormalized {
  let path: string | undefined,
    query: LocationQuery = {},
    searchString = '',
    hash = ''

  // NOTE: 我们可以使用 URL 和 URLSearchParams，但它们比这个方法慢 2 到 5 倍
  // 查找 hash 和 query 的位置
  const hashPos = location.indexOf('#')
  let searchPos = location.indexOf('?')

  // 确保 ? 不作为 hash 的一部分
  // 例如 /foo#hash?query -> 没有 query
  searchPos = hashPos >= 0 && searchPos > hashPos ? -1 : searchPos

  // ============================================
  // 提取 query 部分
  // ============================================
  if (searchPos >= 0) {
    // 路径是 query 之前的部分
    path = location.slice(0, searchPos)
    // 保留 ? 字符
    searchString = location.slice(
      searchPos,
      // hashPos 在 query 段之后，所以如果 hashPos > 0 则使用 hashPos
      // 否则使用 location.length
      hashPos > 0 ? hashPos : location.length
    )

    // 解析 query 字符串
    query = parseQuery(
      // 移除前导 ?
      searchString.slice(1)
    )
  }

  // ============================================
  // 提取 hash 部分
  // ============================================
  if (hashPos >= 0) {
    // 路径是 hash 之前的部分
    path = path || location.slice(0, hashPos)
    // 保留 # 字符
    hash = location.slice(hashPos, location.length)
  }

  // ============================================
  // 处理相对路径
  // ============================================
  path = resolveRelativePath(
    // TODO(major): path ?? location
    path != null
      ? path
      : // 空路径表示相对 query 或 hash：`?foo=f`, `#thing`
        location,
    currentLocation
  )

  return {
    // 不能直接使用 location 参数，因为它可能是相对路径
    fullPath: path + searchString + hash,
    path,
    query,
    // hash 需要解码
    hash: decode(hash),
  }
}

/**
 * 从 path、query、hash 创建 fullPath
 *
 * @remarks
 * 新版本的 stringifyURL，使用模板字面量类型提供更精确的类型推断。
 *
 * @param stringifyQuery - 自定义查询字符串序列化函数
 * @param path - 编码后的路径
 * @param query - 解码后的查询对象
 * @param hash - 解码后的 hash
 * @returns 完整的 URL 字符串
 */
export function NEW_stringifyURL(
  stringifyQuery: (query?: LocationQueryRaw) => string,
  path: `/${string}`,
  query?: LocationPartial['query'],
  hash?: LocationPartial['hash']
): `/${string}`
export function NEW_stringifyURL(
  stringifyQuery: (query?: LocationQueryRaw) => string,
  path: string,
  query?: LocationPartial['query'],
  hash?: LocationPartial['hash']
): string
export function NEW_stringifyURL(
  stringifyQuery: (query?: LocationQueryRaw) => string,
  path: string,
  query?: LocationPartial['query'],
  hash: LocationPartial['hash'] = ''
): string {
  const searchText = stringifyQuery(query)
  return path + (searchText && '?') + searchText + encodeHash(hash)
}

/**
 * 将 URL 对象字符串化
 *
 * @remarks
 * 将路由对象的各个部分组合为完整的 URL 字符串。
 *
 * @param stringifyQuery - 查询字符串序列化函数
 * @param location - 包含 path、query、hash 的对象
 * @returns URL 字符串
 *
 * @example
 * ```typescript
 * stringifyURL(stringifyQuery, { path: '/users', query: { sort: 'name' }, hash: '' })
 * // => '/users?sort=name'
 * ```
 */
export function stringifyURL(
  stringifyQuery: (query: LocationQueryRaw) => string,
  location: LocationPartial
): string {
  const query: string = location.query ? stringifyQuery(location.query) : ''
  return location.path + (query && '?') + query + (location.hash || '')
}

/**
 * 从路径名开头去除 base
 *
 * @remarks
 * 以不区分大小写的方式去除路径开头的 base 前缀。
 * 如果 base 不存在或不在路径开头，返回原路径。
 *
 * @param pathname - 原始路径名
 * @param base - 要去除的 base
 * @returns 去除 base 后的路径
 *
 * @example
 * ```typescript
 * stripBase('/subfolder/users', '/subfolder') // '/users'
 * stripBase('/users', '/subfolder') // '/users'
 * ```
 */
export function stripBase(pathname: string, base: string): string {
  // 没有 base 或 base 不在开头
  if (!base || !pathname.toLowerCase().startsWith(base.toLowerCase()))
    return pathname
  return pathname.slice(base.length) || '/'
}

/**
 * 检查两个 RouteLocation 是否相同
 *
 * @remarks
 * 这意味着两个位置都指向同一个 RouteRecord，
 * 并且所有的 params、query 参数和 hash 都相同。
 *
 * @param stringifyQuery - 将 query 对象转换为字符串的函数
 * @param a - 第一个 RouteLocation
 * @param b - 第二个 RouteLocation
 * @returns 是否相同
 *
 * @example
 * ```typescript
 * // 比较两个路由位置
 * isSameRouteLocation(
 *   stringifyQuery,
 *   { path: '/users/123', query: {}, hash: '' },
 *   { path: '/users/123', query: {}, hash: '' }
 * )
 * // => true
 * ```
 */
export function isSameRouteLocation(
  stringifyQuery: (query: LocationQueryRaw) => string,
  a: RouteLocation,
  b: RouteLocation
): boolean {
  // 获取两个位置的最后一个匹配记录索引
  const aLastIndex = a.matched.length - 1
  const bLastIndex = b.matched.length - 1

  return (
    // 有匹配的路由记录
    aLastIndex > -1 &&
    // 匹配记录数量相同
    aLastIndex === bLastIndex &&
    // 最后一个路由记录相同（考虑别名）
    isSameRouteRecord(a.matched[aLastIndex], b.matched[bLastIndex]) &&
    // 参数相同
    isSameRouteLocationParams(a.params, b.params) &&
    // 查询字符串相同
    stringifyQuery(a.query) === stringifyQuery(b.query) &&
    // hash 相同
    a.hash === b.hash
  )
}

/**
 * 检查两个 RouteRecord 是否相同
 *
 * @remarks
 * 考虑别名：别名被认为是与原始记录相同的。
 *
 * 由于原始记录的 aliasOf 是 undefined，而所有别名都指向原始记录，
 * 这个比较总是会指向原始记录。
 *
 * @param a - 第一个 RouteRecord
 * @param b - 第二个 RouteRecord
 * @returns 是否相同
 */
export function isSameRouteRecord(a: RouteRecord, b: RouteRecord): boolean {
  // since the original record has an undefined value for aliasOf
  // but all aliases point to the original record, this will always compare
  // the original record
  return (a.aliasOf || a) === (b.aliasOf || b)
}

/**
 * 比较两组路由参数是否相同
 *
 * @param a - 第一组参数
 * @param b - 第二组参数
 * @returns 是否相同
 */
export function isSameRouteLocationParams(
  a: RouteParamsGeneric,
  b: RouteParamsGeneric
): boolean {
  // 检查键数量是否相同
  if (Object.keys(a).length !== Object.keys(b).length) return false

  // 检查每个键的值是否相同
  for (var key in a) {
    if (!isSameRouteLocationParamsValue(a[key], b[key])) return false
  }

  return true
}

/**
 * 比较两个参数值是否相同
 *
 * @remarks
 * 参数值可以是：
 * - 单个值（如字符串）
 * - 数组（可重复参数）
 *
 * @param a - 第一个值
 * @param b - 第二个值
 * @returns 是否相同
 */
function isSameRouteLocationParamsValue(
  a: RouteParamValue | readonly RouteParamValue[],
  b: RouteParamValue | readonly RouteParamValue[]
): boolean {
  return isArray(a)
    ? isEquivalentArray(a, b)
    : isArray(b)
      ? isEquivalentArray(b, a)
      : // TODO: 当我们目标是 ES2020 时更新为 ?.valueOf()
        (a && a.valueOf()) === (b && b.valueOf())
}

/**
 * 检查两个数组是否相同，或数组与单一值是否等效
 *
 * @remarks
 * 用于比较 query 参数和参数值。
 *
 * @example
 * ```typescript
 * // 数组比较
 * isEquivalentArray([1, 2], [1, 2]) // true
 * isEquivalentArray([1, 2], [1]) // false
 *
 * // 单值比较
 * isEquivalentArray([1], 1) // true
 * isEquivalentArray([1], 2) // false
 * ```
 */
function isEquivalentArray<T>(a: readonly T[], b: readonly T[] | T): boolean {
  return isArray(b)
    ? a.length === b.length && a.every((value, i) => value === b[i])
    : a.length === 1 && a[0] === b
}

/**
 * 解析以 . 开头的相对路径
 *
 * @remarks
 * 处理以下相对路径：
 * - `.` 或 `./` - 当前目录
 * - `..` 或 `../` - 父目录
 * - 相对路径（如 `../sibling`）
 *
 * 这是浏览器中 URL() 构造函数的相同行为。
 *
 * @param to - 要解析的路径
 * @param from - 当前路径（应该以 `/` 开头）
 * @returns 解析后的绝对路径
 *
 * @example
 * ```typescript
 * resolveRelativePath('../sibling', '/parent/child')
 * // => '/parent/sibling'
 *
 * resolveRelativePath('./grandchild', '/parent/child')
 * // => '/parent/child/grandchild'
 *
 * resolveRelativePath('.', '/parent/child')
 * // => '/parent/child'
 * ```
 */
export function resolveRelativePath(to: string, from: string): string {
  // 绝对路径直接返回
  if (to.startsWith('/')) return to

  // 开发环境验证
  if (__DEV__ && !from.startsWith('/')) {
    warn(
      `Cannot resolve a relative location without an absolute path. Trying to resolve "${to}" from "${from}". It should look like "/${from}".`
    )
    return to
  }

  // 空路径解析为当前路径
  // resolve to: '' with from: '/anything' -> '/anything'
  if (!to) return from

  // 分割路径为段
  const fromSegments = from.split('/')
  const toSegments = to.split('/')
  const lastToSegment: string | undefined = toSegments[toSegments.length - 1]

  // 让 .. 和 . 相同（../ === .., ../../ === ../..）
  // 这与 new URL() 的行为相同
  if (lastToSegment === '..' || lastToSegment === '.') {
    toSegments.push('')
  }

  let position = fromSegments.length - 1
  let toPosition: number
  let segment: string

  // ============================================
  // 处理相对路径段
  // ============================================
  for (toPosition = 0; toPosition < toSegments.length; toPosition++) {
    segment = toSegments[toPosition]

    // 保持在当前位置
    if (segment === '.') continue

    // 向上移动到父目录
    if (segment === '..') {
      // 不能低于零，但仍然需要增加 toPosition
      if (position > 1) position--
      // 继续
    }
    // 到达非相对路径，停止
    else break
  }

  // 组合结果路径
  return (
    fromSegments.slice(0, position).join('/') +
    '/' +
    toSegments.slice(toPosition).join('/')
  )
}

/**
 * 路由的初始位置
 *
 * @remarks
 * 可用于在导航守卫中区分首次导航。
 *
 * @example
 * ```typescript
 * import { START_LOCATION } from 'vue-router'
 *
 * router.beforeEach((to, from) => {
 *   if (from === START_LOCATION) {
 *     // 首次导航
 *   }
 * })
 * ```
 */
export const START_LOCATION_NORMALIZED: RouteLocationNormalizedLoaded = {
  path: '/',
  // TODO: 将来是否可以使用 symbol？
  name: undefined,
  params: {},
  query: {},
  hash: '',
  fullPath: '/',
  matched: [],
  meta: {},
  redirectedFrom: undefined,
}