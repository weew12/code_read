/**
 * 类型工具
 * ==========
 *
 * 本模块提供 TypeScript 类型操作工具。
 */

/**
 * 创建字面量联合类型，但仍然允许自动补全
 */
export type _LiteralUnion<LiteralType, BaseType extends string = string> =
  | LiteralType
  | (BaseType & Record<never, never>)

export type IsNull<T> =
  [T] extends [null] ? true : false

export type IsUnknown<T> = unknown extends T
  ? IsNull<T> extends false
    ? true
    : false
  : false

/**
 * 可能为 Promise 的类型
 */
export type _Awaitable<T> = T | PromiseLike<T>

/**
 * 简化类型（移除交叉类型）
 */
export type Simplify<T> = { [K in keyof T]: T[K] } & {}

/**
 * 字母数字字符
 */
export type _AlphaNumeric =
  | 'a' | 'A' | 'b' | 'B' | 'c' | 'C' | 'd' | 'D' | 'e' | 'E'
  | 'f' | 'F' | 'g' | 'G' | 'h' | 'H' | 'i' | 'I' | 'j' | 'J'
  | 'k' | 'K' | 'l' | 'L' | 'm' | 'M' | 'n' | 'N' | 'o' | 'O'
  | 'p' | 'P' | 'q' | 'Q' | 'r' | 'R' | 's' | 'S' | 't' | 'T'
  | 'u' | 'U' | 'v' | 'V' | 'w' | 'W' | 'x' | 'X' | 'y' | 'Y'
  | 'z' | 'Z' | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7'
  | '8' | '9' | '_'

export type Awaitable<T> = T | Promise<T>
