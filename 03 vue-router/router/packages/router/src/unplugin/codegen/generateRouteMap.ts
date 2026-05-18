/**
 * 路由名称映射生成器
 * ======================
 *
 * 本模块生成类型安全的路由名称映射（RouteNamedMap）和路由记录信息（RouteRecordInfo）。
 *
 * 输出示例：
 * ```typescript
 * export interface RouteNamedMap {
 *   'users': RouteRecordInfo<'users', '/users', { id: string }, { id: number }, []>,
 *   'users-id': RouteRecordInfo<'users-id', '/users/:id', { id: string }, { id: number }, ['users']>,
 * }
 * ```
 */

import type { TreeNode, TreeNodeNamed } from '../core/tree'
import type { ResolvedOptions } from '../options'
import type { ParamParsersMap } from './generateParamParsers'
import { generateParamsTypes } from './generateParamParsers'
import {
  EXPERIMENTAL_generateRouteParams,
  generateRouteParams,
} from './generateRouteParams'
import { pad, formatMultilineUnion, toStringLiteral } from '../utils'

/**
 * 生成 RouteNamedMap
 *
 * @remarks
 * 遍历路由树，生成所有命名路由的映射。
 */
export function generateRouteNamedMap(
  node: TreeNode,
  options: ResolvedOptions,
  paramParsersMap: ParamParsersMap
): string {
  if (node.isRoot()) {
    return `export interface RouteNamedMap {
${node
  .getChildrenSorted()
  .map(n => generateRouteNamedMap(n, options, paramParsersMap))
  .join('')}}`
  }

  return (
    // 有组件且命名的节点才添加到 RouteNamedMap
    (node.value.components.size && node.isNamed()
      ? pad(
          2,
          `${toStringLiteral(node.name)}: ${generateRouteRecordInfo(node, options, paramParsersMap)},\n`
        )
      : '') +
    (node.children.size > 0
      ? node
          .getChildrenSorted()
          .map(n => generateRouteNamedMap(n, options, paramParsersMap))
          .join('\n')
      : '')
  )
}

/**
 * 生成单个 RouteRecordInfo 类型
 *
 * @remarks
 * RouteRecordInfo 包含：名称、完整路径、路径参数类型、查询参数类型、子路由名称数组
 */
export function generateRouteRecordInfo(
  node: TreeNodeNamed,
  options: ResolvedOptions,
  paramParsersMap: ParamParsersMap
): string {
  let paramParsers: Array<string | null> = []
  if (options.experimental.paramParsers) {
    paramParsers = generateParamsTypes(node.params, paramParsersMap)
  }

  const typeParams = [
    toStringLiteral(node.name),
    toStringLiteral(node.fullPath),
    options.experimental.paramParsers
      ? EXPERIMENTAL_generateRouteParams(node, paramParsers, true)
      : generateRouteParams(node, true),
    options.experimental.paramParsers
      ? EXPERIMENTAL_generateRouteParams(node, paramParsers, false)
      : generateRouteParams(node, false),
  ]

  // 收集所有后代路由名称
  const childRouteNames: string[] =
    node.children.size > 0
      ? Array.from(node.getChildrenDeep())
          .filter(childRoute => childRoute.value.components.size && childRoute.isNamed())
          .map(childRoute => childRoute.name)
          .sort()
      : []

  typeParams.push(formatMultilineUnion(childRouteNames.map(toStringLiteral), 4))

  return `RouteRecordInfo<
${typeParams.map(line => pad(4, line)).join(',\n')}
  >`
}
