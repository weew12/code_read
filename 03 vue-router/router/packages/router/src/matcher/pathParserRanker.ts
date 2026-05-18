/**
 * Vue Router 路径解析器和排名器
 * ================================
 *
 * 本模块负责将 token 数组转换为可执行的正则表达式解析器，
 * 并提供路由优先级的计算逻辑。
 *
 * 核心功能：
 * 1. 将 token 数组编译成正则表达式（re）
 * 2. 提供路径解析函数（parse）
 * 3. 提供路径生成函数（stringify）
 * 4. 计算路由优先级分数（score）
 *
 * 路由优先级规则：
 * - 静态路径 > 动态路径 > 通配符路径
 * - 路径段越多优先级越高
 * - 相同优先级时，子路由优先于父路由
 */

/**
 * 路径参数类型
 *
 * @remarks
 * 支持单值和数组值（可重复参数）。
 */
export type PathParams = Record<string, string | string[]>

/**
 * 路径参数键定义
 */
interface PathParserParamKey {
  /** 参数名称 */
  name: string
  /** 是否可重复（* 或 +） */
  repeatable: boolean
  /** 是否可选（?、* 或 +） */
  optional: boolean
}

/**
 * 路径解析器接口
 *
 * @remarks
 * 由 tokensToParser 创建，提供路径匹配和参数提取能力。
 */
export interface PathParser {
  /**
   * 匹配路径的正则表达式
   */
  re: RegExp

  /**
   * 优先级分数数组
   *
   * @remarks
   * 用于比较两个路由的优先级。
   * 分数越高，优先级越高。
   */
  score: Array<number[]>

  /**
   * 路径中的参数键列表
   */
  keys: PathParserParamKey[]

  /**
   * 解析路径并提取参数
   *
   * @param path - 要解析的 URL 路径
   * @returns 参数对象，解析失败返回 null
   *
   * @example
   * ```typescript
   * const parser = tokensToParser(tokenizePath('/users/:id'))
   * parser.parse('/users/123')
   * // => { id: '123' }
   * ```
   */
  parse(path: string): PathParams | null

  /**
   * 从参数生成路径字符串
   *
   * @param params - 参数对象
   * @returns 路径字符串
   *
   * @example
   * ```typescript
   * const parser = tokensToParser(tokenizePath('/users/:id'))
   * parser.stringify({ id: '123' })
   * // => '/users/123'
   * ```
   */
  stringify(params: PathParams): string
}

/**
 * 路径解析器选项（公开）
 */
export interface _PathParserOptions {
  /**
   * 正则表达式是否大小写敏感
   *
   * @defaultValue `false`
   */
  sensitive?: boolean

  /**
   * 是否禁止尾部斜杠
   *
   * @defaultValue `false`
   */
  strict?: boolean

  /**
   * 是否从路径开头匹配（添加 ^）
   *
   * @internal
   * @defaultValue `true`
   */
  start?: boolean

  /**
   * 是否匹配到路径结尾（添加 $）
   *
   * @deprecated 未来版本将始终为 true
   * @defaultValue `true`
   */
  end?: boolean
}

/**
 * 路径解析器选项类型（公开部分）
 */
export type PathParserOptions = Pick<
  _PathParserOptions,
  'end' | 'sensitive' | 'strict'
>

/**
 * 参数的默认正则表达式
 *
 * @remarks
 * 匹配除 `/` 之外的任意字符，非贪婪模式。
 */
const BASE_PARAM_PATTERN = '[^/]+?'

/**
 * 默认的路径解析器选项
 */
const BASE_PATH_PARSER_OPTIONS: Required<_PathParserOptions> = {
  sensitive: false,
  strict: false,
  start: true,
  end: true,
}

/**
 * 路由优先级分数枚举
 *
 * @remarks
 * 分数用于确定路由匹配的优先级。
 * 基础分数乘以 10 以留出奖励空间。
 *
 * 排序规则：
 * 1. 分数高的优先
 * 2. 分数相同时，路径段多的优先
 * 3. 仍有相同则子路由优先于父路由
 */
const enum PathScore {
  /** 乘数，用于缩放分数 */
  _multiplier = 10,
  /** 根路径 `/`，最低优先级 */
  Root = 9 * _multiplier,
  /** 路径段分数 */
  Segment = 4 * _multiplier,
  /** 段内子段分数（多个参数在同一段） */
  SubSegment = 3 * _multiplier,
  /** 静态段分数 */
  Static = 4 * _multiplier,
  /** 动态参数分数 */
  Dynamic = 2 * _multiplier,
  /** 自定义正则表达式奖励 */
  BonusCustomRegExp = 1 * _multiplier,
  /** 通配符惩罚（.* 会被减分） */
  BonusWildcard = -4 * _multiplier - BonusCustomRegExp,
  /** 可重复参数惩罚 */
  BonusRepeatable = -2 * _multiplier,
  /** 可选参数惩罚 */
  BonusOptional = -0.8 * _multiplier,
  /** strict 模式奖励（允许尾部斜杠时给更高分数） */
  BonusStrict = 0.07 * _multiplier,
  /** 大小写敏感奖励 */
  BonusCaseSensitive = 0.025 * _multiplier,
}

