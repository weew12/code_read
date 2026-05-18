/**
 * 路由记录匹配器
 * =================
 *
 * 本模块创建单个路由记录的匹配器实例，将路径正则和解析逻辑封装在一起。
 *
 * 核心功能：
 * - 将路由路径转换为可匹配的正则表达式
 * - 提供路径解析（parse）和字符串化（stringify）能力
 * - 管理路由匹配器的关系（parent/children/alias）
 */

import type { RouteRecord } from './types'
import type { PathParser, PathParserOptions } from './pathParserRanker'
import { tokensToParser } from './pathParserRanker'
import { tokenizePath } from './pathTokenizer'
import { warn } from '../warning'
import { assign } from '../utils'

/**
 * 路由记录匹配器接口
 *
 * @remarks
 * 继承 PathParser，扩展了路由记录的关联信息。
 * 每个路由记录对应一个匹配器实例，管理该路由的所有匹配逻辑。
 */
export interface RouteRecordMatcher extends PathParser {
  /** 对应的路由记录 */
  record: RouteRecord

  /** 父匹配器（嵌套路由） */
  parent: RouteRecordMatcher | undefined

  /** 子匹配器数组 */
  children: RouteRecordMatcher[]

  /** 别名匹配器数组（移除时需要一并移除） */
  alias: RouteRecordMatcher[]
}

/**
 * 创建路由记录匹配器
 *
 * @remarks
 * 这是创建单个路由匹配器的工厂函数。
 * 核心步骤：
 * 1. 将路径字符串 tokenize 为 token 数组
 * 2. 将 tokens 转换为可执行的 parser（包含正则表达式）
 * 3. 创建匹配器实例并建立亲子关系
 *
 * @param record - 路由记录（标准化后）
 * @param parent - 父匹配器（可选）
 * @param options - 路径解析选项
 * @returns 路由记录匹配器实例
 *
 * @example
 * ```typescript
 * const matcher = createRouteRecordMatcher(normalizedRecord, parentMatcher, {
 *   strict: true,
 *   sensitive: false
 * })
 * // matcher.re: RegExp - 用于匹配路径
 * // matcher.parse(path): params - 解析路径获取参数
 * // matcher.stringify(params): path - 从参数生成路径
 * ```
 */
export function createRouteRecordMatcher(
  record: Readonly<RouteRecord>,
  parent: RouteRecordMatcher | undefined,
  options?: PathParserOptions
): RouteRecordMatcher {
  /**
   * 创建路径解析器
   *
   * @remarks
   * tokenizePath 将路径拆分为 tokens，然后 tokensToParser 将 tokens 编译为：
   * - re: RegExp - 用于匹配路径
   * - keys: Array<{name, optional, repeatable}> - 参数键信息
   * - parse: (path) => params - 解析函数
   * - stringify: (params) => path - 字符串化函数
   */
  const parser = tokensToParser(tokenizePath(record.path), options)

  /**
   * 开发环境检查：重复参数名
   *
   * @remarks
   * 同一路径中不允许有同名参数，后者会覆盖前者。
   */
  if (__DEV__) {
    const existingKeys = new Set<string>()
    for (const key of parser.keys) {
      if (existingKeys.has(key.name))
        warn(
          `Found duplicated params with name "${key.name}" for path "${record.path}". Only the last one will be available on "$route.params".`
        )
      existingKeys.add(key.name)
    }
  }

  /**
   * 构建匹配器对象
   *
   * @remarks
   * 将 parser 的解析能力与路由记录关联起来。
   */
  const matcher: RouteRecordMatcher = assign(parser, {
    record,
    parent,
    children: [],
    alias: [],
  })

  /**
   * 建立父子关系
   *
   * @remarks
   * 只有当两者的 aliasOf 状态一致时（都是原始记录或都是别名），
   * 才将其添加到父匹配器的 children 中。
   * 这是因为在 addRoute 中，别名记录的顺序很重要。
   */
  if (parent) {
    if (!matcher.record.aliasOf === !parent.record.aliasOf)
      parent.children.push(matcher)
  }

  return matcher
}