/**
 * Unplugin 通用工具函数
 *
 * 本模块提供代码生成和格式化所需的通用工具。
 */
 /**
 * Maybe a promise maybe not
 * 可能为 Promise 或普通值的类型
 * @internal
 */
export type _Awaitable<T> = T | PromiseLike<T>

/**
 * Creates a union type that still allows autocompletion for strings.
 * 创建支持自动补全的字符串字面量联合类型
 *@internal
 */
export type LiteralStringUnion<LiteralType, BaseType extends string = string> =
  | LiteralType
  | (BaseType & Record<never, never>)

// for highlighting
export const ts = String.raw

/**
 * Pads a single-line string with spaces.
 * 字符串左填充
 *
 * @internal
 *
 * @param spaces The number of spaces to pad with.
 * @param str The string to pad, none if omitted.
 * @returns The padded string.
 */
export function pad(spaces: number, str = ''): string {
  return ' '.repeat(spaces) + str
}

/**
 * Formats an array of union items as a multiline union type.
 * 格式化多行联合类型
 *
 * @internal
 *
 * @param items The items to format.
 * @param spaces The number of spaces to indent each line.
 * @returns The formatted multiline union type.
 */
export function formatMultilineUnion(items: string[], spaces: number): string {
  return (items.length ? items : ['never'])
    .map(s => `| ${s}`)
    .join(`\n${pad(spaces)}`)
}

/**
 * Converts a string value to a string literal, escaping as necessary.
 * 将字符串转换为字面量类型
 *
 * @internal
 *
 * @param str the string to convert to a string type
 * @returns The string wrapped in single quotes and escaped.
 * @example
 * toStringLiteral('hello') // returns "'hello'"
 * toStringLiteral("it's fine") // returns "'it\'s fine'"
 */
export function toStringLiteral(str: string): string {
  return `'${str.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}