/**
 * 正则表达式特殊字符
 *
 * @remarks
 * 这些字符在静态路径中需要转义。
 */
const REGEX_CHARS_RE = /[.+*?^${}()[\]/\\]/g

/**
 * 将 token 数组转换为路径解析器
 *
 * @remarks
 * 这是路径解析的核心函数，将词法分析的结果编译成：
 * 1. 正则表达式（re）：用于匹配路径
 * 2. 参数键列表（keys）：记录参数信息
 * 3. 解析函数（parse）：从路径提取参数
 * 4. 字符串化函数（stringify）：从参数生成路径
 * 5. 优先级分数（score）：用于路由排序
 *
 * @param segments - tokenizePath 返回的 token 数组
 * @param extraOptions - 解析器选项
 * @returns 路径解析器
 *
 * @example
 * ```typescript
 * const tokens = tokenizePath('/users/:id')
 * const parser = tokensToParser(tokens, { strict: true })
 *
 * parser.parse('/users/123')
 * // => { id: '123' }
 *
 * parser.stringify({ id: '123' })
 * // => '/users/123'
 * ```
 */
export function tokensToParser(
  segments: Array<Token[]>,
  extraOptions?: _PathParserOptions
): PathParser {
  const options = assign({}, BASE_PATH_PARSER_OPTIONS, extraOptions)

  /** 每个段的分数 */
  const score: Array<number[]> = []
  /** 正则表达式字符串 */
  let pattern = options.start ? '^' : ''
  /** 参数键列表 */
  const keys: PathParserParamKey[] = []

  for (const segment of segments) {
    /** 当前段的分数 */
    const segmentScores: number[] = segment.length ? [] : [PathScore.Root]

    // strict 模式下，空段需要添加 /
    if (options.strict && !segment.length) pattern += '/'

    for (let tokenIndex = 0; tokenIndex < segment.length; tokenIndex++) {
      const token = segment[tokenIndex]
      /**
       * 子段分数
       *
       * @remarks
       * 每个 token 都会贡献分数。
       * 基础分数是 Segment，加上大小写敏感奖励。
       */
      let subSegmentScore: number =
        PathScore.Segment +
        (options.sensitive ? PathScore.BonusCaseSensitive : 0)

      // ----------------------------------------
      // 静态 token：直接添加到模式
      // ----------------------------------------
      if (token.type === TokenType.Static) {
        if (!tokenIndex) pattern += '/'
        // 转义正则特殊字符
        pattern += token.value.replace(REGEX_CHARS_RE, '\\$&')
        subSegmentScore += PathScore.Static

      // ----------------------------------------
      // 参数 token：构建参数捕获组
      // ----------------------------------------
      } else if (token.type === TokenType.Param) {
        const { value, repeatable, optional, regexp } = token

        // 记录参数键
        keys.push({
          name: value,
          repeatable,
          optional,
        })

        // 使用自定义正则或默认模式
        const re = regexp ? regexp : BASE_PARAM_PATTERN

        // 验证自定义正则表达式
        if (re !== BASE_PARAM_PATTERN) {
          subSegmentScore += PathScore.BonusCustomRegExp
          try {
            new RegExp(`(${re})`)
          } catch (err) {
            throw new Error(
              `Invalid custom RegExp for param "${value}" (${re}): ` +
                (err as Error).message
            )
          }
        }

        /**
         * 构建参数的正则表达式
         *
         * @remarks
         * 可重复参数格式：((?:pattern)(?:/(?:pattern))*)
         * 可选参数格式：后面添加 ?
         */
        let subPattern = repeatable
          ? `((?:${re})(?:/(?:${re}))*)`
          : `(${re})`

        // 段开头添加 /
        if (!tokenIndex)
          subPattern =
            optional && segment.length < 2
              ? `(?:/${subPattern})`
              : '/' + subPattern

        if (optional) subPattern += '?'

        pattern += subPattern

        subSegmentScore += PathScore.Dynamic
        if (optional) subSegmentScore += PathScore.BonusOptional
        if (repeatable) subSegmentScore += PathScore.BonusRepeatable
        if (re === '.*') subSegmentScore += PathScore.BonusWildcard
      }

      segmentScores.push(subSegmentScore)
    }

    score.push(segmentScores)
  }

  // strict 模式奖励仅应用于最后一个分数
  if (options.strict && options.end) {
    const i = score.length - 1
    score[i][score[i].length - 1] += PathScore.BonusStrict
  }

  // 非 strict 模式允许可选的尾部斜杠
  if (!options.strict) pattern += '/?'

  if (options.end) pattern += '$'
  // 非 end 模式允许后续路径
  else if (options.strict && !pattern.endsWith('/')) pattern += '(?:/|$)'

  const re = new RegExp(pattern, options.sensitive ? '' : 'i')

  /**
   * 解析路径
   *
   * @param path - URL 路径
   * @returns 参数对象，失败返回 null
   */
  function parse(path: string): PathParams | null {
    const match = path.match(re)
    const params: PathParams = {}

    if (!match) return null

    // 从正则匹配结果提取参数
    for (let i = 1; i < match.length; i++) {
      const value: string = match[i] || ''
      const key = keys[i - 1]
      // 可重复参数返回数组
      params[key.name] = value && key.repeatable ? value.split('/') : value
    }

    return params
  }

  /**
   * 从参数生成路径
   *
   * @param params - 参数对象
   * @returns 路径字符串
   */
  function stringify(params: PathParams): string {
    let path = ''
    let avoidDuplicatedSlash: boolean = false

    for (const segment of segments) {
      // 添加路径分隔符
      if (!avoidDuplicatedSlash || !path.endsWith('/')) path += '/'
      avoidDuplicatedSlash = false

      for (const token of segment) {
        if (token.type === TokenType.Static) {
          path += token.value
        } else if (token.type === TokenType.Param) {
          const { value, repeatable, optional } = token
          const param: string | readonly string[] =
            value in params ? params[value] : ''

          // 检查数组参数类型
          if (isArray(param) && !repeatable) {
            throw new Error(
              `Provided param "${value}" is an array but it is not repeatable (* or + modifiers)`
            )
          }

          const text: string = isArray(param)
            ? (param as string[]).join('/')
            : (param as string)

          if (!text) {
            if (optional) {
              // 单一可选参数：移除尾部斜杠
              if (segment.length < 2) {
                if (path.endsWith('/')) path = path.slice(0, -1)
                else avoidDuplicatedSlash = true
              }
            } else {
              throw new Error(`Missing required param "${value}"`)
            }
          } else {
            path += text
          }
        }
      }
    }

    return path || '/'
  }

  return {
    re,
    score,
    keys,
    parse,
    stringify,
  }
}

