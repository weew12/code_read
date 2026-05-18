/**
 * Vue Router URL 编码解码模块
 * ==============================
 *
 * 本模块处理 URL 各部分的编码和解码逻辑。
 *
 * 编码规则（RFC3986 + 浏览器兼容性）：
 * -----------------------------------
 * - Path（路径）: 编码 ` ␣ " < > # ? { } `
 * - Query（查询）: 编码 ` ␣ " < > # & = `
 * - Hash（哈希）: 编码 ` ␣ " < > ` `
 *
 * 额外安全考虑：
 * - RFC3986 定义了一些额外需要编码的字符
 * - 大多数浏览器不编码 `!'()*`，但为了安全我们也编码
 * - 只保留 ASCII 字母数字和 `-._~`
 * - `\` 需要编码避免与 `/` 混淆
 * - 反引号 `` ` `` 在不同浏览器中编码行为不一致，需要编码
 *
 * + 号的特殊处理：
 * - 查询中 + 被解码为空格（application/x-www-form-urlencoded 标准）
 * - 编码时空格转为 +，+ 转为 %2B
 */

import { warn } from './warning'

/**
 * 编码规则说明
 *
 * - Path（路径）: 编码 ` ␣ " < > # ? { } `
 * - Query（查询）: 编码 ` ␣ " < > # & = `
 * - Hash（哈希）: 编码 ` ␣ " < > ` `
 *
 * RFC3986 额外字符：
 * 大多数浏览器不编码 `!'()*`，但为了安全我们也编码。
 * 只保留 ASCII 字母数字和 `-._~`。
 *
 * `\` 需要编码避免与 `/` 混淆。
 * 反引号 `` ` `` 在不同浏览器中编码行为不一致，需要编码。
 */

const HASH_RE = /#/g
const AMPERSAND_RE = /&/g
export const SLASH_RE = /\//g
const EQUAL_RE = /=/g
const IM_RE = /\?/g
export const PLUS_RE = /\+/g

/**
 * 查询字符串中 + 的处理说明
 *
 * + 在查询字符串中是特殊字符：
 * - 解析时 + 被解码为空格（URLSearchParams 行为）
 * - 编码时空格被编码为 +
 *
 * 标准参考：
 * - https://url.spec.whatwg.org/#urlencoded-parsing
 * - https://stackoverflow.com/questions/1634271/url-encoding-the-space-character-or-20
 */

const ENC_BRACKET_OPEN_RE = /%5B/g
const ENC_BRACKET_CLOSE_RE = /%5D/g
const ENC_CARET_RE = /%5E/g
const ENC_BACKTICK_RE = /%60/g
const ENC_CURLY_OPEN_RE = /%7B/g
const ENC_PIPE_RE = /%7C/g
const ENC_CURLY_CLOSE_RE = /%7D/g
const ENC_SPACE_RE = /%20/g

/**
 * 通用编码函数
 *
 * @remarks
 * 编码 Path、Query、Hash 都需要先调用此函数。
 * 基本使用 encodeURI 编码，然后恢复 RFC3986 保留字符。
 *
 * @param text - 要编码的文本
 * @returns 编码后的字符串
 */
export function commonEncode(text: string | number | null | undefined): string {
  return text == null
    ? ''
    : encodeURI('' + text)
        .replace(ENC_PIPE_RE, '|')
        .replace(ENC_BRACKET_OPEN_RE, '[')
        .replace(ENC_BRACKET_CLOSE_RE, ']')
}

/**
 * 编码 Hash 部分
 *
 * @remarks
 * Hash 部分的编码规则与 Path 类似，但保留 `{}` 和 `^`。
 *
 * @param text - 要编码的文本
 * @returns 编码后的字符串
 */
export function encodeHash(text: string): string {
  return commonEncode(text)
    .replace(ENC_CURLY_OPEN_RE, '{')
    .replace(ENC_CURLY_CLOSE_RE, '}')
    .replace(ENC_CARET_RE, '^')
}

/**
 * 编码查询值
 *
 * @remarks
 * 查询值需要额外的编码：
 * - 空格编码为 +，+ 编码为 %2B（区分原始 +）
 * - 额外编码 ` ` # & ` { } ^
 *
 * @param text - 要编码的文本
 * @returns 编码后的字符串
 */
export function encodeQueryValue(text: string | number): string {
  return (
    commonEncode(text)
      // 空格编码为 +，原始 + 编码为 %2B
      .replace(PLUS_RE, '%2B')
      .replace(ENC_SPACE_RE, '+')
      .replace(HASH_RE, '%23')
      .replace(AMPERSAND_RE, '%26')
      .replace(ENC_BACKTICK_RE, '`')
      .replace(ENC_CURLY_OPEN_RE, '{')
      .replace(ENC_CURLY_CLOSE_RE, '}')
      .replace(ENC_CARET_RE, '^')
  )
}

/**
 * 编码查询键
 *
 * @remarks
 * 与查询值类似，但额外编码 `=` 字符。
 *
 * @param text - 要编码的文本
 * @returns 编码后的字符串
 */
export function encodeQueryKey(text: string | number): string {
  return encodeQueryValue(text).replace(EQUAL_RE, '%3D')
}

/**
 * 编码路径
 *
 * @remarks
 * 路径部分需要编码 # 和 ? 字符。
 *
 * @param text - 要编码的文本
 * @returns 编码后的字符串
 */
export function encodePath(text: string | number | null | undefined): string {
  return commonEncode(text).replace(HASH_RE, '%23').replace(IM_RE, '%3F')
}

/**
 * 编码路径参数
 *
 * @remarks
 * 在路径编码基础上，额外编码 `/` 字符。
 * 用于路由参数值，因为参数可能包含路径。
 * 如果文本为 null 或 undefined，返回空字符串。
 *
 * @param text - 要编码的文本
 * @returns 编码后的字符串
 */
export function encodeParam(text: string | number | null | undefined): string {
  return encodePath(text).replace(SLASH_RE, '%2F')
}

/**
 * 解码文本
 *
 * @remarks
 * 使用 decodeURIComponent 解码。
 * 如果解码失败（无效的百分号编码），返回原始文本。
 *
 * @param text - 要解码的文本
 * @returns 解码后的字符串，失败时返回原始文本
 */
export function decode(text: string | number): string
export function decode(text: null | undefined): null
export function decode(text: string | number | null | undefined): string | null
export function decode(
  text: string | number | null | undefined
): string | null {
  if (text == null) return null
  try {
    return decodeURIComponent('' + text)
  } catch {
    __DEV__ && warn(`Error decoding "${text}". Using original value`)
  }
  return '' + text
}