/**
 * Vue Router 路径词法分析器
 * ============================
 *
 * 本模块负责将路径字符串解析为 Token（词法单元）数组。
 * 这是路由匹配的第一步，为后续的正则表达式生成提供基础。
 *
 * 路径语法支持：
 * - 静态段： 如 `/users` → [Static('/users')]
 * - 参数段： 如 `/:id` → [Param('id')]
 * - 可选参数： 如 `/:id?` → [Param('id', optional: true)]
 * - 可重复参数： 如 `/:id+` 或 `/:id*` → [Param('id', repeatable: true)]
 * - 自定义正则： 如 `/:id(\\d+)` → [Param('id', regexp: '\\d+')]
 * - 路径组：   如 `/users` 和 `/users/:id` 分属不同 segment
 *
 * 示例：
 * ```typescript
 * tokenizePath('/users/:id')
 * // => [[{ type: TokenType.Static, value: '/users' }, { type: TokenType.Param, value: 'id' }]]
 *
 * tokenizePath('/:id(\\d+)')
 * // => [[{ type: TokenType.Param, value: 'id', regexp: '\\d+' }]]
 * ```
 */

/**
 * Token 类型枚举
 */
export const enum TokenType {
  /** 静态文本段，如 '/users' */
  Static,
  /** 参数段，如 ':id' */
  Param,
  /** 路径组段 */
  Group,
}

/**
 * Tokenizer 状态机状态
 */
const enum TokenizerState {
  /** 解析静态文本 */
  Static,
  /** 解析参数名 */
  Param,
  /** 解析参数的自定义正则表达式 */
  ParamRegExp,
  /** 解析参数正则表达式结束后的修饰符 */
  ParamRegExpEnd,
  /** 转义下一个字符 */
  EscapeNext,
}

/**
 * 静态文本 Token
 */
interface TokenStatic {
  type: TokenType.Static
  value: string
}

/**
 * 参数 Token
 */
interface TokenParam {
  type: TokenType.Param
  /** 自定义正则表达式 */
  regexp?: string
  /** 参数名 */
  value: string
  /** 是否可选 */
  optional: boolean
  /** 是否可重复 */
  repeatable: boolean
}

/**
 * 路径组 Token
 */
interface TokenGroup {
  type: TokenType.Group
  value: Exclude<Token, TokenGroup>[]
}

/**
 * Token 联合类型
 */
export type Token = TokenStatic | TokenParam | TokenGroup

/**
 * 根路径的 token（只有一个斜杠）
 */
const ROOT_TOKEN: Token = {
  type: TokenType.Static,
  value: '',
}

/**
 * 合法的参数名字符
 *
 * @remarks
 * 参数名只能包含字母、数字和下划线。
 */
const VALID_PARAM_RE = /[a-zA-Z0-9_]/

/**
 * 路径词法分析
 *
 * @remarks
 * 将路径字符串拆分为 token 数组。
 * 每个 token 数组代表一个路径段（segment），段内以 `/` 分隔。
 *
 * 状态机流程：
 * 1. 从 Static 状态开始
 * 2. 遇到 `/` 结束当前段，开始新段
 * 3. 遇到 `:` 进入 Param 状态
 * 4. Param 状态后可跟 `(` 进入 ParamRegExp 正则解析
 * 5. 正则结束后检查 `?`、`*`、`+` 修饰符
 *
 * @param path - 要分析的路径字符串（必须以 `/` 开头）
 * @returns 二维 token 数组，外层数组每个元素是一个路径段
 *
 * @example
 * ```typescript
 * tokenizePath('/users/:id')
 * // 返回结构：
 * // [
 * //   [                                    // 第一段（根路径开始）
 * //     { type: Static, value: '/users' },
 * //     { type: Param, value: 'id' }
 * //   ]
 * // ]
 *
 * tokenizePath('/:id/:name?')
 * // [
 * //   [
 * //     { type: Param, value: 'id' },
 * //     { type: Param, value: 'name', optional: true }
 * //   ]
 * // ]
 * ```
 */
