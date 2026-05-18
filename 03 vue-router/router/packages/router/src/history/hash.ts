/**
 * Vue Router Hash History 实现
 * ==============================
 *
 * 本模块实现基于 URL hash 的路由历史记录管理。
 *
 * 适用场景：
 * 1. 无法配置服务器的静态文件环境（如 file:// 协议）
 * 2. 无法配置服务器处理任意 URL 的情况
 *
 * hash 路由格式：`https://example.com/folder/#/path/to/page`
 *
 * 注意：
 * - base 会影响所有 history.pushState() 调用
 * - 如果存在 <base> 标签，其 href 值必须与 base 参数匹配
 */

import type { RouterHistory } from './common'
import { createWebHistory } from './html5'
import { warn } from '../warning'

/**
 * 创建 Hash History
 *
 * @remarks
 * 实际上是在 HTML5 History 基础上添加 hash 前缀处理。
 *
 * @param base - 可选的基础路径
 *
 * @example
 * ```typescript
 * // 在 https://example.com/folder
 * createWebHashHistory() // => https://example.com/folder/#
 * createWebHashHistory('/folder/') // => https://example.com/folder/#
 * createWebHashHistory('/folder/#/app/') // => https://example.com/folder/#/app/
 * ```
 */
export function createWebHashHistory(base?: string): RouterHistory {
  // 对于 file:// 协议，忽略 base
  base = location.host ? base || location.pathname + location.search : ''

  // 确保 base 以 # 结尾
  if (!base.includes('#')) base += '#'

  // 开发环境验证 base 格式
  if (__DEV__ && !base.endsWith('#/') && !base.endsWith('#')) {
    warn(
      `A hash base must end with a "#":\n"${base}" should be "${base.replace(/#.*$/, '#')}".`
    )
  }

  return createWebHistory(base)
}