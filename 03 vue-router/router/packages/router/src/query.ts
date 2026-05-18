/**
 * Vue Router 查询参数处理模块
 * ==============================
 *
 * 本模块负责 URL 查询字符串的解析和序列化。
 *
 * 核心功能：
 * 1. parseQuery - 将查询字符串解析为对象
 * 2. stringifyQuery - 将查询对象序列化为字符串
 * 3. normalizeQuery - 标准化查询对象（类型转换）
 *
 * 查询值类型：
 * - string: 普通字符串值
 * - null: 有键无值（如 ?foo）
 * - LocationQueryValue[]: 同一键多个值
 */

import { decode, encodeQueryKey, encodeQueryValue, PLUS_RE } from './encoding'
import { isArray } from './utils'

/**
 * 标准化查询对象中的值类型
 *
 * @remarks
 * `null` 表示有键无值的情况（如 ?isNull）。
 * 不使用 undefined，因为那是用于表示"移除此键"。
 *
 * @example
 * ```
 * ?isNull&isEmpty=&other=other
 * 解析为：
 * { isNull: null, isEmpty: '', other: 'other' }
 * ```
 */
export type LocationQueryValue = string | null

/**
 * 定义查询参数时允许的值类型
 *
 * @remarks
 * - string: 普通字符串
 * - number: 数字，会被转换为字符串
 * - null: 有键无值
 * - undefined: 表示"移除此键"
 */
export type LocationQueryValueRaw = LocationQueryValue | number | undefined

/**
 * 标准化查询对象
 *
 * @remarks
 * 出现在 RouteLocationNormalized 中。
 * 值可以是单值或数组（多值查询参数）。
 */
export type LocationQuery = Record<
  string,
  LocationQueryValue | LocationQueryValue[]
>

/**
 * 宽松的查询对象类型
 *
 * @remarks
 * 可传递给 Router.push、Router.replace 或创建 RouteLocationRaw。
 * 键可以是字符串或数字。
 */
export type LocationQueryRaw = Record<
  string | number,
  LocationQueryValueRaw | LocationQueryValueRaw[]
>

/**
 * 解析查询字符串
 *
 * @remarks
 * 将 URL 查询字符串解析为 LocationQuery 对象。
 * 支持带 `?` 前缀或不带，支持 URLSearchParams 的行为。
 *
 * 解析规则：
 * - `&` 分隔键值对
 * - `=` 分隔键和值（无 `=` 时值为 null）
 * - `+` 会解码为空格（URLSearchParams 行为）
 * - 重复键会转换为数组
 *
 * @param search - 查询字符串（可以是 `?foo=1&bar=2` 或 `foo=1&bar=2`）
 * @returns 解析后的查询对象
 *
 * @example
 * ```typescript
 * parseQuery('?foo=bar&baz=1')
 * // => { foo: 'bar', baz: '1' }
 *
 * parseQuery('foo&bar=')
 * // => { foo: null, bar: '' }
 *
 * parseQuery('id=1&id=2&id=3')
 * // => { id: ['1', '2', '3'] }
 * ```
 */
export function parseQuery(search: string): LocationQuery {
  const query: LocationQuery = {}

  if (search === '' || search === '?') return query

  // 移除开头的 ? 并按 & 分割
  const searchParams = (search[0] === '?' ? search.slice(1) : search).split('&')

  for (let i = 0; i < searchParams.length; ++i) {
    // 将 + 替换为空格（URLSearchParams 兼容）
    const searchParam = searchParams[i].replace(PLUS_RE, ' ')

    // 查找 = 位置，分割键和值
    const eqPos = searchParam.indexOf('=')
    const key = decode(eqPos < 0 ? searchParam : searchParam.slice(0, eqPos))
    const value = eqPos < 0 ? null : decode(searchParam.slice(eqPos + 1))

    // 同一键的多个值转换为数组
    if (key in query) {
      let currentValue = query[key]
      if (!isArray(currentValue)) {
        currentValue = query[key] = [currentValue]
      }
      ;(currentValue as LocationQueryValue[]).push(value)
    } else {
      query[key] = value
    }
  }

  return query
}

/**
 * 序列化查询对象
 *
 * @remarks
 * 将 LocationQueryRaw 对象转换为查询字符串。
 * 不添加前导 `?`（与 URLSearchParams 一致）。
 *
 * 序列化规则：
 * - undefined 值会被跳过
 * - null 值只输出键名（无 `=`）
 * - 数组中的 undefined 会被跳过
 * - 值会被编码
 *
 * @param query - 查询对象
 * @returns 查询字符串（无前导 ?）
 *
 * @example
 * ```typescript
 * stringifyQuery({ foo: 'bar', baz: 1 })
 * // => 'foo=bar&baz=1'
 *
 * stringifyQuery({ id: ['1', '2'] })
 * // => 'id=1&id=2'
 *
 * stringifyQuery({ foo: null, bar: undefined })
 * // => 'foo'
 * ```
 */
export function stringifyQuery(query: LocationQueryRaw | undefined): string {
  let search = ''

  for (let key in query) {
    const value = query[key]
    key = encodeQueryKey(key)

    // null 值：只输出键名
    if (value == null) {
      if (value !== undefined) {
        search += (search.length ? '&' : '') + key
      }
      continue
    }

    // 统一为数组处理
    const values: LocationQueryValueRaw[] = isArray(value)
      ? value.map(v => v && encodeQueryValue(v))
      : [value && encodeQueryValue(value)]

    values.forEach(value => {
      // 跳过 undefined
      if (value !== undefined) {
        search += (search.length ? '&' : '') + key
        if (value != null) search += '=' + value
      }
    })
  }

  return search
}

/**
 * 标准化查询对象
 *
 * @remarks
 * 将 LocationQueryRaw 转换为 LocationQuery：
 * - 数字转换为字符串
 * - 移除 undefined 值
 * - 数组中的 undefined 替换为 null
 *
 * @param query - 原始查询对象
 * @returns 标准化后的查询对象
 *
 * @example
 * ```typescript
 * normalizeQuery({ id: 123, name: 'John', extra: undefined })
 * // => { id: '123', name: 'John' }
 * ```
 */
export function normalizeQuery(
  query: LocationQueryRaw | undefined
): LocationQuery {
  const normalizedQuery: LocationQuery = {}

  for (const key in query) {
    const value = query[key]
    if (value !== undefined) {
      normalizedQuery[key] = isArray(value)
        ? value.map(v => (v == null ? null : '' + v))
        : value == null
          ? value
          : '' + value
    }
  }

  return normalizedQuery
}