export function tokenizePath(path: string): Array<Token[]> {
  if (!path) return [[]]
  if (path === '/') return [[ROOT_TOKEN]]
  if (!path.startsWith('/')) {
    throw new Error(
      __DEV__
        ? `Route paths should start with a "/": "${path}" should be "/${path}".`
        : `Invalid path "${path}"`
    )
  }

  /**
   * 报告解析错误
   *
   * @param message - 错误消息
   */
  function crash(message: string) {
    throw new Error(`ERR (${state})/"${buffer}": ${message}`)
  }

  let state: TokenizerState = TokenizerState.Static
  let previousState: TokenizerState = state

  /** 所有解析出的 token 段 */
  const tokens: Array<Token[]> = []

  /** 当前正在解析的段 */
  let segment!: Token[]

  /**
   * 结束当前段，保存到 tokens 并开始新段
   */
  function finalizeSegment() {
    if (segment) tokens.push(segment)
    segment = []
  }

  // 路径遍历索引
  let i = 0
  // 当前字符
  let char: string
  // 值缓冲区
  let buffer: string = ''
  // 自定义正则表达式缓冲区
  let customRe: string = ''

  /**
   * 消费缓冲区，将内容转换为 token
   *
   * @remarks
   * 根据当前状态将 buffer 内容转换为对应的 token 并添加到当前段。
   */
  function consumeBuffer() {
    if (!buffer) return

    if (state === TokenizerState.Static) {
      segment.push({
        type: TokenType.Static,
        value: buffer,
      })
    } else if (
      state === TokenizerState.Param ||
      state === TokenizerState.ParamRegExp ||
      state === TokenizerState.ParamRegExpEnd
    ) {
      // 可重复参数必须独占一个段
      if (segment.length > 1 && (char === '*' || char === '+'))
        crash(
          `A repeatable param (${buffer}) must be alone in its segment. eg: '/:ids+.`
        )
      segment.push({
        type: TokenType.Param,
        value: buffer,
        regexp: customRe,
        repeatable: char === '*' || char === '+',
        optional: char === '*' || char === '?',
      })
    } else {
      crash('Invalid state to consume buffer')
    }
    buffer = ''
  }

  function addCharToBuffer() {
    buffer += char
  }

  // ============================================
  // 主循环：逐字符解析路径
  // ============================================
  while (i < path.length) {
    char = path[i++]

    /**
     * 处理转义字符
     *
     * @remarks
     * `\` 用于转义 `:` 和 `)` 等特殊字符，
     * 使它们可以作为静态文本的一部分。
     */
    if (char === '\\' && state !== TokenizerState.ParamRegExp) {
      previousState = state
      state = TokenizerState.EscapeNext
      continue
    }

    switch (state) {
      // ----------------------------------------
      // 静态文本状态
      // ----------------------------------------
      case TokenizerState.Static:
        if (char === '/') {
          // 路径分隔符：结束当前段
          if (buffer) {
            consumeBuffer()
          }
          finalizeSegment()
        } else if (char === ':') {
          // 参数开始：消费 buffer 并切换状态
          consumeBuffer()
          state = TokenizerState.Param
        } else {
          addCharToBuffer()
        }
        break

      // ----------------------------------------
      // 转义状态：直接添加字符并恢复之前状态
      // ----------------------------------------
      case TokenizerState.EscapeNext:
        addCharToBuffer()
        state = previousState
        break

      // ----------------------------------------
      // 参数状态：收集参数名
      // ----------------------------------------
      case TokenizerState.Param:
        if (char === '(') {
          // 开始自定义正则表达式
          state = TokenizerState.ParamRegExp
        } else if (VALID_PARAM_RE.test(char)) {
          // 合法的参数名字符
          addCharToBuffer()
        } else {
          // 参数名结束
          consumeBuffer()
          state = TokenizerState.Static
          // 回退一个字符（不是修饰符时）
          if (char !== '*' && char !== '?' && char !== '+') i--
        }
        break

      // ----------------------------------------
      // 参数正则状态：收集正则表达式内容
      // ----------------------------------------
      case TokenizerState.ParamRegExp:
        if (char === ')') {
          // 检查是否是被转义的 )
          if (customRe[customRe.length - 1] == '\\')
            customRe = customRe.slice(0, -1) + char
          else
            state = TokenizerState.ParamRegExpEnd
        } else {
          customRe += char
        }
        break

      // ----------------------------------------
      // 参数正则结束状态：处理修饰符
      // ----------------------------------------
      case TokenizerState.ParamRegExpEnd:
        consumeBuffer()
        state = TokenizerState.Static
        if (char !== '*' && char !== '?' && char !== '+') i--
        customRe = ''
        break

      default:
        crash('Unknown state')
        break
    }
  }

  // 检查未闭合的正则表达式
  if (state === TokenizerState.ParamRegExp)
    crash(`Unfinished custom RegExp for param "${buffer}"`)

  consumeBuffer()
  finalizeSegment()

  return tokens
}