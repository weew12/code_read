/**
 * Vue Router 警告工具
 * ====================
 *
 * 本模块提供开发环境的警告输出。
 */

/**
 * 输出警告信息
 *
 * @param msg - 警告消息
 */
export function warn(msg: string, ..._args: any[]): void
export function warn(msg: string): void {
  const args = Array.from(arguments).slice(1)
  console.warn.apply(
    console,
    ['[Vue Router warn]: ' + msg].concat(args) as [string, ...any[]]
  )
}