/**
 * 比较两个分数数组
 *
 * @param a - 第一个分数数组
 * @param b - 第二个分数数组
 * @returns 比较结果（用于排序）
 */
function compareScoreArray(a: number[], b: number[]): number {
  let i = 0
  while (i < a.length && i < b.length) {
    const diff = b[i] - a[i]
    if (diff) return diff
    i++
  }

  /**
   * 分数相同时的比较逻辑：
   * 1. 如果较短的是一个静态段，则较短的在前面
   * 2. 否则，较长的在前面
   */
  if (a.length < b.length) {
    return a.length === 1 && a[0] === PathScore.Static + PathScore.Segment
      ? -1
      : 1
  } else if (a.length > b.length) {
    return b.length === 1 && b[0] === PathScore.Static + PathScore.Segment
      ? 1
      : -1
  }

  return 0
}

/**
 * 比较两个路径解析器的优先级
 *
 * @remarks
 * 用于排序路由数组。
 * 返回值 < 0：a 在前；> 0：b 在前。
 *
 * @param a - 第一个解析器
 * @param b - 第二个解析器
 * @returns 优先级比较结果
 */
export function comparePathParserScore(
  a: Pick<PathParser, 'score'>,
  b: Pick<PathParser, 'score'>
): number {
  let i = 0
  const aScore = a.score
  const bScore = b.score

  // 逐段比较分数
  while (i < aScore.length && i < bScore.length) {
    const comp = compareScoreArray(aScore[i], bScore[i])
    if (comp) return comp
    i++
  }

  /**
   * 分数数组长度差为 1 时的处理
   *
   * @remarks
   * 如果一个路由有额外的段（分数数组更长），
   * 且较短路由的最后分数为负（可选参数），
   * 则较长的路由优先。
   */
  if (Math.abs(bScore.length - aScore.length) === 1) {
    if (isLastScoreNegative(aScore)) return 1
    if (isLastScoreNegative(bScore)) return -1
  }

  // 段数多的优先
  return bScore.length - aScore.length
}

/**
 * 检查最后一个分数是否为负
 *
 * @remarks
 * 负分数表示该段包含可选参数。
 * 这影响路由排序逻辑。
 */
function isLastScoreNegative(score: PathParser['score']): boolean {
  const last = score[score.length - 1]
  return score.length > 0 && last[last.length - 1] < 0
}

/**
 * 默认的路径解析器选项
 */
export const PATH_PARSER_OPTIONS_DEFAULTS: PathParserOptions = {
  strict: false,
  end: true,
  sensitive: false,
}