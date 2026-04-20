/**
 * @license
 * Lodash <https://lodash.com/>
 * Copyright OpenJS Foundation and other contributors <https://openjsf.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 *
 * Lodash 源码深度解析
 * ====================
 *
 * Lodash 是一个功能强大的 JavaScript 实用工具库，提供模块化、高性能的
 * 数组、对象、字符串、数字等操作函数。本文件采用单体单文件架构 (Monolithic Single-File)，
 * 所有源码（约 17,259 行）集中在 lodash.js 中。
 *
 * 架构特点：
 * 1. IIFE 封装 - 避免污染全局命名空间
 * 2. UMD 模块格式 - 支持 AMD/CommonJS/全局变量多种导出方式
 * 3. 函数定义表达式 - 使用表达式而非函数声明，避免提升问题
 * 4. 位掩码优化 - 使用位运算处理函数元数据和标志位
 * 5. 延迟计算 - 支持链式操作的惰性求值
 *
 * 核心设计模式：
 * - 工厂模式：通过 runInContext() 创建隔离的 lodash 实例
 * - 装饰器模式：wrap 系列函数包装现有函数
 * - 迭代器模式：提供统一的集合遍历接口
 * - 链式调用：通过 prototype 方法实现流式 API
 */
;(function() {

  /** Used as a safe reference for `undefined` in pre-ES5 environments.
   *
   * 在 pre-ES5 环境中安全引用 undefined 的方式。
   * 原因：在旧版 JavaScript 中，undefined 不是一个保留字，
   * 可以被重新赋值（如：var undefined = 1），导致 typeof undefined === 'undefined' 检查失效。
   * 通过本地变量 undefined 引用全局 undefined，确保其值确实为 undefined。
   */
  var undefined;

  /** Used as the semantic version number.
   *
   * Lodash 语义化版本号，用于标识库版本。
   * 可通过 _.VERSION 访问。
   */
  var VERSION = '4.18.1';

  /** Used as the size to enable large array optimizations.
   *
   * 大数组优化的阈值。当数组长度 >= 200 时，
   * 启用特殊的优化算法（如快速排序替代归并排序）。
   * 这是基于性能测试得出的经验值。
   */
  var LARGE_ARRAY_SIZE = 200;

  /** Error message constants.
   *
   * 核心错误信息常量，用于保持错误消息的一致性。
   *
   * - CORE_ERROR_TEXT: core-js 不支持时的错误提示
   * - FUNC_ERROR_TEXT: 函数参数类型错误（如期望函数却传入其他类型）
   * - INVALID_TEMPL_VAR_ERROR_TEXT: _.template 的 variable 选项无效
   * - INVALID_TEMPL_IMPORTS_ERROR_TEXT: _.template 的 imports 选项无效
   */
  var CORE_ERROR_TEXT = 'Unsupported core-js use. Try https://npms.io/search?q=ponyfill.',
      FUNC_ERROR_TEXT = 'Expected a function',
      INVALID_TEMPL_VAR_ERROR_TEXT = 'Invalid `variable` option passed into `_.template`',
      INVALID_TEMPL_IMPORTS_ERROR_TEXT = 'Invalid `imports` option passed into `_.template`';

  /** Used to stand-in for `undefined` hash values.
   *
   * Hash 表中 undefined 值的占位符。
   * 在 Hash 对象中使用，防止与真实的 undefined 键混淆。
   */
  var HASH_UNDEFINED = '__lodash_hash_undefined__';

  /** Used as the maximum memoize cache size.
   *
   * _.memoize 的最大缓存大小。
   * 超过此大小时，旧缓存条目会被清除。
   */
  var MAX_MEMOIZE_SIZE = 500;

  /** Used as the internal argument placeholder.
   *
   * 内部参数占位符，用于柯里化和偏函数应用。
   * 例如：_.partial(fn, _, 1)(_) 会产生占位符替换。
   * 可以通过 lodash PLACEHOLDER 属性访问。
   */
  var PLACEHOLDER = '__lodash_placeholder__';

  /** Used to compose bitmasks for cloning.
   *
   * 克隆操作的位掩码标志，用于控制克隆深度和是否克隆 Symbol。
   *
   * - CLONE_DEEP_FLAG (1): 深度克隆
   * - CLONE_FLAT_FLAG (2): 扁平克隆（一层）
   * - CLONE_SYMBOLS_FLAG (4): 克隆 Symbol 属性
   *
   * 可以组合使用：如 CLONE_DEEP_FLAG | CLONE_SYMBOLS_FLAG = 5 表示深度克隆包含 Symbol
   */
  var CLONE_DEEP_FLAG = 1,
      CLONE_FLAT_FLAG = 2,
      CLONE_SYMBOLS_FLAG = 4;

  /** Used to compose bitmasks for value comparisons.
   *
   * 值比较的位掩码标志，用于控制比较行为。
   *
   * - COMPARE_PARTIAL_FLAG (1): 部分比较（对象只比较部分属性）
   * - COMPARE_UNORDERED_FLAG (2): 无序比较（用于数组/集合）
   */
  var COMPARE_PARTIAL_FLAG = 1,
      COMPARE_UNORDERED_FLAG = 2;

  /** Used to compose bitmasks for function metadata.
   *
   * 函数包装的位掩码标志，用于 _.wrap、_.curry 等函数元数据。
   *
   * - WRAP_BIND_FLAG (1): bind 绑定
   * - WRAP_BIND_KEY_FLAG (2): bindKey 键绑定
   * - WRAP_CURRY_BOUND_FLAG (4): 柯里化绑定
   * - WRAP_CURRY_FLAG (8): 柯里化
   * - WRAP_CURRY_RIGHT_FLAG (16): 右柯里化
   * - WRAP_PARTIAL_FLAG (32): 偏函数应用
   * - WRAP_PARTIAL_RIGHT_FLAG (64): 右偏函数应用
   * - WRAP_ARY_FLAG (128): 参数数量限制
   * - WRAP_REARG_FLAG (256): 参数重排
   * - WRAP_FLIP_FLAG (512): 函数翻转（参数顺序反转）
   */
  var WRAP_BIND_FLAG = 1,
      WRAP_BIND_KEY_FLAG = 2,
      WRAP_CURRY_BOUND_FLAG = 4,
      WRAP_CURRY_FLAG = 8,
      WRAP_CURRY_RIGHT_FLAG = 16,
      WRAP_PARTIAL_FLAG = 32,
      WRAP_PARTIAL_RIGHT_FLAG = 64,
      WRAP_ARY_FLAG = 128,
      WRAP_REARG_FLAG = 256,
      WRAP_FLIP_FLAG = 512;

  /** Used as default options for `_.truncate`.
   *
   * _.truncate 的默认选项：
   * - DEFAULT_TRUNC_LENGTH (30): 默认截断长度
   * - DEFAULT_TRUNC_OMISSION ('...'): 省略符
   */
  var DEFAULT_TRUNC_LENGTH = 30,
      DEFAULT_TRUNC_OMISSION = '...';

  /** Used to detect hot functions by number of calls within a span of milliseconds.
   *
   * 热函数检测配置，用于性能优化。
   * 当一个函数在 HOT_SPAN (16ms) 内被调用 HOT_COUNT (800) 次，
   * 该函数被标记为"热函数"，采用特殊优化策略。
   * 16ms 约等于 60fps 的一帧时间。
   */
  var HOT_COUNT = 800,
      HOT_SPAN = 16;

  /** Used to indicate the type of lazy iteratees.
   *
   * 延迟迭代器的类型标志，用于链式操作的惰性求值。
   *
   * - LAZY_FILTER_FLAG (1): 过滤操作
   * - LAZY_MAP_FLAG (2): 映射操作
   * - LAZY_WHILE_FLAG (3): 条件循环
   */
  var LAZY_FILTER_FLAG = 1,
      LAZY_MAP_FLAG = 2,
      LAZY_WHILE_FLAG = 3;

  /** Used as references for various `Number` constants.
   *
   * JavaScript Number 常量的快捷引用：
   * - INFINITY: 无穷大 (1/0)
   * - MAX_SAFE_INTEGER: 最大安全整数 (2^53 - 1)
   * - MAX_INTEGER: 最大浮点数
   * - NAN: 非数字 (0/0)
   */
  var INFINITY = 1 / 0,
      MAX_SAFE_INTEGER = 9007199254740991,
      MAX_INTEGER = 1.7976931348623157e+308,
      NAN = 0 / 0;

  /** Used as references for the maximum length and index of an array.
   *
   * 数组长度相关的最大值常量：
   * - MAX_ARRAY_LENGTH (2^32 - 1): 数组最大长度
   * - MAX_ARRAY_INDEX: 最大数组索引 (MAX_ARRAY_LENGTH - 1)
   * - HALF_MAX_ARRAY_LENGTH: 最大长度的一半（用于二分查找等优化）
   */
  var MAX_ARRAY_LENGTH = 4294967295,
      MAX_ARRAY_INDEX = MAX_ARRAY_LENGTH - 1,
      HALF_MAX_ARRAY_LENGTH = MAX_ARRAY_LENGTH >>> 1;

  /** Used to associate wrap methods with their bit flags.
   *
   * wrap 方法与位标志的映射表。
   * 用于在包装函数时快速查找对应的标志位。
   *
   * 示例：_.curry(fn) 会设置 WRAP_CURRY_FLAG (8)
   */
  var wrapFlags = [
    ['ary', WRAP_ARY_FLAG],
    ['bind', WRAP_BIND_FLAG],
    ['bindKey', WRAP_BIND_KEY_FLAG],
    ['curry', WRAP_CURRY_FLAG],
    ['curryRight', WRAP_CURRY_RIGHT_FLAG],
    ['flip', WRAP_FLIP_FLAG],
    ['partial', WRAP_PARTIAL_FLAG],
    ['partialRight', WRAP_PARTIAL_RIGHT_FLAG],
    ['rearg', WRAP_REARG_FLAG]
  ];

  /** `Object#toString` result references. */
  var argsTag = '[object Arguments]',
      arrayTag = '[object Array]',
      asyncTag = '[object AsyncFunction]',
      boolTag = '[object Boolean]',
      dateTag = '[object Date]',
      domExcTag = '[object DOMException]',
      errorTag = '[object Error]',
      funcTag = '[object Function]',
      genTag = '[object GeneratorFunction]',
      mapTag = '[object Map]',
      numberTag = '[object Number]',
      nullTag = '[object Null]',
      objectTag = '[object Object]',
      promiseTag = '[object Promise]',
      proxyTag = '[object Proxy]',
      regexpTag = '[object RegExp]',
      setTag = '[object Set]',
      stringTag = '[object String]',
      symbolTag = '[object Symbol]',
      undefinedTag = '[object Undefined]',
      weakMapTag = '[object WeakMap]',
      weakSetTag = '[object WeakSet]';

  var arrayBufferTag = '[object ArrayBuffer]',
      dataViewTag = '[object DataView]',
      float32Tag = '[object Float32Array]',
      float64Tag = '[object Float64Array]',
      int8Tag = '[object Int8Array]',
      int16Tag = '[object Int16Array]',
      int32Tag = '[object Int32Array]',
      uint8Tag = '[object Uint8Array]',
      uint8ClampedTag = '[object Uint8ClampedArray]',
      uint16Tag = '[object Uint16Array]',
      uint32Tag = '[object Uint32Array]';

  /** Used to match empty string literals in compiled template source. */
  var reEmptyStringLeading = /\b__p \+= '';/g,
      reEmptyStringMiddle = /\b(__p \+=) '' \+/g,
      reEmptyStringTrailing = /(__e\(.*?\)|\b__t\)) \+\n'';/g;

  /** Used to match HTML entities and HTML characters. */
  var reEscapedHtml = /&(?:amp|lt|gt|quot|#39);/g,
      reUnescapedHtml = /[&<>"']/g,
      reHasEscapedHtml = RegExp(reEscapedHtml.source),
      reHasUnescapedHtml = RegExp(reUnescapedHtml.source);

  /** Used to match template delimiters. */
  var reEscape = /<%-([\s\S]+?)%>/g,
      reEvaluate = /<%([\s\S]+?)%>/g,
      reInterpolate = /<%=([\s\S]+?)%>/g;

  /** Used to match property names within property paths. */
  var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
      reIsPlainProp = /^\w*$/,
      rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;

  /**
   * Used to match `RegExp`
   * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
   */
  var reRegExpChar = /[\\^$.*+?()[\]{}|]/g,
      reHasRegExpChar = RegExp(reRegExpChar.source);

  /** Used to match leading whitespace. */
  var reTrimStart = /^\s+/;

  /** Used to match a single whitespace character. */
  var reWhitespace = /\s/;

  /** Used to match wrap detail comments. */
  var reWrapComment = /\{(?:\n\/\* \[wrapped with .+\] \*\/)?\n?/,
      reWrapDetails = /\{\n\/\* \[wrapped with (.+)\] \*/,
      reSplitDetails = /,? & /;

  /** Used to match words composed of alphanumeric characters. */
  var reAsciiWord = /[^\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\x7f]+/g;

  /**
   * Used to validate the `validate` option in `_.template` variable.
   *
   * Forbids characters which could potentially change the meaning of the function argument definition:
   * - "()," (modification of function parameters)
   * - "=" (default value)
   * - "[]{}" (destructuring of function parameters)
   * - "/" (beginning of a comment)
   * - whitespace
   */
  var reForbiddenIdentifierChars = /[()=,{}\[\]\/\s]/;

  /** Used to match backslashes in property paths. */
  var reEscapeChar = /\\(\\)?/g;

  /**
   * Used to match
   * [ES template delimiters](http://ecma-international.org/ecma-262/7.0/#sec-template-literal-lexical-components).
   */
  var reEsTemplate = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;

  /** Used to match `RegExp` flags from their coerced string values. */
  var reFlags = /\w*$/;

  /** Used to detect bad signed hexadecimal string values. */
  var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

  /** Used to detect binary string values. */
  var reIsBinary = /^0b[01]+$/i;

  /** Used to detect host constructors (Safari). */
  var reIsHostCtor = /^\[object .+?Constructor\]$/;

  /** Used to detect octal string values. */
  var reIsOctal = /^0o[0-7]+$/i;

  /** Used to detect unsigned integer values. */
  var reIsUint = /^(?:0|[1-9]\d*)$/;

  /** Used to match Latin Unicode letters (excluding mathematical operators). */
  var reLatin = /[\xc0-\xd6\xd8-\xf6\xf8-\xff\u0100-\u017f]/g;

  /** Used to ensure capturing order of template delimiters. */
  var reNoMatch = /($^)/;

  /** Used to match unescaped characters in compiled string literals. */
  var reUnescapedString = /['\n\r\u2028\u2029\\]/g;

  /** Used to compose unicode character classes. */
  var rsAstralRange = '\\ud800-\\udfff',
      rsComboMarksRange = '\\u0300-\\u036f',
      reComboHalfMarksRange = '\\ufe20-\\ufe2f',
      rsComboSymbolsRange = '\\u20d0-\\u20ff',
      rsComboRange = rsComboMarksRange + reComboHalfMarksRange + rsComboSymbolsRange,
      rsDingbatRange = '\\u2700-\\u27bf',
      rsLowerRange = 'a-z\\xdf-\\xf6\\xf8-\\xff',
      rsMathOpRange = '\\xac\\xb1\\xd7\\xf7',
      rsNonCharRange = '\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf',
      rsPunctuationRange = '\\u2000-\\u206f',
      rsSpaceRange = ' \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000',
      rsUpperRange = 'A-Z\\xc0-\\xd6\\xd8-\\xde',
      rsVarRange = '\\ufe0e\\ufe0f',
      rsBreakRange = rsMathOpRange + rsNonCharRange + rsPunctuationRange + rsSpaceRange;

  /** Used to compose unicode capture groups. */
  var rsApos = "['\u2019]",
      rsAstral = '[' + rsAstralRange + ']',
      rsBreak = '[' + rsBreakRange + ']',
      rsCombo = '[' + rsComboRange + ']',
      rsDigits = '\\d+',
      rsDingbat = '[' + rsDingbatRange + ']',
      rsLower = '[' + rsLowerRange + ']',
      rsMisc = '[^' + rsAstralRange + rsBreakRange + rsDigits + rsDingbatRange + rsLowerRange + rsUpperRange + ']',
      rsFitz = '\\ud83c[\\udffb-\\udfff]',
      rsModifier = '(?:' + rsCombo + '|' + rsFitz + ')',
      rsNonAstral = '[^' + rsAstralRange + ']',
      rsRegional = '(?:\\ud83c[\\udde6-\\uddff]){2}',
      rsSurrPair = '[\\ud800-\\udbff][\\udc00-\\udfff]',
      rsUpper = '[' + rsUpperRange + ']',
      rsZWJ = '\\u200d';

  /** Used to compose unicode regexes. */
  var rsMiscLower = '(?:' + rsLower + '|' + rsMisc + ')',
      rsMiscUpper = '(?:' + rsUpper + '|' + rsMisc + ')',
      rsOptContrLower = '(?:' + rsApos + '(?:d|ll|m|re|s|t|ve))?',
      rsOptContrUpper = '(?:' + rsApos + '(?:D|LL|M|RE|S|T|VE))?',
      reOptMod = rsModifier + '?',
      rsOptVar = '[' + rsVarRange + ']?',
      rsOptJoin = '(?:' + rsZWJ + '(?:' + [rsNonAstral, rsRegional, rsSurrPair].join('|') + ')' + rsOptVar + reOptMod + ')*',
      rsOrdLower = '\\d*(?:1st|2nd|3rd|(?![123])\\dth)(?=\\b|[A-Z_])',
      rsOrdUpper = '\\d*(?:1ST|2ND|3RD|(?![123])\\dTH)(?=\\b|[a-z_])',
      rsSeq = rsOptVar + reOptMod + rsOptJoin,
      rsEmoji = '(?:' + [rsDingbat, rsRegional, rsSurrPair].join('|') + ')' + rsSeq,
      rsSymbol = '(?:' + [rsNonAstral + rsCombo + '?', rsCombo, rsRegional, rsSurrPair, rsAstral].join('|') + ')';

  /** Used to match apostrophes. */
  var reApos = RegExp(rsApos, 'g');

  /**
   * Used to match [combining diacritical marks](https://en.wikipedia.org/wiki/Combining_Diacritical_Marks) and
   * [combining diacritical marks for symbols](https://en.wikipedia.org/wiki/Combining_Diacritical_Marks_for_Symbols).
   */
  var reComboMark = RegExp(rsCombo, 'g');

  /** Used to match [string symbols](https://mathiasbynens.be/notes/javascript-unicode). */
  var reUnicode = RegExp(rsFitz + '(?=' + rsFitz + ')|' + rsSymbol + rsSeq, 'g');

  /** Used to match complex or compound words. */
  var reUnicodeWord = RegExp([
    rsUpper + '?' + rsLower + '+' + rsOptContrLower + '(?=' + [rsBreak, rsUpper, '$'].join('|') + ')',
    rsMiscUpper + '+' + rsOptContrUpper + '(?=' + [rsBreak, rsUpper + rsMiscLower, '$'].join('|') + ')',
    rsUpper + '?' + rsMiscLower + '+' + rsOptContrLower,
    rsUpper + '+' + rsOptContrUpper,
    rsOrdUpper,
    rsOrdLower,
    rsDigits,
    rsEmoji
  ].join('|'), 'g');

  /** Used to detect strings with [zero-width joiners or code points from the astral planes](http://eev.ee/blog/2015/09/12/dark-corners-of-unicode/). */
  var reHasUnicode = RegExp('[' + rsZWJ + rsAstralRange  + rsComboRange + rsVarRange + ']');

  /** Used to detect strings that need a more robust regexp to match words. */
  var reHasUnicodeWord = /[a-z][A-Z]|[A-Z]{2}[a-z]|[0-9][a-zA-Z]|[a-zA-Z][0-9]|[^a-zA-Z0-9 ]/;

  /** Used to assign default `context` object properties.
   *
   * 默认上下文对象属性列表。
   * 用于 lodash 在某些环境中运行时（如 Web Worker），
   * 需要明确指定全局对象属性来源。
   *
   * 包含：原生构造函数（Array, Date 等）、TypedArray、全局函数（setTimeout 等），
   * 以及特殊值（_ 自身）。
   */
  var contextProps = [
    'Array', 'Buffer', 'DataView', 'Date', 'Error', 'Float32Array', 'Float64Array',
    'Function', 'Int8Array', 'Int16Array', 'Int32Array', 'Map', 'Math', 'Object',
    'Promise', 'RegExp', 'Set', 'String', 'Symbol', 'TypeError', 'Uint8Array',
    'Uint8ClampedArray', 'Uint16Array', 'Uint32Array', 'WeakMap',
    '_', 'clearTimeout', 'isFinite', 'parseInt', 'setTimeout'
  ];

  /** Used to make template sourceURLs easier to identify. */
  var templateCounter = -1;

  /** Used to identify `toStringTag` values of typed arrays.
   *
   * typed array 的 toStringTag 查找表。
   * 用于快速判断一个对象的 [[Class]] 是否为 typed array。
   *
   * true: Float32Array, Float64Array, Int8Array, Int16Array, Int32Array,
   *       Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array
   * false: Array, Object, Error, Date 等
   */
  var typedArrayTags = {};
  typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
  typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
  typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
  typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
  typedArrayTags[uint32Tag] = true;
  typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
  typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
  typedArrayTags[dataViewTag] = typedArrayTags[dateTag] =
  typedArrayTags[errorTag] = typedArrayTags[funcTag] =
  typedArrayTags[mapTag] = typedArrayTags[numberTag] =
  typedArrayTags[objectTag] = typedArrayTags[regexpTag] =
  typedArrayTags[setTag] = typedArrayTags[stringTag] =
  typedArrayTags[weakMapTag] = false;

  /** Used to identify `toStringTag` values supported by `_.clone`.
   *
   * _.clone 支持的类型的查找表。
   * 某些类型（如 Error, Function, WeakMap）不能被克隆。
   *
   * cloneableTags[tag] = true 表示该类型可以被克隆
   */
  var cloneableTags = {};
  cloneableTags[argsTag] = cloneableTags[arrayTag] =
  cloneableTags[arrayBufferTag] = cloneableTags[dataViewTag] =
  cloneableTags[boolTag] = cloneableTags[dateTag] =
  cloneableTags[float32Tag] = cloneableTags[float64Tag] =
  cloneableTags[int8Tag] = cloneableTags[int16Tag] =
  cloneableTags[int32Tag] = cloneableTags[mapTag] =
  cloneableTags[numberTag] = cloneableTags[objectTag] =
  cloneableTags[regexpTag] = cloneableTags[setTag] =
  cloneableTags[stringTag] = cloneableTags[symbolTag] =
  cloneableTags[uint8Tag] = cloneableTags[uint8ClampedTag] =
  cloneableTags[uint16Tag] = cloneableTags[uint32Tag] = true;
  cloneableTags[errorTag] = cloneableTags[funcTag] =
  cloneableTags[weakMapTag] = false;

  /** Used to map Latin Unicode letters to basic Latin letters. */
  var deburredLetters = {
    // Latin-1 Supplement block.
    '\xc0': 'A',  '\xc1': 'A', '\xc2': 'A', '\xc3': 'A', '\xc4': 'A', '\xc5': 'A',
    '\xe0': 'a',  '\xe1': 'a', '\xe2': 'a', '\xe3': 'a', '\xe4': 'a', '\xe5': 'a',
    '\xc7': 'C',  '\xe7': 'c',
    '\xd0': 'D',  '\xf0': 'd',
    '\xc8': 'E',  '\xc9': 'E', '\xca': 'E', '\xcb': 'E',
    '\xe8': 'e',  '\xe9': 'e', '\xea': 'e', '\xeb': 'e',
    '\xcc': 'I',  '\xcd': 'I', '\xce': 'I', '\xcf': 'I',
    '\xec': 'i',  '\xed': 'i', '\xee': 'i', '\xef': 'i',
    '\xd1': 'N',  '\xf1': 'n',
    '\xd2': 'O',  '\xd3': 'O', '\xd4': 'O', '\xd5': 'O', '\xd6': 'O', '\xd8': 'O',
    '\xf2': 'o',  '\xf3': 'o', '\xf4': 'o', '\xf5': 'o', '\xf6': 'o', '\xf8': 'o',
    '\xd9': 'U',  '\xda': 'U', '\xdb': 'U', '\xdc': 'U',
    '\xf9': 'u',  '\xfa': 'u', '\xfb': 'u', '\xfc': 'u',
    '\xdd': 'Y',  '\xfd': 'y', '\xff': 'y',
    '\xc6': 'Ae', '\xe6': 'ae',
    '\xde': 'Th', '\xfe': 'th',
    '\xdf': 'ss',
    // Latin Extended-A block.
    '\u0100': 'A',  '\u0102': 'A', '\u0104': 'A',
    '\u0101': 'a',  '\u0103': 'a', '\u0105': 'a',
    '\u0106': 'C',  '\u0108': 'C', '\u010a': 'C', '\u010c': 'C',
    '\u0107': 'c',  '\u0109': 'c', '\u010b': 'c', '\u010d': 'c',
    '\u010e': 'D',  '\u0110': 'D', '\u010f': 'd', '\u0111': 'd',
    '\u0112': 'E',  '\u0114': 'E', '\u0116': 'E', '\u0118': 'E', '\u011a': 'E',
    '\u0113': 'e',  '\u0115': 'e', '\u0117': 'e', '\u0119': 'e', '\u011b': 'e',
    '\u011c': 'G',  '\u011e': 'G', '\u0120': 'G', '\u0122': 'G',
    '\u011d': 'g',  '\u011f': 'g', '\u0121': 'g', '\u0123': 'g',
    '\u0124': 'H',  '\u0126': 'H', '\u0125': 'h', '\u0127': 'h',
    '\u0128': 'I',  '\u012a': 'I', '\u012c': 'I', '\u012e': 'I', '\u0130': 'I',
    '\u0129': 'i',  '\u012b': 'i', '\u012d': 'i', '\u012f': 'i', '\u0131': 'i',
    '\u0134': 'J',  '\u0135': 'j',
    '\u0136': 'K',  '\u0137': 'k', '\u0138': 'k',
    '\u0139': 'L',  '\u013b': 'L', '\u013d': 'L', '\u013f': 'L', '\u0141': 'L',
    '\u013a': 'l',  '\u013c': 'l', '\u013e': 'l', '\u0140': 'l', '\u0142': 'l',
    '\u0143': 'N',  '\u0145': 'N', '\u0147': 'N', '\u014a': 'N',
    '\u0144': 'n',  '\u0146': 'n', '\u0148': 'n', '\u014b': 'n',
    '\u014c': 'O',  '\u014e': 'O', '\u0150': 'O',
    '\u014d': 'o',  '\u014f': 'o', '\u0151': 'o',
    '\u0154': 'R',  '\u0156': 'R', '\u0158': 'R',
    '\u0155': 'r',  '\u0157': 'r', '\u0159': 'r',
    '\u015a': 'S',  '\u015c': 'S', '\u015e': 'S', '\u0160': 'S',
    '\u015b': 's',  '\u015d': 's', '\u015f': 's', '\u0161': 's',
    '\u0162': 'T',  '\u0164': 'T', '\u0166': 'T',
    '\u0163': 't',  '\u0165': 't', '\u0167': 't',
    '\u0168': 'U',  '\u016a': 'U', '\u016c': 'U', '\u016e': 'U', '\u0170': 'U', '\u0172': 'U',
    '\u0169': 'u',  '\u016b': 'u', '\u016d': 'u', '\u016f': 'u', '\u0171': 'u', '\u0173': 'u',
    '\u0174': 'W',  '\u0175': 'w',
    '\u0176': 'Y',  '\u0177': 'y', '\u0178': 'Y',
    '\u0179': 'Z',  '\u017b': 'Z', '\u017d': 'Z',
    '\u017a': 'z',  '\u017c': 'z', '\u017e': 'z',
    '\u0132': 'IJ', '\u0133': 'ij',
    '\u0152': 'Oe', '\u0153': 'oe',
    '\u0149': "'n", '\u017f': 's'
  };

  /** Used to map characters to HTML entities. */
  var htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  /** Used to map HTML entities to characters. */
  var htmlUnescapes = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'"
  };

  /** Used to escape characters for inclusion in compiled string literals. */
  var stringEscapes = {
    '\\': '\\',
    "'": "'",
    '\n': 'n',
    '\r': 'r',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  /** Built-in method references without a dependency on `root`. */
  var freeParseFloat = parseFloat,
      freeParseInt = parseInt;

  /** Detect free variable `global` from Node.js. */
  var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

  /** Detect free variable `self`. */
  var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

  /** Used as a reference to the global object. */
  var root = freeGlobal || freeSelf || Function('return this')();

  /** Detect free variable `exports`. */
  var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;

  /** Detect free variable `module`. */
  var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;

  /** Detect the popular CommonJS extension `module.exports`. */
  var moduleExports = freeModule && freeModule.exports === freeExports;

  /** Detect free variable `process` from Node.js. */
  var freeProcess = moduleExports && freeGlobal.process;

  /** Used to access faster Node.js helpers. */
  var nodeUtil = (function() {
    try {
      // Use `util.types` for Node.js 10+.
      var types = freeModule && freeModule.require && freeModule.require('util').types;

      if (types) {
        return types;
      }

      // Legacy `process.binding('util')` for Node.js < 10.
      return freeProcess && freeProcess.binding && freeProcess.binding('util');
    } catch (e) {}
  }());

  /* Node.js helper references. */
  var nodeIsArrayBuffer = nodeUtil && nodeUtil.isArrayBuffer,
      nodeIsDate = nodeUtil && nodeUtil.isDate,
      nodeIsMap = nodeUtil && nodeUtil.isMap,
      nodeIsRegExp = nodeUtil && nodeUtil.isRegExp,
      nodeIsSet = nodeUtil && nodeUtil.isSet,
      nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;

  /*--------------------------------------------------------------------------*/

  /**
   * A faster alternative to `Function#apply`, this function invokes `func`
   * with the `this` binding of `thisArg` and the arguments of `args`.
   *
   * @private
   * @param {Function} func The function to invoke.
   * @param {*} thisArg The `this` binding of `func`.
   * @param {Array} args The arguments to invoke `func` with.
   * @returns {*} Returns the result of `func`.
   */
  function apply(func, thisArg, args) {
    switch (args.length) {
      case 0: return func.call(thisArg);
      case 1: return func.call(thisArg, args[0]);
      case 2: return func.call(thisArg, args[0], args[1]);
      case 3: return func.call(thisArg, args[0], args[1], args[2]);
    }
    return func.apply(thisArg, args);
  }

  /**
   * arrayAggregator 数组专用版本。
   *
   * @private
   * @param {Array} [array] 要遍历的数组。
   * @param {Function} setter 设置累加器值的函数。
   * @param {Function} iteratee 转换键的迭代器函数。
   * @param {Object} accumulator 初始聚合对象。
   * @returns {Function} 返回累加器。
   *
   * arrayAggregator 实现：
   * - 遍历数组，按 iteratee 转换后的值作为键，将元素聚合到 accumulator 中
   * - 常用于 groupBy、countBy 等聚合操作
   */
  function arrayAggregator(array, setter, iteratee, accumulator) {
    var index = -1,
        length = array == null ? 0 : array.length;

    while (++index < length) {
      var value = array[index];
      setter(accumulator, value, iteratee(value), array);
    }
    return accumulator;
  }

  /**
   * arrayEach 数组专用版本，不支持 iteratee 简写形式。
   *
   * @private
   * @param {Array} [array] 要遍历的数组。
   * @param {Function} iteratee 每次迭代调用的函数。
   * @returns {Array} 返回数组本身。
   *
   * arrayEach 实现：
   * - while 循环遍历数组，比 for 循环性能更好
   * - 如果 iteratee 返回 false，立即终止遍历（early exit）
   * - 返回原数组以支持链式调用
   */
  function arrayEach(array, iteratee) {
    var index = -1,
        length = array == null ? 0 : array.length;

    while (++index < length) {
      if (iteratee(array[index], index, array) === false) {
        break;
      }
    }
    return array;
  }

  /**
   * arrayEachRight 数组专用版本，从右向左遍历，不支持 iteratee 简写形式。
   *
   * @private
   * @param {Array} [array] 要遍历的数组。
   * @param {Function} iteratee 每次迭代调用的函数。
   * @returns {Array} 返回数组本身。
   *
   * arrayEachRight 实现：
   * - while 循环从末尾向前遍历（length--）
   * - 如果 iteratee 返回 false，立即终止遍历
   */
  function arrayEachRight(array, iteratee) {
    var length = array == null ? 0 : array.length;

    while (length--) {
      if (iteratee(array[length], length, array) === false) {
        break;
      }
    }
    return array;
  }

  /**
   * arrayEvery 数组专用版本，不支持 iteratee 简写形式。
   *
   * @private
   * @param {Array} [array] 要遍历的数组。
   * @param {Function} predicate 每次迭代调用的谓词函数。
   * @returns {boolean} 所有元素都通过谓词检查返回 true，否则返回 false。
   *
   * arrayEvery 实现：
   * - 短路求值：遇到第一个不满足谓词的元素立即返回 false
   * - 所有元素都满足才返回 true
   */
  function arrayEvery(array, predicate) {
    var index = -1,
        length = array == null ? 0 : array.length;

    while (++index < length) {
      if (!predicate(array[index], index, array)) {
        return false;
      }
    }
    return true;
  }

  /**
   * arrayFilter 数组专用版本，不支持 iteratee 简写形式。
   *
   * @private
   * @param {Array} [array] 要遍历的数组。
   * @param {Function} predicate 每次迭代调用的谓词函数。
   * @returns {Array} 返回过滤后的新数组。
   *
   * arrayFilter 实现：
   * - 预分配结果数组 + 索引追踪，比 push 更快
   * - 只收集满足谓词条件的元素
   */
  function arrayFilter(array, predicate) {
    var index = -1,
        length = array == null ? 0 : array.length,
        resIndex = 0,
        result = [];

    while (++index < length) {
      var value = array[index];
      if (predicate(value, index, array)) {
        result[resIndex++] = value;
      }
    }
    return result;
  }

  /**
   * arrayIncludes 数组专用版本，不支持指定起始搜索索引。
   *
   * @private
   * @param {Array} [array] 要检查的数组。
   * @param {*} target 要搜索的值。
   * @returns {boolean} 如果找到目标值返回 true，否则返回 false。
   *
   * arrayIncludes 实现：
   * - 使用 baseIndexOf 进行查找
   * - 短路优化：空数组直接返回 false
   */
  function arrayIncludes(array, value) {
    var length = array == null ? 0 : array.length;
    return !!length && baseIndexOf(array, value, 0) > -1;
  }

  /**
   * arrayIncludes 的变体，支持自定义比较器。
   *
   * @private
   * @param {Array} [array] 要检查的数组。
   * @param {*} target 要搜索的值。
   * @param {Function} comparator 每个元素调用的比较器。
   * @returns {boolean} 如果找到目标值返回 true，否则返回 false。
   *
   * arrayIncludesWith 实现：
   * - 使用 comparator 而非严格相等比较
   * - 短路返回：找到第一个匹配立即返回 true
   */
  function arrayIncludesWith(array, value, comparator) {
    var index = -1,
        length = array == null ? 0 : array.length;

    while (++index < length) {
      if (comparator(value, array[index])) {
        return true;
      }
    }
    return false;
  }

  /**
   * arrayMap 数组专用版本，不支持 iteratee 简写形式。
   *
   * @private
   * @param {Array} [array] 要遍历的数组。
   * @param {Function} iteratee 每次迭代调用的函数。
   * @returns {Array} 返回转换后的新数组。
   *
   * arrayMap 实现：
   * - 预分配数组，比 push 更快
   * - 对每个元素应用 iteratee 转换
   */
  function arrayMap(array, iteratee) {
    var index = -1,
        length = array == null ? 0 : array.length,
        result = Array(length);

    while (++index < length) {
      result[index] = iteratee(array[index], index, array);
    }
    return result;
  }

  /**
   * 将 values 的元素追加到 array 数组。
   *
   * @private
   * @param {Array} array 要修改的数组。
   * @param {Array} values 要追加的值。
   * @returns {Array} 返回修改后的数组。
   *
   * arrayPush 实现：
   * - 直接通过索引赋值，比 push 更快
   * - 使用 offset 计算初始位置
   */
  function arrayPush(array, values) {
    var index = -1,
        length = values.length,
        offset = array.length;

    while (++index < length) {
      array[offset + index] = values[index];
    }
    return array;
  }

  /**
   * arrayReduce 数组专用版本，不支持 iteratee 简写形式。
   *
   * @private
   * @param {Array} [array] 要遍历的数组。
   * @param {Function} iteratee 每次迭代调用的函数。
   * @param {*} [accumulator] 初始值。
   * @param {boolean} [initAccum] 指定使用数组的第一个元素作为初始值。
   * @returns {*} 返回累积值。
   *
   * arrayReduce 实现：
   * - initAccum 控制是否使用首元素作为初始值
   * - 标准 reduce 逻辑：遍历并应用 iteratee
   */
  function arrayReduce(array, iteratee, accumulator, initAccum) {
    var index = -1,
        length = array == null ? 0 : array.length;

    if (initAccum && length) {
      accumulator = array[++index];
    }
    while (++index < length) {
      accumulator = iteratee(accumulator, array[index], index, array);
    }
    return accumulator;
  }

  /**
   * arrayReduceRight 数组专用版本，从右向左遍历，不支持 iteratee 简写形式。
   *
   * @private
   * @param {Array} [array] 要遍历的数组。
   * @param {Function} iteratee 每次迭代调用的函数。
   * @param {*} [accumulator] 初始值。
   * @param {boolean} [initAccum] 指定使用数组的最后一个元素作为初始值。
   * @returns {*} 返回累积值。
   *
   * arrayReduceRight 实现：
   * - 从数组末尾开始向前遍历
   * - 使用 --length 而非 length--
   */
  function arrayReduceRight(array, iteratee, accumulator, initAccum) {
    var length = array == null ? 0 : array.length;
    if (initAccum && length) {
      accumulator = array[--length];
    }
    while (length--) {
      accumulator = iteratee(accumulator, array[length], length, array);
    }
    return accumulator;
  }

  /**
   * arraySome 数组专用版本，不支持 iteratee 简写形式。
   *
   * @private
   * @param {Array} [array] 要遍历的数组。
   * @param {Function} predicate 每次迭代调用的谓词函数。
   * @returns {boolean} 如果任一元素通过谓词检查返回 true，否则返回 false。
   *
   * arraySome 实现：
   * - 短路求值：找到第一个匹配立即返回 true
   */
  function arraySome(array, predicate) {
    var index = -1,
        length = array == null ? 0 : array.length;

    while (++index < length) {
      if (predicate(array[index], index, array)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 获取 ASCII 字符串的大小。
   *
   * @private
   * @param {string} string 要检查的字符串。
   * @returns {number} 返回字符串大小。
   */
  var asciiSize = baseProperty('length');

  /**
   * 将 ASCII 字符串转换为数组。
   *
   * @private
   * @param {string} string 要转换的字符串。
   * @returns {Array} 返回转换后的数组。
   *
   * asciiToArray 实现：
   * - 使用空字符串分割，每个字符成为数组元素
   */
  function asciiToArray(string) {
    return string.split('');
  }

  /**
   * 将 ASCII 字符串分割为单词数组。
   *
   * @private
   * @param {string} string 要检查的字符串。
   * @returns {Array} 返回字符串的单词数组。
   *
   * asciiWords 实现：
   * - 使用正则 reAsciiWord 匹配单词
   * - 返回匹配结果或空数组
   */
  function asciiWords(string) {
    return string.match(reAsciiWord) || [];
  }

  /**
   * baseFindKey 基础实现，用于 _.findKey 和 _.findLastKey。
   * 不支持 iteratee 简写形式，通过 eachFunc 遍历集合。
   *
   * @private
   * @param {Array|Object} collection 要检查的集合。
   * @param {Function} predicate 每次迭代调用的谓词函数。
   * @param {Function} eachFunc 遍历集合的函数。
   * @returns {*} 返回找到的元素的键，未找到则返回 undefined。
   *
   * baseFindKey 实现原理：
   *
   * 1. 遍历集合：委托给 eachFunc 进行遍历（可以是 arrayEach 或 collectionEach）
   * 2. 谓词检测：对每个元素调用 predicate(value, key, collection)
   * 3. 短路返回：当 predicate 返回 true 时，立即返回当前 key
   * 4. 默认返回：如果未找到，返回 undefined
   *
   * 设计模式：
   * - 委托模式：遍历逻辑委托给 eachFunc
   * - early exit：通过返回 false 提前终止遍历
   *
   * 示例：
   * baseFindKey({a: 1, b: 2}, v => v > 1, collectionEach) // => 'b'
   */
  function baseFindKey(collection, predicate, eachFunc) {
    var result;
    eachFunc(collection, function(value, key, collection) {
      if (predicate(value, key, collection)) {
        result = key;
        return false;
      }
    });
    return result;
  }

  /**
   * baseFindIndex 基础实现，用于 _.findIndex 和 _.findLastIndex。
   * 不支持 iteratee 简写形式。
   *
   * @private
   * @param {Array} array 要检查的数组。
   * @param {Function} predicate 每次迭代调用的谓词函数。
   * @param {number} fromIndex 搜索起始索引。
   * @param {boolean} [fromRight] 指定从右到左遍历。
   * @returns {number} 找到的值的索引，未找到返回 -1。
   *
   * baseFindIndex 实现原理：
   *
   * 1. 方向感知：根据 fromRight 参数调整遍历方向
   *    - 从左到右：index 从 fromIndex 开始递增
   *    - 从右到左：index 从 fromIndex 开始递减
   * 2. 谓词匹配：对每个元素调用 predicate(element, index, array)
   * 3. 短路返回：找到第一个匹配立即返回索引
   * 4. 默认返回：未找到返回 -1
   *
   * 性能优化：
   * - while 循环比 for 循环更快
   * - 单一条件判断结合方向控制
   *
   * 示例：
   * baseFindIndex([1, 2, 3, 4], x => x > 2, 0, false)  // => 2
   * baseFindIndex([1, 2, 3, 4], x => x > 2, 3, true)   // => 2 (从右向左)
   */
  function baseFindIndex(array, predicate, fromIndex, fromRight) {
    var length = array.length,
        index = fromIndex + (fromRight ? 1 : -1);

    while ((fromRight ? index-- : ++index < length)) {
      if (predicate(array[index], index, array)) {
        return index;
      }
    }
    return -1;
  }

  /**
   * baseIndexOf 基础实现，不进行 fromIndex 边界检查。
   *
   * @private
   * @param {Array} array 要检查的数组。
   * @param {*} value 要搜索的值。
   * @param {number} fromIndex 搜索起始索引。
   * @returns {number} 找到的值的索引，未找到返回 -1。
   *
   * baseIndexOf 实现：
   * - NaN 检测：NaN !== NaN，使用 baseFindIndex + baseIsNaN
   * - 正常值：使用 strictIndexOf
   */
  function baseIndexOf(array, value, fromIndex) {
    return value === value
      ? strictIndexOf(array, value, fromIndex)
      : baseFindIndex(array, baseIsNaN, fromIndex);
  }

  /**
   * baseIndexOf 的变体，支持自定义比较器。
   *
   * @private
   * @param {Array} array 要检查的数组。
   * @param {*} value 要搜索的值。
   * @param {number} fromIndex 搜索起始索引。
   * @param {Function} comparator 每个元素调用的比较器。
   * @returns {number} 找到的值的索引，未找到返回 -1。
   *
   * baseIndexOfWith 实现：
   * - 使用 comparator 而非严格相等比较
   * - 短路返回：找到第一个匹配立即返回索引
   */
  function baseIndexOfWith(array, value, fromIndex, comparator) {
    var index = fromIndex - 1,
        length = array.length;

    while (++index < length) {
      if (comparator(array[index], value)) {
        return index;
      }
    }
    return -1;
  }

  /**
   * baseIsNaN 基础实现，不支持数字对象。
   *
   * @private
   * @param {*} value 要检查的值。
   * @returns {boolean} 如果值是 NaN 返回 true，否则返回 false。
   *
   * baseIsNaN 实现：
   * - NaN 是唯一一个不等于自身的值
   * - value !== value 为 true 当且仅当 value 是 NaN
   */
  function baseIsNaN(value) {
    return value !== value;
  }

  /**
   * baseMean 基础实现，用于 _.mean 和 _.meanBy，不支持 iteratee 简写形式。
   *
   * @private
   * @param {Array} array 要遍历的数组。
   * @param {Function} iteratee 每次迭代调用的函数。
   * @returns {number} 返回平均值。
   *
   * baseMean 实现：
   * - 使用 baseSum 计算总和
   * - 除以数组长度得到平均值
   * - 空数组返回 NaN
   */
  function baseMean(array, iteratee) {
    var length = array == null ? 0 : array.length;
    return length ? (baseSum(array, iteratee) / length) : NAN;
  }

  /**
   * baseProperty 基础实现，不支持深层路径。
   *
    * @private
    * @param {string} key 要获取的属性键。
    * @returns {Function} 返回新的访问器函数。
    *
    * baseProperty 实现：
    * - 返回一个函数，接收对象并返回其 key 属性值
    * - 兼容 null/undefined 输入
    */
  function baseProperty(key) {
    return function(object) {
      return object == null ? undefined : object[key];
    };
  }

  /**
   * basePropertyOf 基础实现，不支持深层路径。
   *
   * @private
   * @param {Object} object 要查询的对象。
   * @returns {Function} 返回新的访问器函数。
   *
   * basePropertyOf 实现：
   * - 与 baseProperty 相反，返回的函数以对象为上下文
   * - 返回一个函数，接收键并从 object 中获取值
   */
  function basePropertyOf(object) {
    return function(key) {
      return object == null ? undefined : object[key];
    };
  }

  /**
   * baseReduce 基础实现，用于 _.reduce 和 _.reduceRight。
   * 不支持 iteratee 简写形式，通过 eachFunc 遍历集合。
   *
   * @private
   * @param {Array|Object} collection 要遍历的集合。
   * @param {Function} iteratee 每次迭代调用的函数。
   * @param {*} accumulator 初始值。
   * @param {boolean} initAccum 指定使用集合的第一个或最后一个元素作为初始值。
   * @param {Function} eachFunc 遍历集合的函数。
   * @returns {*} 返回累积值。
   *
   * baseReduce 实现原理：
   *
   * 核心算法：
   * 1. 初始化检测：如果 initAccum 为 true，使用集合的第一个/最后一个元素作为初始值
   * 2. 迭代累积：对每个元素调用 iteratee(accumulator, value, index, collection)
   * 3. 结果返回：返回最终的 accumulator 值
   *
   * 实现技巧：
   * - initAccum 作为哨兵值：第一次迭代后将其设为 false，确保只使用一次
   * - 利用闭包：accumulator 在迭代过程中被更新
   *
   * reduce vs reduceRight：
   * - reduce：使用 arrayEach，从左到右遍历
   * - reduceRight：使用 arrayEachRight，从右到左遍历
   *
   * 示例：
   * baseReduce([1, 2, 3], (acc, x) => acc + x, 0, false, arrayEach)  // => 6
   * baseReduce([1, 2, 3], (acc, x) => acc + x, 0, true, arrayEachRight) // => 6
   */
  function baseReduce(collection, iteratee, accumulator, initAccum, eachFunc) {
    eachFunc(collection, function(value, index, collection) {
      accumulator = initAccum
        ? (initAccum = false, value)
        : iteratee(accumulator, value, index, collection);
    });
    return accumulator;
  }

  /**
   * baseSortBy 基础实现，使用 comparer 定义数组的排序顺序，
   * 并将条件对象替换为其对应的值。
   *
   * @private
   * @param {Array} array 要排序的数组。
   * @param {Function} comparer 定义排序顺序的函数。
   * @returns {Array} 返回数组。
   *
   * baseSortBy 实现：
   * - 直接修改原数组（使用 Array.sort）
   * - 排序后还原元素（将 criteria 对象替换为实际值）
   */
  function baseSortBy(array, comparer) {
    var length = array.length;

    array.sort(comparer);
    while (length--) {
      array[length] = array[length].value;
    }
    return array;
  }

  /**
   * baseSum 基础实现，用于 _.sum 和 _.sumBy，不支持 iteratee 简写形式。
   *
   * @private
   * @param {Array} array 要遍历的数组。
   * @param {Function} iteratee 每次迭代调用的函数。
   * @returns {number} 返回总和。
   *
   * baseSum 实现：
   * - 累加每个元素调用 iteratee 后的返回值
   * - 跳过 undefined 值
   * - 空数组或所有值都 undefined 返回 undefined
   */
  function baseSum(array, iteratee) {
    var result,
        index = -1,
        length = array.length;

    while (++index < length) {
      var current = iteratee(array[index]);
      if (current !== undefined) {
        result = result === undefined ? current : (result + current);
      }
    }
    return result;
  }

  /**
   * baseTimes 基础实现，不支持 iteratee 简写形式或最大数组长度检查。
   *
   * @private
   * @param {number} n 调用 iteratee 的次数。
   * @param {Function} iteratee 每次迭代调用的函数。
   * @returns {Array} 返回结果数组。
   *
   * baseTimes 实现：
   * - 预分配数组（Array(n)）
   * - 调用 n 次 iteratee，每次传入索引
   */
  function baseTimes(n, iteratee) {
    var index = -1,
        result = Array(n);

    while (++index < n) {
      result[index] = iteratee(index);
    }
    return result;
  }

  /**
   * baseToPairs 基础实现，用于 _.toPairs 和 _.toPairsIn。
   * 为 object 的每个属性名创建键值对数组。
   *
   * @private
   * @param {Object} object 要查询的对象。
   * @param {Array} props 要获取值的属性名数组。
   * @returns {Object} 返回键值对数组。
   *
   * baseToPairs 实现：
   * - 将属性名数组转换为 [[key, value], ...] 格式
   */
  function baseToPairs(object, props) {
    return arrayMap(props, function(key) {
      return [key, object[key]];
    });
  }

  /**
   * baseTrim 基础实现，用于 _.trim。
   *
   * @private
   * @param {string} string 要修剪的字符串。
   * @returns {string} 返回修剪后的字符串。
   */
  function baseTrim(string) {
    return string
      ? string.slice(0, trimmedEndIndex(string) + 1).replace(reTrimStart, '')
      : string;
  }

  /**
   * baseUnary 基础实现，不支持存储元数据。
   *
   * @private
   * @param {Function} func 要限制参数的函数。
   * @returns {Function} 返回新的限制参数的函数。
   *
   * baseUnary 实现：
   * - 将函数限制为只接受一个参数
   * - 忽略任何额外参数
   */
  function baseUnary(func) {
    return function(value) {
      return func(value);
    };
  }

  /**
   * baseValues 基础实现，用于 _.values 和 _.valuesIn。
   * 创建包含 object 属性值的数组，对应于 props 中的属性名。
   *
   * @private
   * @param {Object} object 要查询的对象。
   * @param {Array} props 要获取值的属性名数组。
   * @returns {Object} 返回属性值数组。
   *
   * baseValues 实现：
   * - 提取 object 中指定键对应的值
   */
  function baseValues(object, props) {
    return arrayMap(props, function(key) {
      return object[key];
    });
  }

  /**
   * 检查 cache 中是否存在 key 对应的值。
   *
   * @private
   * @param {Object} cache 要查询的缓存。
   * @param {string} key 要检查的条目的键。
   * @returns {boolean} 如果条目存在返回 true，否则返回 false。
   *
   * cacheHas 实现：
   * - 使用 Map/Set 的 has 方法检查
   */
  function cacheHas(cache, key) {
    return cache.has(key);
  }

  /**
   * _.trim 和 _.trimStart 使用的辅助函数，
   * 获取第一个不在 character symbols 中的字符串符号的索引。
   *
   * @private
   * @param {Array} strSymbols 要检查的字符串符号数组。
   * @param {Array} chrSymbols 要查找的字符符号数组。
   * @returns {number} 返回第一个不匹配的字符串符号的索引。
   */
  function charsStartIndex(strSymbols, chrSymbols) {
    var index = -1,
        length = strSymbols.length;

    while (++index < length && baseIndexOf(chrSymbols, strSymbols[index], 0) > -1) {}
    return index;
  }

  /**
   * _.trim 和 _.trimEnd 使用的辅助函数，
   * 获取最后一个不在 character symbols 中的字符串符号的索引。
   *
   * @private
   * @param {Array} strSymbols 要检查的字符串符号数组。
   * @param {Array} chrSymbols 要查找的字符符号数组。
   * @returns {number} 返回最后一个不匹配的字符串符号的索引。
   */
  function charsEndIndex(strSymbols, chrSymbols) {
    var index = strSymbols.length;

    while (index-- && baseIndexOf(chrSymbols, strSymbols[index], 0) > -1) {}
    return index;
  }

  /**
   * 获取数组中 placeholder 出现的次数。
   *
   * @private
   * @param {Array} array 要检查的数组。
   * @param {*} placeholder 要搜索的占位符。
   * @returns {number} 返回占位符出现的次数。
   */
  function countHolders(array, placeholder) {
    var length = array.length,
        result = 0;

    while (length--) {
      if (array[length] === placeholder) {
        ++result;
      }
    }
    return result;
  }

  /**
   * _.deburr 使用的辅助函数，
   * 将 Latin-1 Supplement 和 Latin Extended-A 字母转换为基本拉丁字母。
   *
   * @private
   * @param {string} letter 要转换的匹配字母。
   * @returns {string} 返回转换后的字母。
   */
  var deburrLetter = basePropertyOf(deburredLetters);

  /**
   * _.escape 使用的辅助函数，将字符转换为 HTML 实体。
   *
   * @private
   * @param {string} chr 要转义的匹配字符。
   * @returns {string} 返回转义后的字符。
   */
  var escapeHtmlChar = basePropertyOf(htmlEscapes);

  /**
   * _.template 使用的辅助函数，转义字符以便包含在编译的字符串字面量中。
   *
   * @private
   * @param {string} chr 要转义的匹配字符。
   * @returns {string} 返回转义后的字符。
   */
  function escapeStringChar(chr) {
    return '\\' + stringEscapes[chr];
  }

  /**
   * 获取对象的指定键的值。
   *
   * @private
   * @param {Object} [object] 要查询的对象。
   * @param {string} key 要获取的属性键。
   * @returns {*} 返回属性值。
   */
  function getValue(object, key) {
    return object == null ? undefined : object[key];
  }

  /**
   * 检查字符串是否包含 Unicode 符号。
   *
   * @private
   * @param {string} string 要检查的字符串。
   * @returns {boolean} 如果找到符号返回 true，否则返回 false。
   */
  function hasUnicode(string) {
    return reHasUnicode.test(string);
  }

  /**
   * 检查字符串是否包含由 Unicode 符号组成的单词。
   *
   * @private
   * @param {string} string 要检查的字符串。
   * @returns {boolean} 如果找到单词返回 true，否则返回 false。
   */
  function hasUnicodeWord(string) {
    return reHasUnicodeWord.test(string);
  }

  /**
   * 将迭代器转换为数组。
   *
   * @private
   * @param {Object} iterator 要转换的迭代器。
   * @returns {Array} 返回转换后的数组。
   */
  function iteratorToArray(iterator) {
    var data,
        result = [];

    while (!(data = iterator.next()).done) {
      result.push(data.value);
    }
    return result;
  }

  /**
   * 将 Map 转换为其键值对数组。
   *
   * @private
   * @param {Object} map 要转换的 Map。
   * @returns {Array} 返回键值对数组。
   */
  function mapToArray(map) {
    var index = -1,
        result = Array(map.size);

    map.forEach(function(value, key) {
      result[++index] = [key, value];
    });
    return result;
  }

  /**
   * 创建一个一元函数，使用转换后的参数调用 `func`。
   *
   * @private
   * @param {Function} func 要包装的函数。
   * @param {Function} transform 参数转换函数。
   * @returns {Function} 返回新的函数。
   */
  function overArg(func, transform) {
    return function(arg) {
      return func(transform(arg));
    };
  }

  /**
   * 将数组中所有 `placeholder` 元素替换为内部占位符，
   * 并返回这些占位符索引的数组。
   *
   * @private
   * @param {Array} array 要修改的数组。
   * @param {*} placeholder 要替换的占位符。
   * @returns {Array} 返回占位符索引的新数组。
   */
  function replaceHolders(array, placeholder) {
    var index = -1,
        length = array.length,
        resIndex = 0,
        result = [];

    while (++index < length) {
      var value = array[index];
      if (value === placeholder || value === PLACEHOLDER) {
        array[index] = PLACEHOLDER;
        result[resIndex++] = index;
      }
    }
    return result;
  }

  /**
   * 将 Set 转换为其值的数组。
   *
   * @private
   * @param {Object} set 要转换的 Set。
   * @returns {Array} 返回值数组。
   */
  function setToArray(set) {
    var index = -1,
        result = Array(set.size);

    set.forEach(function(value) {
      result[++index] = value;
    });
    return result;
  }

  /**
   * 将 Set 转换为其值-值对数组。
   *
   * @private
   * @param {Object} set 要转换的 Set。
   * @returns {Array} 返回值-值对数组。
   */
  function setToPairs(set) {
    var index = -1,
        result = Array(set.size);

    set.forEach(function(value) {
      result[++index] = [value, value];
    });
    return result;
  }

  /**
   * _.indexOf 的专用版本，执行严格相等比较（===）。
   *
   * @private
   * @param {Array} array 要检查的数组。
   * @param {*} value 要搜索的值。
   * @param {number} fromIndex 搜索起始索引。
   * @returns {number} 返回匹配值的索引，否则返回 -1。
   */
  function strictIndexOf(array, value, fromIndex) {
    var index = fromIndex - 1,
        length = array.length;

    while (++index < length) {
      if (array[index] === value) {
        return index;
      }
    }
    return -1;
  }

  /**
   * _.lastIndexOf 的专用版本，执行严格相等比较（===）。
   *
   * @private
   * @param {Array} array 要检查的数组。
   * @param {*} value 要搜索的值。
   * @param {number} fromIndex 搜索起始索引。
   * @returns {number} 返回匹配值的索引，否则返回 -1。
   */
  function strictLastIndexOf(array, value, fromIndex) {
    var index = fromIndex + 1;
    while (index--) {
      if (array[index] === value) {
        return index;
      }
    }
    return index;
  }

  /**
   * 获取字符串中符号的数量。
   *
   * @private
   * @param {string} string 要检查的字符串。
   * @returns {number} 返回字符串大小。
   */
  function stringSize(string) {
    return hasUnicode(string)
      ? unicodeSize(string)
      : asciiSize(string);
  }

  /**
   * 将字符串转换为数组。
   *
   * @private
   * @param {string} string 要转换的字符串。
   * @returns {Array} 返回转换后的数组。
   */
  function stringToArray(string) {
    return hasUnicode(string)
      ? unicodeToArray(string)
      : asciiToArray(string);
  }

  /**
   * _.trim 和 _.trimEnd 使用的辅助函数，
   * 获取字符串中最后一个非空白字符的索引。
   *
   * @private
   * @param {string} string 要检查的字符串。
   * @returns {number} 返回最后一个非空白字符的索引。
   */
  function trimmedEndIndex(string) {
    var index = string.length;

    while (index-- && reWhitespace.test(string.charAt(index))) {}
    return index;
  }

  /**
   * _.unescape 使用的辅助函数，将 HTML 实体转换为字符。
   *
   * @private
   * @param {string} chr 要反转义的匹配字符。
   * @returns {string} 返回反转义后的字符。
   */
  var unescapeHtmlChar = basePropertyOf(htmlUnescapes);

  /**
   * 获取 Unicode 字符串的大小。
   *
   * @private
   * @param {string} string 要检查的字符串。
   * @returns {number} 返回字符串大小。
   */
  function unicodeSize(string) {
    var result = reUnicode.lastIndex = 0;
    while (reUnicode.test(string)) {
      ++result;
    }
    return result;
  }

  /**
   * 将 Unicode 字符串转换为数组。
   *
   * @private
   * @param {string} string 要转换的字符串。
   * @returns {Array} 返回转换后的数组。
   */
  function unicodeToArray(string) {
    return string.match(reUnicode) || [];
  }

  /**
   * 将 Unicode 字符串分割为其单词数组。
   *
   * @private
   * @param {string} string 要检查的字符串。
   * @returns {Array} 返回字符串的单词数组。
   */
  function unicodeWords(string) {
    return string.match(reUnicodeWord) || [];
  }

  /*--------------------------------------------------------------------------*/

  /**
   * 使用 `context` 对象创建一个全新的原始 `lodash` 函数。
   *
   * @static
   * @memberOf _
   * @since 1.1.0
   * @category Util
   * @param {Object} [context=root] 上下文对象。
   * @returns {Function} 返回一个新的 `lodash` 函数。
   * @example
   *
   * _.mixin({ 'foo': _.constant('foo') });
   *
   * var lodash = _.runInContext();
   * lodash.mixin({ 'bar': lodash.constant('bar') });
   *
   * _.isFunction(_.foo);
   * // => true
   * _.isFunction(_.bar);
   * // => false
   *
   * lodash.isFunction(lodash.foo);
   * // => false
   * lodash.isFunction(lodash.bar);
   * // => true
   *
   * // 在 Node.js 中创建一个增强版的 `defer`。
   * var defer = _.runInContext({ 'setTimeout': setImmediate }).defer;
   */
  var runInContext = (function runInContext(context) {
    context = context == null ? root : _.defaults(root.Object(), context, _.pick(root, contextProps));

    /** 内置构造函数引用。 */
    var Array = context.Array,
        Date = context.Date,
        Error = context.Error,
        Function = context.Function,
        Math = context.Math,
        Object = context.Object,
        RegExp = context.RegExp,
        String = context.String,
        TypeError = context.TypeError;

    /** 用于内置方法引用。 */
    var arrayProto = Array.prototype,
        funcProto = Function.prototype,
        objectProto = Object.prototype;

    /** 用于检测覆盖范围的 core-js shims。 */
    var coreJsData = context['__core-js_shared__'];

    /** 用于解析函数的反编译源代码。 */
    var funcToString = funcProto.toString;

    /** 用于检查对象的自有属性。 */
    var hasOwnProperty = objectProto.hasOwnProperty;

    /** 用于生成唯一 ID。 */
    var idCounter = 0;

    /** 用于检测伪装成原生方法的方法。 */
    var maskSrcKey = (function() {
      var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
      return uid ? ('Symbol(src)_1.' + uid) : '';
    }());

    /**
     * 用于解析值的
     * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)。
     */
    var nativeObjectToString = objectProto.toString;

    /** 用于推断 `Object` 构造函数。 */
    var objectCtorString = funcToString.call(Object);

    /** 用于在 `_.noConflict` 中恢复原始 `_` 引用。 */
    var oldDash = root._;

    /** 用于检测方法是否是原生的。 */
    var reIsNative = RegExp('^' +
      funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
      .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
    );

    /** 内置值引用。 */
    var Buffer = moduleExports ? context.Buffer : undefined,
        Symbol = context.Symbol,
        Uint8Array = context.Uint8Array,
        allocUnsafe = Buffer ? Buffer.allocUnsafe : undefined,
        getPrototype = overArg(Object.getPrototypeOf, Object),
        objectCreate = Object.create,
        propertyIsEnumerable = objectProto.propertyIsEnumerable,
        splice = arrayProto.splice,
        spreadableSymbol = Symbol ? Symbol.isConcatSpreadable : undefined,
        symIterator = Symbol ? Symbol.iterator : undefined,
        symToStringTag = Symbol ? Symbol.toStringTag : undefined;

    var defineProperty = (function() {
      try {
        var func = getNative(Object, 'defineProperty');
        func({}, '', {});
        return func;
      } catch (e) {}
    }());

    /** 模拟的内置对象。 */
    var ctxClearTimeout = context.clearTimeout !== root.clearTimeout && context.clearTimeout,
        ctxNow = Date && Date.now !== root.Date.now && Date.now,
        ctxSetTimeout = context.setTimeout !== root.setTimeout && context.setTimeout;

    /* 与其他 `lodash` 方法同名的内置方法引用。 */
    var nativeCeil = Math.ceil,
        nativeFloor = Math.floor,
        nativeGetSymbols = Object.getOwnPropertySymbols,
        nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined,
        nativeIsFinite = context.isFinite,
        nativeJoin = arrayProto.join,
        nativeKeys = overArg(Object.keys, Object),
        nativeMax = Math.max,
        nativeMin = Math.min,
        nativeNow = Date.now,
        nativeParseInt = context.parseInt,
        nativeRandom = Math.random,
        nativeReverse = arrayProto.reverse;

    /* 已验证是原生方法的内置方法引用。 */
    var DataView = getNative(context, 'DataView'),
        Map = getNative(context, 'Map'),
        Promise = getNative(context, 'Promise'),
        Set = getNative(context, 'Set'),
        WeakMap = getNative(context, 'WeakMap'),
        nativeCreate = getNative(Object, 'create');

    /** 用于存储函数元数据。 */
    var metaMap = WeakMap && new WeakMap;

    /** 用于查找未压缩的函数名。 */
    var realNames = {};

    /** 用于检测 maps、sets 和 weakmaps。 */
    var dataViewCtorString = toSource(DataView),
        mapCtorString = toSource(Map),
        promiseCtorString = toSource(Promise),
        setCtorString = toSource(Set),
        weakMapCtorString = toSource(WeakMap);

    /** 用于将符号转换为基础类型和字符串。 */
    var symbolProto = Symbol ? Symbol.prototype : undefined,
        symbolValueOf = symbolProto ? symbolProto.valueOf : undefined,
        symbolToString = symbolProto ? symbolProto.toString : undefined;

    /*------------------------------------------------------------------------*/

    /**
     * 创建一个包装 `value` 的 `lodash` 对象，以启用隐式方法链序列。
     * 操作并返回数组、集合和函数的方法可以链式调用。
     * 检索单个值或可能返回原始值的方法将自动结束链序列
     * 并返回未包装的值。否则，必须使用 `_#value` 解开包装。
     *
     * 显式链序列（必须使用 `_#value` 解开包装）可以使用 `_.chain` 启用。
     *
     * 链式方法的执行是惰性的，即延迟到 `_#value` 被隐式或显式调用时才执行。
     *
     * 惰性求值允许几个方法支持快捷融合。
     * 快捷融合是一种优化技术，用于合并迭代器调用；
     * 这样可以避免创建中间数组，并大大减少迭代器执行次数。
     * 如果链序列的一个部分应用于数组且迭代器只接受一个参数，
     * 则该部分有资格进行快捷融合。
     * 一个部分是否有资格进行快捷融合的启发式方法可能会发生变化。
     *
     * 只要 `_#value` 方法直接或间接包含在构建中，自定义构建就支持链式调用。
     *
     * 除了 lodash 方法外，包装器还具有 `Array` 和 `String` 方法。
     *
     * 包装器的 `Array` 方法有：
     * `concat`、`join`、`pop`、`push`、`shift`、`sort`、`splice` 和 `unshift`
     *
     * 包装器的 `String` 方法有：
     * `replace` 和 `split`
     *
     * 支持快捷融合的包装器方法有：
     * `at`、`compact`、`drop`、`dropRight`、`dropWhile`、`filter`、`find`、
     * `findLast`、`head`、`initial`、`last`、`map`、`reject`、`reverse`、`slice`、
     * `tail`、`take`、`takeRight`、`takeRightWhile`、`takeWhile` 和 `toArray`
     *
     * 可链式调用的包装器方法有：
     * `after`、`ary`、`assign`、`assignIn`、`assignInWith`、`assignWith`、`at`、
     * `before`、`bind`、`bindAll`、`bindKey`、`castArray`、`chain`、`chunk`、
     * `commit`、`compact`、`concat`、`conforms`、`constant`、`countBy`、`create`、
     * `curry`、`debounce`、`defaults`、`defaultsDeep`、`defer`、`delay`、
     * `difference`、`differenceBy`、`differenceWith`、`drop`、`dropRight`、
     * `dropRightWhile`、`dropWhile`、`extend`、`extendWith`、`fill`、`filter`、
     * `flatMap`、`flatMapDeep`、`flatMapDepth`、`flatten`、`flattenDeep`、
     * `flattenDepth`、`flip`、`flow`、`flowRight`、`fromPairs`、`functions`、
     * `functionsIn`、`groupBy`、`initial`、`intersection`、`intersectionBy`、
     * `intersectionWith`、`invert`、`invertBy`、`invokeMap`、`iteratee`、`keyBy`、
     * `keys`、`keysIn`、`map`、`mapKeys`、`mapValues`、`matches`、`matchesProperty`、
     * `memoize`、`merge`、`mergeWith`、`method`、`methodOf`、`mixin`、`negate`、
     * `nthArg`、`omit`、`omitBy`、`once`、`orderBy`、`over`、`overArgs`、
     * `overEvery`、`overSome`、`partial`、`partialRight`、`partition`、`pick`、
     * `pickBy`、`plant`、`property`、`propertyOf`、`pull`、`pullAll`、`pullAllBy`、
     * `pullAllWith`、`pullAt`、`push`、`range`、`rangeRight`、`rearg`、`reject`、
     * `remove`、`rest`、`reverse`、`sampleSize`、`set`、`setWith`、`shuffle`、
     * `slice`、`sort`、`sortBy`、`splice`、`spread`、`tail`、`take`、`takeRight`、
     * `takeRightWhile`、`takeWhile`、`tap`、`throttle`、`thru`、`toArray`、
     * `toPairs`、`toPairsIn`、`toPath`、`toPlainObject`、`transform`、`unary`、
     * `union`、`unionBy`、`unionWith`、`uniq`、`uniqBy`、`uniqWith`、`unset`、
     * `unshift`、`unzip`、`unzipWith`、`update`、`updateWith`、`values`、
     * `valuesIn`、`without`、`wrap`、`xor`、`xorBy`、`xorWith`、`zip`、
     * `zipObject`、`zipObjectDeep` 和 `zipWith`
     *
     * 默认情况下**不可**链式调用的包装器方法有：
     * `add`、`attempt`、`camelCase`、`capitalize`、`ceil`、`clamp`、`clone`、
     * `cloneDeep`、`cloneDeepWith`、`cloneWith`、`conformsTo`、`deburr`、
     * `defaultTo`、`divide`、`each`、`eachRight`、`endsWith`、`eq`、`escape`、
     * `escapeRegExp`、`every`、`find`、`findIndex`、`findKey`、`findLast`、
     * `findLastIndex`、`findLastKey`、`first`、`floor`、`forEach`、`forEachRight`、
     * `forIn`、`forInRight`、`forOwn`、`forOwnRight`、`get`、`gt`、`gte`、`has`、
     * `hasIn`、`head`、`identity`、`includes`、`indexOf`、`inRange`、`invoke`、
     * `isArguments`、`isArray`、`isArrayBuffer`、`isArrayLike`、`isArrayLikeObject`、
     * `isBoolean`、`isBuffer`、`isDate`、`isElement`、`isEmpty`、`isEqual`、
     * `isEqualWith`、`isError`、`isFinite`、`isFunction`、`isInteger`、`isLength`、
     * `isMap`、`isMatch`、`isMatchWith`、`isNaN`、`isNative`、`isNil`、`isNull`、
     * `isNumber`、`isObject`、`isObjectLike`、`isPlainObject`、`isRegExp`、
     * `isSafeInteger`、`isSet`、`isString`、`isUndefined`、`isTypedArray`、
     * `isWeakMap`、`isWeakSet`、`join`、`kebabCase`、`last`、`lastIndexOf`、
     * `lowerCase`、`lowerFirst`、`lt`、`lte`、`max`、`maxBy`、`mean`、`meanBy`、
     * `min`、`minBy`、`multiply`、`noConflict`、`noop`、`now`、`nth`、`pad`、
     * `padEnd`、`padStart`、`parseInt`、`pop`、`random`、`reduce`、`reduceRight`、
     * `repeat`、`result`、`round`、`runInContext`、`sample`、`shift`、`size`、
     * `snakeCase`、`some`、`sortedIndex`、`sortedIndexBy`、`sortedLastIndex`、
     * `sortedLastIndexBy`、`startCase`、`startsWith`、`stubArray`、`stubFalse`、
     * `stubObject`、`stubString`、`stubTrue`、`subtract`、`sum`、`sumBy`、
     * `template`、`times`、`toFinite`、`toInteger`、`toJSON`、`toLength`、
     * `toLower`、`toNumber`、`toSafeInteger`、`toString`、`toUpper`、`trim`、
     * `trimEnd`、`trimStart`、`truncate`、`unescape`、`uniqueId`、`upperCase`、
     * `upperFirst`、`value` 和 `words`
     *
     * @name _
     * @constructor
     * @category Seq
     * @param {*} value 要包装在 `lodash` 实例中的值。
     * @returns {Object} 返回新的 `lodash` 包装器实例。
     * @example
     *
     * function square(n) {
     *   return n * n;
     * }
     *
     * var wrapped = _([1, 2, 3]);
     *
     * // 返回一个未包装的值。
     * wrapped.reduce(_.add);
     * // => 6
     *
     * // 返回一个包装的值。
     * var squares = wrapped.map(square);
     *
     * _.isArray(squares);
     * // => false
     *
     * _.isArray(squares.value());
     * // => true
     */
    function lodash(value) {
      if (isObjectLike(value) && !isArray(value) && !(value instanceof LazyWrapper)) {
        if (value instanceof LodashWrapper) {
          return value;
        }
        if (hasOwnProperty.call(value, '__wrapped__')) {
          return wrapperClone(value);
        }
      }
      return new LodashWrapper(value);
    }

    /**
     * _.create 的基础实现，不支持为创建的对象分配属性。
     *
     * @private
     * @param {Object} proto 要继承的对象。
     * @returns {Object} 返回新对象。
     */
    var baseCreate = (function() {
      function object() {}
      return function(proto) {
        if (!isObject(proto)) {
          return {};
        }
        if (objectCreate) {
          return objectCreate(proto);
        }
        object.prototype = proto;
        var result = new object;
        object.prototype = undefined;
        return result;
      };
    }());

    /**
     * 其原型链序列包装器继承自的函数。
     *
     * @private
     */
    function baseLodash() {
      // No operation performed.
    }

    /**
     * 用于创建 `lodash` 包装器对象的基础构造函数。
     *
     * @private
     * @param {*} value 要包装的值。
     * @param {boolean} [chainAll] 启用显式方法链序列。
     */
    function LodashWrapper(value, chainAll) {
      this.__wrapped__ = value;
      this.__actions__ = [];
      this.__chain__ = !!chainAll;
      this.__index__ = 0;
      this.__values__ = undefined;
    }

    /**
     * 默认情况下，lodash 使用的模板分隔符类似于嵌入式 Ruby (ERB)
     * 以及 ES2015 模板字符串。更改以下模板设置以使用替代分隔符。
     *
     * **安全警告：** 请参阅
     * [威胁模型](https://github.com/lodash/lodash/blob/main/threat-model.md)
     * — `_.template` 不安全，将在 v5 中移除。
     *
     * @static
     * @memberOf _
     * @type {Object}
     */
    lodash.templateSettings = {

      /**
       * 用于检测要 HTML 转义的数据属性值。
       *
       * @memberOf _.templateSettings
       * @type {RegExp}
       */
      'escape': reEscape,

      /**
       * 用于检测要评估的代码。
       *
       * @memberOf _.templateSettings
       * @type {RegExp}
       */
      'evaluate': reEvaluate,

      /**
       * 用于检测要注入的数据属性值。
       *
       * @memberOf _.templateSettings
       * @type {RegExp}
       */
      'interpolate': reInterpolate,

      /**
       * 用于在模板文本中引用数据对象。
       *
       * @memberOf _.templateSettings
       * @type {string}
       */
      'variable': '',

      /**
       * 用于将变量导入到编译的模板中。
       *
       * @memberOf _.templateSettings
       * @type {Object}
       */
      'imports': {

        /**
         * 对 `lodash` 函数的引用。
         *
         * @memberOf _.templateSettings.imports
         * @type {Function}
         */
        '_': lodash
      }
    };

    // 确保包装器是 `baseLodash` 的实例。
    lodash.prototype = baseLodash.prototype;
    lodash.prototype.constructor = lodash;

    LodashWrapper.prototype = baseCreate(baseLodash.prototype);
    LodashWrapper.prototype.constructor = LodashWrapper;

    /*------------------------------------------------------------------------*/

    /**
     * 创建一个包装 `value` 的延迟包装器对象，以启用延迟求值。
     *
     * @private
     * @constructor
     * @param {*} value 要包装的值。
     *
     * LazyWrapper 是 Lodash 延迟计算的核心实现。
     *
     * 延迟计算（Lazy Evaluation）是一种优化策略：
     * - 不立即执行遍历操作，而是记录操作
     * - 只在真正需要结果时才执行计算
     * - 可以合并多个操作，减少中间数组创建
     *
     * 内部属性说明：
     * - __wrapped__: 被包装的原始值（通常是数组）
     * - __actions__: 需要执行的动作（如 slice, reverse 等）
     * - __dir__: 遍历方向，1 表示正向，-1 表示反向
     * - __filtered__: 是否经过过滤操作（用于优化）
     * - __iteratees__: 迭代器列表（如 map 的转换函数）
     * - __takeCount__: 需要获取的元素数量
     * - __views__: 视图信息，用于 take/drop 操作
     *
     * 示例：
     * _([1,2,3,4,5]).filter(x => x % 2 === 0).map(x => x * 2)
     * 不会立即执行，而是在调用 .value() 时一起执行
     */
    function LazyWrapper(value) {
      this.__wrapped__ = value;
      this.__actions__ = [];
      this.__dir__ = 1;
      this.__filtered__ = false;
      this.__iteratees__ = [];
      this.__takeCount__ = MAX_ARRAY_LENGTH;
      this.__views__ = [];
    }

    /**
     * 创建延迟包装器对象的克隆。
     *
     * @private
     * @name clone
     * @memberOf LazyWrapper
     * @returns {Object} 返回克隆的 `LazyWrapper` 对象。
     *
     * 浅克隆 LazyWrapper，复制所有内部状态。
     * 重要：数组和嵌套状态使用 copyArray 复制，确保独立性。
     */
    function lazyClone() {
      var result = new LazyWrapper(this.__wrapped__);
      result.__actions__ = copyArray(this.__actions__);
      result.__dir__ = this.__dir__;
      result.__filtered__ = this.__filtered__;
      result.__iteratees__ = copyArray(this.__iteratees__);
      result.__takeCount__ = this.__takeCount__;
      result.__views__ = copyArray(this.__views__);
      return result;
    }

    /**
     * 反转延迟迭代的方向。
     *
     * @private
     * @name reverse
     * @memberOf LazyWrapper
     * @returns {Object} 返回新的反转后的 `LazyWrapper` 对象。
     *
     * 反转遍历方向。如果已经是 filtered 状态，
     * 创建一个新的 LazyWrapper 副本；否则直接修改方向。
     */
    function lazyReverse() {
      if (this.__filtered__) {
        var result = new LazyWrapper(this);
        result.__dir__ = -1;
        result.__filtered__ = true;
      } else {
        result = this.clone();
        result.__dir__ *= -1;
      }
      return result;
    }

    /**
     * 从其延迟包装器中提取未包装的值。
     *
     * @private
     * @name value
     * @memberOf LazyWrapper
     * @returns {*} 返回未包装的值。
     *
     * 延迟值计算的核心方法。这是真正执行计算的地方。
     *
     * 执行流程：
     * 1. 获取原始数组（调用 __wrapped__.value()）
     * 2. 计算视图范围（start, end）
     * 3. 按方向遍历，应用所有 iteratee
     * 4. 处理 take/drop 操作
     * 5. 返回最终结果
     *
     * 优化策略：
     * - 短路计算：某些操作（如 find）可以在找到后立即停止
     * - take 优化：如果已知需要取的元素数量，可提前终止
     * - 视图合并：多个 take/drop 操作合并计算
     */
    function lazyValue() {
      var array = this.__wrapped__.value(),
          dir = this.__dir__,
          isArr = isArray(array),
          isRight = dir < 0,
          arrLength = isArr ? array.length : 0,
          view = getView(0, arrLength, this.__views__),
          start = view.start,
          end = view.end,
          length = end - start,
          index = isRight ? end : (start - 1),
          iteratees = this.__iteratees__,
          iterLength = iteratees.length,
          resIndex = 0,
          takeCount = nativeMin(length, this.__takeCount__);

      if (!isArr || (!isRight && arrLength == length && takeCount == length)) {
        return baseWrapperValue(array, this.__actions__);
      }
      var result = [];

      outer:
      while (length-- && resIndex < takeCount) {
        index += dir;

        var iterIndex = -1,
            value = array[index];

        while (++iterIndex < iterLength) {
          var data = iteratees[iterIndex],
              iteratee = data.iteratee,
              type = data.type,
              computed = iteratee(value);

          if (type == LAZY_MAP_FLAG) {
            value = computed;
          } else if (!computed) {
            if (type == LAZY_FILTER_FLAG) {
              continue outer;
            } else {
              break outer;
            }
          }
        }
        result[resIndex++] = value;
      }
      return result;
    }

    // Ensure `LazyWrapper` is an instance of `baseLodash`.
    LazyWrapper.prototype = baseCreate(baseLodash.prototype);
    LazyWrapper.prototype.constructor = LazyWrapper;

    /*------------------------------------------------------------------------*/

    /**
     * 创建一个哈希对象。
     *
     * @private
     * @constructor
     * @param {Array} [entries] 要缓存的键值对。
     */
    function Hash(entries) {
      var index = -1,
          length = entries == null ? 0 : entries.length;

      this.clear();
      while (++index < length) {
        var entry = entries[index];
        this.set(entry[0], entry[1]);
      }
    }

    /**
     * 移除哈希中的所有键值对。
     *
     * @private
     * @name clear
     * @memberOf Hash
     */
    function hashClear() {
      this.__data__ = nativeCreate ? nativeCreate(null) : {};
      this.size = 0;
    }

    /**
     * 从哈希中移除 `key` 及其值。
     *
     * @private
     * @name delete
     * @memberOf Hash
     * @param {Object} hash 要修改的哈希。
     * @param {string} key 要移除的值的键。
     * @returns {boolean} 如果条目被移除返回 `true`，否则返回 `false`。
     */
    function hashDelete(key) {
      var result = this.has(key) && delete this.__data__[key];
      this.size -= result ? 1 : 0;
      return result;
    }

    /**
     * 获取 `key` 对应的哈希值。
     *
     * @private
     * @name get
     * @memberOf Hash
     * @param {string} key 要获取的值的键。
     * @returns {*} 返回条目的值。
     */
    function hashGet(key) {
      var data = this.__data__;
      if (nativeCreate) {
        var result = data[key];
        return result === HASH_UNDEFINED ? undefined : result;
      }
      return hasOwnProperty.call(data, key) ? data[key] : undefined;
    }

    /**
     * 检查 `key` 的哈希值是否存在。
     *
     * @private
     * @name has
     * @memberOf Hash
     * @param {string} key 要检查的条目的键。
     * @returns {boolean} 如果 `key` 的条目存在返回 `true`，否则返回 `false`。
     */
    function hashHas(key) {
      var data = this.__data__;
      return nativeCreate ? (data[key] !== undefined) : hasOwnProperty.call(data, key);
    }

    /**
     * 将哈希 `key` 设置为 `value`。
     *
     * @private
     * @name set
     * @memberOf Hash
     * @param {string} key 要设置的值的键。
     * @param {*} value 要设置的值。
     * @returns {Object} 返回哈希实例。
     */
    function hashSet(key, value) {
      var data = this.__data__;
      this.size += this.has(key) ? 0 : 1;
      data[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
      return this;
    }

    // 将方法添加到 `Hash`。
    Hash.prototype.clear = hashClear;
    Hash.prototype['delete'] = hashDelete;
    Hash.prototype.get = hashGet;
    Hash.prototype.has = hashHas;
    Hash.prototype.set = hashSet;

    /*------------------------------------------------------------------------*/

    /**
     * 创建一个列表缓存对象。
     *
     * @private
     * @constructor
     * @param {Array} [entries] 要缓存的键值对。
     */
    function ListCache(entries) {
      var index = -1,
          length = entries == null ? 0 : entries.length;

      this.clear();
      while (++index < length) {
        var entry = entries[index];
        this.set(entry[0], entry[1]);
      }
    }

    /**
     * 移除列表缓存中的所有键值对。
     *
     * @private
     * @name clear
     * @memberOf ListCache
     */
    function listCacheClear() {
      this.__data__ = [];
      this.size = 0;
    }

    /**
     * 从列表缓存中移除 `key` 及其值。
     *
     * @private
     * @name delete
     * @memberOf ListCache
     * @param {string} key 要移除的值的键。
     * @returns {boolean} 如果条目被移除返回 `true`，否则返回 `false`。
     */
    function listCacheDelete(key) {
      var data = this.__data__,
          index = assocIndexOf(data, key);

      if (index < 0) {
        return false;
      }
      var lastIndex = data.length - 1;
      if (index == lastIndex) {
        data.pop();
      } else {
        splice.call(data, index, 1);
      }
      --this.size;
      return true;
    }

    /**
     * 获取 `key` 对应的列表缓存值。
     *
     * @private
     * @name get
     * @memberOf ListCache
     * @param {string} key 要获取的值的键。
     * @returns {*} 返回条目的值。
     */
    function listCacheGet(key) {
      var data = this.__data__,
          index = assocIndexOf(data, key);

      return index < 0 ? undefined : data[index][1];
    }

    /**
     * 检查 `key` 的列表缓存值是否存在。
     *
     * @private
     * @name has
     * @memberOf ListCache
     * @param {string} key 要检查的条目的键。
     * @returns {boolean} 如果 `key` 的条目存在返回 `true`，否则返回 `false`。
     */
    function listCacheHas(key) {
      return assocIndexOf(this.__data__, key) > -1;
    }

    /**
     * 将列表缓存的 `key` 设置为 `value`。
     *
     * @private
     * @name set
     * @memberOf ListCache
     * @param {string} key 要设置的值的键。
     * @param {*} value 要设置的值。
     * @returns {Object} 返回列表缓存实例。
     */
    function listCacheSet(key, value) {
      var data = this.__data__,
          index = assocIndexOf(data, key);

      if (index < 0) {
        ++this.size;
        data.push([key, value]);
      } else {
        data[index][1] = value;
      }
      return this;
    }

    // 将方法添加到 `ListCache`。
    ListCache.prototype.clear = listCacheClear;
    ListCache.prototype['delete'] = listCacheDelete;
    ListCache.prototype.get = listCacheGet;
    ListCache.prototype.has = listCacheHas;
    ListCache.prototype.set = listCacheSet;

    /*------------------------------------------------------------------------*/

    /**
     * 创建一个 map 缓存对象来存储键值对。
     *
     * @private
     * @constructor
     * @param {Array} [entries] 要缓存的键值对。
     */
    function MapCache(entries) {
      var index = -1,
          length = entries == null ? 0 : entries.length;

      this.clear();
      while (++index < length) {
        var entry = entries[index];
        this.set(entry[0], entry[1]);
      }
    }

    /**
     * 移除 map 中的所有键值对。
     *
     * @private
     * @name clear
     * @memberOf MapCache
     */
    function mapCacheClear() {
      this.size = 0;
      this.__data__ = {
        'hash': new Hash,
        'map': new (Map || ListCache),
        'string': new Hash
      };
    }

    /**
     * 从 map 中移除 `key` 及其值。
     *
     * @private
     * @name delete
     * @memberOf MapCache
     * @param {string} key 要移除的值的键。
     * @returns {boolean} 如果条目被移除返回 `true`，否则返回 `false`。
     */
    function mapCacheDelete(key) {
      var result = getMapData(this, key)['delete'](key);
      this.size -= result ? 1 : 0;
      return result;
    }

    /**
     * 获取 `key` 对应的 map 值。
     *
     * @private
     * @name get
     * @memberOf MapCache
     * @param {string} key 要获取的值的键。
     * @returns {*} 返回条目的值。
     */
    function mapCacheGet(key) {
      return getMapData(this, key).get(key);
    }

    /**
     * 检查 `key` 的 map 值是否存在。
     *
     * @private
     * @name has
     * @memberOf MapCache
     * @param {string} key 要检查的条目的键。
     * @returns {boolean} 如果 `key` 的条目存在返回 `true`，否则返回 `false`。
     */
    function mapCacheHas(key) {
      return getMapData(this, key).has(key);
    }

    /**
     * 将 map 的 `key` 设置为 `value`。
     *
     * @private
     * @name set
     * @memberOf MapCache
     * @param {string} key 要设置的值的键。
     * @param {*} value 要设置的值。
     * @returns {Object} 返回 map 缓存实例。
     */
    function mapCacheSet(key, value) {
      var data = getMapData(this, key),
          size = data.size;

      data.set(key, value);
      this.size += data.size == size ? 0 : 1;
      return this;
    }

    // 将方法添加到 `MapCache`。
    MapCache.prototype.clear = mapCacheClear;
    MapCache.prototype['delete'] = mapCacheDelete;
    MapCache.prototype.get = mapCacheGet;
    MapCache.prototype.has = mapCacheHas;
    MapCache.prototype.set = mapCacheSet;

    /*------------------------------------------------------------------------*/

    /**
     *
     * 创建一个数组缓存对象来存储唯一值。
     *
     * @private
     * @constructor
     * @param {Array} [values] 要缓存的值。
     */
    function SetCache(values) {
      var index = -1,
          length = values == null ? 0 : values.length;

      this.__data__ = new MapCache;
      while (++index < length) {
        this.add(values[index]);
      }
    }

    /**
     * 将 `value` 添加到数组缓存。
     *
     * @private
     * @name add
     * @memberOf SetCache
     * @alias push
     * @param {*} value 要缓存的值。
     * @returns {Object} 返回缓存实例。
     */
    function setCacheAdd(value) {
      this.__data__.set(value, HASH_UNDEFINED);
      return this;
    }

    /**
     * 检查 `value` 是否在数组缓存中。
     *
     * @private
     * @name has
     * @memberOf SetCache
     * @param {*} value 要搜索的值。
     * @returns {boolean} 如果找到 `value` 返回 `true`，否则返回 `false`。
     */
    function setCacheHas(value) {
      return this.__data__.has(value);
    }

    // 将方法添加到 `SetCache`。
    SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
    SetCache.prototype.has = setCacheHas;

    /*------------------------------------------------------------------------*/

    /**
     * 创建一个栈缓存对象来存储键值对。
     *
     * @private
     * @constructor
     * @param {Array} [entries] 要缓存的键值对。
     */
    function Stack(entries) {
      var data = this.__data__ = new ListCache(entries);
      this.size = data.size;
    }

    /**
     * 移除栈中的所有键值对。
     *
     * @private
     * @name clear
     * @memberOf Stack
     */
    function stackClear() {
      this.__data__ = new ListCache;
      this.size = 0;
    }

    /**
     * 从栈中移除 `key` 及其值。
     *
     * @private
     * @name delete
     * @memberOf Stack
     * @param {string} key 要移除的值的键。
     * @returns {boolean} 如果条目被移除返回 `true`，否则返回 `false`。
     */
    function stackDelete(key) {
      var data = this.__data__,
          result = data['delete'](key);

      this.size = data.size;
      return result;
    }

    /**
     * 获取 `key` 对应的栈值。
     *
     * @private
     * @name get
     * @memberOf Stack
     * @param {string} key 要获取的值的键。
     * @returns {*} 返回条目的值。
     */
    function stackGet(key) {
      return this.__data__.get(key);
    }

    /**
     * 检查 `key` 的栈值是否存在。
     *
     * @private
     * @name has
     * @memberOf Stack
     * @param {string} key 要检查的条目的键。
     * @returns {boolean} 如果 `key` 的条目存在返回 `true`，否则返回 `false`。
     */
    function stackHas(key) {
      return this.__data__.has(key);
    }

    /**
     * 将栈的 `key` 设置为 `value`。
     *
     * @private
     * @name set
     * @memberOf Stack
     * @param {string} key 要设置的值的键。
     * @param {*} value 要设置的值。
     * @returns {Object} 返回栈缓存实例。
     */
    function stackSet(key, value) {
      var data = this.__data__;
      if (data instanceof ListCache) {
        var pairs = data.__data__;
        if (!Map || (pairs.length < LARGE_ARRAY_SIZE - 1)) {
          pairs.push([key, value]);
          this.size = ++data.size;
          return this;
        }
        data = this.__data__ = new MapCache(pairs);
      }
      data.set(key, value);
      this.size = data.size;
      return this;
    }

    // 将方法添加到 `Stack`。
    Stack.prototype.clear = stackClear;
    Stack.prototype['delete'] = stackDelete;
    Stack.prototype.get = stackGet;
    Stack.prototype.has = stackHas;
    Stack.prototype.set = stackSet;

    /*------------------------------------------------------------------------*/

    /**
     * 创建类数组 `value` 的可枚举属性名的数组。
     *
     * @private
     * @param {*} value 要查询的值。
     * @param {boolean} inherited 指定是否返回继承的属性名。
     * @returns {Array} 返回属性名数组。
     */
    function arrayLikeKeys(value, inherited) {
      var isArr = isArray(value),
          isArg = !isArr && isArguments(value),
          isBuff = !isArr && !isArg && isBuffer(value),
          isType = !isArr && !isArg && !isBuff && isTypedArray(value),
          skipIndexes = isArr || isArg || isBuff || isType,
          result = skipIndexes ? baseTimes(value.length, String) : [],
          length = result.length;

      for (var key in value) {
        if ((inherited || hasOwnProperty.call(value, key)) &&
            !(skipIndexes && (
               // Safari 9 has enumerable `arguments.length` in strict mode.
               key == 'length' ||
               // Node.js 0.10 has enumerable non-index properties on buffers.
               (isBuff && (key == 'offset' || key == 'parent')) ||
               // PhantomJS 2 has enumerable non-index properties on typed arrays.
               (isType && (key == 'buffer' || key == 'byteLength' || key == 'byteOffset')) ||
               // Skip index properties.
               isIndex(key, length)
            ))) {
          result.push(key);
        }
      }
      return result;
    }

    /**
     * _.sample 的数组专用版本。
     *
     * @private
     * @param {Array} array 要采样的数组。
     * @returns {*} 返回随机元素。
     */
    function arraySample(array) {
      var length = array.length;
      return length ? array[baseRandom(0, length - 1)] : undefined;
    }

    /**
     * _.sampleSize 的数组专用版本。
     *
     * @private
     * @param {Array} array 要采样的数组。
     * @param {number} n 要采样的元素数量。
     * @returns {Array} 返回随机元素数组。
     */
    function arraySampleSize(array, n) {
      return shuffleSelf(copyArray(array), baseClamp(n, 0, array.length));
    }

    /**
     * _.shuffle 的数组专用版本。
     *
     * @private
     * @param {Array} array 要打乱的数组。
     * @returns {Array} 返回打乱后的新数组。
     */
    function arrayShuffle(array) {
      return shuffleSelf(copyArray(array));
    }

    /**
     * 此函数类似于 `assignValue`，但不会分配 `undefined` 值。
     *
     * @private
     * @param {Object} object 要修改的对象。
     * @param {string} key 要分配的属性的键。
     * @param {*} value 要分配的值。
     */
    function assignMergeValue(object, key, value) {
      if ((value !== undefined && !eq(object[key], value)) ||
          (value === undefined && !(key in object))) {
        baseAssignValue(object, key, value);
      }
    }

    /**
     * 如果 `object` 的 `key` 的现有值不等价，
     * 则使用 [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
     * 进行相等比较来分配 `value`。
     *
     * @private
     * @param {Object} object 要修改的对象。
     * @param {string} key 要分配的属性的键。
     * @param {*} value 要分配的值。
     */
    function assignValue(object, key, value) {
      var objValue = object[key];
      if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) ||
          (value === undefined && !(key in object))) {
        baseAssignValue(object, key, value);
      }
    }

    /**
     * 获取在键值对数组中找到 `key` 的索引。
     *
     * @private
     * @param {Array} array 要检查的数组。
     * @param {*} key 要搜索的键。
     * @returns {number} 返回匹配值的索引，否则返回 `-1`。
     */
    function assocIndexOf(array, key) {
      var length = array.length;
      while (length--) {
        if (eq(array[length][0], key)) {
          return length;
        }
      }
      return -1;
    }

    /**
     * 使用 `iteratee` 转换键和 `setter` 设置值，
     * 在 `accumulator` 上聚合 `collection` 的元素。
     *
     * @private
     * @param {Array|Object} collection 要遍历的集合。
     * @param {Function} setter 用于设置 `accumulator` 值的函数。
     * @param {Function} iteratee 用于转换键的迭代器函数。
     * @param {Object} accumulator 初始聚合对象。
     * @returns {Function} 返回 `accumulator`。
     */
    function baseAggregator(collection, setter, iteratee, accumulator) {
      baseEach(collection, function(value, key, collection) {
        setter(accumulator, value, iteratee(value), collection);
      });
      return accumulator;
    }

    /**
     * _.assign 的基础实现，不支持多个源或 `customizer` 函数。
     *
     * @private
     * @param {Object} object 目标对象。
     * @param {Object} source 源对象。
     * @returns {Object} 返回 `object`。
     */
    function baseAssign(object, source) {
      return object && copyObject(source, keys(source), object);
    }

    /**
     * _.assignIn 的基础实现，不支持多个源或 `customizer` 函数。
     *
     * @private
     * @param {Object} object 目标对象。
     * @param {Object} source 源对象。
     * @returns {Object} 返回 `object`。
     */
    function baseAssignIn(object, source) {
      return object && copyObject(source, keysIn(source), object);
    }

    /**
     * assignValue 和 assignMergeValue 的基础实现，不进行值检查。
     *
     * @private
     * @param {Object} object 要修改的对象。
     * @param {string} key 要分配的属性的键。
     * @param {*} value 要分配的值。
     */
    function baseAssignValue(object, key, value) {
      if (key == '__proto__' && defineProperty) {
        defineProperty(object, key, {
          'configurable': true,
          'enumerable': true,
          'value': value,
          'writable': true
        });
      } else {
        object[key] = value;
      }
    }

    /**
     * _.at 的基础实现，不支持单个路径。
     *
     * @private
     * @param {Object} object 要遍历的对象。
     * @param {string[]} paths 要选取的属性路径。
     * @returns {Array} 返回选取的元素。
     */
    function baseAt(object, paths) {
      var index = -1,
          length = paths.length,
          result = Array(length),
          skip = object == null;

      while (++index < length) {
        result[index] = skip ? undefined : get(object, paths[index]);
      }
      return result;
    }

    /**
     * _.clamp 的基础实现，不强制转换参数。
     *
     * @private
     * @param {number} number 要限制的数字。
     * @param {number} [lower] 下界。
     * @param {number} upper 上界。
     * @returns {number} 返回限制后的数字。
     */
    function baseClamp(number, lower, upper) {
      if (number === number) {
        if (upper !== undefined) {
          number = number <= upper ? number : upper;
        }
        if (lower !== undefined) {
          number = number >= lower ? number : lower;
        }
      }
      return number;
    }

    /**
     * _.clone 和 _.cloneDeep 的基础实现，跟踪遍历的对象。
     *
     * @private
     * @param {*} value 要克隆的值。
     * @param {boolean} bitmask 位掩码标志。
     *  1 - 深度克隆
     *  2 - 展平继承的属性
     *  4 - 克隆符号
     * @param {Function} [customizer] 用于自定义克隆的函数。
     * @param {string} [key] value 的键。
     * @param {Object} [object] value 的父对象。
     * @param {Object} [stack] 跟踪遍历的对象及其克隆对应物。
     * @returns {*} 返回克隆的值。
     */
    function baseClone(value, bitmask, customizer, key, object, stack) {
      var result,
          isDeep = bitmask & CLONE_DEEP_FLAG,
          isFlat = bitmask & CLONE_FLAT_FLAG,
          isFull = bitmask & CLONE_SYMBOLS_FLAG;

      if (customizer) {
        result = object ? customizer(value, key, object, stack) : customizer(value);
      }
      if (result !== undefined) {
        return result;
      }
      if (!isObject(value)) {
        return value;
      }
      var isArr = isArray(value);
      if (isArr) {
        result = initCloneArray(value);
        if (!isDeep) {
          return copyArray(value, result);
        }
      } else {
        var tag = getTag(value),
            isFunc = tag == funcTag || tag == genTag;

        if (isBuffer(value)) {
          return cloneBuffer(value, isDeep);
        }
        if (tag == objectTag || tag == argsTag || (isFunc && !object)) {
          result = (isFlat || isFunc) ? {} : initCloneObject(value);
          if (!isDeep) {
            return isFlat
              ? copySymbolsIn(value, baseAssignIn(result, value))
              : copySymbols(value, baseAssign(result, value));
          }
        } else {
          if (!cloneableTags[tag]) {
            return object ? value : {};
          }
          result = initCloneByTag(value, tag, isDeep);
        }
      }
      // Check for circular references and return its corresponding clone.
      stack || (stack = new Stack);
      var stacked = stack.get(value);
      if (stacked) {
        return stacked;
      }
      stack.set(value, result);

      if (isSet(value)) {
        value.forEach(function(subValue) {
          result.add(baseClone(subValue, bitmask, customizer, subValue, value, stack));
        });
      } else if (isMap(value)) {
        value.forEach(function(subValue, key) {
          result.set(key, baseClone(subValue, bitmask, customizer, key, value, stack));
        });
      }

      var keysFunc = isFull
        ? (isFlat ? getAllKeysIn : getAllKeys)
        : (isFlat ? keysIn : keys);

      var props = isArr ? undefined : keysFunc(value);
      arrayEach(props || value, function(subValue, key) {
        if (props) {
          key = subValue;
          subValue = value[key];
        }
        // Recursively populate clone (susceptible to call stack limits).
        assignValue(result, key, baseClone(subValue, bitmask, customizer, key, value, stack));
      });
      return result;
    }

    /**
     * _.conforms 的基础实现，不克隆 `source`。
     *
     * @private
     * @param {Object} source 属性谓词符合的对象。
     * @returns {Function} 返回新的规范函数。
     */
    function baseConforms(source) {
      var props = keys(source);
      return function(object) {
        return baseConformsTo(object, source, props);
      };
    }

    /**
     * _.conformsTo 的基础实现，接受要检查的 `props`。
     *
     * @private
     * @param {Object} object 要检查的对象。
     * @param {Object} source 属性谓词符合的对象。
     * @returns {boolean} 如果 `object` 符合返回 `true`，否则返回 `false`。
     */
    function baseConformsTo(object, source, props) {
      var length = props.length;
      if (object == null) {
        return !length;
      }
      object = Object(object);
      while (length--) {
        var key = props[length],
            predicate = source[key],
            value = object[key];

        if ((value === undefined && !(key in object)) || !predicate(value)) {
          return false;
        }
      }
      return true;
    }

    /**
     * _.delay 和 _.defer 的基础实现，接受要提供给 `func` 的 `args`。
     *
     * @private
     * @param {Function} func 要延迟的函数。
     * @param {number} wait 延迟调用的毫秒数。
     * @param {Array} args 要提供给 `func` 的参数。
     * @returns {number|Object} 返回定时器 id 或超时对象。
     */
    function baseDelay(func, wait, args) {
      if (typeof func != 'function') {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      return setTimeout(function() { func.apply(undefined, args); }, wait);
    }

    /**
     * 类似 `_.difference` 的方法的基础实现，不支持排除多个数组或迭代器简写。
     *
     * @private
     * @param {Array} array 要检查的数组。
     * @param {Array} values 要排除的值。
     * @param {Function} [iteratee] 每个元素调用的迭代器函数。
     * @param {Function} [comparator] 每个元素调用的比较器函数。
     * @returns {Array} 返回过滤后的新数组。
     */
    function baseDifference(array, values, iteratee, comparator) {
      var index = -1,
          includes = arrayIncludes,
          isCommon = true,
          length = array.length,
          result = [],
          valuesLength = values.length;

      if (!length) {
        return result;
      }
      if (iteratee) {
        values = arrayMap(values, baseUnary(iteratee));
      }
      if (comparator) {
        includes = arrayIncludesWith;
        isCommon = false;
      }
      else if (values.length >= LARGE_ARRAY_SIZE) {
        includes = cacheHas;
        isCommon = false;
        values = new SetCache(values);
      }
      outer:
      while (++index < length) {
        var value = array[index],
            computed = iteratee == null ? value : iteratee(value);

        value = (comparator || value !== 0) ? value : 0;
        if (isCommon && computed === computed) {
          var valuesIndex = valuesLength;
          while (valuesIndex--) {
            if (values[valuesIndex] === computed) {
              continue outer;
            }
          }
          result.push(value);
        }
        else if (!includes(values, computed, comparator)) {
          result.push(value);
        }
      }
      return result;
    }

    /**
     * _.forEach 的基础实现，不支持迭代器简写。
     *
     * @private
     * @param {Array|Object} collection 要遍历的集合。
     * @param {Function} iteratee 每次迭代调用的函数。
     * @returns {Array|Object} 返回 `collection`。
     */
    var baseEach = createBaseEach(baseForOwn);

    /**
     * _.forEachRight 的基础实现，不支持迭代器简写。
     *
     * @private
     * @param {Array|Object} collection 要遍历的集合。
     * @param {Function} iteratee 每次迭代调用的函数。
     * @returns {Array|Object} 返回 `collection`。
     */
    var baseEachRight = createBaseEach(baseForOwnRight, true);

    /**
     * _.every 的基础实现，不支持迭代器简写。
     *
     * @private
     * @param {Array|Object} collection 要遍历的集合。
     * @param {Function} predicate 每次迭代调用的谓词函数。
     * @returns {boolean} 如果所有元素都通过谓词检查返回 `true`，
     *  否则返回 `false`
     *
     * baseEvery 实现原理：
     *
     * 短路求值（Short-circuit evaluation）：
     * - 只要有一个元素不满足谓词，立即返回 false
     * - 不需要遍历整个集合
     *
     * 实现细节：
     * 1. !! 运算符：确保返回值是布尔值（true/false）
     * 2. return result：当 result 为 false 时，baseEach 会立即返回
     *
     * 性能优势：
     * - 最佳情况：第一个元素就不满足，只遍历一次
     * - 最坏情况：所有元素都满足，需要完整遍历
     *
     * 示例：
     * baseEvery([2, 4, 6], x => x % 2 === 0)  // => true
     * baseEvery([2, 3, 4], x => x % 2 === 0)   // => false
     */
    function baseEvery(collection, predicate) {
      var result = true;
      baseEach(collection, function(value, index, collection) {
        result = !!predicate(value, index, collection);
        return result;
      });
      return result;
    }

    /**
     * 类似 `_.max` 和 `_.min` 方法的基础实现，
     * 接受一个 `comparator` 来确定极值。
     *
     * @private
     * @param {Array} array 要遍历的数组。
     * @param {Function} iteratee 每次迭代调用的迭代器函数。
     * @param {Function} comparator 用于比较值的比较器函数。
     * @returns {*} 返回极值。
     */
    function baseExtremum(array, iteratee, comparator) {
      var index = -1,
          length = array.length;

      while (++index < length) {
        var value = array[index],
            current = iteratee(value);

        if (current != null && (computed === undefined
              ? (current === current && !isSymbol(current))
              : comparator(current, computed)
            )) {
          var computed = current,
              result = value;
        }
      }
      return result;
    }

    /**
     * _.fill 的基础实现，没有迭代器调用保护。
     *
     * @private
     * @param {Array} array 要填充的数组。
     * @param {*} value 用什么值填充 `array`。
     * @param {number} [start=0] 起始位置。
     * @param {number} [end=array.length] 结束位置。
     * @returns {Array} 返回 `array`。
     */
    function baseFill(array, value, start, end) {
      var length = array.length;

      start = toInteger(start);
      if (start < 0) {
        start = -start > length ? 0 : (length + start);
      }
      end = (end === undefined || end > length) ? length : toInteger(end);
      if (end < 0) {
        end += length;
      }
      end = start > end ? 0 : toLength(end);
      while (start < end) {
        array[start++] = value;
      }
      return array;
    }

    /**
     * _.filter 的基础实现，不支持迭代器简写。
     *
     * @private
     * @param {Array|Object} collection 要遍历的集合。
     * @param {Function} predicate 每次迭代调用的谓词函数。
     * @returns {Array} 返回过滤后的新数组。
     *
     * baseFilter 实现原理：
     *
     * 1. 初始化结果数组：创建空数组存储满足条件的元素
     *
     * 2. 遍历集合：使用 baseEach 遍历每个元素
     *
     * 3. 谓词检测：对每个元素调用 predicate(value, index, collection)
     *    - 如果返回 true，将元素 push 到结果数组
     *
     * 4. 返回结果：返回所有满足条件的元素组成的新数组
     *
     * 注意：
     * - 与 baseEvery 不同，filter 需要遍历所有元素
     * - 结果数组使用 push 添加元素（不需要预分配长度）
     *
     * 示例：
     * baseFilter([1, 2, 3, 4], x => x % 2 === 0)  // => [2, 4]
     * baseFilter({a: 1, b: 2}, v => v > 1)        // => [2]
     */
    function baseFilter(collection, predicate) {
      var result = [];
      baseEach(collection, function(value, index, collection) {
        if (predicate(value, index, collection)) {
          result.push(value);
        }
      });
      return result;
    }

    /**
     * _.flatten 的基础实现，支持限制扁平化深度。
     *
     * @private
     * @param {Array} array 要扁平化的数组。
     * @param {number} depth 最大递归深度。
     * @param {boolean} [predicate=isFlattenable] 每次迭代调用的函数。
     * @param {boolean} [isStrict] 限制为通过 `predicate` 检查的值。
     * @param {Array} [result=[]] 初始结果值。
     * @returns {Array} 返回扁平化后的新数组。
     */
    function baseFlatten(array, depth, predicate, isStrict, result) {
      var index = -1,
          length = array.length;

      predicate || (predicate = isFlattenable);
      result || (result = []);

      while (++index < length) {
        var value = array[index];
        if (depth > 0 && predicate(value)) {
          if (depth > 1) {
            // Recursively flatten arrays (susceptible to call stack limits).
            baseFlatten(value, depth - 1, predicate, isStrict, result);
          } else {
            arrayPush(result, value);
          }
        } else if (!isStrict) {
          result[result.length] = value;
        }
      }
      return result;
    }

    /**
     * baseForOwn 的基础实现，遍历 `object` 的 `keysFunc` 返回的属性，
     * 并为每个属性调用 `iteratee`。迭代器函数可以通过返回 `false` 提前退出迭代。
     *
     * @private
     * @param {Object} object 要遍历的对象。
     * @param {Function} iteratee 每次迭代调用的函数。
     * @param {Function} keysFunc 获取 `object` 键的函数。
     * @returns {Object} 返回 `object`。
     */
    var baseFor = createBaseFor();

    /**
     * 此函数类似于 `baseFor`，但以相反的顺序遍历属性。
     *
     * @private
     * @param {Object} object 要遍历的对象。
     * @param {Function} iteratee 每次迭代调用的函数。
     * @param {Function} keysFunc 获取 `object` 键的函数。
     * @returns {Object} 返回 `object`。
     */
    var baseForRight = createBaseFor(true);

    /**
     * _.forOwn 的基础实现，不支持迭代器简写。
     *
     * @private
     * @param {Object} object 要遍历的对象。
     * @param {Function} iteratee 每次迭代调用的函数。
     * @returns {Object} 返回 `object`。
     *
     * baseForOwn 是 Lodash 集合遍历的核心基础设施函数之一。
     *
     * 设计原理：
     * 1. 委托模式 - 将具体遍历逻辑委托给 baseFor，自己只负责 keys 获取
     * 2. 原型链安全 - keys 函数确保只遍历对象自身的可枚举属性
     * 3. early exit - 遍历过程中可通过 iteratee 返回 false 提前终止
     *
     * 与 baseForOwnRight 的区别：
     * - baseForOwn: 从前向后遍历（key 顺序由 keys() 决定）
     * - baseForOwnRight: 从后向前遍历（反向 key 顺序）
     */
    function baseForOwn(object, iteratee) {
      return object && baseFor(object, iteratee, keys);
    }

    /**
     * The base implementation of `_.forOwnRight` without support for iteratee shorthands.
      *
      * @private
      * @param {Object} object 要遍历的对象。
      * @param {Function} iteratee 每次迭代调用的函数。
      * @returns {Object} 返回 `object`。
      *
      * forOwnRight 的基础实现，按属性名的反向顺序遍历对象。
      * 常用于需要从后向前处理对象属性的场景。
      */
    function baseForOwnRight(object, iteratee) {
      return object && baseForRight(object, iteratee, keys);
    }

    /**
     * _.functions 的基础实现，从 `props` 过滤创建 `object` 函数属性名的数组。
     *
     * @private
     * @param {Object} object 要检查的对象。
     * @param {Array} props 要过滤的属性名。
     * @returns {Array} 返回函数名数组。
     *
     * 提取对象中所有函数类型属性的基础实现。
     * 与 _.functions 的区别：不检查 props 参数的有效性，假设传入的是对象键数组。
     */
    function baseFunctions(object, props) {
      return arrayFilter(props, function(key) {
        return isFunction(object[key]);
      });
    }

    /**
     * _.get 的基础实现，不支持默认值。
     *
     * @private
     * @param {Object} object 要查询的对象。
     * @param {Array|string} path 要获取的属性的路径。
     * @returns {*} 返回解析后的值。
     *
     * 深层属性访问的基础实现，支持路径语法。
     *
     * 设计原理：
     * 1. 路径解析 - 将字符串路径（如 'a.b.c'）转换为数组 ['a', 'b', 'c']
     * 2. 逐层访问 - 循环遍历路径的每一层，从对象中取出对应的值
     * 3. 中途短路 - 如果任意一层为 null/undefined，立即返回 undefined
     *
     * 示例：
     * baseGet({a: {b: {c: 1}}}, ['a', 'b', 'c']) => 1
     * baseGet({a: {b: {c: 1}}}, 'a.b.c') => 1
     */
    function baseGet(object, path) {
      path = castPath(path, object);

      var index = 0,
          length = path.length;

      while (object != null && index < length) {
        object = object[toKey(path[index++])];
      }
      return (index && index == length) ? object : undefined;
    }

    /**
     * getAllKeys 和 getAllKeysIn 的基础实现，
     * 使用 `keysFunc` 和 `symbolsFunc` 获取 `object` 的可枚举属性名和符号。
     *
     * @private
     * @param {Object} object 要查询的对象。
     * @param {Function} keysFunc 获取 `object` 键的函数。
     * @param {Function} symbolsFunc 获取 `object` 符号的函数。
     * @returns {Array} 返回属性名和符号的数组。
     */
    function baseGetAllKeys(object, keysFunc, symbolsFunc) {
      var result = keysFunc(object);
      return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
    }

    /**
     * getTag 的基础实现，没有针对有问题的环境的回退。
     *
     * @private
     * @param {*} value 要查询的值。
     * @returns {string} 返回 `toStringTag`。
     */
    function baseGetTag(value) {
      if (value == null) {
        return value === undefined ? undefinedTag : nullTag;
      }
      return (symToStringTag && symToStringTag in Object(value))
        ? getRawTag(value)
        : objectToString(value);
    }

    /**
     * The base implementation of `_.gt` which doesn't coerce arguments.
     *
      * @private
      * @param {*} value 要比较的值。
      * @param {*} other 要比较的其他值。
      * @returns {boolean} 如果 `value` 大于 `other` 返回 `true`，
      *  否则返回 `false`。
      */
    function baseGt(value, other) {
      return value > other;
    }

    /**
     * _.has 的基础实现，不支持深层路径。
     *
     * @private
     * @param {Object} [object] 要查询的对象。
     * @param {Array|string} key 要检查的键。
     * @returns {boolean} 如果 `key` 存在返回 `true`，否则返回 `false`。
     */
    function baseHas(object, key) {
      return object != null && hasOwnProperty.call(object, key);
    }

    /**
     * _.hasIn 的基础实现，不支持深层路径。
     *
     * @private
     * @param {Object} [object] 要查询的对象。
     * @param {Array|string} key 要检查的键。
     * @returns {boolean} 如果 `key` 存在返回 `true`，否则返回 `false`。
     */
    function baseHasIn(object, key) {
      return object != null && key in Object(object);
    }

    /**
     * _.inRange 的基础实现，不强制转换参数。
     *
     * @private
     * @param {number} number 要检查的数字。
     * @param {number} start 范围的起始值。
     * @param {number} end 范围的结束值。
     * @returns {boolean} 如果 `number` 在范围内返回 `true`，否则返回 `false`。
     */
    function baseInRange(number, start, end) {
      return number >= nativeMin(start, end) && number < nativeMax(start, end);
    }

    /**
     * 类似 `_.intersection` 方法的基础实现，不支持迭代器简写，
     * 接受要检查的数组数组。
     *
     * @private
     * @param {Array} arrays 要检查的数组。
     * @param {Function} [iteratee] 每个元素调用的迭代器函数。
     * @param {Function} [comparator] 每个元素调用的比较器函数。
     * @returns {Array} 返回共享值的新数组。
     */
    function baseIntersection(arrays, iteratee, comparator) {
      var includes = comparator ? arrayIncludesWith : arrayIncludes,
          length = arrays[0].length,
          othLength = arrays.length,
          othIndex = othLength,
          caches = Array(othLength),
          maxLength = Infinity,
          result = [];

      while (othIndex--) {
        var array = arrays[othIndex];
        if (othIndex && iteratee) {
          array = arrayMap(array, baseUnary(iteratee));
        }
        maxLength = nativeMin(array.length, maxLength);
        caches[othIndex] = !comparator && (iteratee || (length >= 120 && array.length >= 120))
          ? new SetCache(othIndex && array)
          : undefined;
      }
      array = arrays[0];

      var index = -1,
          seen = caches[0];

      outer:
      while (++index < length && result.length < maxLength) {
        var value = array[index],
            computed = iteratee ? iteratee(value) : value;

        value = (comparator || value !== 0) ? value : 0;
        if (!(seen
              ? cacheHas(seen, computed)
              : includes(result, computed, comparator)
            )) {
          othIndex = othLength;
          while (--othIndex) {
            var cache = caches[othIndex];
            if (!(cache
                  ? cacheHas(cache, computed)
                  : includes(arrays[othIndex], computed, comparator))
                ) {
              continue outer;
            }
          }
          if (seen) {
            seen.push(computed);
          }
          result.push(value);
        }
      }
      return result;
    }

    /**
     * _.invert 和 _.invertBy 的基础实现，
     * 使用 `iteratee` 转换值并用 `setter` 设置来反转 `object`。
     *
     * @private
     * @param {Object} object 要遍历的对象。
     * @param {Function} setter 用于设置 `accumulator` 值的函数。
     * @param {Function} iteratee 用于转换值的迭代器函数。
     * @param {Object} accumulator 初始反转对象。
     * @returns {Function} 返回 `accumulator`。
     */
    function baseInverter(object, setter, iteratee, accumulator) {
      baseForOwn(object, function(value, key, object) {
        setter(accumulator, iteratee(value), key, object);
      });
      return accumulator;
    }

    /**
     * _.invoke 的基础实现，不支持单个方法参数。
     *
     * @private
     * @param {Object} object 要查询的对象。
     * @param {Array|string} path 要调用的方法的路径。
     * @param {Array} args 调用方法时使用的参数。
     * @returns {*} 返回被调用方法的结果。
     */
    function baseInvoke(object, path, args) {
      path = castPath(path, object);
      object = parent(object, path);
      var func = object == null ? object : object[toKey(last(path))];
      return func == null ? undefined : apply(func, object, args);
    }

    /**
     * _.isArguments 的基础实现。
     *
     * @private
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是 `arguments` 对象返回 `true`。
     */
    function baseIsArguments(value) {
      return isObjectLike(value) && baseGetTag(value) == argsTag;
    }

    /**
     * _.isArrayBuffer 的基础实现，没有 Node.js 优化。
     *
     * @private
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是数组缓冲区返回 `true`，否则返回 `false`。
     */
    function baseIsArrayBuffer(value) {
      return isObjectLike(value) && baseGetTag(value) == arrayBufferTag;
    }

    /**
     * _.isDate 的基础实现，没有 Node.js 优化。
     *
     * @private
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是日期对象返回 `true`，否则返回 `false`。
     */
    function baseIsDate(value) {
      return isObjectLike(value) && baseGetTag(value) == dateTag;
    }

    /**
     * _.isEqual 的基础实现，支持部分比较和跟踪遍历的对象。
     *
     * @private
     * @param {*} value 要比较的值。
     * @param {*} other 要比较的其他值。
     * @param {boolean} bitmask 位掩码标志。
     *  1 - 无序比较
     *  2 - 部分比较
     * @param {Function} [customizer] 用于自定义比较的函数。
     * @param {Object} [stack] 跟踪遍历的 `value` 和 `other` 对象。
     * @returns {boolean} 如果值等价返回 `true`，否则返回 `false`。
     *
     * baseIsEqual 实现原理：
     *
     * 快速路径（短路检查）：
     * 1. 严格相等（===）：如果 value === other，直接返回 true
     *    - 包括 NaN !== NaN 的情况处理
     *
     * 2. 基础类型检测：
     *    - 如果任一值为 null/undefined 且两者不等，返回 false
     *    - 如果两者都不是对象类型（!isObjectLike），使用严格比较 NaN
     *      这是为了处理 NaN === NaN 返回 false 的情况
     *
     * 3. 委托深度比较：
     *    - 将实际的深度比较委托给 baseIsEqualDeep
     *    - 传递回调函数 baseIsEqual 以支持递归
     *
     * 位掩码标志：
     * - COMPARE_UNORDERED_FLAG (1): 无序比较（用于 Set、Array 比较）
     * - COMPARE_PARTIAL_FLAG (2): 部分比较（_.isMatch 使用）
     *
     * 示例：
     * baseIsEqual(1, 1)                    // => true
     * baseIsEqual(NaN, NaN)                // => true（特殊处理）
     * baseIsEqual({a: 1}, {a: 1})         // => true
     */
    function baseIsEqual(value, other, bitmask, customizer, stack) {
      if (value === other) {
        return true;
      }
      if (value == null || other == null || (!isObjectLike(value) && !isObjectLike(other))) {
        return value !== value && other !== other;
      }
      return baseIsEqualDeep(value, other, bitmask, customizer, baseIsEqual, stack);
    }

    /**
     * baseIsEqual 的专用版本，用于数组和对象，
     * 执行深度比较并跟踪遍历的对象，使具有循环引用的对象能够被比较。
     *
     * @private
     * @param {Object} object 要比较的对象。
     * @param {Object} other 要比较的其他对象。
     * @param {number} bitmask 位掩码标志。详见 `baseIsEqual`。
     * @param {Function} customizer 用于自定义比较的函数。
     * @param {Function} equalFunc 用于确定值等价的函数。
     * @param {Object} [stack] 跟踪遍历的 `object` 和 `other` 对象。
     * @returns {boolean} 如果对象等价返回 `true`，否则返回 `false`。
     *
     * baseIsEqualDeep 实现原理：
     *
     * 1. 类型检测：
     *    - isArray 检测：区分数组和普通对象
     *    - getTag 获取 toStringTag：用于精确类型比较
     *    - argsTag 归一化：arguments 对象归为 objectTag
     *
     * 2. Buffer 处理：
     *    - Buffer 需要特殊比较（内容比较而非引用）
     *    - 如果一个是 Buffer 另一个不是，直接返回 false
     *
     * 3. 分支策略：
     *    - 相同类型 + 数组：使用 equalArrays 比较
     *    - 相同类型 + TypedArray：使用 equalArrays 比较
     *    - 其他：使用 equalByTag 比较（如 Date、RegExp、Map、Set 等）
     *
     * 4. 循环引用处理：
     *    - 使用 Stack 数据结构跟踪已访问的对象
     *    - 比较前先检查是否已比较过
     *    - 比较后将当前对象入栈
     *
     * 5. 包装对象（_.chain）支持：
     *    - 如果对象被 _.chain 包装，提取其值进行比较
     *
     * 6. 类型不同：直接返回 false
     *
     * 循环引用示例：
     * var obj = {a: 1};
     * obj.self = obj;  // 循环引用
     * var obj2 = {a: 1, self: obj2};  // 另一个循环引用
     * baseIsEqual(obj, obj2) // => true（正确处理循环引用）
     */
    function baseIsEqualDeep(object, other, bitmask, customizer, equalFunc, stack) {
      var objIsArr = isArray(object),
          othIsArr = isArray(other),
          objTag = objIsArr ? arrayTag : getTag(object),
          othTag = othIsArr ? arrayTag : getTag(other);

      objTag = objTag == argsTag ? objectTag : objTag;
      othTag = othTag == argsTag ? objectTag : othTag;

      var objIsObj = objTag == objectTag,
          othIsObj = othTag == objectTag,
          isSameTag = objTag == othTag;

      if (isSameTag && isBuffer(object)) {
        if (!isBuffer(other)) {
          return false;
        }
        objIsArr = true;
        objIsObj = false;
      }
      if (isSameTag && !objIsObj) {
        stack || (stack = new Stack);
        return (objIsArr || isTypedArray(object))
          ? equalArrays(object, other, bitmask, customizer, equalFunc, stack)
          : equalByTag(object, other, objTag, bitmask, customizer, equalFunc, stack);
      }
      if (!(bitmask & COMPARE_PARTIAL_FLAG)) {
        var objIsWrapped = objIsObj && hasOwnProperty.call(object, '__wrapped__'),
            othIsWrapped = othIsObj && hasOwnProperty.call(other, '__wrapped__');

        if (objIsWrapped || othIsWrapped) {
          var objUnwrapped = objIsWrapped ? object.value() : object,
              othUnwrapped = othIsWrapped ? other.value() : other;

          stack || (stack = new Stack);
          return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
        }
      }
      if (!isSameTag) {
        return false;
      }
      stack || (stack = new Stack);
      return equalObjects(object, other, bitmask, customizer, equalFunc, stack);
    }

    /**
     * _.isMap 的基础实现，没有 Node.js 优化。
     *
     * @private
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是 Map 返回 `true`，否则返回 `false`。
     */
    function baseIsMap(value) {
      return isObjectLike(value) && getTag(value) == mapTag;
    }

    /**
     * _.isMatch 的基础实现，不支持迭代器简写。
     *
     * @private
     * @param {Object} object 要检查的对象。
     * @param {Object} source 要匹配的属性值的对象。
     * @param {Array} matchData 要匹配的属性名、值和比较标志。
     * @param {Function} [customizer] 用于自定义比较的函数。
     * @returns {boolean} 如果 `object` 是匹配返回 `true`，否则返回 `false`。
     */
    function baseIsMatch(object, source, matchData, customizer) {
      var index = matchData.length,
          length = index,
          noCustomizer = !customizer;

      if (object == null) {
        return !length;
      }
      object = Object(object);
      while (index--) {
        var data = matchData[index];
        if ((noCustomizer && data[2])
              ? data[1] !== object[data[0]]
              : !(data[0] in object)
            ) {
          return false;
        }
      }
      while (++index < length) {
        data = matchData[index];
        var key = data[0],
            objValue = object[key],
            srcValue = data[1];

        if (noCustomizer && data[2]) {
          if (objValue === undefined && !(key in object)) {
            return false;
          }
        } else {
          var stack = new Stack;
          if (customizer) {
            var result = customizer(objValue, srcValue, key, object, source, stack);
          }
          if (!(result === undefined
                ? baseIsEqual(srcValue, objValue, COMPARE_PARTIAL_FLAG | COMPARE_UNORDERED_FLAG, customizer, stack)
                : result
              )) {
            return false;
          }
        }
      }
      return true;
    }

    /**
     * _.isNative 的基础实现，没有不良 shim 检查。
     *
     * @private
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是原生函数返回 `true`，
     *  否则返回 `false`。
     */
    function baseIsNative(value) {
      if (!isObject(value) || isMasked(value)) {
        return false;
      }
      var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
      return pattern.test(toSource(value));
    }

    /**
     * _.isRegExp 的基础实现，没有 Node.js 优化。
     *
     * @private
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是正则表达式返回 `true`，否则返回 `false`。
     */
    function baseIsRegExp(value) {
      return isObjectLike(value) && baseGetTag(value) == regexpTag;
    }

    /**
     * _.isSet 的基础实现，没有 Node.js 优化。
     *
     * @private
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是 Set 返回 `true`，否则返回 `false`。
     */
    function baseIsSet(value) {
      return isObjectLike(value) && getTag(value) == setTag;
    }

    /**
     * _.isTypedArray 的基础实现，没有 Node.js 优化。
     *
     * @private
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是类型化数组返回 `true`，否则返回 `false`。
     */
    function baseIsTypedArray(value) {
      return isObjectLike(value) &&
        isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
    }

    /**
     * _.iteratee 的基础实现。
     *
     * @private
     * @param {*} [value=_.identity] 要转换为迭代器的值。
     * @returns {Function} 返回迭代器。
     */
    function baseIteratee(value) {
      // Don't store the `typeof` result in a variable to avoid a JIT bug in Safari 9.
      // See https://bugs.webkit.org/show_bug.cgi?id=156034 for more details.
      if (typeof value == 'function') {
        return value;
      }
      if (value == null) {
        return identity;
      }
      if (typeof value == 'object') {
        return isArray(value)
          ? baseMatchesProperty(value[0], value[1])
          : baseMatches(value);
      }
      return property(value);
    }

    /**
     * _.keys 的基础实现，不将稀疏数组视为密集数组。
     *
     * @private
     * @param {Object} object 要查询的对象。
     * @returns {Array} 返回属性名数组。
     *
     * baseKeys 实现原理：
     *
     * 1. 原型检测：检查是否是原型对象（Object.prototype 等）
     *
     * 2. 快速路径：
     *    - 如果不是原型对象，直接使用 nativeKeys（Object.keys）
     *    - 这是常见的普通对象情况
     *
     * 3. 慢速路径（原型对象）：
     *    - 使用 for...in 遍历
     *    - 过滤：只包含 hasOwnProperty 为 true 的属性
     *    - 排除：key !== 'constructor'（避免包含继承的属性）
     *
     * 设计考虑：
     * - 避免遍历稀疏数组的空洞
     * - 跳过继承自原型的属性
     *
     * 示例：
     * baseKeys({a: 1, b: 2})           // => ['a', 'b']
     * baseKeys([1, 2, 3])              // => ['0', '1', '2']
     * baseKeys(Object.prototype)       // => []（空，原型无自有属性）
     */
    function baseKeys(object) {
      if (!isPrototype(object)) {
        return nativeKeys(object);
      }
      var result = [];
      for (var key in Object(object)) {
        if (hasOwnProperty.call(object, key) && key != 'constructor') {
          result.push(key);
        }
      }
      return result;
    }

    /**
     * _.keysIn 的基础实现，不将稀疏数组视为密集数组。
     *
     * @private
     * @param {Object} object 要查询的对象。
     * @returns {Array} 返回属性名数组。
     *
     * baseKeysIn 实现原理：
     *
     * 与 baseKeys 的区别：
     * - baseKeys：只返回自有属性（own properties）
     * - baseKeysIn：返回自有属性 + 继承属性
     *
     * 1. 非对象检测：如果不是对象（如 undefined、null、原始值），返回空数组
     *
     * 2. 原型检测：检查是否是原型对象
     *
     * 3. 遍历策略：
     *    - 使用 for...in（包含继承属性）
     *    - 排除构造函数属性
     *    - 当是原型对象时，还要排除非 hasOwnProperty 的继承属性
     *
     * 示例：
     * baseKeysIn({a: 1, b: 2})                    // => ['a', 'b']
     * baseKeysIn(Object.create({c: 3}, {d: {value: 4}})) // => ['d', 'c']
     */
    function baseKeysIn(object) {
      if (!isObject(object)) {
        return nativeKeysIn(object);
      }
      var isProto = isPrototype(object),
          result = [];

      for (var key in object) {
        if (!(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
          result.push(key);
        }
      }
      return result;
    }

    /**
     * _.lt 的基础实现，不强制转换参数。
     *
     * @private
     * @param {*} value 要比较的值。
     * @param {*} other 要比较的其他值。
     * @returns {boolean} 如果 `value` 小于 `other` 返回 `true`，
     *  否则返回 `false`。
     */
    function baseLt(value, other) {
      return value < other;
    }

    /**
     * _.map 的基础实现，不支持迭代器简写。
     *
     * @private
     * @param {Array|Object} collection 要遍历的集合。
     * @param {Function} iteratee 每次迭代调用的函数。
     * @returns {Array} 返回映射后的新数组。
     *
     * baseMap 实现原理：
     *
     * 1. 预分配数组：
     *    - 如果是类数组（isArrayLike），预分配正确长度的数组
     *    - 否则使用空数组（适用于 Set、Map 等）
     *
     * 2. 遍历集合：使用 baseEach 进行遍历
     *
     * 3. 转换元素：对每个元素调用 iteratee(value, key, collection)
     *    - key：如果是数组则是索引，如果是对象则是属性名
     *
     * 4. 返回结果：返回填充好的新数组
     *
     * 性能优化：
     * - 预分配数组比 push 更快
     * - 使用 ++index 而非 index++ 避免额外赋值
     *
     * 示例：
     * baseMap([1, 2, 3], x => x * 2)  // => [2, 4, 6]
     * baseMap({a: 1, b: 2}, (v, k) => k + v)  // => ['a1', 'b2']
     */
    function baseMap(collection, iteratee) {
      var index = -1,
          result = isArrayLike(collection) ? Array(collection.length) : [];

      baseEach(collection, function(value, key, collection) {
        result[++index] = iteratee(value, key, collection);
      });
      return result;
    }

    /**
     * _.matches 的基础实现，不克隆 `source`。
     *
     * @private
     * @param {Object} source 要匹配的属性值的对象。
     * @returns {Function} 返回新的规范函数。
     */
    function baseMatches(source) {
      var matchData = getMatchData(source);
      if (matchData.length == 1 && matchData[0][2]) {
        return matchesStrictComparable(matchData[0][0], matchData[0][1]);
      }
      return function(object) {
        return object === source || baseIsMatch(object, source, matchData);
      };
    }

    /**
     * _.matchesProperty 的基础实现，不克隆 `srcValue`。
     *
     * @private
     * @param {string} path 要获取的属性的路径。
     * @param {*} srcValue 要匹配的值。
     * @returns {Function} 返回新的规范函数。
     */
    function baseMatchesProperty(path, srcValue) {
      if (isKey(path) && isStrictComparable(srcValue)) {
        return matchesStrictComparable(toKey(path), srcValue);
      }
      return function(object) {
        var objValue = get(object, path);
        return (objValue === undefined && objValue === srcValue)
          ? hasIn(object, path)
          : baseIsEqual(srcValue, objValue, COMPARE_PARTIAL_FLAG | COMPARE_UNORDERED_FLAG);
      };
    }

    /**
     * The base implementation of `_.merge` without support for multiple sources.
     *
     * @private
     * @param {Object} object The destination object.
     * @param {Object} source The source object.
     * @param {number} srcIndex The index of `source`.
     * @param {Function} [customizer] The function to customize merged values.
     * @param {Object} [stack] Tracks traversed source values and their merged
     *  counterparts.
     *
     * baseMerge 实现原理：
     *
     * 合并策略：
     * 1. 自引用检测：如果 object === source，直接返回（避免无限循环）
     *
     * 2. 遍历源对象：使用 baseFor 遍历 source 的所有属性（包含继承属性）
     *
     * 3. 分类处理：
     *    - 对象类型：递归调用 baseMergeDeep 进行深度合并
     *    - 基本类型：
     *      a. 如果有 customizer，调用它获取新值
     *      b. 否则使用源值作为新值
     *      c. 调用 assignMergeValue 赋值到目标对象
     *
     * 4. Stack 用于循环引用检测：
     *    - 避免死循环（如合并两个相互引用的对象）
     *
     * 与 Object.assign 的区别：
     * - Object.assign：浅拷贝，直接替换属性值
     * - _.merge：深度合并，递归合并嵌套对象
     *
     * 示例：
     * baseMerge({a: {x: 1}}, {a: {y: 2}})  // => {a: {x: 1, y: 2}}
     */
    function baseMerge(object, source, srcIndex, customizer, stack) {
      if (object === source) {
        return;
      }
      baseFor(source, function(srcValue, key) {
        stack || (stack = new Stack);
        if (isObject(srcValue)) {
          baseMergeDeep(object, source, key, srcIndex, baseMerge, customizer, stack);
        }
        else {
          var newValue = customizer
            ? customizer(safeGet(object, key), srcValue, (key + ''), object, source, stack)
            : undefined;

          if (newValue === undefined) {
            newValue = srcValue;
          }
          assignMergeValue(object, key, newValue);
        }
      }, keysIn);
    }

    /**
     * baseMerge 的专用版本，用于数组和对象，
     * 执行深度合并并跟踪遍历的对象，使具有循环引用的对象能够被合并。
     *
     * @private
     * @param {Object} object 目标对象。
     * @param {Object} source 源对象。
     * @param {string} key 要合并的值的键。
     * @param {number} srcIndex `source` 的索引。
     * @param {Function} mergeFunc 用于合并值的函数。
     * @param {Function} [customizer] 用于自定义分配值的函数。
     * @param {Object} [stack] 跟踪遍历的源值及其合并对应物。
     *
     * baseMergeDeep 实现原理：
     *
     * 1. 循环引用检测：
     *    - 使用 Stack 检查 srcValue 是否已访问
     *    - 如果已访问，直接使用缓存的副本（避免无限循环）
     *
     * 2. Customizer 优先：
     *    - 如果提供了 customizer，调用它决定新值
     *    - isCommon 标记 customizer 是否返回了有效值
     *
     * 3. 类型判断与处理策略：
     *    - 数组：合并数组而非替换
     *    - Buffer：深拷贝 Buffer
     *    - TypedArray：深拷贝 TypedArray
     *    - 普通对象/arguments：递归合并
     *    - 其他类型（如函数）：直接替换
     *
     * 4. 递归合并：
     *    - 将新值入栈（标记为已访问）
     *    - 递归调用 mergeFunc 合并嵌套对象
     *    - 合并完成后从栈中删除（允许后续重新访问）
     *
     * 示例：
     * baseMergeDeep({a: {}}, {a: {b: 1}}, 'a', 0, baseMerge)
     * // => {a: {b: 1}}（a 对象被合并，而非替换）
     */
    function baseMergeDeep(object, source, key, srcIndex, mergeFunc, customizer, stack) {
      var objValue = safeGet(object, key),
          srcValue = safeGet(source, key),
          stacked = stack.get(srcValue);

      if (stacked) {
        assignMergeValue(object, key, stacked);
        return;
      }
      var newValue = customizer
        ? customizer(objValue, srcValue, (key + ''), object, source, stack)
        : undefined;

      var isCommon = newValue === undefined;

      if (isCommon) {
        var isArr = isArray(srcValue),
            isBuff = !isArr && isBuffer(srcValue),
            isTyped = !isArr && !isBuff && isTypedArray(srcValue);

        newValue = srcValue;
        if (isArr || isBuff || isTyped) {
          if (isArray(objValue)) {
            newValue = objValue;
          }
          else if (isArrayLikeObject(objValue)) {
            newValue = copyArray(objValue);
          }
          else if (isBuff) {
            isCommon = false;
            newValue = cloneBuffer(srcValue, true);
          }
          else if (isTyped) {
            isCommon = false;
            newValue = cloneTypedArray(srcValue, true);
          }
          else {
            newValue = [];
          }
        }
        else if (isPlainObject(srcValue) || isArguments(srcValue)) {
          newValue = objValue;
          if (isArguments(objValue)) {
            newValue = toPlainObject(objValue);
          }
          else if (!isObject(objValue) || isFunction(objValue)) {
            newValue = initCloneObject(srcValue);
          }
        }
        else {
          isCommon = false;
        }
      }
      if (isCommon) {
        // Recursively merge objects and arrays (susceptible to call stack limits).
        stack.set(srcValue, newValue);
        mergeFunc(newValue, srcValue, srcIndex, customizer, stack);
        stack['delete'](srcValue);
      }
      assignMergeValue(object, key, newValue);
    }

    /**
     * _.nth 的基础实现，不强制转换参数。
     *
     * @private
     * @param {Array} array 要查询的数组。
     * @param {number} n 要返回的元素的索引。
     * @returns {*} 返回 `array` 的第 n 个元素。
     */
    function baseNth(array, n) {
      var length = array.length;
      if (!length) {
        return;
      }
      n += n < 0 ? length : 0;
      return isIndex(n, length) ? array[n] : undefined;
    }

    /**
     * _.orderBy 的基础实现，没有参数保护。
     *
     * @private
     * @param {Array|Object} collection 要遍历的集合。
     * @param {Function[]|Object[]|string[]} iteratees 要排序的迭代器。
     * @param {string[]} orders `iteratees` 的排序顺序。
     * @returns {Array} 返回排序后的新数组。
     */
    function baseOrderBy(collection, iteratees, orders) {
      if (iteratees.length) {
        iteratees = arrayMap(iteratees, function(iteratee) {
          if (isArray(iteratee)) {
            return function(value) {
              return baseGet(value, iteratee.length === 1 ? iteratee[0] : iteratee);
            };
          }
          return iteratee;
        });
      } else {
        iteratees = [identity];
      }

      var index = -1;
      iteratees = arrayMap(iteratees, baseUnary(getIteratee()));

      var result = baseMap(collection, function(value, key, collection) {
        var criteria = arrayMap(iteratees, function(iteratee) {
          return iteratee(value);
        });
        return { 'criteria': criteria, 'index': ++index, 'value': value };
      });

      return baseSortBy(result, function(object, other) {
        return compareMultiple(object, other, orders);
      });
    }

    /**
     * _.pick 的基础实现，不支持单个属性标识符。
     *
     * @private
     * @param {Object} object 源对象。
     * @param {string[]} paths 要选取的属性路径。
     * @returns {Object} 返回新对象。
     */
    function basePick(object, paths) {
      return basePickBy(object, paths, function(value, path) {
        return hasIn(object, path);
      });
    }

    /**
     * _.pickBy 的基础实现，不支持迭代器简写。
     *
     * @private
     * @param {Object} object 源对象。
     * @param {string[]} paths 要选取的属性路径。
     * @param {Function} predicate 每个属性调用的函数。
     * @returns {Object} 返回新对象。
     */
    function basePickBy(object, paths, predicate) {
      var index = -1,
          length = paths.length,
          result = {};

      while (++index < length) {
        var path = paths[index],
            value = baseGet(object, path);

        if (predicate(value, path)) {
          baseSet(result, castPath(path, object), value);
        }
      }
      return result;
    }

    /**
     * baseProperty 的专用版本，支持深层路径。
     *
     * @private
     * @param {Array|string} path 要获取的属性的路径。
     * @returns {Function} 返回新的访问器函数。
     */
    function basePropertyDeep(path) {
      return function(object) {
        return baseGet(object, path);
      };
    }

    /**
     * _.pullAllBy 的基础实现，不支持迭代器简写。
     *
     * @private
     * @param {Array} array 要修改的数组。
     * @param {Array} values 要移除的值。
     * @param {Function} [iteratee] 每个元素调用的迭代器函数。
     * @param {Function} [comparator] 每个元素调用的比较器函数。
     * @returns {Array} 返回 `array`。
     */
    function basePullAll(array, values, iteratee, comparator) {
      var indexOf = comparator ? baseIndexOfWith : baseIndexOf,
          index = -1,
          length = values.length,
          seen = array;

      if (array === values) {
        values = copyArray(values);
      }
      if (iteratee) {
        seen = arrayMap(array, baseUnary(iteratee));
      }
      while (++index < length) {
        var fromIndex = 0,
            value = values[index],
            computed = iteratee ? iteratee(value) : value;

        while ((fromIndex = indexOf(seen, computed, fromIndex, comparator)) > -1) {
          if (seen !== array) {
            splice.call(seen, fromIndex, 1);
          }
          splice.call(array, fromIndex, 1);
        }
      }
      return array;
    }

    /**
     * _.pullAt 的基础实现，不支持单个索引或捕获移除的元素。
     *
     * @private
     * @param {Array} array 要修改的数组。
     * @param {number[]} indexes 要移除的元素的索引。
     * @returns {Array} 返回 `array`。
     */
    function basePullAt(array, indexes) {
      var length = array ? indexes.length : 0,
          lastIndex = length - 1;

      while (length--) {
        var index = indexes[length];
        if (length == lastIndex || index !== previous) {
          var previous = index;
          if (isIndex(index)) {
            splice.call(array, index, 1);
          } else {
            baseUnset(array, index);
          }
        }
      }
      return array;
    }

    /**
     * _.random 的基础实现，不支持返回浮点数。
     *
     * @private
     * @param {number} lower 下界。
     * @param {number} upper 上界。
     * @returns {number} 返回随机数。
     */
    function baseRandom(lower, upper) {
      return lower + nativeFloor(nativeRandom() * (upper - lower + 1));
    }

    /**
     * _.range 和 _.rangeRight 的基础实现，不强制转换参数。
     *
     * @private
     * @param {number} start 范围的起始值。
     * @param {number} end 范围的结束值。
     * @param {number} step 递增或递减的值。
     * @param {boolean} [fromRight] 指定从右到左迭代。
     * @returns {Array} 返回数字范围。
     */
    function baseRange(start, end, step, fromRight) {
      var index = -1,
          length = nativeMax(nativeCeil((end - start) / (step || 1)), 0),
          result = Array(length);

      while (length--) {
        result[fromRight ? length : ++index] = start;
        start += step;
      }
      return result;
    }

    /**
     * _.repeat 的基础实现，不强制转换参数。
     *
     * @private
     * @param {string} string 要重复的字符串。
     * @param {number} n 重复字符串的次数。
     * @returns {string} 返回重复后的字符串。
     */
    function baseRepeat(string, n) {
      var result = '';
      if (!string || n < 1 || n > MAX_SAFE_INTEGER) {
        return result;
      }
      // Leverage the exponentiation by squaring algorithm for a faster repeat.
      // See https://en.wikipedia.org/wiki/Exponentiation_by_squaring for more details.
      do {
        if (n % 2) {
          result += string;
        }
        n = nativeFloor(n / 2);
        if (n) {
          string += string;
        }
      } while (n);

      return result;
    }

    /**
     * _.rest 的基础实现，不验证或强制转换参数。
     *
     * @private
     * @param {Function} func 要应用 rest 参数的函数。
     * @param {number} [start=func.length-1] rest 参数的起始位置。
     * @returns {Function} 返回新函数。
     */
    function baseRest(func, start) {
      return setToString(overRest(func, start, identity), func + '');
    }

    /**
     * _.sample 的基础实现。
     *
     * @private
     * @param {Array|Object} collection 要采样的集合。
     * @returns {*} 返回随机元素。
     */
    function baseSample(collection) {
      return arraySample(values(collection));
    }

    /**
     * _.sampleSize 的基础实现，没有参数保护。
     *
     * @private
     * @param {Array|Object} collection 要采样的集合。
     * @param {number} n 要采样的元素数量。
     * @returns {Array} 返回随机元素数组。
     */
    function baseSampleSize(collection, n) {
      var array = values(collection);
      return shuffleSelf(array, baseClamp(n, 0, array.length));
    }

    /**
     * _.set 的基础实现。
     *
     * @private
     * @param {Object} object 要修改的对象。
     * @param {Array|string} path 要设置的属性的路径。
     * @param {*} value 要设置的值。
     * @param {Function} [customizer] 用于自定义路径创建的函数。
     * @returns {Object} 返回 `object`。
     */
    function baseSet(object, path, value, customizer) {
      if (!isObject(object)) {
        return object;
      }
      path = castPath(path, object);

      var index = -1,
          length = path.length,
          lastIndex = length - 1,
          nested = object;

      while (nested != null && ++index < length) {
        var key = toKey(path[index]),
            newValue = value;

        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          return object;
        }

        if (index != lastIndex) {
          var objValue = nested[key];
          newValue = customizer ? customizer(objValue, key, nested) : undefined;
          if (newValue === undefined) {
            newValue = isObject(objValue)
              ? objValue
              : (isIndex(path[index + 1]) ? [] : {});
          }
        }
        assignValue(nested, key, newValue);
        nested = nested[key];
      }
      return object;
    }

    /**
     * setData 的基础实现，不支持热循环短路。
     *
     * @private
     * @param {Function} func 要关联元数据的函数。
     * @param {*} data 元数据。
     * @returns {Function} 返回 `func`。
     */
    var baseSetData = !metaMap ? identity : function(func, data) {
      metaMap.set(func, data);
      return func;
    };

    /**
     * setToString 的基础实现，不支持热循环短路。
     *
     * @private
     * @param {Function} func 要修改的函数。
     * @param {Function} string `toString` 结果。
     * @returns {Function} 返回 `func`。
     */
    var baseSetToString = !defineProperty ? identity : function(func, string) {
      return defineProperty(func, 'toString', {
        'configurable': true,
        'enumerable': false,
        'value': constant(string),
        'writable': true
      });
    };

    /**
     * _.shuffle 的基础实现。
     *
     * @private
     * @param {Array|Object} collection 要打乱的集合。
     * @returns {Array} 返回打乱后的新数组。
     */
    function baseShuffle(collection) {
      return shuffleSelf(values(collection));
    }

    /**
     * _.slice 的基础实现，没有迭代器调用保护。
     *
     * @private
     * @param {Array} array 要切片的数组。
     * @param {number} [start=0] 起始位置。
     * @param {number} [end=array.length] 结束位置。
     * @returns {Array} 返回 `array` 的切片。
     */
    function baseSlice(array, start, end) {
      var index = -1,
          length = array.length;

      if (start < 0) {
        start = -start > length ? 0 : (length + start);
      }
      end = end > length ? length : end;
      if (end < 0) {
        end += length;
      }
      length = start > end ? 0 : ((end - start) >>> 0);
      start >>>= 0;

      var result = Array(length);
      while (++index < length) {
        result[index] = array[index + start];
      }
      return result;
    }

    /**
     * _.some 的基础实现，不支持迭代器简写。
     *
     * @private
     * @param {Array|Object} collection 要遍历的集合。
     * @param {Function} predicate 每次迭代调用的谓词函数。
     * @returns {boolean} 如果任何元素通过谓词检查返回 `true`，
     *  否则返回 `false`。
     *
     * baseSome 实现原理：
     *
     * 短路求值（Short-circuit evaluation）：
     * - 只要有一个元素满足谓词，立即返回 true
     * - 不需要遍历整个集合
     *
     * 实现技巧：
     * 1. return !result：当 result 为 true 时，返回 false，终止 baseEach
     * 2. !!result：确保返回值是布尔值
     *
     * 与 baseEvery 的区别：
     * - baseEvery：所有元素都满足才返回 true
     * - baseSome：任一元素满足就返回 true
     *
     * 示例：
     * baseSome([1, 2, 3], x => x > 2)  // => true
     * baseSome([1, 2, 3], x => x > 3)   // => false
     */
    function baseSome(collection, predicate) {
      var result;

      baseEach(collection, function(value, index, collection) {
        result = predicate(value, index, collection);
        return !result;
      });
      return !!result;
    }

    /**
     * _.sortedIndex 和 _.sortedLastIndex 的基础实现，
     * 执行数组的二分搜索以确定 `value` 应被插入 `array` 的索引位置，以维持其排序顺序。
     *
     * @private
     * @param {Array} array 要检查的已排序数组。
     * @param {*} value 要评估的值。
     * @param {boolean} [retHighest] 指定返回最高限定索引。
     * @returns {number} 返回 `value` 应被插入 `array` 的索引。
     */
    function baseSortedIndex(array, value, retHighest) {
      var low = 0,
          high = array == null ? low : array.length;

      if (typeof value == 'number' && value === value && high <= HALF_MAX_ARRAY_LENGTH) {
        while (low < high) {
          var mid = (low + high) >>> 1,
              computed = array[mid];

          if (computed !== null && !isSymbol(computed) &&
              (retHighest ? (computed <= value) : (computed < value))) {
            low = mid + 1;
          } else {
            high = mid;
          }
        }
        return high;
      }
      return baseSortedIndexBy(array, value, identity, retHighest);
    }

    /**
     * _.sortedIndexBy 和 _.sortedLastIndexBy 的基础实现，
     * 为 `value` 和 `array` 的每个元素调用 `iteratee` 来计算它们的排序排名。
     * 迭代器使用一个参数调用：(value)。
     *
     * @private
     * @param {Array} array 要检查的已排序数组。
     * @param {*} value 要评估的值。
     * @param {Function} iteratee 每个元素调用的迭代器。
     * @param {boolean} [retHighest] 指定返回最高限定索引。
     * @returns {number} 返回 `value` 应被插入 `array` 的索引。
     */
    function baseSortedIndexBy(array, value, iteratee, retHighest) {
      var low = 0,
          high = array == null ? 0 : array.length;
      if (high === 0) {
        return 0;
      }

      value = iteratee(value);
      var valIsNaN = value !== value,
          valIsNull = value === null,
          valIsSymbol = isSymbol(value),
          valIsUndefined = value === undefined;

      while (low < high) {
        var mid = nativeFloor((low + high) / 2),
            computed = iteratee(array[mid]),
            othIsDefined = computed !== undefined,
            othIsNull = computed === null,
            othIsReflexive = computed === computed,
            othIsSymbol = isSymbol(computed);

        if (valIsNaN) {
          var setLow = retHighest || othIsReflexive;
        } else if (valIsUndefined) {
          setLow = othIsReflexive && (retHighest || othIsDefined);
        } else if (valIsNull) {
          setLow = othIsReflexive && othIsDefined && (retHighest || !othIsNull);
        } else if (valIsSymbol) {
          setLow = othIsReflexive && othIsDefined && !othIsNull && (retHighest || !othIsSymbol);
        } else if (othIsNull || othIsSymbol) {
          setLow = false;
        } else {
          setLow = retHighest ? (computed <= value) : (computed < value);
        }
        if (setLow) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }
      return nativeMin(high, MAX_ARRAY_INDEX);
    }

    /**
     * _.sortedUniq 和 _.sortedUniqBy 的基础实现，不支持迭代器简写。
     *
     * @private
     * @param {Array} array 要检查的数组。
     * @param {Function} [iteratee] 每个元素调用的迭代器。
     * @returns {Array} 返回新的无重复值数组。
     */
    function baseSortedUniq(array, iteratee) {
      var index = -1,
          length = array.length,
          resIndex = 0,
          result = [];

      while (++index < length) {
        var value = array[index],
            computed = iteratee ? iteratee(value) : value;

        if (!index || !eq(computed, seen)) {
          var seen = computed;
          result[resIndex++] = value === 0 ? 0 : value;
        }
      }
      return result;
    }

    /**
     * _.toNumber 的基础实现，不确保二进制、十六进制或八进制字符串值的正确转换。
     *
     * @private
     * @param {*} value 要处理的值。
     * @returns {number} 返回数字。
     */
    function baseToNumber(value) {
      if (typeof value == 'number') {
        return value;
      }
      if (isSymbol(value)) {
        return NAN;
      }
      return +value;
    }

    /**
     * _.toString 的基础实现，不将 nullish 值转换为空字符串。
     *
     * @private
     * @param {*} value 要处理的值。
     * @returns {string} 返回字符串。
     */
    function baseToString(value) {
      // Exit early for strings to avoid a performance hit in some environments.
      if (typeof value == 'string') {
        return value;
      }
      if (isArray(value)) {
        // Recursively convert values (susceptible to call stack limits).
        return arrayMap(value, baseToString) + '';
      }
      if (isSymbol(value)) {
        return symbolToString ? symbolToString.call(value) : '';
      }
      var result = (value + '');
      return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
    }

    /**
     * The base implementation of `_.uniqBy` without support for iteratee shorthands.
     *
     * @private
     * @param {Array} array The array to inspect.
     * @param {Function} [iteratee] 每个元素调用的迭代器。
     * @param {Function} [comparator] 每个元素调用的比较器。
     * @returns {Array} 返回新的无重复值数组。
     */
    function baseUniq(array, iteratee, comparator) {
      var index = -1,
          includes = arrayIncludes,
          length = array.length,
          isCommon = true,
          result = [],
          seen = result;

      if (comparator) {
        isCommon = false;
        includes = arrayIncludesWith;
      }
      else if (length >= LARGE_ARRAY_SIZE) {
        var set = iteratee ? null : createSet(array);
        if (set) {
          return setToArray(set);
        }
        isCommon = false;
        includes = cacheHas;
        seen = new SetCache;
      }
      else {
        seen = iteratee ? [] : result;
      }
      outer:
      while (++index < length) {
        var value = array[index],
            computed = iteratee ? iteratee(value) : value;

        value = (comparator || value !== 0) ? value : 0;
        if (isCommon && computed === computed) {
          var seenIndex = seen.length;
          while (seenIndex--) {
            if (seen[seenIndex] === computed) {
              continue outer;
            }
          }
          if (iteratee) {
            seen.push(computed);
          }
          result.push(value);
        }
        else if (!includes(seen, computed, comparator)) {
          if (seen !== result) {
            seen.push(computed);
          }
          result.push(value);
        }
      }
      return result;
    }

    /**
     * _.unset 的基础实现。
     *
     * @private
     * @param {Object} object 要修改的对象。
     * @param {Array|string} path 要删除的属性路径。
     * @returns {boolean} 如果属性被删除返回 `true`，否则返回 `false`。
     */
    function baseUnset(object, path) {
      path = castPath(path, object);

      // Prevent prototype pollution:
      // https://github.com/lodash/lodash/security/advisories/GHSA-xxjr-mmjv-4gpg
      // https://github.com/lodash/lodash/security/advisories/GHSA-f23m-r3pf-42rh
      var index = -1,
          length = path.length;

      if (!length) {
        return true;
      }

      while (++index < length) {
        var key = toKey(path[index]);

        // Always block "__proto__" anywhere in the path if it's not expected
        if (key === '__proto__' && !hasOwnProperty.call(object, '__proto__')) {
          return false;
        }

        // Block constructor/prototype as non-terminal traversal keys to prevent
        // escaping the object graph into built-in constructors and prototypes.
        if ((key === 'constructor' || key === 'prototype') && index < length - 1) {
          return false;
        }
      }

      var obj = parent(object, path);
      return obj == null || delete obj[toKey(last(path))];
    }

    /**
     * The base implementation of `_.update`.
     *
     * @private
     * @param {Object} object 要修改的对象。
     * @param {Array|string} path 要更新的属性的路径。
     * @param {Function} updater 生成更新值的函数。
     * @param {Function} [customizer] 用于自定义路径创建的函数。
     * @returns {Object} 返回 `object`。
     */
    function baseUpdate(object, path, updater, customizer) {
      return baseSet(object, path, updater(baseGet(object, path)), customizer);
    }

    /**
     * _.dropWhile 和 _.takeWhile 方法的基础实现，不支持迭代器简写。
     *
     * @private
     * @param {Array} array 要查询的数组。
     * @param {Function} predicate 每次迭代调用的函数。
     * @param {boolean} [isDrop] 指定删除元素而不是获取元素。
     * @param {boolean} [fromRight] 指定从右到左迭代。
     * @returns {Array} 返回 `array` 的切片。
     */
    function baseWhile(array, predicate, isDrop, fromRight) {
      var length = array.length,
          index = fromRight ? length : -1;

      while ((fromRight ? index-- : ++index < length) &&
        predicate(array[index], index, array)) {}

      return isDrop
        ? baseSlice(array, (fromRight ? 0 : index), (fromRight ? index + 1 : length))
        : baseSlice(array, (fromRight ? index + 1 : 0), (fromRight ? length : index));
    }

    /**
     * wrapperValue 的基础实现，返回在未包装的 `value` 上执行一系列操作的结果，
     * 其中每个后续操作都使用前一个的返回值。
     *
     * @private
     * @param {*} value 未包装的值。
     * @param {Array} actions 用于解析未包装值的操作。
     * @returns {*} 返回解析后的值。
     */
    function baseWrapperValue(value, actions) {
      var result = value;
      if (result instanceof LazyWrapper) {
        result = result.value();
      }
      return arrayReduce(actions, function(result, action) {
        return action.func.apply(action.thisArg, arrayPush([result], action.args));
      }, result);
    }

    /**
     * _.xor 方法的基础实现，不支持迭代器简写，
     * 接受要检查的数组数组。
     *
     * @private
     * @param {Array} arrays 要检查的数组。
     * @param {Function} [iteratee] 每个元素调用的迭代器。
     * @param {Function} [comparator] 每个元素调用的比较器。
     * @returns {Array} 返回新值数组。
     */
    function baseXor(arrays, iteratee, comparator) {
      var length = arrays.length;
      if (length < 2) {
        return length ? baseUniq(arrays[0]) : [];
      }
      var index = -1,
          result = Array(length);

      while (++index < length) {
        var array = arrays[index],
            othIndex = -1;

        while (++othIndex < length) {
          if (othIndex != index) {
            result[index] = baseDifference(result[index] || array, arrays[othIndex], iteratee, comparator);
          }
        }
      }
      return baseUniq(baseFlatten(result, 1), iteratee, comparator);
    }

    /**
     * _.zipObject 的基础实现，使用 `assignFunc` 分配值。
     *
     * @private
     * @param {Array} props 属性标识符。
     * @param {Array} values 属性值。
     * @param {Function} assignFunc 用于分配值的函数。
     * @returns {Object} 返回新对象。
     */
    function baseZipObject(props, values, assignFunc) {
      var index = -1,
          length = props.length,
          valsLength = values.length,
          result = {};

      while (++index < length) {
        var value = index < valsLength ? values[index] : undefined;
        assignFunc(result, props[index], value);
      }
      return result;
    }

    /**
     * 如果 `value` 不是类数组对象，则将其转换为空数组。
     *
     * @private
     * @param {*} value 要检查的值。
     * @returns {Array|Object} 返回转换后的类数组对象。
     */
    function castArrayLikeObject(value) {
      return isArrayLikeObject(value) ? value : [];
    }

    /**
     * 如果 `value` 不是函数，则将其转换为 `identity`。
     *
     * @private
     * @param {*} value 要检查的值。
     * @returns {Function} 返回转换后的函数。
     */
    function castFunction(value) {
      return typeof value == 'function' ? value : identity;
    }

    /**
     * 如果 `value` 不是路径数组，则将其转换为路径数组。
     *
     * @private
     * @param {*} value 要检查的值。
     * @param {Object} [object] 要查询键的对象。
     * @returns {Array} 返回转换后的属性路径数组。
     */
    function castPath(value, object) {
      if (isArray(value)) {
        return value;
      }
      return isKey(value, object) ? [value] : stringToPath(toString(value));
    }

    /**
     * baseRest 的别名，可以被模块替换插件替换为 `identity`。
     *
     * @private
     * @type {Function}
     * @param {Function} func 要应用 rest 参数的函数。
     * @returns {Function} 返回新函数。
     */
    var castRest = baseRest;

    /**
     * 如果需要，将 `array` 转换为切片。
     *
     * @private
     * @param {Array} array 要检查的数组。
     * @param {number} start 起始位置。
     * @param {number} [end=array.length] 结束位置。
     * @returns {Array} 返回转换后的切片。
     */
    function castSlice(array, start, end) {
      var length = array.length;
      end = end === undefined ? length : end;
      return (!start && end >= length) ? array : baseSlice(array, start, end);
    }

    /**
     * 全局 [`clearTimeout`](https://mdn.io/clearTimeout) 的简单包装器。
     *
     * @private
     * @param {number|Object} id 要清除的定时器的定时器 id 或超时对象。
     */
    var clearTimeout = ctxClearTimeout || function(id) {
      return root.clearTimeout(id);
    };

    /**
     * 创建 `buffer` 的克隆。
     *
     * @private
     * @param {Buffer} buffer 要克隆的缓冲区。
     * @param {boolean} [isDeep] 指定深度克隆。
     * @returns {Buffer} 返回克隆的缓冲区。
     */
    function cloneBuffer(buffer, isDeep) {
      if (isDeep) {
        return buffer.slice();
      }
      var length = buffer.length,
          result = allocUnsafe ? allocUnsafe(length) : new buffer.constructor(length);

      buffer.copy(result);
      return result;
    }

    /**
     * Creates a clone of `arrayBuffer`.
     *
     * @private
     * @param {ArrayBuffer} arrayBuffer The array buffer to clone.
     * @returns {ArrayBuffer} 返回克隆的数组缓冲区。
     */
    function cloneArrayBuffer(arrayBuffer) {
      var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
      new Uint8Array(result).set(new Uint8Array(arrayBuffer));
      return result;
    }

    /**
     * 创建 `dataView` 的克隆。
     *
     * @private
     * @param {Object} dataView 要克隆的数据视图。
     * @param {boolean} [isDeep] 指定深度克隆。
     * @returns {Object} 返回克隆的数据视图。
     */
    function cloneDataView(dataView, isDeep) {
      var buffer = isDeep ? cloneArrayBuffer(dataView.buffer) : dataView.buffer;
      return new dataView.constructor(buffer, dataView.byteOffset, dataView.byteLength);
    }

    /**
     * 创建 `regexp` 的克隆。
     *
     * @private
     * @param {Object} regexp 要克隆的正则表达式。
     * @returns {Object} 返回克隆的正则表达式。
     */
    function cloneRegExp(regexp) {
      var result = new regexp.constructor(regexp.source, reFlags.exec(regexp));
      result.lastIndex = regexp.lastIndex;
      return result;
    }

    /**
     * 创建 `symbol` 对象的克隆。
     *
     * @private
     * @param {Object} symbol 要克隆的 symbol 对象。
     * @returns {Object} 返回克隆的 symbol 对象。
     */
    function cloneSymbol(symbol) {
      return symbolValueOf ? Object(symbolValueOf.call(symbol)) : {};
    }

    /**
     * 创建 `typedArray` 的克隆。
     *
     * @private
     * @param {Object} typedArray 要克隆的 TypedArray。
     * @param {boolean} [isDeep] 指定深度克隆。
     * @returns {Object} 返回克隆的 TypedArray。
     */
    function cloneTypedArray(typedArray, isDeep) {
      var buffer = isDeep ? cloneArrayBuffer(typedArray.buffer) : typedArray.buffer;
      return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
    }

    /**
     * 比较值以按升序排序。
     *
     * @private
     * @param {*} value 要比较的值。
     * @param {*} other 要比较的其他值。
     * @returns {number} 返回 `value` 的排序顺序指示符。
     */
    function compareAscending(value, other) {
      if (value !== other) {
        var valIsDefined = value !== undefined,
            valIsNull = value === null,
            valIsReflexive = value === value,
            valIsSymbol = isSymbol(value);

        var othIsDefined = other !== undefined,
            othIsNull = other === null,
            othIsReflexive = other === other,
            othIsSymbol = isSymbol(other);

        if ((!othIsNull && !othIsSymbol && !valIsSymbol && value > other) ||
            (valIsSymbol && othIsDefined && othIsReflexive && !othIsNull && !othIsSymbol) ||
            (valIsNull && othIsDefined && othIsReflexive) ||
            (!valIsDefined && othIsReflexive) ||
            !valIsReflexive) {
          return 1;
        }
        if ((!valIsNull && !valIsSymbol && !othIsSymbol && value < other) ||
            (othIsSymbol && valIsDefined && valIsReflexive && !valIsNull && !valIsSymbol) ||
            (othIsNull && valIsDefined && valIsReflexive) ||
            (!othIsDefined && valIsReflexive) ||
            !othIsReflexive) {
          return -1;
        }
      }
      return 0;
    }

    /**
     * Used by `_.orderBy` to compare multiple properties of a value to another
     * and stable sort them.
     *
      * 如果未指定 `orders`，所有值按升序排序。否则，
      * 指定 "desc" 为降序或 "asc" 为相应值的升序排序顺序。
      *
      * @private
      * @param {Object} object 要比较的对象。
      * @param {Object} other 要比较的其他对象。
      * @param {boolean[]|string[]} orders 每个属性要排序的顺序。
      * @returns {number} 返回 `object` 的排序顺序指示符。
      */
    function compareMultiple(object, other, orders) {
      var index = -1,
          objCriteria = object.criteria,
          othCriteria = other.criteria,
          length = objCriteria.length,
          ordersLength = orders.length;

      while (++index < length) {
        var result = compareAscending(objCriteria[index], othCriteria[index]);
        if (result) {
          if (index >= ordersLength) {
            return result;
          }
          var order = orders[index];
          return result * (order == 'desc' ? -1 : 1);
        }
      }
      // Fixes an `Array#sort` bug in the JS engine embedded in Adobe applications
      // that causes it, under certain circumstances, to provide the same value for
      // `object` and `other`. See https://github.com/jashkenas/underscore/pull/1247
      // for more details.
      //
      // This also ensures a stable sort in V8 and other engines.
      // See https://bugs.chromium.org/p/v8/issues/detail?id=90 for more details.
      return object.index - other.index;
    }

    /**
     * 创建由部分应用的参数、占位符和提供的参数组成的数组，
     * 作为单个参数数组。
     *
     * @private
     * @param {Array} args 提供的参数。
     * @param {Array} partials 要预先添加到提供的参数前面的参数。
     * @param {Array} holders `partials` 占位符索引。
     * @params {boolean} [isCurried] 指定为柯里化函数组合。
     * @returns {Array} 返回组合参数的新数组。
     */
    function composeArgs(args, partials, holders, isCurried) {
      var argsIndex = -1,
          argsLength = args.length,
          holdersLength = holders.length,
          leftIndex = -1,
          leftLength = partials.length,
          rangeLength = nativeMax(argsLength - holdersLength, 0),
          result = Array(leftLength + rangeLength),
          isUncurried = !isCurried;

      while (++leftIndex < leftLength) {
        result[leftIndex] = partials[leftIndex];
      }
      while (++argsIndex < holdersLength) {
        if (isUncurried || argsIndex < argsLength) {
          result[holders[argsIndex]] = args[argsIndex];
        }
      }
      while (rangeLength--) {
        result[leftIndex++] = args[argsIndex++];
      }
      return result;
    }

    /**
     * 此函数类似于 `composeArgs`，但参数组合是为 `_.partialRight` 量身定制的。
     *
     * @private
     * @param {Array} args 提供的参数。
     * @param {Array} partials 要追加到提供的参数后面的参数。
     * @param {Array} holders `partials` 占位符索引。
     * @params {boolean} [isCurried] 指定为柯里化函数组合。
     * @returns {Array} 返回组合参数的新数组。
     */
    function composeArgsRight(args, partials, holders, isCurried) {
      var argsIndex = -1,
          argsLength = args.length,
          holdersIndex = -1,
          holdersLength = holders.length,
          rightIndex = -1,
          rightLength = partials.length,
          rangeLength = nativeMax(argsLength - holdersLength, 0),
          result = Array(rangeLength + rightLength),
          isUncurried = !isCurried;

      while (++argsIndex < rangeLength) {
        result[argsIndex] = args[argsIndex];
      }
      var offset = argsIndex;
      while (++rightIndex < rightLength) {
        result[offset + rightIndex] = partials[rightIndex];
      }
      while (++holdersIndex < holdersLength) {
        if (isUncurried || argsIndex < argsLength) {
          result[offset + holders[holdersIndex]] = args[argsIndex++];
        }
      }
      return result;
    }

    /**
     * 将 `source` 的值复制到 `array`。
     *
     * @private
     * @param {Array} source 要复制值的数组。
     * @param {Array} [array=[]] 要复制值到的数组。
     * @returns {Array} 返回 `array`。
     */
    function copyArray(source, array) {
      var index = -1,
          length = source.length;

      array || (array = Array(length));
      while (++index < length) {
        array[index] = source[index];
      }
      return array;
    }

    /**
     * 将 `source` 的属性复制到 `object`。
     *
     * @private
     * @param {Object} source 要复制属性的源对象。
     * @param {Array} props 要复制的属性标识符。
     * @param {Object} [object={}] 要复制属性到的目标对象。
     * @param {Function} [customizer] 用于自定义复制值的函数。
     * @returns {Object} 返回 `object`。
     */
    function copyObject(source, props, object, customizer) {
      var isNew = !object;
      object || (object = {});

      var index = -1,
          length = props.length;

      while (++index < length) {
        var key = props[index];

        var newValue = customizer
          ? customizer(object[key], source[key], key, object, source)
          : undefined;

        if (newValue === undefined) {
          newValue = source[key];
        }
        if (isNew) {
          baseAssignValue(object, key, newValue);
        } else {
          assignValue(object, key, newValue);
        }
      }
      return object;
    }

    /**
     * 将 `source` 的自有符号复制到 `object`。
     *
     * @private
     * @param {Object} source 要复制符号的源对象。
     * @param {Object} [object={}] 要复制符号到的目标对象。
     * @returns {Object} 返回 `object`。
     */
    function copySymbols(source, object) {
      return copyObject(source, getSymbols(source), object);
    }

    /**
     * 将 `source` 的自有和继承符号复制到 `object`。
     *
     * @private
     * @param {Object} source 要复制符号的源对象。
     * @param {Object} [object={}] 要复制符号到的目标对象。
     * @returns {Object} 返回 `object`。
     */
    function copySymbolsIn(source, object) {
      return copyObject(source, getSymbolsIn(source), object);
    }

    /**
     * 创建一个类似 `_.groupBy` 的函数。
     *
     * @private
     * @param {Function} setter 用于设置累加器值的函数。
     * @param {Function} [initializer] 累加器对象初始化函数。
     * @returns {Function} 返回新的聚合器函数。
     */
    function createAggregator(setter, initializer) {
      return function(collection, iteratee) {
        var func = isArray(collection) ? arrayAggregator : baseAggregator,
            accumulator = initializer ? initializer() : {};

        return func(collection, setter, getIteratee(iteratee, 2), accumulator);
      };
    }

    /**
     * 创建一个类似 `_.assign` 的函数。
     *
     * @private
     * @param {Function} assigner 用于分配值的函数。
     * @returns {Function} 返回新的分配器函数。
     */
    function createAssigner(assigner) {
      return baseRest(function(object, sources) {
        var index = -1,
            length = sources.length,
            customizer = length > 1 ? sources[length - 1] : undefined,
            guard = length > 2 ? sources[2] : undefined;

        customizer = (assigner.length > 3 && typeof customizer == 'function')
          ? (length--, customizer)
          : undefined;

        if (guard && isIterateeCall(sources[0], sources[1], guard)) {
          customizer = length < 3 ? undefined : customizer;
          length = 1;
        }
        object = Object(object);
        while (++index < length) {
          var source = sources[index];
          if (source) {
            assigner(object, source, index, customizer);
          }
        }
        return object;
      });
    }

    /**
     * 创建 `baseEach` 或 `baseEachRight` 函数。
     *
     * @private
     * @param {Function} eachFunc 用于遍历集合的函数。
     * @param {boolean} [fromRight] 指定从右到左迭代。
     * @returns {Function} 返回新的基础函数。
     */
    function createBaseEach(eachFunc, fromRight) {
      return function(collection, iteratee) {
        if (collection == null) {
          return collection;
        }
        if (!isArrayLike(collection)) {
          return eachFunc(collection, iteratee);
        }
        var length = collection.length,
            index = fromRight ? length : -1,
            iterable = Object(collection);

        while ((fromRight ? index-- : ++index < length)) {
          if (iteratee(iterable[index], index, iterable) === false) {
            break;
          }
        }
        return collection;
      };
    }

    /**
     * 为 `_.forIn` 和 `_.forOwn` 方法创建基础函数。
     *
     * @private
     * @param {boolean} [fromRight] 指定从右到左迭代。
     * @returns {Function} 返回新的基础函数。
     *
     * createBaseFor 实现原理：
     *
     * 工厂模式：
     * - 创建一个工厂函数，根据 fromRight 参数生成不同方向的遍历函数
     * - fromRight = false：创建 baseFor（从左到右遍历）
     * - fromRight = true：创建 baseForRight（从右到左遍历）
     *
     * 核心算法：
     * 1. 获取属性列表：keysFunc(object) 返回要遍历的属性数组
     *    - keys()：自有可枚举属性
     *    - keysIn()：自有 + 继承属性
     *
     * 2. while 循环 + 长度递减：
     *    - 比 for 循环性能更好
     *    - 通过 length-- 控制迭代次数
     *
     * 3. 方向控制：
     *    - 从左到右：++index（先增后用）
     *    - 从右到左：length--（从末尾开始）
     *
     * 4. early exit：
     *    - 如果 iteratee 返回 false，立即终止遍历
     *
     * 性能优化：
     * - while 循环比 for 循环更快
     * - 预获取 props.length 避免重复计算
     *
     * 示例：
     * var forIn = createBaseFor(false);
     * forIn({a: 1, b: 2}, (v, k) => console.log(k), keys); // a, b
     *
     * var forInRight = createBaseFor(true);
     * forInRight({a: 1, b: 2}, (v, k) => console.log(k), keys); // b, a
     */
    function createBaseFor(fromRight) {
      return function(object, iteratee, keysFunc) {
        var index = -1,
            iterable = Object(object),
            props = keysFunc(object),
            length = props.length;

        while (length--) {
          var key = props[fromRight ? length : ++index];
          if (iteratee(iterable[key], key, iterable) === false) {
            break;
          }
        }
        return object;
      };
    }

    /**
     * 创建一个包装 `func` 的函数，使用 `thisArg` 的可选 `this` 绑定调用它。
     *
     * @private
     * @param {Function} func 要包装的函数。
     * @param {number} bitmask 位掩码标志。详见 `createWrap`。
     * @param {*} [thisArg] `func` 的 `this` 绑定。
     * @returns {Function} 返回包装后的新函数。
     */
    function createBind(func, bitmask, thisArg) {
      var isBind = bitmask & WRAP_BIND_FLAG,
          Ctor = createCtor(func);

      function wrapper() {
        var fn = (this && this !== root && this instanceof wrapper) ? Ctor : func;
        return fn.apply(isBind ? thisArg : this, arguments);
      }
      return wrapper;
    }

    /**
     * 创建一个类似 `_.lowerFirst` 的函数。
     *
     * @private
     * @param {string} methodName 要使用的 `String` 大小写方法的名称。
     * @returns {Function} 返回新的大小写函数。
     */
    function createCaseFirst(methodName) {
      return function(string) {
        string = toString(string);

        var strSymbols = hasUnicode(string)
          ? stringToArray(string)
          : undefined;

        var chr = strSymbols
          ? strSymbols[0]
          : string.charAt(0);

        var trailing = strSymbols
          ? castSlice(strSymbols, 1).join('')
          : string.slice(1);

        return chr[methodName]() + trailing;
      };
    }

    /**
     * 创建一个类似 `_.camelCase` 的函数。
     *
     * @private
     * @param {Function} callback 用于组合每个单词的函数。
     * @returns {Function} 返回新的组合函数。
     */
    function createCompounder(callback) {
      return function(string) {
        return arrayReduce(words(deburr(string).replace(reApos, '')), callback, '');
      };
    }

    /**
     * 创建一个无论是否作为 `new` 表达式还是通过 `call` 或 `apply` 调用，
     * 都产生 `Ctor` 实例的函数。
     *
     * @private
     * @param {Function} Ctor 要包装的构造函数。
     * @returns {Function} 返回包装后的新函数。
     */
    function createCtor(Ctor) {
      return function() {
        // Use a `switch` statement to work with class constructors. See
        // http://ecma-international.org/ecma-262/7.0/#sec-ecmascript-function-objects-call-thisargument-argumentslist
        // for more details.
        var args = arguments;
        switch (args.length) {
          case 0: return new Ctor;
          case 1: return new Ctor(args[0]);
          case 2: return new Ctor(args[0], args[1]);
          case 3: return new Ctor(args[0], args[1], args[2]);
          case 4: return new Ctor(args[0], args[1], args[2], args[3]);
          case 5: return new Ctor(args[0], args[1], args[2], args[3], args[4]);
          case 6: return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5]);
          case 7: return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
        }
        var thisBinding = baseCreate(Ctor.prototype),
            result = Ctor.apply(thisBinding, args);

        // Mimic the constructor's `return` behavior.
        // See https://es5.github.io/#x13.2.2 for more details.
        return isObject(result) ? result : thisBinding;
      };
    }

    /**
     * 创建一个包装 `func` 以启用柯里化的函数。
     *
     * @private
     * @param {Function} func 要包装的函数。
     * @param {number} bitmask 位掩码标志。详见 `createWrap`。
     * @param {number} arity `func` 的参数数量。
     * @returns {Function} 返回包装后的新函数。
     */
    function createCurry(func, bitmask, arity) {
      var Ctor = createCtor(func);

      function wrapper() {
        var length = arguments.length,
            args = Array(length),
            index = length,
            placeholder = getHolder(wrapper);

        while (index--) {
          args[index] = arguments[index];
        }
        var holders = (length < 3 && args[0] !== placeholder && args[length - 1] !== placeholder)
          ? []
          : replaceHolders(args, placeholder);

        length -= holders.length;
        if (length < arity) {
          return createRecurry(
            func, bitmask, createHybrid, wrapper.placeholder, undefined,
            args, holders, undefined, undefined, arity - length);
        }
        var fn = (this && this !== root && this instanceof wrapper) ? Ctor : func;
        return apply(fn, this, args);
      }
      return wrapper;
    }

    /**
     * Creates a `_.find` or `_.findLast` function.
     *
     * @private
     * @param {Function} findIndexFunc The function to find the collection index.
     * @returns {Function} Returns the new find function.
     */
    function createFind(findIndexFunc) {
      return function(collection, predicate, fromIndex) {
        var iterable = Object(collection);
        if (!isArrayLike(collection)) {
          var iteratee = getIteratee(predicate, 3);
          collection = keys(collection);
          predicate = function(key) { return iteratee(iterable[key], key, iterable); };
        }
        var index = findIndexFunc(collection, predicate, fromIndex);
        return index > -1 ? iterable[iteratee ? collection[index] : index] : undefined;
      };
    }

    /**
     * Creates a `_.flow` or `_.flowRight` function.
     *
     * @private
     * @param {boolean} [fromRight] Specify iterating from right to left.
     * @returns {Function} Returns the new flow function.
     */
    function createFlow(fromRight) {
      return flatRest(function(funcs) {
        var length = funcs.length,
            index = length,
            prereq = LodashWrapper.prototype.thru;

        if (fromRight) {
          funcs.reverse();
        }
        while (index--) {
          var func = funcs[index];
          if (typeof func != 'function') {
            throw new TypeError(FUNC_ERROR_TEXT);
          }
          if (prereq && !wrapper && getFuncName(func) == 'wrapper') {
            var wrapper = new LodashWrapper([], true);
          }
        }
        index = wrapper ? index : length;
        while (++index < length) {
          func = funcs[index];

          var funcName = getFuncName(func),
              data = funcName == 'wrapper' ? getData(func) : undefined;

          if (data && isLaziable(data[0]) &&
                data[1] == (WRAP_ARY_FLAG | WRAP_CURRY_FLAG | WRAP_PARTIAL_FLAG | WRAP_REARG_FLAG) &&
                !data[4].length && data[9] == 1
              ) {
            wrapper = wrapper[getFuncName(data[0])].apply(wrapper, data[3]);
          } else {
            wrapper = (func.length == 1 && isLaziable(func))
              ? wrapper[funcName]()
              : wrapper.thru(func);
          }
        }
        return function() {
          var args = arguments,
              value = args[0];

          if (wrapper && args.length == 1 && isArray(value)) {
            return wrapper.plant(value).value();
          }
          var index = 0,
              result = length ? funcs[index].apply(this, args) : value;

          while (++index < length) {
            result = funcs[index].call(this, result);
          }
          return result;
        };
      });
    }

    /**
     * 创建一个包装函数，用于调用 `func`，可选绑定 `thisArg`、
     * 应用部分参数和进行柯里化。
     *
     * @private
     * @param {Function|string} func 要包装的函数或方法名。
     * @param {number} bitmask 位掩码标志。详见 `createWrap`。
     * @param {*} [thisArg] `func` 的 `this` 绑定。
     * @param {Array} [partials] 要预置到新函数参数前的参数。
     * @param {Array} [holders] `partials` 的占位符索引。
     * @param {Array} [partialsRight] 要追加到新函数参数后的参数。
     * @param {Array} [holdersRight] `partialsRight` 的占位符索引。
     * @param {Array} [argPos] 新函数的参数位置。
     * @param {number} [ary] `func` 的参数数量上限。
     * @param {number} [arity] `func` 的参数数量。
     * @returns {Function} 返回新的包装函数。
     */
    function createHybrid(func, bitmask, thisArg, partials, holders, partialsRight, holdersRight, argPos, ary, arity) {
      var isAry = bitmask & WRAP_ARY_FLAG,
          isBind = bitmask & WRAP_BIND_FLAG,
          isBindKey = bitmask & WRAP_BIND_KEY_FLAG,
          isCurried = bitmask & (WRAP_CURRY_FLAG | WRAP_CURRY_RIGHT_FLAG),
          isFlip = bitmask & WRAP_FLIP_FLAG,
          Ctor = isBindKey ? undefined : createCtor(func);

      function wrapper() {
        var length = arguments.length,
            args = Array(length),
            index = length;

        while (index--) {
          args[index] = arguments[index];
        }
        if (isCurried) {
          var placeholder = getHolder(wrapper),
              holdersCount = countHolders(args, placeholder);
        }
        if (partials) {
          args = composeArgs(args, partials, holders, isCurried);
        }
        if (partialsRight) {
          args = composeArgsRight(args, partialsRight, holdersRight, isCurried);
        }
        length -= holdersCount;
        if (isCurried && length < arity) {
          var newHolders = replaceHolders(args, placeholder);
          return createRecurry(
            func, bitmask, createHybrid, wrapper.placeholder, thisArg,
            args, newHolders, argPos, ary, arity - length
          );
        }
        var thisBinding = isBind ? thisArg : this,
            fn = isBindKey ? thisBinding[func] : func;

        length = args.length;
        if (argPos) {
          args = reorder(args, argPos);
        } else if (isFlip && length > 1) {
          args.reverse();
        }
        if (isAry && ary < length) {
          args.length = ary;
        }
        if (this && this !== root && this instanceof wrapper) {
          fn = Ctor || createCtor(fn);
        }
        return fn.apply(thisBinding, args);
      }
      return wrapper;
    }

    /**
     * 创建一个类似于 `_.invertBy` 的函数。
     *
     * @private
     * @param {Function} setter 用于设置累加器值的函数。
     * @param {Function} toIteratee 用于解析迭代器的函数。
     * @returns {Function} 返回新的反转函数。
     */
    function createInverter(setter, toIteratee) {
      return function(object, iteratee) {
        return baseInverter(object, setter, toIteratee(iteratee), {});
      };
    }

    /**
     * 创建一个对两个值执行数学运算的函数。
     *
     * @private
     * @param {Function} operator 用于执行运算的函数。
     * @param {number} [defaultValue] 用于 `undefined` 参数的值。
     * @returns {Function} 返回新的数学运算函数。
     */
    function createMathOperation(operator, defaultValue) {
      return function(value, other) {
        var result;
        if (value === undefined && other === undefined) {
          return defaultValue;
        }
        if (value !== undefined) {
          result = value;
        }
        if (other !== undefined) {
          if (result === undefined) {
            return other;
          }
          if (typeof value == 'string' || typeof other == 'string') {
            value = baseToString(value);
            other = baseToString(other);
          } else {
            value = baseToNumber(value);
            other = baseToNumber(other);
          }
          result = operator(value, other);
        }
        return result;
      };
    }

    /**
     * 创建一个类似于 `_.over` 的函数。
     *
     * @private
     * @param {Function} arrayFunc 迭代迭代器的函数。
     * @returns {Function} 返回新的 over 函数。
     */
    function createOver(arrayFunc) {
      return flatRest(function(iteratees) {
        iteratees = arrayMap(iteratees, baseUnary(getIteratee()));
        return baseRest(function(args) {
          var thisArg = this;
          return arrayFunc(iteratees, function(iteratee) {
            return apply(iteratee, thisArg, args);
          });
        });
      });
    }

    /**
     * 根据 `length` 为 `string` 创建填充。如果字符数超过 `length`，
     * 则截断 `chars` 字符串。
     *
     * @private
     * @param {number} length 填充长度。
     * @param {string} [chars=' '] 用作填充的字符串。
     * @returns {string} 返回 `string` 的填充。
     */
    function createPadding(length, chars) {
      chars = chars === undefined ? ' ' : baseToString(chars);

      var charsLength = chars.length;
      if (charsLength < 2) {
        return charsLength ? baseRepeat(chars, length) : chars;
      }
      var result = baseRepeat(chars, nativeCeil(length / stringSize(chars)));
      return hasUnicode(chars)
        ? castSlice(stringToArray(result), 0, length).join('')
        : result.slice(0, length);
    }

    /**
     * 创建一个包装函数，用 `thisArg` 的 `this` 绑定和预置到其接收参数前的
     * `partials` 来调用 `func`。
     *
     * @private
     * @param {Function} func 要包装的函数。
     * @param {number} bitmask 位掩码标志。详见 `createWrap`。
     * @param {*} thisArg `func` 的 `this` 绑定。
     * @param {Array} partials 要预置到新函数参数前的参数。
     * @returns {Function} 返回新的包装函数。
     */
    function createPartial(func, bitmask, thisArg, partials) {
      var isBind = bitmask & WRAP_BIND_FLAG,
          Ctor = createCtor(func);

      function wrapper() {
        var argsIndex = -1,
            argsLength = arguments.length,
            leftIndex = -1,
            leftLength = partials.length,
            args = Array(leftLength + argsLength),
            fn = (this && this !== root && this instanceof wrapper) ? Ctor : func;

        while (++leftIndex < leftLength) {
          args[leftIndex] = partials[leftIndex];
        }
        while (argsLength--) {
          args[leftIndex++] = arguments[++argsIndex];
        }
        return apply(fn, isBind ? thisArg : this, args);
      }
      return wrapper;
    }

    /**
     * 创建一个 `_.range` 或 `_.rangeRight` 函数。
     *
     * @private
     * @param {boolean} [fromRight] 指定从右到左迭代。
     * @returns {Function} 返回新的 range 函数。
     */
    function createRange(fromRight) {
      return function(start, end, step) {
        if (step && typeof step != 'number' && isIterateeCall(start, end, step)) {
          end = step = undefined;
        }
        // Ensure the sign of `-0` is preserved.
        start = toFinite(start);
        if (end === undefined) {
          end = start;
          start = 0;
        } else {
          end = toFinite(end);
        }
        step = step === undefined ? (start < end ? 1 : -1) : toFinite(step);
        return baseRange(start, end, step, fromRight);
      };
    }

    /**
     * 创建一个对两个值执行关系运算的函数。
     *
     * @private
     * @param {Function} operator 用于执行运算的函数。
     * @returns {Function} 返回新的关系运算函数。
     */
    function createRelationalOperation(operator) {
      return function(value, other) {
        if (!(typeof value == 'string' && typeof other == 'string')) {
          value = toNumber(value);
          other = toNumber(other);
        }
        return operator(value, other);
      };
    }

    /**
     * 创建一个继续柯里化 `func` 的包装函数。
     *
     * @private
     * @param {Function} func 要包装的函数。
     * @param {number} bitmask 位掩码标志。详见 `createWrap`。
     * @param {Function} wrapFunc 用于创建 `func` 包装器的函数。
     * @param {*} placeholder 占位符值。
     * @param {*} [thisArg] `func` 的 `this` 绑定。
     * @param {Array} [partials] 要预置到新函数参数前的参数。
     * @param {Array} [holders] `partials` 的占位符索引。
     * @param {Array} [argPos] 新函数的参数位置。
     * @param {number} [ary] `func` 的参数数量上限。
     * @param {number} [arity] `func` 的参数数量。
     * @returns {Function} 返回新的包装函数。
     */
    function createRecurry(func, bitmask, wrapFunc, placeholder, thisArg, partials, holders, argPos, ary, arity) {
      var isCurry = bitmask & WRAP_CURRY_FLAG,
          newHolders = isCurry ? holders : undefined,
          newHoldersRight = isCurry ? undefined : holders,
          newPartials = isCurry ? partials : undefined,
          newPartialsRight = isCurry ? undefined : partials;

      bitmask |= (isCurry ? WRAP_PARTIAL_FLAG : WRAP_PARTIAL_RIGHT_FLAG);
      bitmask &= ~(isCurry ? WRAP_PARTIAL_RIGHT_FLAG : WRAP_PARTIAL_FLAG);

      if (!(bitmask & WRAP_CURRY_BOUND_FLAG)) {
        bitmask &= ~(WRAP_BIND_FLAG | WRAP_BIND_KEY_FLAG);
      }
      var newData = [
        func, bitmask, thisArg, newPartials, newHolders, newPartialsRight,
        newHoldersRight, argPos, ary, arity
      ];

      var result = wrapFunc.apply(undefined, newData);
      if (isLaziable(func)) {
        setData(result, newData);
      }
      result.placeholder = placeholder;
      return setWrapToString(result, func, bitmask);
    }

    /**
     * 创建一个类似于 `_.round` 的函数。
     *
     * @private
     * @param {string} methodName 四舍五入时使用的 `Math` 方法名。
     * @returns {Function} 返回新的 round 函数。
     */
    function createRound(methodName) {
      var func = Math[methodName];
      return function(number, precision) {
        number = toNumber(number);
        precision = precision == null ? 0 : nativeMin(toInteger(precision), 292);
        if (precision && nativeIsFinite(number)) {
          // Shift with exponential notation to avoid floating-point issues.
          // See [MDN](https://mdn.io/round#Examples) for more details.
          var pair = (toString(number) + 'e').split('e'),
              value = func(pair[0] + 'e' + (+pair[1] + precision));

          pair = (toString(value) + 'e').split('e');
          return +(pair[0] + 'e' + (+pair[1] - precision));
        }
        return func(number);
      };
    }

    /**
     * 创建一个包含 `values` 的 set 对象。
     *
     * @private
     * @param {Array} values 要添加到 set 的值。
     * @returns {Object} 返回新的 set。
     */
    var createSet = !(Set && (1 / setToArray(new Set([,-0]))[1]) == INFINITY) ? noop : function(values) {
      return new Set(values);
    };

    /**
     * 创建一个 `_.toPairs` 或 `_.toPairsIn` 函数。
     *
     * @private
     * @param {Function} keysFunc 获取给定对象键的函数。
     * @returns {Function} 返回新的 pairs 函数。
     */
    function createToPairs(keysFunc) {
      return function(object) {
        var tag = getTag(object);
        if (tag == mapTag) {
          return mapToArray(object);
        }
        if (tag == setTag) {
          return setToPairs(object);
        }
        return baseToPairs(object, keysFunc(object));
      };
    }

    /**
     * 创建一个要么柯里化要么调用 `func` 的函数，可选绑定 `this` 和应用部分参数。
     *
     * @private
     * @param {Function|string} func 要包装的函数或方法名。
     * @param {number} bitmask 位掩码标志。
     *    1 - `_.bind`
     *    2 - `_.bindKey`
     *    4 - `_.curry` 或绑定函数的 `_.curryRight`
     *    8 - `_.curry`
     *   16 - `_.curryRight`
     *   32 - `_.partial`
     *   64 - `_.partialRight`
     *  128 - `_.rearg`
     *  256 - `_.ary`
     *  512 - `_.flip`
     * @param {*} [thisArg] `func` 的 `this` 绑定。
     * @param {Array} [partials] 要部分应用的参数。
     * @param {Array} [holders] `partials` 的占位符索引。
     * @param {Array} [argPos] 新函数的参数位置。
     * @param {number} [ary] `func` 的参数数量上限。
     * @param {number} [arity] `func` 的参数数量。
     * @returns {Function} 返回新的包装函数。
     */
    function createWrap(func, bitmask, thisArg, partials, holders, argPos, ary, arity) {
      var isBindKey = bitmask & WRAP_BIND_KEY_FLAG;
      if (!isBindKey && typeof func != 'function') {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      var length = partials ? partials.length : 0;
      if (!length) {
        bitmask &= ~(WRAP_PARTIAL_FLAG | WRAP_PARTIAL_RIGHT_FLAG);
        partials = holders = undefined;
      }
      ary = ary === undefined ? ary : nativeMax(toInteger(ary), 0);
      arity = arity === undefined ? arity : toInteger(arity);
      length -= holders ? holders.length : 0;

      if (bitmask & WRAP_PARTIAL_RIGHT_FLAG) {
        var partialsRight = partials,
            holdersRight = holders;

        partials = holders = undefined;
      }
      var data = isBindKey ? undefined : getData(func);

      var newData = [
        func, bitmask, thisArg, partials, holders, partialsRight, holdersRight,
        argPos, ary, arity
      ];

      if (data) {
        mergeData(newData, data);
      }
      func = newData[0];
      bitmask = newData[1];
      thisArg = newData[2];
      partials = newData[3];
      holders = newData[4];
      arity = newData[9] = newData[9] === undefined
        ? (isBindKey ? 0 : func.length)
        : nativeMax(newData[9] - length, 0);

      if (!arity && bitmask & (WRAP_CURRY_FLAG | WRAP_CURRY_RIGHT_FLAG)) {
        bitmask &= ~(WRAP_CURRY_FLAG | WRAP_CURRY_RIGHT_FLAG);
      }
      if (!bitmask || bitmask == WRAP_BIND_FLAG) {
        var result = createBind(func, bitmask, thisArg);
      } else if (bitmask == WRAP_CURRY_FLAG || bitmask == WRAP_CURRY_RIGHT_FLAG) {
        result = createCurry(func, bitmask, arity);
      } else if ((bitmask == WRAP_PARTIAL_FLAG || bitmask == (WRAP_BIND_FLAG | WRAP_PARTIAL_FLAG)) && !holders.length) {
        result = createPartial(func, bitmask, thisArg, partials);
      } else {
        result = createHybrid.apply(undefined, newData);
      }
      var setter = data ? baseSetData : setData;
      return setWrapToString(setter(result, newData), func, bitmask);
    }

    /**
     * `_.defaults` 使用此函数自定义其 `_.assignIn` 的用法，将源对象的属性分配到
     * 目标对象上，对于所有解析为 `undefined` 的目标属性生效。
     *
     * @private
     * @param {*} objValue 目标值。
     * @param {*} srcValue 源值。
     * @param {string} key 要分配的属性的键。
     * @param {Object} object `objValue` 的父对象。
     * @returns {*} 返回要分配的值。
     */
    function customDefaultsAssignIn(objValue, srcValue, key, object) {
      if (objValue === undefined ||
          (eq(objValue, objectProto[key]) && !hasOwnProperty.call(object, key))) {
        return srcValue;
      }
      return objValue;
    }

    /**
     * `_.defaultsDeep` 使用此函数自定义其 `_.merge` 的用法，将源对象合并到
     * 通过的目标对象中。
     *
     * @private
     * @param {*} objValue 目标值。
     * @param {*} srcValue 源值。
     * @param {string} key 要合并的属性的键。
     * @param {Object} object `objValue` 的父对象。
     * @param {Object} source `srcValue` 的父对象。
     * @param {Object} [stack] 跟踪遍历的源值及其合并对应物。
     * @returns {*} 返回要分配的值。
     */
    function customDefaultsMerge(objValue, srcValue, key, object, source, stack) {
      if (isObject(objValue) && isObject(srcValue)) {
        // Recursively merge objects and arrays (susceptible to call stack limits).
        stack.set(srcValue, objValue);
        baseMerge(objValue, srcValue, undefined, customDefaultsMerge, stack);
        stack['delete'](srcValue);
      }
      return objValue;
    }

    /**
     * `_.omit` 使用此函数自定义其 `_.cloneDeep` 的用法，仅克隆普通对象。
     *
     * @private
     * @param {*} value 要检查的值。
     * @param {string} key 要检查的属性的键。
     * @returns {*} 返回未克隆的值或 `undefined` 以将克隆推迟到 `_.cloneDeep`。
     */
    function customOmitClone(value) {
      return isPlainObject(value) ? undefined : value;
    }

    /**
     * `baseIsEqualDeep` 的专用版本，用于数组比较，支持部分深度比较。
     *
     * @private
     * @param {Array} array 要比较的数组。
     * @param {Array} other 要比较的另一个数组。
     * @param {number} bitmask 位掩码标志。详见 `baseIsEqual`。
     * @param {Function} customizer 用于自定义比较的函数。
     * @param {Function} equalFunc 用于确定值等价的函数。
     * @param {Object} stack 跟踪遍历的 `array` 和 `other` 对象。
     * @returns {boolean} 如果数组等价则返回 `true`，否则返回 `false`。
     */
    function equalArrays(array, other, bitmask, customizer, equalFunc, stack) {
      var isPartial = bitmask & COMPARE_PARTIAL_FLAG,
          arrLength = array.length,
          othLength = other.length;

      if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
        return false;
      }
      // Check that cyclic values are equal.
      var arrStacked = stack.get(array);
      var othStacked = stack.get(other);
      if (arrStacked && othStacked) {
        return arrStacked == other && othStacked == array;
      }
      var index = -1,
          result = true,
          seen = (bitmask & COMPARE_UNORDERED_FLAG) ? new SetCache : undefined;

      stack.set(array, other);
      stack.set(other, array);

      // Ignore non-index properties.
      while (++index < arrLength) {
        var arrValue = array[index],
            othValue = other[index];

        if (customizer) {
          var compared = isPartial
            ? customizer(othValue, arrValue, index, other, array, stack)
            : customizer(arrValue, othValue, index, array, other, stack);
        }
        if (compared !== undefined) {
          if (compared) {
            continue;
          }
          result = false;
          break;
        }
        // Recursively compare arrays (susceptible to call stack limits).
        if (seen) {
          if (!arraySome(other, function(othValue, othIndex) {
                if (!cacheHas(seen, othIndex) &&
                    (arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
                  return seen.push(othIndex);
                }
              })) {
            result = false;
            break;
          }
        } else if (!(
              arrValue === othValue ||
                equalFunc(arrValue, othValue, bitmask, customizer, stack)
            )) {
          result = false;
          break;
        }
      }
      stack['delete'](array);
      stack['delete'](other);
      return result;
    }

    /**
     * `baseIsEqualDeep` 的专用版本，用于比较具有相同 `toStringTag` 的对象。
     *
     * **注意：** 此函数仅支持比较具有 `Boolean`、`Date`、`Error`、`Number`、
     * `RegExp` 或 `String` 标签的值。
     *
     * @private
     * @param {Object} object 要比较的对象。
     * @param {Object} other 要比较的另一个对象。
     * @param {string} tag 要比较的对象的 `toStringTag`。
     * @param {number} bitmask 位掩码标志。详见 `baseIsEqual`。
     * @param {Function} customizer 用于自定义比较的函数。
     * @param {Function} equalFunc 用于确定值等价的函数。
     * @param {Object} stack 跟踪遍历的 `object` 和 `other` 对象。
     * @returns {boolean} 如果对象等价则返回 `true`，否则返回 `false`。
     */
    function equalByTag(object, other, tag, bitmask, customizer, equalFunc, stack) {
      switch (tag) {
        case dataViewTag:
          if ((object.byteLength != other.byteLength) ||
              (object.byteOffset != other.byteOffset)) {
            return false;
          }
          object = object.buffer;
          other = other.buffer;

        case arrayBufferTag:
          if ((object.byteLength != other.byteLength) ||
              !equalFunc(new Uint8Array(object), new Uint8Array(other))) {
            return false;
          }
          return true;

        case boolTag:
        case dateTag:
        case numberTag:
          // Coerce booleans to `1` or `0` and dates to milliseconds.
          // Invalid dates are coerced to `NaN`.
          return eq(+object, +other);

        case errorTag:
          return object.name == other.name && object.message == other.message;

        case regexpTag:
        case stringTag:
          // Coerce regexes to strings and treat strings, primitives and objects,
          // as equal. See http://www.ecma-international.org/ecma-262/7.0/#sec-regexp.prototype.tostring
          // for more details.
          return object == (other + '');

        case mapTag:
          var convert = mapToArray;

        case setTag:
          var isPartial = bitmask & COMPARE_PARTIAL_FLAG;
          convert || (convert = setToArray);

          if (object.size != other.size && !isPartial) {
            return false;
          }
          // Assume cyclic values are equal.
          var stacked = stack.get(object);
          if (stacked) {
            return stacked == other;
          }
          bitmask |= COMPARE_UNORDERED_FLAG;

          // Recursively compare objects (susceptible to call stack limits).
          stack.set(object, other);
          var result = equalArrays(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
          stack['delete'](object);
          return result;

        case symbolTag:
          if (symbolValueOf) {
            return symbolValueOf.call(object) == symbolValueOf.call(other);
          }
      }
      return false;
    }

    /**
     * `baseIsEqualDeep` 的专用版本，用于对象比较，支持部分深度比较。
     *
     * @private
     * @param {Object} object 要比较的对象。
     * @param {Object} other 要比较的另一个对象。
     * @param {number} bitmask 位掩码标志。详见 `baseIsEqual`。
     * @param {Function} customizer 用于自定义比较的函数。
     * @param {Function} equalFunc 用于确定值等价的函数。
     * @param {Object} stack 跟踪遍历的 `object` 和 `other` 对象。
     * @returns {boolean} 如果对象等价则返回 `true`，否则返回 `false`。
     */
    function equalObjects(object, other, bitmask, customizer, equalFunc, stack) {
      var isPartial = bitmask & COMPARE_PARTIAL_FLAG,
          objProps = getAllKeys(object),
          objLength = objProps.length,
          othProps = getAllKeys(other),
          othLength = othProps.length;

      if (objLength != othLength && !isPartial) {
        return false;
      }
      var index = objLength;
      while (index--) {
        var key = objProps[index];
        if (!(isPartial ? key in other : hasOwnProperty.call(other, key))) {
          return false;
        }
      }
      // Check that cyclic values are equal.
      var objStacked = stack.get(object);
      var othStacked = stack.get(other);
      if (objStacked && othStacked) {
        return objStacked == other && othStacked == object;
      }
      var result = true;
      stack.set(object, other);
      stack.set(other, object);

      var skipCtor = isPartial;
      while (++index < objLength) {
        key = objProps[index];
        var objValue = object[key],
            othValue = other[key];

        if (customizer) {
          var compared = isPartial
            ? customizer(othValue, objValue, key, other, object, stack)
            : customizer(objValue, othValue, key, object, other, stack);
        }
        // Recursively compare objects (susceptible to call stack limits).
        if (!(compared === undefined
              ? (objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack))
              : compared
            )) {
          result = false;
          break;
        }
        skipCtor || (skipCtor = key == 'constructor');
      }
      if (result && !skipCtor) {
        var objCtor = object.constructor,
            othCtor = other.constructor;

        // Non `Object` object instances with different constructors are not equal.
        if (objCtor != othCtor &&
            ('constructor' in object && 'constructor' in other) &&
            !(typeof objCtor == 'function' && objCtor instanceof objCtor &&
              typeof othCtor == 'function' && othCtor instanceof othCtor)) {
          result = false;
        }
      }
      stack['delete'](object);
      stack['delete'](other);
      return result;
    }

    /**
     * `baseRest` 的专用版本，用于展平 rest 参数数组。
     *
     * @private
     * @param {Function} func 要应用 rest 参数的函数。
     * @returns {Function} 返回新的函数。
     */
    function flatRest(func) {
      return setToString(overRest(func, undefined, flatten), func + '');
    }

    /**
     * 创建 `object` 自身可枚举属性名和符号的数组。
     *
     * @private
     * @param {Object} object 要查询的对象。
     * @returns {Array} 返回属性名和符号的数组。
     */
    function getAllKeys(object) {
      return baseGetAllKeys(object, keys, getSymbols);
    }

    /**
     * 创建 `object` 自身和继承的可枚举属性名和符号的数组。
     *
     * @private
     * @param {Object} object 要查询的对象。
     * @returns {Array} 返回属性名和符号的数组。
     */
    function getAllKeysIn(object) {
      return baseGetAllKeys(object, keysIn, getSymbolsIn);
    }

    /**
     * 获取 `func` 的元数据。
     *
     * @private
     * @param {Function} func 要查询的函数。
     * @returns {*} 返回 `func` 的元数据。
     */
    var getData = !metaMap ? noop : function(func) {
      return metaMap.get(func);
    };

    /**
     * 获取 `func` 的名称。
     *
     * @private
     * @param {Function} func 要查询的函数。
     * @returns {string} 返回函数名称。
     */
    function getFuncName(func) {
      var result = (func.name + ''),
          array = realNames[result],
          length = hasOwnProperty.call(realNames, result) ? array.length : 0;

      while (length--) {
        var data = array[length],
            otherFunc = data.func;
        if (otherFunc == null || otherFunc == func) {
          return data.name;
        }
      }
      return result;
    }

    /**
     * 获取 `func` 的参数占位符值。
     *
     * @private
     * @param {Function} func 要检查的函数。
     * @returns {*} 返回占位符值。
     */
    function getHolder(func) {
      var object = hasOwnProperty.call(lodash, 'placeholder') ? lodash : func;
      return object.placeholder;
    }

    /**
     * 获取适当的 "iteratee" 函数。如果 `_.iteratee` 被自定义，
     * 此函数返回自定义方法，否则返回 `baseIteratee`。
     * 如果提供了参数，则调用所选函数并返回其结果。
     *
     * @private
     * @param {*} [value] 要转换为迭代器的值。
     * @param {number} [arity] 创建的迭代器的参数数量。
     * @returns {Function} 返回所选函数或其结果。
     */
    function getIteratee() {
      var result = lodash.iteratee || iteratee;
      result = result === iteratee ? baseIteratee : result;
      return arguments.length ? result(arguments[0], arguments[1]) : result;
    }

    /**
     * 获取 `map` 的数据。
     *
     * @private
     * @param {Object} map 要查询的 map。
     * @param {string} key 引用键。
     * @returns {*} 返回 map 数据。
     */
    function getMapData(map, key) {
      var data = map.__data__;
      return isKeyable(key)
        ? data[typeof key == 'string' ? 'string' : 'hash']
        : data.map;
    }

    /**
     * 获取 `object` 的属性名、值和比较标志。
     *
     * @private
     * @param {Object} object 要查询的对象。
     * @returns {Array} 返回 `object` 的匹配数据。
     */
    function getMatchData(object) {
      var result = keys(object),
          length = result.length;

      while (length--) {
        var key = result[length],
            value = object[key];

        result[length] = [key, value, isStrictComparable(value)];
      }
      return result;
    }

    /**
     * 获取 `object` 上 `key` 处的原生函数。
     *
     * @private
     * @param {Object} object 要查询的对象。
     * @param {string} key 要获取的方法的键。
     * @returns {*} 如果是原生函数则返回该函数，否则返回 `undefined`。
     */
    function getNative(object, key) {
      var value = getValue(object, key);
      return baseIsNative(value) ? value : undefined;
    }

    /**
     * 忽略 `Symbol.toStringTag` 值的 `baseGetTag` 专用版本。
     *
     * @private
     * @param {*} value 要查询的值。
     * @returns {string} 返回原始的 `toStringTag`。
     */
    function getRawTag(value) {
      var isOwn = hasOwnProperty.call(value, symToStringTag),
          tag = value[symToStringTag];

      try {
        value[symToStringTag] = undefined;
        var unmasked = true;
      } catch (e) {}

      var result = nativeObjectToString.call(value);
      if (unmasked) {
        if (isOwn) {
          value[symToStringTag] = tag;
        } else {
          delete value[symToStringTag];
        }
      }
      return result;
    }

    /**
     * 创建 `object` 自身可枚举符号的数组。
     *
     * @private
     * @param {Object} object 要查询的对象。
     * @returns {Array} 返回符号数组。
     */
    var getSymbols = !nativeGetSymbols ? stubArray : function(object) {
      if (object == null) {
        return [];
      }
      object = Object(object);
      return arrayFilter(nativeGetSymbols(object), function(symbol) {
        return propertyIsEnumerable.call(object, symbol);
      });
    };

    /**
     * 创建 `object` 自身和继承的可枚举符号的数组。
     *
     * @private
     * @param {Object} object 要查询的对象。
     * @returns {Array} 返回符号数组。
     */
    var getSymbolsIn = !nativeGetSymbols ? stubArray : function(object) {
      var result = [];
      while (object) {
        arrayPush(result, getSymbols(object));
        object = getPrototype(object);
      }
      return result;
    };

    /**
     * 获取 `value` 的 `toStringTag`。
     *
     * @private
     * @param {*} value 要查询的值。
     * @returns {string} 返回 `toStringTag`。
     */
    var getTag = baseGetTag;

    // Fallback for data views, maps, sets, and weak maps in IE 11 and promises in Node.js < 6.
    if ((DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag) ||
        (Map && getTag(new Map) != mapTag) ||
        (Promise && getTag(Promise.resolve()) != promiseTag) ||
        (Set && getTag(new Set) != setTag) ||
        (WeakMap && getTag(new WeakMap) != weakMapTag)) {
      getTag = function(value) {
        var result = baseGetTag(value),
            Ctor = result == objectTag ? value.constructor : undefined,
            ctorString = Ctor ? toSource(Ctor) : '';

        if (ctorString) {
          switch (ctorString) {
            case dataViewCtorString: return dataViewTag;
            case mapCtorString: return mapTag;
            case promiseCtorString: return promiseTag;
            case setCtorString: return setTag;
            case weakMapCtorString: return weakMapTag;
          }
        }
        return result;
      };
    }

    /**
     * 获取视图，对 `start` 和 `end` 位置应用任何 `transforms`。
     *
     * @private
     * @param {number} start 视图的开始位置。
     * @param {number} end 视图的结束位置。
     * @param {Array} transforms 要应用于视图的转换。
     * @returns {Object} 返回包含视图 `start` 和 `end` 位置的对象。
     */
    function getView(start, end, transforms) {
      var index = -1,
          length = transforms.length;

      while (++index < length) {
        var data = transforms[index],
            size = data.size;

        switch (data.type) {
          case 'drop':      start += size; break;
          case 'dropRight': end -= size; break;
          case 'take':      end = nativeMin(end, start + size); break;
          case 'takeRight': start = nativeMax(start, end - size); break;
        }
      }
      return { 'start': start, 'end': end };
    }

    /**
     * 从 `source` 主体注释中提取包装器详情。
     *
     * @private
     * @param {string} source 要检查的源代码。
     * @returns {Array} 返回包装器详情。
     */
    function getWrapDetails(source) {
      var match = source.match(reWrapDetails);
      return match ? match[1].split(reSplitDetails) : [];
    }

    /**
     * 检查 `path` 是否存在于 `object` 上。
     *
     * @private
     * @param {Object} object 要查询的对象。
     * @param {Array|string} path 要检查的路径。
     * @param {Function} hasFunc 用于检查属性的函数。
     * @returns {boolean} 如果 `path` 存在则返回 `true`，否则返回 `false`。
     */
    function hasPath(object, path, hasFunc) {
      path = castPath(path, object);

      var index = -1,
          length = path.length,
          result = false;

      while (++index < length) {
        var key = toKey(path[index]);
        if (!(result = object != null && hasFunc(object, key))) {
          break;
        }
        object = object[key];
      }
      if (result || ++index != length) {
        return result;
      }
      length = object == null ? 0 : object.length;
      return !!length && isLength(length) && isIndex(key, length) &&
        (isArray(object) || isArguments(object));
    }

    /**
     * 初始化数组克隆。
     *
     * @private
     * @param {Array} array 要克隆的数组。
     * @returns {Array} 返回初始化后的克隆。
     */
    function initCloneArray(array) {
      var length = array.length,
          result = new array.constructor(length);

      // Add properties assigned by `RegExp#exec`.
      if (length && typeof array[0] == 'string' && hasOwnProperty.call(array, 'index')) {
        result.index = array.index;
        result.input = array.input;
      }
      return result;
    }

    /**
     * 初始化对象克隆。
     *
     * @private
     * @param {Object} object 要克隆的对象。
     * @returns {Object} 返回初始化后的克隆。
     */
    function initCloneObject(object) {
      return (typeof object.constructor == 'function' && !isPrototype(object))
        ? baseCreate(getPrototype(object))
        : {};
    }

    /**
     * 根据其 `toStringTag` 初始化对象克隆。
     *
     * **注意：** 此函数仅支持克隆具有 `Boolean`、`Date`、`Error`、`Map`、
     * `Number`、`RegExp`、`Set` 或 `String` 标签的值。
     *
     * @private
     * @param {Object} object 要克隆的对象。
     * @param {string} tag 要克隆的对象的 `toStringTag`。
     * @param {boolean} [isDeep] 指定深度克隆。
     * @returns {Object} 返回初始化后的克隆。
     */
    function initCloneByTag(object, tag, isDeep) {
      var Ctor = object.constructor;
      switch (tag) {
        case arrayBufferTag:
          return cloneArrayBuffer(object);

        case boolTag:
        case dateTag:
          return new Ctor(+object);

        case dataViewTag:
          return cloneDataView(object, isDeep);

        case float32Tag: case float64Tag:
        case int8Tag: case int16Tag: case int32Tag:
        case uint8Tag: case uint8ClampedTag: case uint16Tag: case uint32Tag:
          return cloneTypedArray(object, isDeep);

        case mapTag:
          return new Ctor;

        case numberTag:
        case stringTag:
          return new Ctor(object);

        case regexpTag:
          return cloneRegExp(object);

        case setTag:
          return new Ctor;

        case symbolTag:
          return cloneSymbol(object);
      }
    }

    /**
     * 在 `source` 主体顶部的注释中插入包装器 `details`。
     *
     * @private
     * @param {string} source 要修改的源代码。
     * @returns {Array} details 要插入的详情。
     * @returns {string} 返回修改后的源代码。
     */
    function insertWrapDetails(source, details) {
      var length = details.length;
      if (!length) {
        return source;
      }
      var lastIndex = length - 1;
      details[lastIndex] = (length > 1 ? '& ' : '') + details[lastIndex];
      details = details.join(length > 2 ? ', ' : ' ');
      return source.replace(reWrapComment, '{\n/* [wrapped with ' + details + '] */\n');
    }

    /**
     * 检查 `value` 是否是可选平的 `arguments` 对象或数组。
     *
     * @private
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 可展平则返回 `true`，否则返回 `false`。
     */
    function isFlattenable(value) {
      return isArray(value) || isArguments(value) ||
        !!(spreadableSymbol && value && value[spreadableSymbol]);
    }

    /**
     * 检查 `value` 是否是有效的类数组索引。
     *
     * @private
     * @param {*} value 要检查的值。
     * @param {number} [length=MAX_SAFE_INTEGER] 有效索引的上界。
     * @returns {boolean} 如果 `value` 是有效索引则返回 `true`，否则返回 `false`。
     */
    function isIndex(value, length) {
      var type = typeof value;
      length = length == null ? MAX_SAFE_INTEGER : length;

      return !!length &&
        (type == 'number' ||
          (type != 'symbol' && reIsUint.test(value))) &&
            (value > -1 && value % 1 == 0 && value < length);
    }

    /**
     * 检查给定的参数是否来自迭代器调用。
     *
     * @private
     * @param {*} value 潜在的迭代器值参数。
     * @param {*} index 潜在的迭代器索引或键参数。
     * @param {*} object 潜在的迭代器对象参数。
     * @returns {boolean} 如果参数来自迭代器调用则返回 `true`，否则返回 `false`。
     */
    function isIterateeCall(value, index, object) {
      if (!isObject(object)) {
        return false;
      }
      var type = typeof index;
      if (type == 'number'
            ? (isArrayLike(object) && isIndex(index, object.length))
            : (type == 'string' && index in object)
          ) {
        return eq(object[index], value);
      }
      return false;
    }

    /**
     * 检查 `value` 是否是属性名而不是属性路径。
     *
     * @private
     * @param {*} value 要检查的值。
     * @param {Object} [object] 要查询键的对象。
     * @returns {boolean} 如果 `value` 是属性名则返回 `true`，否则返回 `false`。
     */
    function isKey(value, object) {
      if (isArray(value)) {
        return false;
      }
      var type = typeof value;
      if (type == 'number' || type == 'symbol' || type == 'boolean' ||
          value == null || isSymbol(value)) {
        return true;
      }
      return reIsPlainProp.test(value) || !reIsDeepProp.test(value) ||
        (object != null && value in Object(object));
    }

    /**
     * 检查 `value` 是否适合用作唯一对象键。
     *
     * @private
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 适合则返回 `true`，否则返回 `false`。
     */
    function isKeyable(value) {
      var type = typeof value;
      return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
        ? (value !== '__proto__')
        : (value === null);
    }

    /**
     * 检查 `func` 是否有惰性对应物。
     *
     * @private
     * @param {Function} func 要检查的函数。
     * @returns {boolean} 如果 `func` 有惰性对应物则返回 `true`，否则返回 `false`。
     */
    function isLaziable(func) {
      var funcName = getFuncName(func),
          other = lodash[funcName];

      if (typeof other != 'function' || !(funcName in LazyWrapper.prototype)) {
        return false;
      }
      if (func === other) {
        return true;
      }
      var data = getData(other);
      return !!data && func === data[0];
    }

    /**
     * 检查 `func` 的源代码是否被屏蔽。
     *
     * @private
     * @param {Function} func 要检查的函数。
     * @returns {boolean} 如果 `func` 被屏蔽则返回 `true`，否则返回 `false`。
     */
    function isMasked(func) {
      return !!maskSrcKey && (maskSrcKey in func);
    }

    /**
     * 检查 `func` 是否可以被屏蔽。
     *
     * @private
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `func` 可屏蔽则返回 `true`，否则返回 `false`。
     */
    var isMaskable = coreJsData ? isFunction : stubFalse;

    /**
     * 检查 `value` 是否可能是原型对象。
     *
     * @private
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是原型则返回 `true`，否则返回 `false`。
     */
    function isPrototype(value) {
      var Ctor = value && value.constructor,
          proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

      return value === proto;
    }

    /**
     * 检查 `value` 是否适合严格相等比较，即 `===`。
     *
     * @private
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 适合严格相等比较则返回 `true`，否则返回 `false`。
     */
    function isStrictComparable(value) {
      return value === value && !isObject(value);
    }

    /**
     * 适用于严格相等比较（即 `===`）的源值的 `matchesProperty` 专用版本。
     *
     * @private
     * @param {string} key 要获取的属性的键。
     * @param {*} srcValue 要匹配的值。
     * @returns {Function} 返回新的 spec 函数。
     */
    function matchesStrictComparable(key, srcValue) {
      return function(object) {
        if (object == null) {
          return false;
        }
        return object[key] === srcValue &&
          (srcValue !== undefined || (key in Object(object)));
      };
    }

    /**
     * 当超过 `MAX_MEMOIZE_SIZE` 时清除记忆函数缓存的 `_.memoize` 专用版本。
     *
     * @private
     * @param {Function} func 要记忆输出的函数。
     * @returns {Function} 返回新的记忆函数。
     */
    function memoizeCapped(func) {
      var result = memoize(func, function(key) {
        if (cache.size === MAX_MEMOIZE_SIZE) {
          cache.clear();
        }
        return key;
      });

      var cache = result.cache;
      return result;
    }

    /**
     * 将 `source` 的函数元数据合并到 `data` 中。
     *
     * 合并元数据可以减少调用函数时使用的包装器数量。
     * 这是可能的，因为像 `_.bind`、`_.curry` 和 `_.partial` 这样的方法可以
     * 不考虑执行顺序应用。像 `_.ary` 和 `_.rearg` 这样的方法会修改函数参数，
     * 使它们的执行顺序变得重要，从而阻止元数据的合并。但是，我们为安全组合
     * 的情况做了一个例外，即柯里化函数应用了 `_.ary` 和/或 `_.rearg`。
     *
     * @private
     * @param {Array} data 目标元数据。
     * @param {Array} source 源元数据。
     * @returns {Array} 返回 `data`。
     */
    function mergeData(data, source) {
      var bitmask = data[1],
          srcBitmask = source[1],
          newBitmask = bitmask | srcBitmask,
          isCommon = newBitmask < (WRAP_BIND_FLAG | WRAP_BIND_KEY_FLAG | WRAP_ARY_FLAG);

      var isCombo =
        ((srcBitmask == WRAP_ARY_FLAG) && (bitmask == WRAP_CURRY_FLAG)) ||
        ((srcBitmask == WRAP_ARY_FLAG) && (bitmask == WRAP_REARG_FLAG) && (data[7].length <= source[8])) ||
        ((srcBitmask == (WRAP_ARY_FLAG | WRAP_REARG_FLAG)) && (source[7].length <= source[8]) && (bitmask == WRAP_CURRY_FLAG));

      // Exit early if metadata can't be merged.
      if (!(isCommon || isCombo)) {
        return data;
      }
      // Use source `thisArg` if available.
      if (srcBitmask & WRAP_BIND_FLAG) {
        data[2] = source[2];
        // Set when currying a bound function.
        newBitmask |= bitmask & WRAP_BIND_FLAG ? 0 : WRAP_CURRY_BOUND_FLAG;
      }
      // Compose partial arguments.
      var value = source[3];
      if (value) {
        var partials = data[3];
        data[3] = partials ? composeArgs(partials, value, source[4]) : value;
        data[4] = partials ? replaceHolders(data[3], PLACEHOLDER) : source[4];
      }
      // Compose partial right arguments.
      value = source[5];
      if (value) {
        partials = data[5];
        data[5] = partials ? composeArgsRight(partials, value, source[6]) : value;
        data[6] = partials ? replaceHolders(data[5], PLACEHOLDER) : source[6];
      }
      // Use source `argPos` if available.
      value = source[7];
      if (value) {
        data[7] = value;
      }
      // Use source `ary` if it's smaller.
      if (srcBitmask & WRAP_ARY_FLAG) {
        data[8] = data[8] == null ? source[8] : nativeMin(data[8], source[8]);
      }
      // Use source `arity` if one is not provided.
      if (data[9] == null) {
        data[9] = source[9];
      }
      // Use source `func` and merge bitmasks.
      data[0] = source[0];
      data[1] = newBitmask;

      return data;
    }

    /**
     * 这个函数类似于
     * [`Object.keys`](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)，
     * 但它包括继承的可枚举属性。
     *
     * @private
     * @param {Object} object 要查询的对象。
     * @returns {Array} 返回属性名的数组。
     */
    function nativeKeysIn(object) {
      var result = [];
      if (object != null) {
        for (var key in Object(object)) {
          result.push(key);
        }
      }
      return result;
    }

    /**
     * 使用 `Object.prototype.toString` 将 `value` 转换为字符串。
     *
     * @private
     * @param {*} value 要转换的值。
     * @returns {string} 返回转换后的字符串。
     */
    function objectToString(value) {
      return nativeObjectToString.call(value);
    }

    /**
     * 转换 rest 数组的 `baseRest` 专用版本。
     *
     * @private
     * @param {Function} func 要应用 rest 参数的函数。
     * @param {number} [start=func.length-1] rest 参数的起始位置。
     * @param {Function} transform rest 数组的转换函数。
     * @returns {Function} 返回新的函数。
     */
    function overRest(func, start, transform) {
      start = nativeMax(start === undefined ? (func.length - 1) : start, 0);
      return function() {
        var args = arguments,
            index = -1,
            length = nativeMax(args.length - start, 0),
            array = Array(length);

        while (++index < length) {
          array[index] = args[start + index];
        }
        index = -1;
        var otherArgs = Array(start + 1);
        while (++index < start) {
          otherArgs[index] = args[index];
        }
        otherArgs[start] = transform(array);
        return apply(func, this, otherArgs);
      };
    }

    /**
     * 获取 `object` 在 `path` 处的父值。
     *
     * @private
     * @param {Object} object 要查询的对象。
     * @param {Array} path 要获取父值的路径。
     * @returns {*} 返回父值。
     */
    function parent(object, path) {
      return path.length < 2 ? object : baseGet(object, baseSlice(path, 0, -1));
    }

    /**
     * 根据指定的索引重新排序 `array`，其中第一个索引处的元素被分配为第一个元素，
     * 第二个索引处的元素被分配为第二个元素，以此类推。
     *
     * @private
     * @param {Array} array 要重新排序的数组。
     * @param {Array} indexes 排列后的数组索引。
     * @returns {Array} 返回 `array`。
     */
    function reorder(array, indexes) {
      var arrLength = array.length,
          length = nativeMin(indexes.length, arrLength),
          oldArray = copyArray(array);

      while (length--) {
        var index = indexes[length];
        array[length] = isIndex(index, arrLength) ? oldArray[index] : undefined;
      }
      return array;
    }

    /**
     * 获取 `key` 处的值，除非 `key` 是 "__proto__" 或 "constructor"。
     *
     * @private
     * @param {Object} object 要查询的对象。
     * @param {string} key 要获取的属性的键。
     * @returns {*} 返回属性值。
     */
    function safeGet(object, key) {
      if (key === 'constructor' && typeof object[key] === 'function') {
        return;
      }

      if (key == '__proto__') {
        return;
      }

      return object[key];
    }

    /**
     * 为 `func` 设置元数据。
     *
     * **注意：** 如果此函数变得热门，即在很短的时间内被频繁调用，
     * 它将触发其断路器并转换为一个恒等函数，以避免 V8 中的垃圾回收暂停。
     * 详见 [V8 issue 2070](https://bugs.chromium.org/p/v8/issues/detail?id=2070)。
     *
     * @private
     * @param {Function} func 要关联元数据的函数。
     * @param {*} data 元数据。
     * @returns {Function} 返回 `func`。
     */
    var setData = shortOut(baseSetData);

    /**
     * 全局 [`setTimeout`](https://mdn.io/setTimeout) 的简单包装器。
     *
     * @private
     * @param {Function} func 要延迟的函数。
     * @param {number} wait 延迟调用的毫秒数。
     * @returns {number|Object} 返回定时器 id 或超时对象。
     */
    var setTimeout = ctxSetTimeout || function(func, wait) {
      return root.setTimeout(func, wait);
    };

    /**
     * 将 `func` 的 `toString` 方法设置为返回 `string`。
     *
     * @private
     * @param {Function} func 要修改的函数。
     * @param {Function} string `toString` 的结果。
     * @returns {Function} 返回 `func`。
     */
    var setToString = shortOut(baseSetToString);

    /**
     * 将 `wrapper` 的 `toString` 方法设置为模仿 `reference` 的源代码，
     * 在源代码主体顶部的注释中包含包装器详情。
     *
     * @private
     * @param {Function} wrapper 要修改的函数。
     * @param {Function} reference 参考函数。
     * @param {number} bitmask 位掩码标志。详见 `createWrap`。
     * @returns {Function} 返回 `wrapper`。
     */
    function setWrapToString(wrapper, reference, bitmask) {
      var source = (reference + '');
      return setToString(wrapper, insertWrapDetails(source, updateWrapDetails(getWrapDetails(source), bitmask)));
    }

    /**
     * 创建一个函数，当在 `HOT_SPAN` 毫秒内被调用 `HOT_COUNT` 次或更多次时，
     * 会短路并调用 `identity` 而不是 `func`。
     *
     * @private
     * @param {Function} func 要限制的函数。
     * @returns {Function} 返回新的可短路函数。
     */
    function shortOut(func) {
      var count = 0,
          lastCalled = 0;

      return function() {
        var stamp = nativeNow(),
            remaining = HOT_SPAN - (stamp - lastCalled);

        lastCalled = stamp;
        if (remaining > 0) {
          if (++count >= HOT_COUNT) {
            return arguments[0];
          }
        } else {
          count = 0;
        }
        return func.apply(undefined, arguments);
      };
    }

    /**
     * 变异并设置 `array` 大小的 `_.shuffle` 专用版本。
     *
     * @private
     * @param {Array} array 要打乱的数组。
     * @param {number} [size=array.length] `array` 的大小。
     * @returns {Array} 返回 `array`。
     */
    function shuffleSelf(array, size) {
      var index = -1,
          length = array.length,
          lastIndex = length - 1;

      size = size === undefined ? length : size;
      while (++index < size) {
        var rand = baseRandom(index, lastIndex),
            value = array[rand];

        array[rand] = array[index];
        array[index] = value;
      }
      array.length = size;
      return array;
    }

    /**
     * 将 `string` 转换为属性路径数组。
     *
     * @private
     * @param {string} string 要转换的字符串。
     * @returns {Array} 返回属性路径数组。
     */
    var stringToPath = memoizeCapped(function(string) {
      var result = [];
      if (string.charCodeAt(0) === 46 /* . */) {
        result.push('');
      }
      string.replace(rePropName, function(match, number, quote, subString) {
        result.push(quote ? subString.replace(reEscapeChar, '$1') : (number || match));
      });
      return result;
    });

    /**
     * 如果 `value` 不是字符串或符号，则将其转换为字符串键。
     *
     * @private
     * @param {*} value 要检查的值。
     * @returns {string|symbol} 返回键。
     */
    function toKey(value) {
      if (typeof value == 'string' || isSymbol(value)) {
        return value;
      }
      var result = (value + '');
      return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
    }

    /**
     * 将 `func` 转换为其源代码。
     *
     * @private
     * @param {Function} func 要转换的函数。
     * @returns {string} 返回源代码。
     */
    function toSource(func) {
      if (func != null) {
        try {
          return funcToString.call(func);
        } catch (e) {}
        try {
          return (func + '');
        } catch (e) {}
      }
      return '';
    }

    /**
     * 根据 `bitmask` 标志更新包装器 `details`。
     *
     * @private
     * @returns {Array} details 要修改的详情。
     * @param {number} bitmask 位掩码标志。详见 `createWrap`。
     * @returns {Array} 返回 `details`。
     */
    function updateWrapDetails(details, bitmask) {
      arrayEach(wrapFlags, function(pair) {
        var value = '_.' + pair[0];
        if ((bitmask & pair[1]) && !arrayIncludes(details, value)) {
          details.push(value);
        }
      });
      return details.sort();
    }

    /**
      * 创建一个 `wrapper` 的克隆。
      *
      * @private
      * @param {Object} wrapper 要克隆的包装器。
      * @returns {Object} 返回克隆的包装器。
     */
    function wrapperClone(wrapper) {
      if (wrapper instanceof LazyWrapper) {
        return wrapper.clone();
      }
      var result = new LodashWrapper(wrapper.__wrapped__, wrapper.__chain__);
      result.__actions__ = copyArray(wrapper.__actions__);
      result.__index__  = wrapper.__index__;
      result.__values__ = wrapper.__values__;
      return result;
    }

    /*------------------------------------------------------------------------*/

    /**
     * 创建一个数组，分割成 `size` 长度的组。如果 `array` 不能被均匀分割，
     * 最后的元素组将是剩余的元素。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Array
     * @param {Array} array 要处理的数组。
     * @param {number} [size=1] 每个元素组的长度
     * @param- {Object} [guard] 允许用作像 `_.map` 这样的方法的迭代器。
     * @returns {Array} 返回新的元素组数组。
     * @example
     *
     * _.chunk(['a', 'b', 'c', 'd'], 2);
     * // => [['a', 'b'], ['c', 'd']]
     *
     * _.chunk(['a', 'b', 'c', 'd'], 3);
     * // => [['a', 'b', 'c'], ['d']]
     */
    function chunk(array, size, guard) {
      if ((guard ? isIterateeCall(array, size, guard) : size === undefined)) {
        size = 1;
      } else {
        size = nativeMax(toInteger(size), 0);
      }
      var length = array == null ? 0 : array.length;
      if (!length || size < 1) {
        return [];
      }
      var index = 0,
          resIndex = 0,
          result = Array(nativeCeil(length / size));

      while (index < length) {
        result[resIndex++] = baseSlice(array, index, (index += size));
      }
      return result;
    }

    /**
     * 创建一个移除了所有假值的数组。`false`、`null`、`0`、`-0`、`0n`、`""`、
     * `undefined` 和 `NaN` 都是假值。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Array
     * @param {Array} array 要过滤的数组。
     * @returns {Array} 返回新的过滤值数组。
     * @example
     *
     * _.compact([0, 1, false, 2, '', 3]);
     * // => [1, 2, 3]
     */
    function compact(array) {
      var index = -1,
          length = array == null ? 0 : array.length,
          resIndex = 0,
          result = [];

      while (++index < length) {
        var value = array[index];
        if (value) {
          result[resIndex++] = value;
        }
      }
      return result;
    }

    /**
     * 创建一个新数组，将 `array` 与任何其他数组和/或值连接在一起。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {Array} array 要连接的数组。
     * @param {...*} [values] 要连接的值。
     * @returns {Array} 返回新的连接后的数组。
     * @example
     *
     * var array = [1];
     * var other = _.concat(array, 2, [3], [[4]]);
     *
     * console.log(other);
     * // => [1, 2, 3, [4]]
     *
     * console.log(array);
     * // => [1]
     */
    function concat() {
      var length = arguments.length;
      if (!length) {
        return [];
      }
      var args = Array(length - 1),
          array = arguments[0],
          index = length;

      while (index--) {
        args[index - 1] = arguments[index];
      }
      return arrayPush(isArray(array) ? copyArray(array) : [array], baseFlatten(args, 1));
    }

    /**
     * 创建一个数组，包含 `array` 中的值，但不包含在其他给定的数组中。
     * 使用 [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
     * 进行相等比较。结果值的顺序和引用由第一个数组决定。
     *
     * **注意：** 与 `_.pullAll` 不同，此方法返回一个新数组。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Array
     * @param {Array} array 要检查的数组。
     * @param {...Array} [values] 要排除的值。
     * @returns {Array} 返回新的过滤值数组。
     * @see _.without, _.xor
     * @example
     *
     * _.difference([2, 1], [2, 3]);
     * // => [1]
     */
    var difference = baseRest(function(array, values) {
      return isArrayLikeObject(array)
        ? baseDifference(array, baseFlatten(values, 1, isArrayLikeObject, true))
        : [];
    });

    /**
     * 这个方法类似 `_.difference`，但它接受一个 `iteratee`，该函数对 `array`
     * 和 `values` 中的每个元素调用，生成比较的标准。结果值的顺序和引用由第一个数组决定。
     * 迭代器接受一个参数：(value)。
     *
     * **注意：** 与 `_.pullAllBy` 不同，此方法返回一个新数组。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {Array} array 要检查的数组。
     * @param {...Array} [values] 要排除的值。
     * @param {Function} [iteratee=_.identity] 每个元素调用的迭代器。
     * @returns {Array} 返回新的过滤值数组。
     * @example
     *
     * _.differenceBy([2.1, 1.2], [2.3, 3.4], Math.floor);
     * // => [1.2]
     *
     * // The `_.property` iteratee shorthand.
     * _.differenceBy([{ 'x': 2 }, { 'x': 1 }], [{ 'x': 1 }], 'x');
     * // => [{ 'x': 2 }]
     */
    var differenceBy = baseRest(function(array, values) {
      var iteratee = last(values);
      if (isArrayLikeObject(iteratee)) {
        iteratee = undefined;
      }
      return isArrayLikeObject(array)
        ? baseDifference(array, baseFlatten(values, 1, isArrayLikeObject, true), getIteratee(iteratee, 2))
        : [];
    });

    /**
     * 这个方法类似 `_.difference`，但它接受一个 `comparator` 来比较
     * `array` 和 `values` 的元素。结果值的顺序和引用由第一个数组决定。
     * 比较器接受两个参数：(arrVal, othVal)。
     *
     * **注意：** 与 `_.pullAllWith` 不同，此方法返回一个新数组。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {Array} array 要检查的数组。
     * @param {...Array} [values] 要排除的值。
     * @param {Function} [comparator] 每个元素调用的比较器。
     * @returns {Array} 返回新的过滤值数组。
     * @example
     *
     * var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }];
     *
     * _.differenceWith(objects, [{ 'x': 1, 'y': 2 }], _.isEqual);
     * // => [{ 'x': 2, 'y': 1 }]
     */
    var differenceWith = baseRest(function(array, values) {
      var comparator = last(values);
      if (isArrayLikeObject(comparator)) {
        comparator = undefined;
      }
      return isArrayLikeObject(array)
        ? baseDifference(array, baseFlatten(values, 1, isArrayLikeObject, true), undefined, comparator)
        : [];
    });

    /**
     * 创建一个数组切片，从开头移除 `n` 个元素。
     *
     * @static
     * @memberOf _
     * @since 0.5.0
     * @category Array
     * @param {Array} array 要查询的数组。
     * @param {number} [n=1] 要移除的元素数量。
     * @param- {Object} [guard] 允许用作像 `_.map` 这样的方法的迭代器。
     * @returns {Array} 返回 `array` 的切片。
     * @example
     *
     * _.drop([1, 2, 3]);
     * // => [2, 3]
     *
     * _.drop([1, 2, 3], 2);
     * // => [3]
     *
     * _.drop([1, 2, 3], 5);
     * // => []
     *
     * _.drop([1, 2, 3], 0);
     * // => [1, 2, 3]
     */
    function drop(array, n, guard) {
      var length = array == null ? 0 : array.length;
      if (!length) {
        return [];
      }
      n = (guard || n === undefined) ? 1 : toInteger(n);
      return baseSlice(array, n < 0 ? 0 : n, length);
    }

    /**
     * 创建一个数组切片，从末尾移除 `n` 个元素。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Array
     * @param {Array} array 要查询的数组。
     * @param {number} [n=1] 要移除的元素数量。
     * @param- {Object} [guard] 允许用作像 `_.map` 这样的方法的迭代器。
     * @returns {Array} 返回 `array` 的切片。
     * @example
     *
     * _.dropRight([1, 2, 3]);
     * // => [1, 2]
     *
     * _.dropRight([1, 2, 3], 2);
     * // => [1]
     *
     * _.dropRight([1, 2, 3], 5);
     * // => []
     *
     * _.dropRight([1, 2, 3], 0);
     * // => [1, 2, 3]
     */
    function dropRight(array, n, guard) {
      var length = array == null ? 0 : array.length;
      if (!length) {
        return [];
      }
      n = (guard || n === undefined) ? 1 : toInteger(n);
      n = length - n;
      return baseSlice(array, 0, n < 0 ? 0 : n);
    }

    /**
     * 创建一个 `array` 的切片，排除从末尾丢弃的元素。丢弃元素直到 `predicate`
     * 返回假值。断言接受三个参数：(value, index, array)。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Array
     * @param {Array} array 要查询的数组。
     * @param {Function} [predicate=_.identity] 每次迭代调用的函数。
     * @returns {Array} 返回 `array` 的切片。
     * @example
     *
     * var users = [
     *   { 'user': 'barney',  'active': true },
     *   { 'user': 'fred',    'active': false },
     *   { 'user': 'pebbles', 'active': false }
     * ];
     *
     * _.dropRightWhile(users, function(o) { return !o.active; });
     * // => objects for ['barney']
     *
     * // The `_.matches` iteratee shorthand.
     * _.dropRightWhile(users, { 'user': 'pebbles', 'active': false });
     * // => objects for ['barney', 'fred']
     *
     * // The `_.matchesProperty` iteratee shorthand.
     * _.dropRightWhile(users, ['active', false]);
     * // => objects for ['barney']
     *
     * // The `_.property` iteratee shorthand.
     * _.dropRightWhile(users, 'active');
     * // => objects for ['barney', 'fred', 'pebbles']
     */
    function dropRightWhile(array, predicate) {
      return (array && array.length)
        ? baseWhile(array, getIteratee(predicate, 3), true, true)
        : [];
    }

    /**
     * 创建一个 `array` 的切片，排除从开头丢弃的元素。丢弃元素直到 `predicate`
     * 返回假值。断言接受三个参数：(value, index, array)。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Array
     * @param {Array} array 要查询的数组。
     * @param {Function} [predicate=_.identity] 每次迭代调用的函数。
     * @returns {Array} 返回 `array` 的切片。
     * @example
     *
     * var users = [
     *   { 'user': 'barney',  'active': false },
     *   { 'user': 'fred',    'active': false },
     *   { 'user': 'pebbles', 'active': true }
     * ];
     *
     * _.dropWhile(users, function(o) { return !o.active; });
     * // => objects for ['pebbles']
     *
     * // The `_.matches` iteratee shorthand.
     * _.dropWhile(users, { 'user': 'barney', 'active': false });
     * // => objects for ['fred', 'pebbles']
     *
     * // The `_.matchesProperty` iteratee shorthand.
     * _.dropWhile(users, ['active', false]);
     * // => objects for ['pebbles']
     *
     * // The `_.property` iteratee shorthand.
     * _.dropWhile(users, 'active');
     * // => objects for ['barney', 'fred', 'pebbles']
     */
    function dropWhile(array, predicate) {
      return (array && array.length)
        ? baseWhile(array, getIteratee(predicate, 3), true)
        : [];
    }

    /**
     * 使用 `value` 填充 `array` 中从 `start` 到但不包括 `end` 的元素。
     *
     * **注意：** 此方法会改变 `array`。
     *
     * @static
     * @memberOf _
     * @since 3.2.0
     * @category Array
     * @param {Array} array 要填充的数组。
     * @param {*} value 用什么值填充 `array`。
     * @param {number} [start=0] 起始位置。
     * @param {number} [end=array.length] 结束位置。
     * @returns {Array} 返回 `array`。
     * @example
     *
     * var array = [1, 2, 3];
     *
     * _.fill(array, 'a');
     * console.log(array);
     * // => ['a', 'a', 'a']
     *
     * _.fill(Array(3), 2);
     * // => [2, 2, 2]
     *
     * _.fill([4, 6, 8, 10], '*', 1, 3);
     * // => [4, '*', '*', 10]
     */
    function fill(array, value, start, end) {
      var length = array == null ? 0 : array.length;
      if (!length) {
        return [];
      }
      if (start && typeof start != 'number' && isIterateeCall(array, value, start)) {
        start = 0;
        end = length;
      }
      return baseFill(array, value, start, end);
    }

    /**
     * 这个方法类似 `_.find`，但它返回 `predicate` 返回真值的第一个元素的索引，
     * 而不是元素本身。
     *
     * @static
     * @memberOf _
     * @since 1.1.0
     * @category Array
     * @param {Array} array 要检查的数组。
     * @param {Function} [predicate=_.identity] 每次迭代调用的函数。
     * @param {number} [fromIndex=0] 从哪里开始搜索的索引。
     * @returns {number} 返回找到的元素的索引，否则为 `-1`。
     * @example
     *
     * var users = [
     *   { 'user': 'barney',  'active': false },
     *   { 'user': 'fred',    'active': false },
     *   { 'user': 'pebbles', 'active': true }
     * ];
     *
     * _.findIndex(users, function(o) { return o.user == 'barney'; });
     * // => 0
     *
     * // The `_.matches` iteratee shorthand.
     * _.findIndex(users, { 'user': 'fred', 'active': false });
     * // => 1
     *
     * // The `_.matchesProperty` iteratee shorthand.
     * _.findIndex(users, ['active', false]);
     * // => 0
     *
     * // The `_.property` iteratee shorthand.
     * _.findIndex(users, 'active');
     * // => 2
     */
    function findIndex(array, predicate, fromIndex) {
      var length = array == null ? 0 : array.length;
      if (!length) {
        return -1;
      }
      var index = fromIndex == null ? 0 : toInteger(fromIndex);
      if (index < 0) {
        index = nativeMax(length + index, 0);
      }
      return baseFindIndex(array, getIteratee(predicate, 3), index);
    }

    /**
     * 这个方法类似 `_.findIndex`，但它从右到左迭代 `collection` 的元素。
     *
     * @static
     * @memberOf _
     * @since 2.0.0
     * @category Array
     * @param {Array} array 要检查的数组。
     * @param {Function} [predicate=_.identity] 每次迭代调用的函数。
     * @param {number} [fromIndex=array.length-1] 从哪里开始搜索的索引。
     * @returns {number} 返回找到的元素的索引，否则为 `-1`。
     * @example
     *
     * var users = [
     *   { 'user': 'barney',  'active': true },
     *   { 'user': 'fred',    'active': false },
     *   { 'user': 'pebbles', 'active': false }
     * ];
     *
     * _.findLastIndex(users, function(o) { return o.user == 'pebbles'; });
     * // => 2
     *
     * // The `_.matches` iteratee shorthand.
     * _.findLastIndex(users, { 'user': 'barney', 'active': true });
     * // => 0
     *
     * // The `_.matchesProperty` iteratee shorthand.
     * _.findLastIndex(users, ['active', false]);
     * // => 2
     *
     * // The `_.property` iteratee shorthand.
     * _.findLastIndex(users, 'active');
     * // => 0
     */
    function findLastIndex(array, predicate, fromIndex) {
      var length = array == null ? 0 : array.length;
      if (!length) {
        return -1;
      }
      var index = length - 1;
      if (fromIndex !== undefined) {
        index = toInteger(fromIndex);
        index = fromIndex < 0
          ? nativeMax(length + index, 0)
          : nativeMin(index, length - 1);
      }
      return baseFindIndex(array, getIteratee(predicate, 3), index, true);
    }

    /**
     * 将 `array` 展平一层。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Array
     * @param {Array} array 要展平的数组。
     * @returns {Array} 返回新的展平后的数组。
     * @example
     *
     * _.flatten([1, [2, [3, [4]], 5]]);
     * // => [1, 2, [3, [4]], 5]
     */
    function flatten(array) {
      var length = array == null ? 0 : array.length;
      return length ? baseFlatten(array, 1) : [];
    }

    /**
     * 递归展平 `array`。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Array
     * @param {Array} array 要展平的数组。
     * @returns {Array} 返回新的展平后的数组。
     * @example
     *
     * _.flattenDeep([1, [2, [3, [4]], 5]]);
     * // => [1, 2, 3, 4, 5]
     */
    function flattenDeep(array) {
      var length = array == null ? 0 : array.length;
      return length ? baseFlatten(array, INFINITY) : [];
    }

    /**
     * 递归展平 `array` 最多 `depth` 次。
     *
     * @static
     * @memberOf _
     * @since 4.4.0
     * @category Array
     * @param {Array} array 要展平的数组。
     * @param {number} [depth=1] 最大递归深度。
     * @returns {Array} 返回新的展平后的数组。
     * @example
     *
     * var array = [1, [2, [3, [4]], 5]];
     *
     * _.flattenDepth(array, 1);
     * // => [1, 2, [3, [4]], 5]
     *
     * _.flattenDepth(array, 2);
     * // => [1, 2, 3, [4], 5]
     */
    function flattenDepth(array, depth) {
      var length = array == null ? 0 : array.length;
      if (!length) {
        return [];
      }
      depth = depth === undefined ? 1 : toInteger(depth);
      return baseFlatten(array, depth);
    }

    /**
     * `_.toPairs` 的反向方法；此方法返回一个由键值对 `pairs` 构成的对象。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {Array} pairs 键值对。
     * @returns {Object} 返回新的对象。
     * @example
     *
     * _.fromPairs([['a', 1], ['b', 2]]);
     * // => { 'a': 1, 'b': 2 }
     */
    function fromPairs(pairs) {
      var index = -1,
          length = pairs == null ? 0 : pairs.length,
          result = {};

      while (++index < length) {
        var pair = pairs[index];
        baseAssignValue(result, pair[0], pair[1]);
      }
      return result;
    }

    /**
     * 获取 `array` 的第一个元素。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @alias first
     * @category Array
     * @param {Array} array 要查询的数组。
     * @returns {*} 返回 `array` 的第一个元素。
     * @example
     *
     * _.head([1, 2, 3]);
     * // => 1
     *
     * _.head([]);
     * // => undefined
     */
    function head(array) {
      return (array && array.length) ? array[0] : undefined;
    }

    /**
     * 返回 `value` 在 `array` 中首次出现的索引，使用
     * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
     * 进行相等比较。如果 `fromIndex` 为负，则作为从 `array` 末尾开始的偏移量。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Array
     * @param {Array} array 要检查的数组。
     * @param {*} value 要搜索的值。
     * @param {number} [fromIndex=0] 从哪里开始搜索的索引。
     * @returns {number} 返回匹配值的索引，否则为 `-1`。
     * @example
     *
     * _.indexOf([1, 2, 1, 2], 2);
     * // => 1
     *
     * // Search from the `fromIndex`.
     * _.indexOf([1, 2, 1, 2], 2, 2);
     * // => 3
     */
    function indexOf(array, value, fromIndex) {
      var length = array == null ? 0 : array.length;
      if (!length) {
        return -1;
      }
      var index = fromIndex == null ? 0 : toInteger(fromIndex);
      if (index < 0) {
        index = nativeMax(length + index, 0);
      }
      return baseIndexOf(array, value, index);
    }

    /**
     * 获取 `array` 除最后一个元素外的所有元素。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Array
     * @param {Array} array 要查询的数组。
     * @returns {Array} 返回 `array` 的切片。
     * @example
     *
     * _.initial([1, 2, 3]);
     * // => [1, 2]
     */
    function initial(array) {
      var length = array == null ? 0 : array.length;
      return length ? baseSlice(array, 0, -1) : [];
    }

    /**
     * 创建一个包含所有给定数组中唯一值的数组，使用
     * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
     * 进行相等比较。结果值的顺序和引用由第一个数组决定。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Array
     * @param {...Array} [arrays] 要检查的数组。
     * @returns {Array} 返回新的交集值数组。
     * @example
     *
     * _.intersection([2, 1], [2, 3]);
     * // => [2]
     */
    var intersection = baseRest(function(arrays) {
      var mapped = arrayMap(arrays, castArrayLikeObject);
      return (mapped.length && mapped[0] === arrays[0])
        ? baseIntersection(mapped)
        : [];
    });

    /**
     * 这个方法类似 `_.intersection`，但它接受 `iteratee`，为每个 `arrays`
     * 的每个元素调用，生成比较的标准。结果值的顺序和引用由第一个数组决定。
     * 迭代器接受一个参数：(value)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {...Array} [arrays] 要检查的数组。
     * @param {Function} [iteratee=_.identity] 每个元素调用的迭代器。
     * @returns {Array} 返回新的交集值数组。
     * @example
     *
     * _.intersectionBy([2.1, 1.2], [2.3, 3.4], Math.floor);
     * // => [2.1]
     *
     * // The `_.property` iteratee shorthand.
     * _.intersectionBy([{ 'x': 1 }], [{ 'x': 2 }, { 'x': 1 }], 'x');
     * // => [{ 'x': 1 }]
     */
    var intersectionBy = baseRest(function(arrays) {
      var iteratee = last(arrays),
          mapped = arrayMap(arrays, castArrayLikeObject);

      if (iteratee === last(mapped)) {
        iteratee = undefined;
      } else {
        mapped.pop();
      }
      return (mapped.length && mapped[0] === arrays[0])
        ? baseIntersection(mapped, getIteratee(iteratee, 2))
        : [];
    });

    /**
     * 这个方法类似 `_.intersection`，但它接受 `comparator` 来比较
     * `arrays` 的元素。结果值的顺序和引用由第一个数组决定。
     * 比较器接受两个参数：(arrVal, othVal)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {...Array} [arrays] 要检查的数组。
     * @param {Function} [comparator] 每个元素调用的比较器。
     * @returns {Array} 返回新的交集值数组。
     * @example
     *
     * var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }];
     * var others = [{ 'x': 1, 'y': 1 }, { 'x': 1, 'y': 2 }];
     *
     * _.intersectionWith(objects, others, _.isEqual);
     * // => [{ 'x': 1, 'y': 2 }]
     */
    var intersectionWith = baseRest(function(arrays) {
      var comparator = last(arrays),
          mapped = arrayMap(arrays, castArrayLikeObject);

      comparator = typeof comparator == 'function' ? comparator : undefined;
      if (comparator) {
        mapped.pop();
      }
      return (mapped.length && mapped[0] === arrays[0])
        ? baseIntersection(mapped, undefined, comparator)
        : [];
    });

    /**
     * 将 `array` 中的所有元素转换为由 `separator` 分隔的字符串。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {Array} array 要转换的数组。
     * @param {string} [separator=','] 元素分隔符。
     * @returns {string} 返回连接的字符串。
     * @example
     *
     * _.join(['a', 'b', 'c'], '~');
     * // => 'a~b~c'
     */
    function join(array, separator) {
      return array == null ? '' : nativeJoin.call(array, separator);
    }

    /**
     * 获取 `array` 的最后一个元素。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Array
     * @param {Array} array 要查询的数组。
     * @returns {*} 返回 `array` 的最后一个元素。
     * @example
     *
     * _.last([1, 2, 3]);
     * // => 3
     */
    function last(array) {
      var length = array == null ? 0 : array.length;
      return length ? array[length - 1] : undefined;
    }

    /**
     * 这个方法类似 `_.indexOf`，但它从右到左迭代 `array` 的元素。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Array
     * @param {Array} array 要检查的数组。
     * @param {*} value 要搜索的值。
     * @param {number} [fromIndex=array.length-1] 从哪里开始搜索的索引。
     * @returns {number} 返回匹配值的索引，否则为 `-1`。
     * @example
     *
     * _.lastIndexOf([1, 2, 1, 2], 2);
     * // => 3
     *
     * // Search from the `fromIndex`.
     * _.lastIndexOf([1, 2, 1, 2], 2, 2);
     * // => 1
     */
    function lastIndexOf(array, value, fromIndex) {
      var length = array == null ? 0 : array.length;
      if (!length) {
        return -1;
      }
      var index = length;
      if (fromIndex !== undefined) {
        index = toInteger(fromIndex);
        index = index < 0 ? nativeMax(length + index, 0) : nativeMin(index, length - 1);
      }
      return value === value
        ? strictLastIndexOf(array, value, index)
        : baseFindIndex(array, baseIsNaN, index, true);
    }

    /**
     * 获取 `array` 索引 `n` 处的元素。如果 `n` 为负，则返回从末尾开始的第 n 个元素。
     *
     * @static
     * @memberOf _
     * @since 4.11.0
     * @category Array
     * @param {Array} array 要查询的数组。
     * @param {number} [n=0] 要返回的元素的索引。
     * @returns {*} 返回 `array` 的第 n 个元素。
     * @example
     *
     * var array = ['a', 'b', 'c', 'd'];
     *
     * _.nth(array, 1);
     * // => 'b'
     *
     * _.nth(array, -2);
     * // => 'c';
     */
    function nth(array, n) {
      return (array && array.length) ? baseNth(array, toInteger(n)) : undefined;
    }

    /**
     * 使用 [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
     * 进行相等比较，从 `array` 中移除所有给定的值。
     *
     * **注意：** 与 `_.without` 不同，此方法会改变 `array`。使用 `_.remove`
     * 通过谓词从数组中移除元素。
     *
     * @static
     * @memberOf _
     * @since 2.0.0
     * @category Array
     * @param {Array} array 要修改的数组。
     * @param {...*} [values] 要移除的值。
     * @returns {Array} 返回 `array`。
     * @example
     *
     * var array = ['a', 'b', 'c', 'a', 'b', 'c'];
     *
     * _.pull(array, 'a', 'c');
     * console.log(array);
     * // => ['b', 'b']
     */
    var pull = baseRest(pullAll);

    /**
     * 这个方法类似 `_.pull`，但它接受要移除的值数组。
     *
     * **注意：** 与 `_.difference` 不同，此方法会改变 `array`。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {Array} array 要修改的数组。
     * @param {Array} values 要移除的值。
     * @returns {Array} 返回 `array`。
     * @example
     *
     * var array = ['a', 'b', 'c', 'a', 'b', 'c'];
     *
     * _.pullAll(array, ['a', 'c']);
     * console.log(array);
     * // => ['b', 'b']
     */
    function pullAll(array, values) {
      return (array && array.length && values && values.length)
        ? basePullAll(array, values)
        : array;
    }

    /**
     * 这个方法类似 `_.pullAll`，但它接受 `iteratee`，为 `array` 和 `values`
     * 的每个元素调用，生成比较的标准。迭代器接受一个参数：(value)。
     *
     * **注意：** 与 `_.differenceBy` 不同，此方法会改变 `array`。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {Array} array 要修改的数组。
     * @param {Array} values 要移除的值。
     * @param {Function} [iteratee=_.identity] 每个元素调用的迭代器。
     * @returns {Array} 返回 `array`。
     * @example
     *
     * var array = [{ 'x': 1 }, { 'x': 2 }, { 'x': 3 }, { 'x': 1 }];
     *
     * _.pullAllBy(array, [{ 'x': 1 }, { 'x': 3 }], 'x');
     * console.log(array);
     * // => [{ 'x': 2 }]
     */
    function pullAllBy(array, values, iteratee) {
      return (array && array.length && values && values.length)
        ? basePullAll(array, values, getIteratee(iteratee, 2))
        : array;
    }

    /**
     * This method is like `_.pullAll` except that it accepts `comparator` which
     * is invoked to compare elements of `array` to `values`. The comparator is
     * invoked with two arguments: (arrVal, othVal).
     *
     * **Note:** Unlike `_.differenceWith`, this method mutates `array`.
     *
     * @static
     * @memberOf _
     * @since 4.6.0
     * @category Array
     * @param {Array} array The array to modify.
     * @param {Array} values The values to remove.
     * @param {Function} [comparator] The comparator invoked per element.
     * @returns {Array} 返回 `array`。
     * @example
     *
     * var array = [{ 'x': 1, 'y': 2 }, { 'x': 3, 'y': 4 }, { 'x': 5, 'y': 6 }];
     *
     * _.pullAllWith(array, [{ 'x': 3, 'y': 4 }], _.isEqual);
     * console.log(array);
     * // => [{ 'x': 1, 'y': 2 }, { 'x': 5, 'y': 6 }]
     */
    function pullAllWith(array, values, comparator) {
      return (array && array.length && values && values.length)
        ? basePullAll(array, values, undefined, comparator)
        : array;
    }

    /**
     * 移除 `array` 中与 `indexes` 对应的元素，并返回已移除元素的数组。
     *
     * **注意：** 与 `_.at` 不同，此方法会改变 `array`。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Array
     * @param {Array} array 要修改的数组。
     * @param {...(number|number[])} [indexes] 要移除的元素的索引。
     * @returns {Array} 返回新的已移除元素数组。
     * @example
     *
     * var array = ['a', 'b', 'c', 'd'];
     * var pulled = _.pullAt(array, [1, 3]);
     *
     * console.log(array);
     * // => ['a', 'c']
     *
     * console.log(pulled);
     * // => ['b', 'd']
     */
    var pullAt = flatRest(function(array, indexes) {
      var length = array == null ? 0 : array.length,
          result = baseAt(array, indexes);

      basePullAt(array, arrayMap(indexes, function(index) {
        return isIndex(index, length) ? +index : index;
      }).sort(compareAscending));

      return result;
    });

    /**
     * 移除 `array` 中 `predicate` 返回真值的所有元素，并返回已移除元素的数组。
     * 断言接受三个参数：(value, index, array)。
     *
     * **注意：** 与 `_.filter` 不同，此方法会改变 `array`。使用 `_.pull`
     * 按值从数组中拉出元素。
     *
     * @static
     * @memberOf _
     * @since 2.0.0
     * @category Array
     * @param {Array} array 要修改的数组。
     * @param {Function} [predicate=_.identity] 每次迭代调用的函数。
     * @returns {Array} 返回新的已移除元素数组。
     * @example
     *
     * var array = [1, 2, 3, 4];
     * var evens = _.remove(array, function(n) {
     *   return n % 2 == 0;
     * });
     *
     * console.log(array);
     * // => [1, 3]
     *
     * console.log(evens);
     * // => [2, 4]
     */
    function remove(array, predicate) {
      var result = [];
      if (!(array && array.length)) {
        return result;
      }
      var index = -1,
          indexes = [],
          length = array.length;

      predicate = getIteratee(predicate, 3);
      while (++index < length) {
        var value = array[index];
        if (predicate(value, index, array)) {
          result.push(value);
          indexes.push(index);
        }
      }
      basePullAt(array, indexes);
      return result;
    }

    /**
     * 反转 `array`，使第一个元素成为最后一个，第二个元素成为倒数第二个，以此类推。
     *
     * **注意：** 此方法会改变 `array`，基于
     * [`Array#reverse`](https://mdn.io/Array/reverse)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {Array} array 要修改的数组。
     * @returns {Array} 返回 `array`。
     * @example
     *
     * var array = [1, 2, 3];
     *
     * _.reverse(array);
     * // => [3, 2, 1]
     *
     * console.log(array);
     * // => [3, 2, 1]
     */
    function reverse(array) {
      return array == null ? array : nativeReverse.call(array);
    }

    /**
     * 创建一个 `array` 的切片，从 `start` 到但不包括 `end`。
     *
     * **注意：** 此方法用于替代
     * [`Array#slice`](https://mdn.io/Array/slice) 以确保返回密集数组。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Array
     * @param {Array} array 要切片的数组。
     * @param {number} [start=0] 起始位置。
     * @param {number} [end=array.length] 结束位置。
     * @returns {Array} 返回 `array` 的切片。
     */
    function slice(array, start, end) {
      var length = array == null ? 0 : array.length;
      if (!length) {
        return [];
      }
      if (end && typeof end != 'number' && isIterateeCall(array, start, end)) {
        start = 0;
        end = length;
      }
      else {
        start = start == null ? 0 : toInteger(start);
        end = end === undefined ? length : toInteger(end);
      }
      return baseSlice(array, start, end);
    }

    /**
     * 使用二分搜索来确定 `value` 应该被插入到 `array` 中的最低索引，
     * 以便维持其排序顺序。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Array
     * @param {Array} array 要检查的已排序数组。
     * @param {*} value 要评估的值。
     * @returns {number} 返回 `value` 应该被插入 `array` 的索引。
     * @example
     *
     * _.sortedIndex([30, 50], 40);
     * // => 1
     */
    function sortedIndex(array, value) {
      return baseSortedIndex(array, value);
    }

    /**
     * 这个方法类似 `_.sortedIndex`，但它接受 `iteratee`，为 `value` 和
     * `array` 的每个元素调用，计算它们的排序排名。迭代器接受一个参数：(value)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {Array} array 要检查的已排序数组。
     * @param {*} value 要评估的值。
     * @param {Function} [iteratee=_.identity] 每个元素调用的迭代器。
     * @returns {number} 返回 `value` 应该被插入 `array` 的索引。
     * @example
     *
     * var objects = [{ 'x': 4 }, { 'x': 5 }];
     *
     * _.sortedIndexBy(objects, { 'x': 4 }, function(o) { return o.x; });
     * // => 0
     *
     * // The `_.property` iteratee shorthand.
     * _.sortedIndexBy(objects, { 'x': 4 }, 'x');
     * // => 0
     */
    function sortedIndexBy(array, value, iteratee) {
      return baseSortedIndexBy(array, value, getIteratee(iteratee, 2));
    }

    /**
     * 这个方法类似 `_.indexOf`，但它对已排序的 `array` 执行二分搜索。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {Array} array 要检查的数组。
     * @param {*} value 要搜索的值。
     * @returns {number} 返回匹配值的索引，否则为 `-1`。
     * @example
     *
     * _.sortedIndexOf([4, 5, 5, 5, 6], 5);
     * // => 1
     */
    function sortedIndexOf(array, value) {
      var length = array == null ? 0 : array.length;
      if (length) {
        var index = baseSortedIndex(array, value);
        if (index < length && eq(array[index], value)) {
          return index;
        }
      }
      return -1;
    }

    /**
     * 这个方法类似 `_.sortedIndex`，但它返回 `value` 应该被插入 `array`
     * 的最高索引，以维持其排序顺序。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Array
     * @param {Array} array 要检查的已排序数组。
     * @param {*} value 要评估的值。
     * @returns {number} 返回 `value` 应该被插入 `array` 的索引。
     * @example
     *
     * _.sortedLastIndex([4, 5, 5, 5, 6], 5);
     * // => 4
     */
    function sortedLastIndex(array, value) {
      return baseSortedIndex(array, value, true);
    }

    /**
     * 这个方法类似 `_.sortedLastIndex`，但它接受 `iteratee`，为 `value` 和
     * `array` 的每个元素调用，计算它们的排序排名。迭代器接受一个参数：(value)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {Array} array 要检查的已排序数组。
     * @param {*} value 要评估的值。
     * @param {Function} [iteratee=_.identity] 每个元素调用的迭代器。
     * @returns {number} 返回 `value` 应该被插入 `array` 的索引。
     * @example
     *
     * var objects = [{ 'x': 4 }, { 'x': 5 }];
     *
     * _.sortedLastIndexBy(objects, { 'x': 4 }, function(o) { return o.x; });
     * // => 1
     *
     * // The `_.property` iteratee shorthand.
     * _.sortedLastIndexBy(objects, { 'x': 4 }, 'x');
     * // => 1
     */
    function sortedLastIndexBy(array, value, iteratee) {
      return baseSortedIndexBy(array, value, getIteratee(iteratee, 2), true);
    }

    /**
     * 这个方法类似 `_.lastIndexOf`，但它对已排序的 `array` 执行二分搜索。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {Array} array 要检查的数组。
     * @param {*} value 要搜索的值。
     * @returns {number} 返回匹配值的索引，否则为 `-1`。
     * @example
     *
     * _.sortedLastIndexOf([4, 5, 5, 5, 6], 5);
     * // => 3
     */
    function sortedLastIndexOf(array, value) {
      var length = array == null ? 0 : array.length;
      if (length) {
        var index = baseSortedIndex(array, value, true) - 1;
        if (eq(array[index], value)) {
          return index;
        }
      }
      return -1;
    }

    /**
     * 这个方法类似 `_.uniq`，但它针对已排序数组进行了设计和优化。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {Array} array 要检查的数组。
     * @returns {Array} 返回新的无重复值数组。
     * @example
     *
     * _.sortedUniq([1, 1, 2]);
     * // => [1, 2]
     */
    function sortedUniq(array) {
      return (array && array.length)
        ? baseSortedUniq(array)
        : [];
    }

    /**
     * 这个方法类似 `_.uniqBy`，但它针对已排序数组进行了设计和优化。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {Array} array 要检查的数组。
     * @param {Function} [iteratee] 每个元素调用的迭代器。
     * @returns {Array} 返回新的无重复值数组。
     * @example
     *
     * _.sortedUniqBy([1.1, 1.2, 2.3, 2.4], Math.floor);
     * // => [1.1, 2.3]
     */
    function sortedUniqBy(array, iteratee) {
      return (array && array.length)
        ? baseSortedUniq(array, getIteratee(iteratee, 2))
        : [];
    }

    /**
     * 获取 `array` 除第一个元素外的所有元素。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {Array} array 要查询的数组。
     * @returns {Array} 返回 `array` 的切片。
     * @example
     *
     * _.tail([1, 2, 3]);
     * // => [2, 3]
     */
    function tail(array) {
      var length = array == null ? 0 : array.length;
      return length ? baseSlice(array, 1, length) : [];
    }

    /**
     * 创建一个从开头取 `n` 个元素的 `array` 切片。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Array
     * @param {Array} array 要查询的数组。
     * @param {number} [n=1] 要取的元素数量。
     * @param- {Object} [guard] 允许用作像 `_.map` 这样的方法的迭代器。
     * @returns {Array} 返回 `array` 的切片。
     * @example
     *
     * _.take([1, 2, 3]);
     * // => [1]
     *
     * _.take([1, 2, 3], 2);
     * // => [1, 2]
     *
     * _.take([1, 2, 3], 5);
     * // => [1, 2, 3]
     *
     * _.take([1, 2, 3], 0);
     * // => []
     */
    function take(array, n, guard) {
      if (!(array && array.length)) {
        return [];
      }
      n = (guard || n === undefined) ? 1 : toInteger(n);
      return baseSlice(array, 0, n < 0 ? 0 : n);
    }

    /**
     * 创建一个从末尾取 `n` 个元素的 `array` 切片。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Array
     * @param {Array} array 要查询的数组。
     * @param {number} [n=1] 要取的元素数量。
     * @param- {Object} [guard] 允许用作像 `_.map` 这样的方法的迭代器。
     * @returns {Array} 返回 `array` 的切片。
     * @example
     *
     * _.takeRight([1, 2, 3]);
     * // => [3]
     *
     * _.takeRight([1, 2, 3], 2);
     * // => [2, 3]
     *
     * _.takeRight([1, 2, 3], 5);
     * // => [1, 2, 3]
     *
     * _.takeRight([1, 2, 3], 0);
     * // => []
     */
    function takeRight(array, n, guard) {
      var length = array == null ? 0 : array.length;
      if (!length) {
        return [];
      }
      n = (guard || n === undefined) ? 1 : toInteger(n);
      n = length - n;
      return baseSlice(array, n < 0 ? 0 : n, length);
    }

    /**
     * Creates a slice of `array` with elements taken from the end. Elements are
     * taken until `predicate` returns falsey. The predicate is invoked with
     * three arguments: (value, index, array).
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Array
     * @param {Array} array The array to query.
     * @param {Function} [predicate=_.identity] The function invoked per iteration.
     * @returns {Array} 返回 `array` 的切片。
     * @example
     *
     * var users = [
     *   { 'user': 'barney',  'active': true },
     *   { 'user': 'fred',    'active': false },
     *   { 'user': 'pebbles', 'active': false }
     * ];
     *
     * // The `_.matches` iteratee shorthand.
     * _.takeRightWhile(users, { 'user': 'pebbles', 'active': false });
     * // => objects for ['pebbles']
     *
     * // The `_.matchesProperty` iteratee shorthand.
     * _.takeRightWhile(users, ['active', false]);
     * // => objects for ['fred', 'pebbles']
     *
     * // The `_.property` iteratee shorthand.
     * _.takeRightWhile(users, 'active');
     * // => []
     */
    function takeRightWhile(array, predicate) {
      return (array && array.length)
        ? baseWhile(array, getIteratee(predicate, 3), false, true)
        : [];
    }

    /**
     * 创建一个从开头取元素的 `array` 切片。元素取自开头，直到 `predicate`
     * 返回假值。断言接受三个参数：(value, index, array)。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Array
     * @param {Array} array 要查询的数组。
     * @param {Function} [predicate=_.identity] 每次迭代调用的函数。
     * @returns {Array} 返回 `array` 的切片。
     * @example
     *
     * var users = [
     *   { 'user': 'barney',  'active': false },
     *   { 'user': 'fred',    'active': false },
     *   { 'user': 'pebbles', 'active': true }
     * ];
     *
     * _.takeWhile(users, function(o) { return !o.active; });
     * // => objects for ['barney', 'fred']
     *
     * // The `_.matches` iteratee shorthand.
     * _.takeWhile(users, { 'user': 'barney', 'active': false });
     * // => objects for ['barney']
     *
     * // The `_.matchesProperty` iteratee shorthand.
     * _.takeWhile(users, ['active', false]);
     * // => objects for ['barney', 'fred']
     *
     * // The `_.property` iteratee shorthand.
     * _.takeWhile(users, 'active');
     * // => []
     */
    function takeWhile(array, predicate) {
      return (array && array.length)
        ? baseWhile(array, getIteratee(predicate, 3))
        : [];
    }

    /**
     * 创建一个包含来自所有给定数组的唯一值的数组，按顺序排列，使用
     * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
     * 进行相等比较。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Array
     * @param {...Array} [arrays] 要检查的数组。
     * @returns {Array} 返回新的组合值数组。
     * @example
     *
     * _.union([2], [1, 2]);
     * // => [2, 1]
     */
    var union = baseRest(function(arrays) {
      return baseUniq(baseFlatten(arrays, 1, isArrayLikeObject, true));
    });

    /**
     * 这个方法类似 `_.union`，但它接受 `iteratee`，为每个 `arrays` 的每个元素调用，
     * 生成计算唯一性的标准。结果值从第一个出现该值的数组中选择。
     * 迭代器接受一个参数：(value)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {...Array} [arrays] 要检查的数组。
     * @param {Function} [iteratee=_.identity] 每个元素调用的迭代器。
     * @returns {Array} 返回新的组合值数组。
     * @example
     *
     * _.unionBy([2.1], [1.2, 2.3], Math.floor);
     * // => [2.1, 1.2]
     *
     * // The `_.property` iteratee shorthand.
     * _.unionBy([{ 'x': 1 }], [{ 'x': 2 }, { 'x': 1 }], 'x');
     * // => [{ 'x': 1 }, { 'x': 2 }]
     */
    var unionBy = baseRest(function(arrays) {
      var iteratee = last(arrays);
      if (isArrayLikeObject(iteratee)) {
        iteratee = undefined;
      }
      return baseUniq(baseFlatten(arrays, 1, isArrayLikeObject, true), getIteratee(iteratee, 2));
    });

    /**
     * 这个方法类似 `_.union`，但它接受 `comparator` 来比较 `arrays` 的元素。
     * 结果值从第一个出现该值的数组中选择。
     * 比较器接受两个参数：(arrVal, othVal)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {...Array} [arrays] 要检查的数组。
     * @param {Function} [comparator] 每个元素调用的比较器。
     * @returns {Array} 返回新的组合值数组。
     * @example
     *
     * var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }];
     * var others = [{ 'x': 1, 'y': 1 }, { 'x': 1, 'y': 2 }];
     *
     * _.unionWith(objects, others, _.isEqual);
     * // => [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }, { 'x': 1, 'y': 1 }]
     */
    var unionWith = baseRest(function(arrays) {
      var comparator = last(arrays);
      comparator = typeof comparator == 'function' ? comparator : undefined;
      return baseUniq(baseFlatten(arrays, 1, isArrayLikeObject, true), undefined, comparator);
    });

    /**
     * Creates a duplicate-free version of an array, using
     * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
     * for equality comparisons, in which only the first occurrence of each element
     * is kept. The order of result values is determined by the order they occur
     * in the array.
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Array
     * @param {Array} array 要检查的数组。
     * @returns {Array} 返回新的无重复值数组。
     * @example
     *
     * _.uniq([2, 1, 2]);
     * // => [2, 1]
     */
    function uniq(array) {
      return (array && array.length) ? baseUniq(array) : [];
    }

    /**
     * 这个方法类似 `_.uniq`，但它接受 `iteratee`，为 `array` 中的每个元素调用，
     * 生成计算唯一性的标准。结果值的顺序由它们在数组中出现的顺序决定。
     * 迭代器接受一个参数：(value)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {Array} array 要检查的数组。
     * @param {Function} [iteratee=_.identity] 每个元素调用的迭代器。
     * @returns {Array} 返回新的无重复值数组。
     * @example
     *
     * _.uniqBy([2.1, 1.2, 2.3], Math.floor);
     * // => [2.1, 1.2]
     *
     * // The `_.property` iteratee shorthand.
     * _.uniqBy([{ 'x': 1 }, { 'x': 2 }, { 'x': 1 }], 'x');
     * // => [{ 'x': 1 }, { 'x': 2 }]
     */
    function uniqBy(array, iteratee) {
      return (array && array.length) ? baseUniq(array, getIteratee(iteratee, 2)) : [];
    }

    /**
     * 这个方法类似 `_.uniq`，但它接受 `comparator` 来比较 `array` 的元素。
     * 结果值的顺序由它们在数组中出现的顺序决定。
     * 比较器接受两个参数：(arrVal, othVal)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {Array} array 要检查的数组。
     * @param {Function} [comparator] 每个元素调用的比较器。
     * @returns {Array} 返回新的无重复值数组。
     * @example
     *
     * var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }, { 'x': 1, 'y': 2 }];
     *
     * _.uniqWith(objects, _.isEqual);
     * // => [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }]
     */
    function uniqWith(array, comparator) {
      comparator = typeof comparator == 'function' ? comparator : undefined;
      return (array && array.length) ? baseUniq(array, undefined, comparator) : [];
    }

    /**
     * 这个方法类似 `_.zip`，但接受一个分组成元素的数组，
     * 并创建一个重新分组的数组，将元素恢复为预压缩配置。
     *
     * @static
     * @memberOf _
     * @since 1.2.0
     * @category Array
     * @param {Array} array 要处理的分组成元素的数组。
     * @returns {Array} 返回新的重新分组元素数组。
     * @example
     *
     * var zipped = _.zip(['a', 'b'], [1, 2], [true, false]);
     * // => [['a', 1, true], ['b', 2, false]]
     *
     * _.unzip(zipped);
     * // => [['a', 'b'], [1, 2], [true, false]]
     */
    function unzip(array) {
      if (!(array && array.length)) {
        return [];
      }
      var length = 0;
      array = arrayFilter(array, function(group) {
        if (isArrayLikeObject(group)) {
          length = nativeMax(group.length, length);
          return true;
        }
      });
      return baseTimes(length, function(index) {
        return arrayMap(array, baseProperty(index));
      });
    }

    /**
     * 这个方法类似 `_.unzip`，但接受 `iteratee` 来指定如何组合重新分组的值。
     * 迭代器接受每个组的元素调用：(...group)。
     *
     * @static
     * @memberOf _
     * @since 3.8.0
     * @category Array
     * @param {Array} array 要处理的分组成元素的数组。
     * @param {Function} [iteratee=_.identity] 用于组合重新分组值的函数。
     * @returns {Array} 返回新的重新分组元素数组。
     * @example
     *
     * var zipped = _.zip([1, 2], [10, 20], [100, 200]);
     * // => [[1, 10, 100], [2, 20, 200]]
     *
     * _.unzipWith(zipped, _.add);
     * // => [3, 30, 300]
     */
    function unzipWith(array, iteratee) {
      if (!(array && array.length)) {
        return [];
      }
      var result = unzip(array);
      if (iteratee == null) {
        return result;
      }
      return arrayMap(result, function(group) {
        return apply(iteratee, undefined, group);
      });
    }

    /**
     * 使用 [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
     * 进行相等比较，创建一个排除所有给定值的新数组。
     *
     * **注意：** 与 `_.pull` 不同，此方法返回一个新数组。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Array
     * @param {Array} array 要检查的数组。
     * @param {...*} [values] 要排除的值。
     * @returns {Array} 返回新的过滤值数组。
     * @see _.difference, _.xor
     * @example
     *
     * _.without([2, 1, 2, 3], 1, 2);
     * // => [3]
     */
    var without = baseRest(function(array, values) {
      return isArrayLikeObject(array)
        ? baseDifference(array, values)
        : [];
    });

    /**
     * 创建一个包含给定数组的
     * [对称差集](https://en.wikipedia.org/wiki/Symmetric_difference)
     * 的唯一值数组。结果值的顺序由它们在数组中出现的顺序决定。
     *
     * @static
     * @memberOf _
     * @since 2.4.0
     * @category Array
     * @param {...Array} [arrays] 要检查的数组。
     * @returns {Array} 返回新的过滤值数组。
     * @see _.difference, _.without
     * @example
     *
     * _.xor([2, 1], [2, 3]);
     * // => [1, 3]
     */
    var xor = baseRest(function(arrays) {
      return baseXor(arrayFilter(arrays, isArrayLikeObject));
    });

    /**
     * 这个方法类似 `_.xor`，但它接受 `iteratee`，为每个 `arrays` 的每个元素调用，
     * 生成计算比较的标准。结果值的顺序由它们在数组中出现的顺序决定。
     * 迭代器接受一个参数：(value)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {...Array} [arrays] 要检查的数组。
     * @param {Function} [iteratee=_.identity] 每个元素调用的迭代器。
     * @returns {Array} 返回新的过滤值数组。
     * @example
     *
     * _.xorBy([2.1, 1.2], [2.3, 3.4], Math.floor);
     * // => [1.2, 3.4]
     *
     * // The `_.property` iteratee shorthand.
     * _.xorBy([{ 'x': 1 }], [{ 'x': 2 }, { 'x': 1 }], 'x');
     * // => [{ 'x': 2 }]
     */
    var xorBy = baseRest(function(arrays) {
      var iteratee = last(arrays);
      if (isArrayLikeObject(iteratee)) {
        iteratee = undefined;
      }
      return baseXor(arrayFilter(arrays, isArrayLikeObject), getIteratee(iteratee, 2));
    });

    /**
     * 这个方法类似 `_.xor`，但它接受 `comparator` 来比较 `arrays` 的元素。
     * 结果值的顺序由它们在数组中出现的顺序决定。
     * 比较器接受两个参数：(arrVal, othVal)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Array
     * @param {...Array} [arrays] 要检查的数组。
     * @param {Function} [comparator] 每个元素调用的比较器。
     * @returns {Array} 返回新的过滤值数组。
     * @example
     *
     * var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }];
     * var others = [{ 'x': 1, 'y': 1 }, { 'x': 1, 'y': 2 }];
     *
     * _.xorWith(objects, others, _.isEqual);
     * // => [{ 'x': 2, 'y': 1 }, { 'x': 1, 'y': 1 }]
     */
    var xorWith = baseRest(function(arrays) {
      var comparator = last(arrays);
      comparator = typeof comparator == 'function' ? comparator : undefined;
      return baseXor(arrayFilter(arrays, isArrayLikeObject), undefined, comparator);
    });

    /**
     * 创建一个分组成元素的数组，其中第一个分组成元素包含给定数组的第一个元素，
     * 第二个分组成元素包含给定数组的第二个元素，以此类推。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Array
     * @param {...Array} [arrays] 要处理的数组。
     * @returns {Array} 返回新的分组成元素数组。
     * @example
     *
     * _.zip(['a', 'b'], [1, 2], [true, false]);
     * // => [['a', 1, true], ['b', 2, false]]
     */
    var zip = baseRest(unzip);

    /**
     * This method is like `_.fromPairs` except that it accepts two arrays,
     * one of property identifiers and one of corresponding values.
     *
     * @static
     * @memberOf _
     * @since 0.4.0
     * @category Array
     * @param {Array} [props=[]] 属性标识符。
     * @param {Array} [values=[]] 属性值。
     * @returns {Object} 返回新的对象。
     * @example
     *
     * _.zipObject(['a', 'b'], [1, 2]);
     * // => { 'a': 1, 'b': 2 }
     */
    function zipObject(props, values) {
      return baseZipObject(props || [], values || [], assignValue);
    }

    /**
     * 这个方法类似 `_.zipObject`，但它支持属性路径。
     *
     * @static
     * @memberOf _
     * @since 4.1.0
     * @category Array
     * @param {Array} [props=[]] 属性标识符。
     * @param {Array} [values=[]] 属性值。
     * @returns {Object} 返回新的对象。
     * @example
     *
     * _.zipObjectDeep(['a.b[0].c', 'a.b[1].d'], [1, 2]);
     * // => { 'a': { 'b': [{ 'c': 1 }, { 'd': 2 }] } }
     */
    function zipObjectDeep(props, values) {
      return baseZipObject(props || [], values || [], baseSet);
    }

    /**
     * 这个方法类似 `_.zip`，但接受 `iteratee` 来指定如何组合分组的值。
     * 迭代器接受每个组的元素调用：(...group)。
     *
     * @static
     * @memberOf _
     * @since 3.8.0
     * @category Array
     * @param {...Array} [arrays] 要处理的数组。
     * @param {Function} [iteratee=_.identity] 用于组合分组值的函数。
     * @returns {Array} 返回新的分组成元素数组。
     * @example
     *
     * _.zipWith([1, 2], [10, 20], [100, 200], function(a, b, c) {
     *   return a + b + c;
     * });
     * // => [111, 222]
     */
    var zipWith = baseRest(function(arrays) {
      var length = arrays.length,
          iteratee = length > 1 ? arrays[length - 1] : undefined;

      iteratee = typeof iteratee == 'function' ? (arrays.pop(), iteratee) : undefined;
      return unzipWith(arrays, iteratee);
    });

    /*------------------------------------------------------------------------*/

    /**
     * 创建一个包装 `value` 的 `lodash` 包装器实例，启用显式方法链序列。
     * 这种序列的结果必须用 `_#value` 解包。
     *
     * @static
     * @memberOf _
     * @since 1.3.0
     * @category Seq
     * @param {*} value 要包装的值。
     * @returns {Object} 返回新的 `lodash` 包装器实例。
     * @example
     *
     * var users = [
     *   { 'user': 'barney',  'age': 36 },
     *   { 'user': 'fred',    'age': 40 },
     *   { 'user': 'pebbles', 'age': 1 }
     * ];
     *
     * var youngest = _
     *   .chain(users)
     *   .sortBy('age')
     *   .map(function(o) {
     *     return o.user + ' is ' + o.age;
     *   })
     *   .head()
     *   .value();
     * // => 'pebbles is 1'
     */
    function chain(value) {
      var result = lodash(value);
      result.__chain__ = true;
      return result;
    }

    /**
     * This method invokes `interceptor` and returns `value`. The interceptor
     * is invoked with one argument; (value). The purpose of this method is to
     * "tap into" a method chain sequence in order to modify intermediate results.
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Seq
     * @param {*} value 要提供给 `interceptor` 的值。
     * @param {Function} interceptor 要调用的函数。
     * @returns {*} 返回 `value`。
     * @example
     *
     * _([1, 2, 3])
     *  .tap(function(array) {
     *    // Mutate input array.
     *    array.pop();
     *  })
     *  .reverse()
     *  .value();
     * // => [2, 1]
     */
    function tap(value, interceptor) {
      interceptor(value);
      return value;
    }

    /**
     * 这个方法类似 `_.tap`，但它返回 `interceptor` 的结果。
     * 此方法的目的是在方法链序列中"传递"值，替换中间结果。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Seq
     * @param {*} value 要提供给 `interceptor` 的值。
     * @param {Function} interceptor 要调用的函数。
     * @returns {*} 返回 `interceptor` 的结果。
     * @example
     *
     * _('  abc  ')
     *  .chain()
     *  .trim()
     *  .thru(function(value) {
     *    return [value];
     *  })
     *  .value();
     * // => ['abc']
     */
    function thru(value, interceptor) {
      return interceptor(value);
    }

    /**
     * 这是 `_.at` 的包装器版本。
     *
     * @name at
     * @memberOf _
     * @since 1.0.0
     * @category Seq
     * @param {...(string|string[])} [paths] 要选择的属性路径。
     * @returns {Object} 返回新的 `lodash` 包装器实例。
     * @example
     *
     * var object = { 'a': [{ 'b': { 'c': 3 } }, 4] };
     *
     * _(object).at(['a[0].b.c', 'a[1]']).value();
     * // => [3, 4]
     */
    var wrapperAt = flatRest(function(paths) {
      var length = paths.length,
          start = length ? paths[0] : 0,
          value = this.__wrapped__,
          interceptor = function(object) { return baseAt(object, paths); };

      if (length > 1 || this.__actions__.length ||
          !(value instanceof LazyWrapper) || !isIndex(start)) {
        return this.thru(interceptor);
      }
      value = value.slice(start, +start + (length ? 1 : 0));
      value.__actions__.push({
        'func': thru,
        'args': [interceptor],
        'thisArg': undefined
      });
      return new LodashWrapper(value, this.__chain__).thru(function(array) {
        if (length && !array.length) {
          array.push(undefined);
        }
        return array;
      });
    });

    /**
     * Creates a `lodash` wrapper instance with explicit method chain sequences enabled.
     *
     * @name chain
     * @memberOf _
     * @since 0.1.0
     * @category Seq
     * @returns {Object} 返回新的 `lodash` 包装器实例。
     * @example
     *
     * var users = [
     *   { 'user': 'barney', 'age': 36 },
     *   { 'user': 'fred',   'age': 40 }
     * ];
     *
     * // A sequence without explicit chaining.
     * _(users).head();
     * // => { 'user': 'barney', 'age': 36 }
     *
     * // A sequence with explicit chaining.
     * _(users)
     *   .chain()
     *   .head()
     *   .pick('user')
     *   .value();
     * // => { 'user': 'barney' }
     */
    function wrapperChain() {
      return chain(this);
    }

    /**
     * 执行链序列并返回包装后的结果。
     *
     * @name commit
     * @memberOf _
     * @since 3.2.0
     * @category Seq
     * @returns {Object} 返回新的 `lodash` 包装器实例。
     * @example
     *
     * var array = [1, 2];
     * var wrapped = _(array).push(3);
     *
     * console.log(array);
     * // => [1, 2]
     *
     * wrapped = wrapped.commit();
     * console.log(array);
     * // => [1, 2, 3]
     *
     * wrapped.last();
     * // => 3
     *
     * console.log(array);
     * // => [1, 2, 3]
     */
    function wrapperCommit() {
      return new LodashWrapper(this.value(), this.__chain__);
    }

    /**
     * 获取包装对象上的下一个值，遵循
     * [迭代器协议](https://mdn.io/iteration_protocols#iterator)。
     *
     * @name next
     * @memberOf _
     * @since 4.0.0
     * @category Seq
     * @returns {Object} 返回下一个迭代器值。
     * @example
     *
     * var wrapped = _([1, 2]);
     *
     * wrapped.next();
     * // => { 'done': false, 'value': 1 }
     *
     * wrapped.next();
     * // => { 'done': false, 'value': 2 }
     *
     * wrapped.next();
     * // => { 'done': true, 'value': undefined }
     */
    function wrapperNext() {
      if (this.__values__ === undefined) {
        this.__values__ = toArray(this.value());
      }
      var done = this.__index__ >= this.__values__.length,
          value = done ? undefined : this.__values__[this.__index__++];

      return { 'done': done, 'value': value };
    }

    /**
     * 启用包装器可迭代。
     *
     * @name Symbol.iterator
     * @memberOf _
     * @since 4.0.0
     * @category Seq
     * @returns {Object} 返回包装器对象。
     * @example
     *
     * var wrapped = _([1, 2]);
     *
     * wrapped[Symbol.iterator]() === wrapped;
     * // => true
     *
     * Array.from(wrapped);
     * // => [1, 2]
     */
    function wrapperToIterator() {
      return this;
    }

    /**
     * 创建链序列的克隆，将 `value` 作为包装值植入。
     *
     * @name plant
     * @memberOf _
     * @since 3.2.0
     * @category Seq
     * @param {*} value 要植入的值。
     * @returns {Object} 返回新的 `lodash` 包装器实例。
     * @example
     *
     * function square(n) {
     *   return n * n;
     * }
     *
     * var wrapped = _([1, 2]).map(square);
     * var other = wrapped.plant([3, 4]);
     *
     * other.value();
     * // => [9, 16]
     *
     * wrapped.value();
     * // => [1, 4]
     */
    function wrapperPlant(value) {
      var result,
          parent = this;

      while (parent instanceof baseLodash) {
        var clone = wrapperClone(parent);
        clone.__index__ = 0;
        clone.__values__ = undefined;
        if (result) {
          previous.__wrapped__ = clone;
        } else {
          result = clone;
        }
        var previous = clone;
        parent = parent.__wrapped__;
      }
      previous.__wrapped__ = value;
      return result;
    }

    /**
     * This method is the wrapper version of `_.reverse`.
     *
     * **Note:** This method mutates the wrapped array.
     *
     * @name reverse
     * @memberOf _
     * @since 0.1.0
     * @category Seq
     * @returns {Object} 返回新的 `lodash` 包装器实例。
     * @example
     *
     * var array = [1, 2, 3];
     *
     * _(array).reverse().value()
     * // => [3, 2, 1]
     *
     * console.log(array);
     * // => [3, 2, 1]
     */
    function wrapperReverse() {
      var value = this.__wrapped__;
      if (value instanceof LazyWrapper) {
        var wrapped = value;
        if (this.__actions__.length) {
          wrapped = new LazyWrapper(this);
        }
        wrapped = wrapped.reverse();
        wrapped.__actions__.push({
          'func': thru,
          'args': [reverse],
          'thisArg': undefined
        });
        return new LodashWrapper(wrapped, this.__chain__);
      }
      return this.thru(reverse);
    }

    /**
     * 执行链序列以解析解包的值。
     *
     * @name value
     * @memberOf _
     * @since 0.1.0
     * @alias toJSON, valueOf
     * @category Seq
     * @returns {*} 返回解析后的解包值。
     * @example
     *
     * _([1, 2, 3]).value();
     * // => [1, 2, 3]
     */
    function wrapperValue() {
      return baseWrapperValue(this.__wrapped__, this.__actions__);
    }

    /*------------------------------------------------------------------------*/

    /**
     * 创建一个对象，键由将 `collection` 的每个元素通过 `iteratee` 运行的结果生成。
     * 每个键对应的值是 `iteratee` 返回该键的次数。迭代器接受一个参数：(value)。
     *
     * @static
     * @memberOf _
     * @since 0.5.0
     * @category Collection
     * @param {Array|Object} collection 要迭代的集合。
     * @param {Function} [iteratee=_.identity] 用于转换键的迭代器。
     * @returns {Object} 返回组合的聚合对象。
     * @example
     *
     * _.countBy([6.1, 4.2, 6.3], Math.floor);
     * // => { '4': 1, '6': 2 }
     *
     * // The `_.property` iteratee shorthand.
     * _.countBy(['one', 'two', 'three'], 'length');
     * // => { '3': 2, '5': 1 }
     */
    var countBy = createAggregator(function(result, value, key) {
      if (hasOwnProperty.call(result, key)) {
        ++result[key];
      } else {
        baseAssignValue(result, key, 1);
      }
    });

    /**
     * 检查 `predicate` 是否对 `collection` 的**所有**元素都返回真值。
     * 一旦 `predicate` 返回假值，迭代就会停止。断言接受三个参数：
     * (value, index|key, collection)。
     *
     * **注意：** 此方法对
     * [空集合](https://en.wikipedia.org/wiki/Empty_set) 返回 `true`，
     * 因为空集合的每个元素
     * [都是真的](https://en.wikipedia.org/wiki/Vacuous_truth)。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Collection
     * @param {Array|Object} collection 要迭代的集合。
     * @param {Function} [predicate=_.identity] 每次迭代调用的函数。
     * @param- {Object} [guard] 允许用作像 `_.map` 这样的方法的迭代器。
     * @returns {boolean} 如果所有元素通过谓词检查则返回 `true`，否则返回 `false`。
     * @example
     *
     * _.every([true, 1, null, 'yes'], Boolean);
     * // => false
     *
     * var users = [
     *   { 'user': 'barney', 'age': 36, 'active': false },
     *   { 'user': 'fred',   'age': 40, 'active': false }
     * ];
     *
     * // The `_.matches` iteratee shorthand.
     * _.every(users, { 'user': 'barney', 'active': false });
     * // => false
     *
     * // The `_.matchesProperty` iteratee shorthand.
     * _.every(users, ['active', false]);
     * // => true
     *
     * // The `_.property` iteratee shorthand.
     * _.every(users, 'active');
     * // => false
     */
    function every(collection, predicate, guard) {
      var func = isArray(collection) ? arrayEvery : baseEvery;
      if (guard && isIterateeCall(collection, predicate, guard)) {
        predicate = undefined;
      }
      return func(collection, getIteratee(predicate, 3));
    }

    /**
     * Iterates over elements of `collection`, returning an array of all elements
     * `predicate` returns truthy for. The predicate is invoked with three
     * arguments: (value, index|key, collection).
     *
     * **Note:** Unlike `_.remove`, this method returns a new array.
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Collection
     * @param {Array|Object} collection The collection to iterate over.
     * @param {Function} [predicate=_.identity] The function invoked per iteration.
     * @returns {Array} Returns the new filtered array.
     * @see _.reject
     * @example
     *
     * var users = [
     *   { 'user': 'barney', 'age': 36, 'active': true },
     *   { 'user': 'fred',   'age': 40, 'active': false }
     * ];
     *
     * _.filter(users, function(o) { return !o.active; });
     * // => objects for ['fred']
     *
     * // The `_.matches` iteratee shorthand.
     * _.filter(users, { 'age': 36, 'active': true });
     * // => objects for ['barney']
     *
     * // The `_.matchesProperty` iteratee shorthand.
     * _.filter(users, ['active', false]);
     * // => objects for ['fred']
     *
     * // The `_.property` iteratee shorthand.
     * _.filter(users, 'active');
     * // => objects for ['barney']
     *
     * // Combining several predicates using `_.overEvery` or `_.overSome`.
     * _.filter(users, _.overSome([{ 'age': 36 }, ['age', 40]]));
     * // => objects for ['fred', 'barney']
     */
    function filter(collection, predicate) {
      var func = isArray(collection) ? arrayFilter : baseFilter;
      return func(collection, getIteratee(predicate, 3));
    }

    /**
     * 迭代 `collection` 的元素，返回 `predicate` 第一次返回真值的元素。
     * 断言接受三个参数：(value, index|key, collection)。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Collection
     * @param {Array|Object} collection 要检查的集合。
     * @param {Function} [predicate=_.identity] 每次迭代调用的函数。
     * @param {number} [fromIndex=0] 从哪里开始搜索的索引。
     * @returns {*} 返回匹配的元素，否则为 `undefined`。
     * @example
     *
     * var users = [
     *   { 'user': 'barney',  'age': 36, 'active': true },
     *   { 'user': 'fred',    'age': 40, 'active': false },
     *   { 'user': 'pebbles', 'age': 1,  'active': true }
     * ];
     *
     * _.find(users, function(o) { return o.age < 40; });
     * // => object for 'barney'
     *
     * // The `_.matches` iteratee shorthand.
     * _.find(users, { 'age': 1, 'active': true });
     * // => object for 'pebbles'
     *
     * // The `_.matchesProperty` iteratee shorthand.
     * _.find(users, ['active', false]);
     * // => object for 'fred'
     *
     * // The `_.property` iteratee shorthand.
     * _.find(users, 'active');
     * // => object for 'barney'
     */
    var find = createFind(findIndex);

    /**
     * 这个方法类似 `_.find`，但它从右到左迭代 `collection` 的元素。
     *
     * @static
     * @memberOf _
     * @since 2.0.0
     * @category Collection
     * @param {Array|Object} collection 要检查的集合。
     * @param {Function} [predicate=_.identity] 每次迭代调用的函数。
     * @param {number} [fromIndex=collection.length-1] 从哪里开始搜索的索引。
     * @returns {*} 返回匹配的元素，否则为 `undefined`。
     * @example
     *
     * _.findLast([1, 2, 3, 4], function(n) {
     *   return n % 2 == 1;
     * });
     * // => 3
     */
    var findLast = createFind(findLastIndex);

    /**
     * 通过 `iteratee` 运行 `collection` 的每个元素并展平映射结果来创建一个扁平化数组。
     * 迭代器接受三个参数：(value, index|key, collection)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Collection
     * @param {Array|Object} collection 要迭代的集合。
     * @param {Function} [iteratee=_.identity] 每次迭代调用的函数。
     * @returns {Array} 返回新的扁平化数组。
     * @example
     *
     * function duplicate(n) {
     *   return [n, n];
     * }
     *
     * _.flatMap([1, 2], duplicate);
     * // => [1, 1, 2, 2]
     */
    function flatMap(collection, iteratee) {
      return baseFlatten(map(collection, iteratee), 1);
    }

    /**
     * 这个方法类似 `_.flatMap`，但它递归地展平映射的结果。
     *
     * @static
     * @memberOf _
     * @since 4.7.0
     * @category Collection
     * @param {Array|Object} collection 要迭代的集合。
     * @param {Function} [iteratee=_.identity] 每次迭代调用的函数。
     * @returns {Array} 返回新的扁平化数组。
     * @example
     *
     * function duplicate(n) {
     *   return [[[n, n]]];
     * }
     *
     * _.flatMapDeep([1, 2], duplicate);
     * // => [1, 1, 2, 2]
     */
    function flatMapDeep(collection, iteratee) {
      return baseFlatten(map(collection, iteratee), INFINITY);
    }

    /**
     * 这个方法类似 `_.flatMap`，但它递归地展平映射的结果最多 `depth` 次。
     *
     * @static
     * @memberOf _
     * @since 4.7.0
     * @category Collection
     * @param {Array|Object} collection 要迭代的集合。
     * @param {Function} [iteratee=_.identity] 每次迭代调用的函数。
     * @param {number} [depth=1] 最大递归深度。
     * @returns {Array} 返回新的扁平化数组。
     * @example
     *
     * function duplicate(n) {
     *   return [[[n, n]]];
     * }
     *
     * _.flatMapDepth([1, 2], duplicate, 2);
     * // => [[1, 1], [2, 2]]
     */
    function flatMapDepth(collection, iteratee, depth) {
      depth = depth === undefined ? 1 : toInteger(depth);
      return baseFlatten(map(collection, iteratee), depth);
    }

    /**
     * 迭代 `collection` 的每个元素并为每个元素调用 `iteratee`。
     * 迭代器接受三个参数：(value, index|key, collection)。
     * 迭代器函数可以通过明确返回 `false` 提前退出迭代。
     *
     * **注意：** 与其他"Collections"方法一样，具有"length"属性的对象会被像数组一样迭代。
     * 要避免这种行为，请使用 `_.forIn` 或 `_.forOwn` 进行对象迭代。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @alias each
     * @category Collection
     * @param {Array|Object} collection 要迭代的集合。
     * @param {Function} [iteratee=_.identity] 每次迭代调用的函数。
     * @returns {Array|Object} 返回 `collection`。
     * @see _.forEachRight
     * @example
     *
     * _.forEach([1, 2], function(value) {
     *   console.log(value);
     * });
     * // => Logs `1` then `2`.
     *
     * _.forEach({ 'a': 1, 'b': 2 }, function(value, key) {
     *   console.log(key);
     * });
     * // => Logs 'a' then 'b' (iteration order is not guaranteed).
     */
    function forEach(collection, iteratee) {
      var func = isArray(collection) ? arrayEach : baseEach;
      return func(collection, getIteratee(iteratee, 3));
    }

    /**
     * 这个方法类似 `_.forEach`，但它从右到左迭代 `collection` 的元素。
     *
     * @static
     * @memberOf _
     * @since 2.0.0
     * @alias eachRight
     * @category Collection
     * @param {Array|Object} collection 要迭代的集合。
     * @param {Function} [iteratee=_.identity] 每次迭代调用的函数。
     * @returns {Array|Object} 返回 `collection`。
     * @example
     *
     * _.forEachRight([1, 2], function(value) {
     *   console.log(value);
     * });
     * // => Logs `2` then `1`.
     */
    function forEachRight(collection, iteratee) {
      var func = isArray(collection) ? arrayEachRight : baseEachRight;
      return func(collection, getIteratee(iteratee, 3));
    }

    /**
     * 创建一个对象，键由将 `collection` 的每个元素通过 `iteratee` 运行的结果生成。
     * 分组值的顺序由它们在 `collection` 中出现的顺序决定。
     * 每个键对应的值是负责生成该键的元素数组。迭代器接受一个参数：(value)。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Collection
     * @param {Array|Object} collection 要迭代的集合。
     * @param {Function} [iteratee=_.identity] 用于转换键的迭代器。
     * @returns {Object} 返回组合的聚合对象。
     * @example
     *
     * _.groupBy([6.1, 4.2, 6.3], Math.floor);
     * // => { '4': [4.2], '6': [6.1, 6.3] }
     *
     * // The `_.property` iteratee shorthand.
     * _.groupBy(['one', 'two', 'three'], 'length');
     * // => { '3': ['one', 'two'], '5': ['three'] }
     */
    var groupBy = createAggregator(function(result, value, key) {
      if (hasOwnProperty.call(result, key)) {
        result[key].push(value);
      } else {
        baseAssignValue(result, key, [value]);
      }
    });

    /**
     * 检查 `value` 是否在 `collection` 中。如果 `collection` 是字符串，
     * 则检查 `value` 的子字符串，否则使用
     * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
     * 进行相等比较。如果 `fromIndex` 为负，则作为从 `collection` 末尾开始的偏移量。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Collection
     * @param {Array|Object|string} collection 要检查的集合。
     * @param {*} value 要搜索的值。
     * @param {number} [fromIndex=0] 从哪里开始搜索的索引。
     * @param- {Object} [guard] 允许用作像 `_.reduce` 这样的方法的迭代器。
     * @returns {boolean} 如果找到 `value` 则返回 `true`，否则返回 `false`。
     * @example
     *
     * _.includes([1, 2, 3], 1);
     * // => true
     *
     * _.includes([1, 2, 3], 1, 2);
     * // => false
     *
     * _.includes({ 'a': 1, 'b': 2 }, 1);
     * // => true
     *
     * _.includes('abcd', 'bc');
     * // => true
     */
    function includes(collection, value, fromIndex, guard) {
      collection = isArrayLike(collection) ? collection : values(collection);
      fromIndex = (fromIndex && !guard) ? toInteger(fromIndex) : 0;

      var length = collection.length;
      if (fromIndex < 0) {
        fromIndex = nativeMax(length + fromIndex, 0);
      }
      return isString(collection)
        ? (fromIndex <= length && collection.indexOf(value, fromIndex) > -1)
        : (!!length && baseIndexOf(collection, value, fromIndex) > -1);
    }

    /**
     * 调用 `collection` 中每个元素的 `path` 上的方法，返回每个调用结果组成的数组。
     * 任何额外的参数都会传递给每个调用的方法。如果 `path` 是一个函数，
     * 则为 `collection` 中的每个元素调用它，并绑定 `this`。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Collection
     * @param {Array|Object} collection 要迭代的集合。
     * @param {Array|Function|string} path 要调用的方法的路径，或每次迭代调用的函数。
     * @param {...*} [args] 传递给每个方法的参数。
     * @returns {Array} 返回结果数组。
     * @example
     *
     * _.invokeMap([[5, 1, 7], [3, 2, 1]], 'sort');
     * // => [[1, 5, 7], [1, 2, 3]]
     *
     * _.invokeMap([123, 456], String.prototype.split, '');
     * // => [['1', '2', '3'], ['4', '5', '6']]
     */
    var invokeMap = baseRest(function(collection, path, args) {
      var index = -1,
          isFunc = typeof path == 'function',
          result = isArrayLike(collection) ? Array(collection.length) : [];

      baseEach(collection, function(value) {
        result[++index] = isFunc ? apply(path, value, args) : baseInvoke(value, path, args);
      });
      return result;
    });

    /**
     * 创建一个对象，键由将 `collection` 的每个元素通过 `iteratee` 运行的结果生成。
     * 每个键对应的值是负责生成该键的最后一个元素。迭代器接受一个参数：(value)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Collection
     * @param {Array|Object} collection 要迭代的集合。
     * @param {Function} [iteratee=_.identity] 用于转换键的迭代器。
     * @returns {Object} 返回组合的聚合对象。
     * @example
     *
     * var array = [
     *   { 'dir': 'left', 'code': 97 },
     *   { 'dir': 'right', 'code': 100 }
     * ];
     *
     * _.keyBy(array, function(o) {
     *   return String.fromCharCode(o.code);
     * });
     * // => { 'a': { 'dir': 'left', 'code': 97 }, 'd': { 'dir': 'right', 'code': 100 } }
     *
     * _.keyBy(array, 'dir');
     * // => { 'left': { 'dir': 'left', 'code': 97 }, 'right': { 'dir': 'right', 'code': 100 } }
     */
    var keyBy = createAggregator(function(result, value, key) {
      baseAssignValue(result, key, value);
    });

    /**
     * 通过 `iteratee` 运行 `collection` 的每个元素来创建一个值数组。
     * 迭代器接受三个参数：(value, index|key, collection)。
     *
     * 许多 lodash 方法被保护为可以作为像 `_.every`、`_.filter`、`_.map`、
     * `_.mapValues`、`_.reject` 和 `_.some` 等方法的迭代器。
     *
     * 受保护的方法有：
     * `ary`、`chunk`、`curry`、`curryRight`、`drop`、`dropRight`、`every`、
     * `fill`、`invert`、`parseInt`、`random`、`range`、`rangeRight`、`repeat`、
     * `sampleSize`、`slice`、`some`、`sortBy`、`split`、`take`、`takeRight`、
     * `template`、`trim`、`trimEnd`、`trimStart` 和 `words`
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Collection
     * @param {Array|Object} collection 要迭代的集合。
     * @param {Function} [iteratee=_.identity] 每次迭代调用的函数。
     * @returns {Array} 返回新的映射数组。
     * @example
     *
     * function square(n) {
     *   return n * n;
     * }
     *
     * _.map([4, 8], square);
     * // => [16, 64]
     *
     * _.map({ 'a': 4, 'b': 8 }, square);
     * // => [16, 64] (iteration order is not guaranteed)
     *
     * var users = [
     *   { 'user': 'barney' },
     *   { 'user': 'fred' }
     * ];
     *
     * // The `_.property` iteratee shorthand.
     * _.map(users, 'user');
     * // => ['barney', 'fred']
     */
    function map(collection, iteratee) {
      var func = isArray(collection) ? arrayMap : baseMap;
      return func(collection, getIteratee(iteratee, 3));
    }

    /**
     * 这个方法类似 `_.sortBy`，但它允许指定要排序的迭代器的排序顺序。
     * 如果 `orders` 未指定，所有值按升序排序。否则，
     * 指定 "desc" 为降序，"asc" 为对应值的升序排序。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Collection
     * @param {Array|Object} collection 要迭代的集合。
     * @param {Array[]|Function[]|Object[]|string[]} [iteratees=[_.identity]]
     *  要排序的迭代器。
     * @param {string[]} [orders] `iteratees` 的排序顺序。
     * @param- {Object} [guard] 允许用作像 `_.reduce` 这样的方法的迭代器。
     * @returns {Array} 返回新的排序数组。
     * @example
     *
     * var users = [
     *   { 'user': 'fred',   'age': 48 },
     *   { 'user': 'barney', 'age': 34 },
     *   { 'user': 'fred',   'age': 40 },
     *   { 'user': 'barney', 'age': 36 }
     * ];
     *
     * // Sort by `user` in ascending order and by `age` in descending order.
     * _.orderBy(users, ['user', 'age'], ['asc', 'desc']);
     * // => objects for [['barney', 36], ['barney', 34], ['fred', 48], ['fred', 40]]
     */
    function orderBy(collection, iteratees, orders, guard) {
      if (collection == null) {
        return [];
      }
      if (!isArray(iteratees)) {
        iteratees = iteratees == null ? [] : [iteratees];
      }
      orders = guard ? undefined : orders;
      if (!isArray(orders)) {
        orders = orders == null ? [] : [orders];
      }
      return baseOrderBy(collection, iteratees, orders);
    }

    /**
     * 创建一个包含两个分组的数组，第一个分组包含 `predicate` 返回真值的元素，
     * 第二个分组包含 `predicate` 返回假值的元素。断言接受一个参数：(value)。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Collection
     * @param {Array|Object} collection 要迭代的集合。
     * @param {Function} [predicate=_.identity] 每次迭代调用的函数。
     * @returns {Array} 返回分组元素的数组。
     * @example
     *
     * var users = [
     *   { 'user': 'barney',  'age': 36, 'active': false },
     *   { 'user': 'fred',    'age': 40, 'active': true },
     *   { 'user': 'pebbles', 'age': 1,  'active': false }
     * ];
     *
     * _.partition(users, function(o) { return o.active; });
     * // => objects for [['fred'], ['barney', 'pebbles']]
     *
     * // The `_.matches` iteratee shorthand.
     * _.partition(users, { 'age': 1, 'active': false });
     * // => objects for [['pebbles'], ['barney', 'fred']]
     *
     * // The `_.matchesProperty` iteratee shorthand.
     * _.partition(users, ['active', false]);
     * // => objects for [['barney', 'pebbles'], ['fred']]
     *
     * // The `_.property` iteratee shorthand.
     * _.partition(users, 'active');
     * // => objects for [['fred'], ['barney', 'pebbles']]
     */
    var partition = createAggregator(function(result, value, key) {
      result[key ? 0 : 1].push(value);
    }, function() { return [[], []]; });

    /**
     * 将 `collection` 归约为一个值，该值是依次将每个元素通过 `iteratee`
     * 运行的结果，每次后续调用都接收前一个返回值。如果未提供 `accumulator`，
     * `collection` 的第一个元素用作初始值。迭代器接受四个参数：
     * (accumulator, value, index|key, collection)。
     *
     * 许多 lodash 方法被保护为可以作为像 `_.reduce`、`_.reduceRight`
     * 和 `_.transform` 等方法的迭代器。
     *
     * 受保护的方法有：
     * `assign`、`defaults`、`defaultsDeep`、`includes`、`merge`、`orderBy` 和 `sortBy`
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Collection
     * @param {Array|Object} collection 要迭代的集合。
     * @param {Function} [iteratee=_.identity] 每次迭代调用的函数。
     * @param {*} [accumulator] 初始值。
     * @returns {*} 返回累计的值。
     * @see _.reduceRight
     * @example
     *
     * _.reduce([1, 2], function(sum, n) {
     *   return sum + n;
     * }, 0);
     * // => 3
     *
     * _.reduce({ 'a': 1, 'b': 2, 'c': 1 }, function(result, value, key) {
     *   (result[value] || (result[value] = [])).push(key);
     *   return result;
     * }, {});
     * // => { '1': ['a', 'c'], '2': ['b'] } (iteration order is not guaranteed)
     */
    function reduce(collection, iteratee, accumulator) {
      var func = isArray(collection) ? arrayReduce : baseReduce,
          initAccum = arguments.length < 3;

      return func(collection, getIteratee(iteratee, 4), accumulator, initAccum, baseEach);
    }

    /**
     * 这个方法类似 `_.reduce`，但它从右到左迭代 `collection` 的元素。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Collection
     * @param {Array|Object} collection 要迭代的集合。
     * @param {Function} [iteratee=_.identity] 每次迭代调用的函数。
     * @param {*} [accumulator] 初始值。
     * @returns {*} 返回累计的值。
     * @see _.reduce
     * @example
     *
     * var array = [[0, 1], [2, 3], [4, 5]];
     *
     * _.reduceRight(array, function(flattened, other) {
     *   return flattened.concat(other);
     * }, []);
     * // => [4, 5, 2, 3, 0, 1]
     */
    function reduceRight(collection, iteratee, accumulator) {
      var func = isArray(collection) ? arrayReduceRight : baseReduce,
          initAccum = arguments.length < 3;

      return func(collection, getIteratee(iteratee, 4), accumulator, initAccum, baseEachRight);
    }

    /**
     * `_.filter` 的反向方法；此方法返回 `collection` 中 `predicate`
     * **不**返回真值的元素。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Collection
     * @param {Array|Object} collection 要迭代的集合。
     * @param {Function} [predicate=_.identity] 每次迭代调用的函数。
     * @returns {Array} 返回新的过滤数组。
     * @see _.filter
     * @example
     *
     * var users = [
     *   { 'user': 'barney', 'age': 36, 'active': false },
     *   { 'user': 'fred',   'age': 40, 'active': true }
     * ];
     *
     * _.reject(users, function(o) { return !o.active; });
     * // => objects for ['fred']
     *
     * // The `_.matches` iteratee shorthand.
     * _.reject(users, { 'age': 40, 'active': true });
     * // => objects for ['barney']
     *
     * // The `_.matchesProperty` iteratee shorthand.
     * _.reject(users, ['active', false]);
     * // => objects for ['fred']
     *
     * // The `_.property` iteratee shorthand.
     * _.reject(users, 'active');
     * // => objects for ['barney']
     */
    function reject(collection, predicate) {
      var func = isArray(collection) ? arrayFilter : baseFilter;
      return func(collection, negate(getIteratee(predicate, 3)));
    }

    /**
     * 从 `collection` 中获取一个随机元素。
     *
     * @static
     * @memberOf _
     * @since 2.0.0
     * @category Collection
     * @param {Array|Object} collection 要采样的集合。
     * @returns {*} 返回随机元素。
     * @example
     *
     * _.sample([1, 2, 3, 4]);
     * // => 2
     */
    function sample(collection) {
      var func = isArray(collection) ? arraySample : baseSample;
      return func(collection);
    }

    /**
     * 从 `collection` 中获取 `n` 个随机元素，键唯一，一直到 `collection` 的大小。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Collection
     * @param {Array|Object} collection 要采样的集合。
     * @param {number} [n=1] 要采样的元素数量。
     * @param- {Object} [guard] 允许用作像 `_.map` 这样的方法的迭代器。
     * @returns {Array} 返回随机元素。
     * @example
     *
     * _.sampleSize([1, 2, 3], 2);
     * // => [3, 1]
     *
     * _.sampleSize([1, 2, 3], 4);
     * // => [2, 3, 1]
     */
    function sampleSize(collection, n, guard) {
      if ((guard ? isIterateeCall(collection, n, guard) : n === undefined)) {
        n = 1;
      } else {
        n = toInteger(n);
      }
      var func = isArray(collection) ? arraySampleSize : baseSampleSize;
      return func(collection, n);
    }

    /**
     * 创建一个打乱顺序后的值数组，使用的是
     * [Fisher-Yates shuffle](https://en.wikipedia.org/wiki/Fisher-Yates_shuffle) 的版本。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Collection
     * @param {Array|Object} collection 要打乱的集合。
     * @returns {Array} 返回新的打乱后的数组。
     * @example
     *
     * _.shuffle([1, 2, 3, 4]);
     * // => [4, 1, 3, 2]
     */
    function shuffle(collection) {
      var func = isArray(collection) ? arrayShuffle : baseShuffle;
      return func(collection);
    }

    /**
     * 通过返回其长度获取 `collection` 的大小，对于类数组值，
     * 或返回对象自身可枚举字符串键属性的数量。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Collection
     * @param {Array|Object|string} collection 要检查的集合。
     * @returns {number} 返回集合的大小。
     * @example
     *
     * _.size([1, 2, 3]);
     * // => 3
     *
     * _.size({ 'a': 1, 'b': 2 });
     * // => 2
     *
     * _.size('pebbles');
     * // => 7
     */
    function size(collection) {
      if (collection == null) {
        return 0;
      }
      if (isArrayLike(collection)) {
        return isString(collection) ? stringSize(collection) : collection.length;
      }
      var tag = getTag(collection);
      if (tag == mapTag || tag == setTag) {
        return collection.size;
      }
      return baseKeys(collection).length;
    }

    /**
     * 检查 `predicate` 是否对 `collection` 的**任意**元素返回真值。
     * 一旦 `predicate` 返回真值，迭代就会停止。断言接受三个参数：
     * (value, index|key, collection)。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Collection
     * @param {Array|Object} collection 要迭代的集合。
     * @param {Function} [predicate=_.identity] 每次迭代调用的函数。
     * @param- {Object} [guard] 允许用作像 `_.map` 这样的方法的迭代器。
     * @returns {boolean} 如果任意元素通过谓词检查则返回 `true`，否则返回 `false`。
     * @example
     *
     * _.some([null, 0, 'yes', false], Boolean);
     * // => true
     *
     * var users = [
     *   { 'user': 'barney', 'active': true },
     *   { 'user': 'fred',   'active': false }
     * ];
     *
     * // The `_.matches` iteratee shorthand.
     * _.some(users, { 'user': 'barney', 'active': false });
     * // => false
     *
     * // The `_.matchesProperty` iteratee shorthand.
     * _.some(users, ['active', false]);
     * // => true
     *
     * // The `_.property` iteratee shorthand.
     * _.some(users, 'active');
     * // => true
     */
    function some(collection, predicate, guard) {
      var func = isArray(collection) ? arraySome : baseSome;
      if (guard && isIterateeCall(collection, predicate, guard)) {
        predicate = undefined;
      }
      return func(collection, getIteratee(predicate, 3));
    }

    /**
     * 创建一个元素数组，按升序根据每个元素在 collection 中通过每个迭代器运行的结果排序。
     * 此方法执行稳定排序，即保留相等元素的原始排序顺序。
     * 迭代器接受一个参数：(value)。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Collection
     * @param {Array|Object} collection 要迭代的集合。
     * @param {...(Function|Function[])} [iteratees=[_.identity]]
     *  要排序的迭代器。
     * @returns {Array} 返回新的排序数组。
     * @example
     *
     * var users = [
     *   { 'user': 'fred',   'age': 48 },
     *   { 'user': 'barney', 'age': 36 },
     *   { 'user': 'fred',   'age': 30 },
     *   { 'user': 'barney', 'age': 34 }
     * ];
     *
     * _.sortBy(users, [function(o) { return o.user; }]);
     * // => objects for [['barney', 34], ['barney', 36], ['fred', 30], ['fred', 48]]
     *
     * _.sortBy(users, ['user', 'age']);
     * // => objects for [['barney', 34], ['barney', 36], ['fred', 30], ['fred', 48]]
     *
     * _.sortBy(users, 'user', function(o) {
     *   return Math.floor(o.age / 10);
     * });
     * // => objects for [['barney', 36], ['barney', 34], ['fred', 48], ['fred', 30]]
     */
    var sortBy = baseRest(function(collection, iteratees) {
      if (collection == null) {
        return [];
      }
      var length = iteratees.length;
      if (length > 1 && isIterateeCall(collection, iteratees[0], iteratees[1])) {
        iteratees = [];
      } else if (length > 2 && isIterateeCall(iteratees[0], iteratees[1], iteratees[2])) {
        iteratees = [iteratees[0]];
      }
      return baseOrderBy(collection, baseFlatten(iteratees, 1), []);
    });

    /*------------------------------------------------------------------------*/

    /**
     * 获取自 Unix 纪元（1970年1月1日 00:00:00 UTC）以来所经过的毫秒数的时间戳。
     *
     * @static
     * @memberOf _
     * @since 2.4.0
     * @category Date
     * @returns {number} 返回时间戳。
     * @example
     *
     * _.defer(function(stamp) {
     *   console.log(_.now() - stamp);
     * }, _.now());
     * // => Logs the number of milliseconds it took for the deferred invocation.
     */
    var now = ctxNow || function() {
      return root.Date.now();
    };

    /*------------------------------------------------------------------------*/

    /**
     * `_.before` 的反向方法；此方法创建一个函数，当调用 `n` 次或更多次后才会调用 `func`。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Function
     * @param {number} n 调用 `func` 之前的调用次数。
     * @param {Function} func 要限制的函数。
     * @returns {Function} 返回新的受限函数。
     * @example
     *
     * var saves = ['profile', 'settings'];
     *
     * var done = _.after(saves.length, function() {
     *   console.log('done saving!');
     * });
     *
     * _.forEach(saves, function(type) {
     *   asyncSave({ 'type': type, 'complete': done });
     * });
     * // => Logs 'done saving!' after the two async saves have completed.
     */
    function after(n, func) {
      if (typeof func != 'function') {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      n = toInteger(n);
      return function() {
        if (--n < 1) {
          return func.apply(this, arguments);
        }
      };
    }

    /**
     * 创建一个函数，该函数调用 `func`，最多接受 `n` 个参数，忽略任何附加参数。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Function
     * @param {Function} func 要限制参数的函数。
     * @param {number} [n=func.length] 参数数量上限。
     * @param- {Object} [guard] 允许用作像 `_.map` 这样的方法的迭代器。
     * @returns {Function} 返回新的限制参数后的函数。
     * @example
     *
     * _.map(['6', '8', '10'], _.ary(parseInt, 1));
     * // => [6, 8, 10]
     */
    function ary(func, n, guard) {
      n = guard ? undefined : n;
      n = (func && n == null) ? func.length : n;
      return createWrap(func, WRAP_ARY_FLAG, undefined, undefined, undefined, undefined, n);
    }

    /**
     * 创建一个函数，该函数调用 `func`，绑定 `this` 和创建函数时接收的参数，
     * 当调用次数少于 `n` 次时。后续调用返回最后一次 `func` 调用的结果。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Function
     * @param {number} n 不再调用 `func` 的调用次数。
     * @param {Function} func 要限制的函数。
     * @returns {Function} 返回新的受限函数。
     * @example
     *
     * jQuery(element).on('click', _.before(5, addContactToList));
     * // => Allows adding up to 4 contacts to the list.
     */
    function before(n, func) {
      var result;
      if (typeof func != 'function') {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      n = toInteger(n);
      return function() {
        if (--n > 0) {
          result = func.apply(this, arguments);
        }
        if (n <= 1) {
          func = undefined;
        }
        return result;
      };
    }

    /**
     * 创建一个函数，调用 `func`，绑定 `thisArg` 的 `this`，
     * 并将 `partials` 预置到它接收的参数前。
     *
     * `_.bind.placeholder` 值，在整体构建中默认为 `_`，可用作部分应用参数的占位符。
     *
     * **注意：** 与原生的 `Function#bind` 不同，此方法不会设置绑定函数的 "length" 属性。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Function
     * @param {Function} func 要绑定的函数。
     * @param {*} thisArg `func` 的 `this` 绑定。
     * @param {...*} [partials] 要部分应用的参数。
     * @returns {Function} 返回新的绑定函数。
     * @example
     *
     * function greet(greeting, punctuation) {
     *   return greeting + ' ' + this.user + punctuation;
     * }
     *
     * var object = { 'user': 'fred' };
     *
     * var bound = _.bind(greet, object, 'hi');
     * bound('!');
     * // => 'hi fred!'
     *
     * // Bound with placeholders.
     * var bound = _.bind(greet, object, _, '!');
     * bound('hi');
     * // => 'hi fred!'
     */
    var bind = baseRest(function(func, thisArg, partials) {
      var bitmask = WRAP_BIND_FLAG;
      if (partials.length) {
        var holders = replaceHolders(partials, getHolder(bind));
        bitmask |= WRAP_PARTIAL_FLAG;
      }
      return createWrap(func, bitmask, thisArg, partials, holders);
    });

    /**
     * 创建一个函数，在 `object[key]` 上调用方法，`partials` 预置到它接收的参数前。
     *
     * 此方法与 `_.bind` 的区别在于允许绑定函数引用可能已被重新定义
     * 或尚不存在的方法。详见
     * [Peter Michaux's article](http://peter.michaux.ca/articles/lazy-function-definition-pattern)。
     *
     * `_.bindKey.placeholder` 值，在整体构建中默认为 `_`，可用作部分应用参数的占位符。
     *
     * @static
     * @memberOf _
     * @since 0.10.0
     * @category Function
     * @param {Object} object 要调用方法的对象。
     * @param {string} key 方法的键。
     * @param {...*} [partials] 要部分应用的参数。
     * @returns {Function} 返回新的绑定函数。
     * @example
     *
     * var object = {
     *   'user': 'fred',
     *   'greet': function(greeting, punctuation) {
     *     return greeting + ' ' + this.user + punctuation;
     *   }
     * };
     *
     * var bound = _.bindKey(object, 'greet', 'hi');
     * bound('!');
     * // => 'hi fred!'
     *
     * object.greet = function(greeting, punctuation) {
     *   return greeting + 'ya ' + this.user + punctuation;
     * };
     *
     * bound('!');
     * // => 'hiya fred!'
     *
     * // Bound with placeholders.
     * var bound = _.bindKey(object, 'greet', _, '!');
     * bound('hi');
     * // => 'hiya fred!'
     */
    var bindKey = baseRest(function(object, key, partials) {
      var bitmask = WRAP_BIND_FLAG | WRAP_BIND_KEY_FLAG;
      if (partials.length) {
        var holders = replaceHolders(partials, getHolder(bindKey));
        bitmask |= WRAP_PARTIAL_FLAG;
      }
      return createWrap(key, bitmask, object, partials, holders);
    });

    /**
     * 创建一个函数，该函数接受 `func` 的参数，如果至少提供了 `arity` 个参数，
     * 则调用 `func` 返回其结果，或者返回一个接受 `func` 剩余参数的函数，以此类推。
     * 如果 `func.length` 不够用，可以指定 `func` 的参数数量。
     *
     * `_.curry.placeholder` 值，在整体构建中默认为 `_`，可用作提供参数的占位符。
     *
     * **注意：** 此方法不会设置柯里化函数的 "length" 属性。
     *
     * @static
     * @memberOf _
     * @since 2.0.0
     * @category Function
     * @param {Function} func 要柯里化的函数。
     * @param {number} [arity=func.length] `func` 的参数数量。
     * @param- {Object} [guard] 允许用作像 `_.map` 这样的方法的迭代器。
     * @returns {Function} 返回新的柯里化函数。
     * @example
     *
     * var abc = function(a, b, c) {
     *   return [a, b, c];
     * };
     *
     * var curried = _.curry(abc);
     *
     * curried(1)(2)(3);
     * // => [1, 2, 3]
     *
     * curried(1, 2)(3);
     * // => [1, 2, 3]
     *
     * curried(1, 2, 3);
     * // => [1, 2, 3]
     *
     * // Curried with placeholders.
     * curried(1)(_, 3)(2);
     * // => [1, 2, 3]
     */
    function curry(func, arity, guard) {
      arity = guard ? undefined : arity;
      var result = createWrap(func, WRAP_CURRY_FLAG, undefined, undefined, undefined, undefined, undefined, arity);
      result.placeholder = curry.placeholder;
      return result;
    }

    /**
     * 这个方法类似 `_.curry`，但参数以 `_.partialRight` 的方式应用给 `func`，而不是 `_.partial`。
     *
     * `_.curryRight.placeholder` 值，在整体构建中默认为 `_`，可用作提供参数的占位符。
     *
     * **注意：** 此方法不会设置柯里化函数的 "length" 属性。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Function
     * @param {Function} func 要柯里化的函数。
     * @param {number} [arity=func.length] `func` 的参数数量。
     * @param- {Object} [guard] 允许用作像 `_.map` 这样的方法的迭代器。
     * @returns {Function} 返回新的柯里化函数。
     * @example
     *
     * var abc = function(a, b, c) {
     *   return [a, b, c];
     * };
     *
     * var curried = _.curryRight(abc);
     *
     * curried(3)(2)(1);
     * // => [1, 2, 3]
     *
     * curried(2, 3)(1);
     * // => [1, 2, 3]
     *
     * curried(1, 2, 3);
     * // => [1, 2, 3]
     *
     * // Curried with placeholders.
     * curried(3)(1, _)(2);
     * // => [1, 2, 3]
     */
    function curryRight(func, arity, guard) {
      arity = guard ? undefined : arity;
      var result = createWrap(func, WRAP_CURRY_RIGHT_FLAG, undefined, undefined, undefined, undefined, undefined, arity);
      result.placeholder = curryRight.placeholder;
      return result;
    }

    /**
     * 创建一个防抖函数，该函数延迟调用 `func`，直到自上次防抖函数被调用后
     * 过去了 `wait` 毫秒。防抖函数带有一个 `cancel` 方法来取消延迟的 `func` 调用，
     * 以及一个 `flush` 方法来立即调用它们。可以提供 `options` 来指示是否应在
     * `wait` 超时的领先和/或尾随边缘调用 `func`。使用传递给防抖函数的最后参数调用 `func`。
     * 对防抖函数的后续调用返回最后一次 `func` 调用的结果。
     *
     * **注意：** 如果 `leading` 和 `trailing` 选项都是 `true`，则仅在 `wait` 超时期间
     * 防抖函数被调用多次时，才在超时的尾随边缘调用 `func`。
     *
     * 如果 `wait` 为 `0` 且 `leading` 为 `false`，则 `func` 调用被延迟到下一个 tick，
     * 类似于 timeout 为 `0` 的 `setTimeout`。
     *
     * 有关 `_.debounce` 和 `_.throttle` 之间差异的详细信息，
     * 请参见 [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Function
     * @param {Function} func 要防抖的函数。
     * @param {number} [wait=0] 延迟的毫秒数。
     * @param {Object} [options={}] 选项对象。
     * @param {boolean} [options.leading=false]
     *  指定在超时领先边缘调用。
     * @param {number} [options.maxWait]
     *  在调用之前允许 `func` 被延迟的最大时间。
     * @param {boolean} [options.trailing=true]
     *  指定在超时尾随边缘调用。
     * @returns {Function} 返回新的防抖函数。
     * @example
     *
     * // Avoid costly calculations while the window size is in flux.
     * jQuery(window).on('resize', _.debounce(calculateLayout, 150));
     *
     * // Invoke `sendMail` when clicked, debouncing subsequent calls.
     * jQuery(element).on('click', _.debounce(sendMail, 300, {
     *   'leading': true,
     *   'trailing': false
     * }));
     *
     * // Ensure `batchLog` is invoked once after 1 second of debounced calls.
     * var debounced = _.debounce(batchLog, 250, { 'maxWait': 1000 });
     * var source = new EventSource('/stream');
     * jQuery(source).on('message', debounced);
     *
     * // Cancel the trailing debounced invocation.
     * jQuery(window).on('popstate', debounced.cancel);
     */
    function debounce(func, wait, options) {
      var lastArgs,
          lastThis,
          maxWait,
          result,
          timerId,
          lastCallTime,
          lastInvokeTime = 0,
          leading = false,
          maxing = false,
          trailing = true;

      if (typeof func != 'function') {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      wait = toNumber(wait) || 0;
      if (isObject(options)) {
        leading = !!options.leading;
        maxing = 'maxWait' in options;
        maxWait = maxing ? nativeMax(toNumber(options.maxWait) || 0, wait) : maxWait;
        trailing = 'trailing' in options ? !!options.trailing : trailing;
      }

      function invokeFunc(time) {
        var args = lastArgs,
            thisArg = lastThis;

        lastArgs = lastThis = undefined;
        lastInvokeTime = time;
        result = func.apply(thisArg, args);
        return result;
      }

      function leadingEdge(time) {
        // Reset any `maxWait` timer.
        lastInvokeTime = time;
        // Start the timer for the trailing edge.
        timerId = setTimeout(timerExpired, wait);
        // Invoke the leading edge.
        return leading ? invokeFunc(time) : result;
      }

      function remainingWait(time) {
        var timeSinceLastCall = time - lastCallTime,
            timeSinceLastInvoke = time - lastInvokeTime,
            timeWaiting = wait - timeSinceLastCall;

        return maxing
          ? nativeMin(timeWaiting, maxWait - timeSinceLastInvoke)
          : timeWaiting;
      }

      function shouldInvoke(time) {
        var timeSinceLastCall = time - lastCallTime,
            timeSinceLastInvoke = time - lastInvokeTime;

        // Either this is the first call, activity has stopped and we're at the
        // trailing edge, the system time has gone backwards and we're treating
        // it as the trailing edge, or we've hit the `maxWait` limit.
        return (lastCallTime === undefined || (timeSinceLastCall >= wait) ||
          (timeSinceLastCall < 0) || (maxing && timeSinceLastInvoke >= maxWait));
      }

      function timerExpired() {
        var time = now();
        if (shouldInvoke(time)) {
          return trailingEdge(time);
        }
        // Restart the timer.
        timerId = setTimeout(timerExpired, remainingWait(time));
      }

      function trailingEdge(time) {
        timerId = undefined;

        // Only invoke if we have `lastArgs` which means `func` has been
        // debounced at least once.
        if (trailing && lastArgs) {
          return invokeFunc(time);
        }
        lastArgs = lastThis = undefined;
        return result;
      }

      function cancel() {
        if (timerId !== undefined) {
          clearTimeout(timerId);
        }
        lastInvokeTime = 0;
        lastArgs = lastCallTime = lastThis = timerId = undefined;
      }

      function flush() {
        return timerId === undefined ? result : trailingEdge(now());
      }

      function debounced() {
        var time = now(),
            isInvoking = shouldInvoke(time);

        lastArgs = arguments;
        lastThis = this;
        lastCallTime = time;

        if (isInvoking) {
          if (timerId === undefined) {
            return leadingEdge(lastCallTime);
          }
          if (maxing) {
            // Handle invocations in a tight loop.
            clearTimeout(timerId);
            timerId = setTimeout(timerExpired, wait);
            return invokeFunc(lastCallTime);
          }
        }
        if (timerId === undefined) {
          timerId = setTimeout(timerExpired, wait);
        }
        return result;
      }
      debounced.cancel = cancel;
      debounced.flush = flush;
      return debounced;
    }

    /**
     * 延迟调用 `func`，直到当前调用栈被清除后。调用时，任何附加的参数都会传递给 `func`。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Function
     * @param {Function} func 要延迟的函数。
     * @param {...*} [args] 传递给 `func` 的参数。
     * @returns {number} 返回定时器 id。
     * @example
     *
     * _.defer(function(text) {
     *   console.log(text);
     * }, 'deferred');
     * // => Logs 'deferred' after one millisecond.
     */
    var defer = baseRest(function(func, args) {
      return baseDelay(func, 1, args);
    });

    /**
     * 在 `wait` 毫秒后调用 `func`。调用时会将任何附加的参数传递给 `func`。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Function
     * @param {Function} func 要延迟的函数。
     * @param {number} wait 延迟调用的毫秒数。
     * @param {...*} [args] 传递给 `func` 的参数。
     * @returns {number} 返回定时器 id。
     * @example
     *
     * _.delay(function(text) {
     *   console.log(text);
     * }, 1000, 'later');
     * // => Logs 'later' after one second.
     */
    var delay = baseRest(function(func, wait, args) {
      return baseDelay(func, toNumber(wait) || 0, args);
    });

    /**
     * 创建一个函数，调用时反转传递给 `func` 的参数。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Function
     * @param {Function} func 要反转参数的函数。
     * @returns {Function} 返回新的反转参数后的函数。
     * @example
     *
     * var flipped = _.flip(function() {
     *   return _.toArray(arguments);
     * });
     *
     * flipped('a', 'b', 'c', 'd');
     * // => ['d', 'c', 'b', 'a']
     */
    function flip(func) {
      return createWrap(func, WRAP_FLIP_FLAG);
    }

    /**
     * 创建一个函数，对 `func` 的结果进行记忆化。如果提供了 `resolver`，
     * 它会基于记忆化函数接收的参数决定缓存键来存储结果。
     * 默认情况下，记忆化函数的第一个参数用作 map 缓存键。
     * 使用记忆化函数的 `this` 绑定调用 `func`。
     *
     * **注意：** 缓存作为 `cache` 属性暴露在记忆化函数上。
     * 可以通过将 `_.memoize.Cache` 构造函数替换为实现了
     * [`Map`](http://ecma-international.org/ecma-262/7.0/#sec-properties-of-the-map-prototype-object)
     * 方法接口（`clear`、`delete`、`get`、`has` 和 `set`）的实例来自定义其创建。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Function
     * @param {Function} func 要记忆化输出的函数。
     * @param {Function} [resolver] 用于解析缓存键的函数。
     * @returns {Function} 返回新的记忆化函数。
     * @example
     *
     * var object = { 'a': 1, 'b': 2 };
     * var other = { 'c': 3, 'd': 4 };
     *
     * var values = _.memoize(_.values);
     * values(object);
     * // => [1, 2]
     *
     * values(other);
     * // => [3, 4]
     *
     * object.a = 2;
     * values(object);
     * // => [1, 2]
     *
     * // Modify the result cache.
     * values.cache.set(object, ['a', 'b']);
     * values(object);
     * // => ['a', 'b']
     *
     * // Replace `_.memoize.Cache`.
     * _.memoize.Cache = WeakMap;
     */
    function memoize(func, resolver) {
      if (typeof func != 'function' || (resolver != null && typeof resolver != 'function')) {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      var memoized = function() {
        var args = arguments,
            key = resolver ? resolver.apply(this, args) : args[0],
            cache = memoized.cache;

        if (cache.has(key)) {
          return cache.get(key);
        }
        var result = func.apply(this, args);
        memoized.cache = cache.set(key, result) || cache;
        return result;
      };
      memoized.cache = new (memoize.Cache || MapCache);
      return memoized;
    }

    // Expose `MapCache`.
    memoize.Cache = MapCache;

    /**
     * 创建一个函数，该函数对 `func` 谓词的结果求反。`func` 谓词使用创建函数的
     * `this` 绑定和参数调用。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Function
     * @param {Function} predicate 要求反的谓词。
     * @returns {Function} 返回新的求反函数。
     * @example
     *
     * function isEven(n) {
     *   return n % 2 == 0;
     * }
     *
     * _.filter([1, 2, 3, 4, 5, 6], _.negate(isEven));
     * // => [1, 3, 5]
     */
    function negate(predicate) {
      if (typeof predicate != 'function') {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      return function() {
        var args = arguments;
        switch (args.length) {
          case 0: return !predicate.call(this);
          case 1: return !predicate.call(this, args[0]);
          case 2: return !predicate.call(this, args[0], args[1]);
          case 3: return !predicate.call(this, args[0], args[1], args[2]);
        }
        return !predicate.apply(this, args);
      };
    }

    /**
     * 创建一个只能调用 `func` 一次的函数。重复调用该函数返回第一次调用的值。
     * 使用创建函数的 `this` 绑定和参数调用 `func`。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Function
     * @param {Function} func 要限制的函数。
     * @returns {Function} 返回新的受限函数。
     * @example
     *
     * var initialize = _.once(createApplication);
     * initialize();
     * initialize();
     * // => `createApplication` is invoked once
     */
    function once(func) {
      return before(2, func);
    }

    /**
     * 创建一个使用转换后的参数调用 `func` 的函数。
     *
     * @static
     * @since 4.0.0
     * @memberOf _
     * @category Function
     * @param {Function} func 要包装的函数。
     * @param {...(Function|Function[])} [transforms=[_.identity]]
     *  参数转换器。
     * @returns {Function} 返回新的函数。
     * @example
     *
     * function doubled(n) {
     *   return n * 2;
     * }
     *
     * function square(n) {
     *   return n * n;
     * }
     *
     * var func = _.overArgs(function(x, y) {
     *   return [x, y];
     * }, [square, doubled]);
     *
     * func(9, 3);
     * // => [81, 6]
     *
     * func(10, 5);
     * // => [100, 10]
     */
    var overArgs = castRest(function(func, transforms) {
      transforms = (transforms.length == 1 && isArray(transforms[0]))
        ? arrayMap(transforms[0], baseUnary(getIteratee()))
        : arrayMap(baseFlatten(transforms, 1), baseUnary(getIteratee()));

      var funcsLength = transforms.length;
      return baseRest(function(args) {
        var index = -1,
            length = nativeMin(args.length, funcsLength);

        while (++index < length) {
          args[index] = transforms[index].call(this, args[index]);
        }
        return apply(func, this, args);
      });
    });

    /**
     * 创建一个函数，该函数调用 `func`，`partials` 预置到它接收的参数前。
     * 此方法类似 `_.bind`，但**不会**改变 `this` 绑定。
     *
     * `_.partial.placeholder` 值，在整体构建中默认为 `_`，可用作部分应用参数的占位符。
     *
     * **注意：** 此方法不会设置部分应用函数的 "length" 属性。
     *
     * @static
     * @memberOf _
     * @since 0.2.0
     * @category Function
     * @param {Function} func 要部分应用参数的函数。
     * @param {...*} [partials] 要部分应用的参数。
     * @returns {Function} 返回新的部分应用函数。
     * @example
     *
     * function greet(greeting, name) {
     *   return greeting + ' ' + name;
     * }
     *
     * var sayHelloTo = _.partial(greet, 'hello');
     * sayHelloTo('fred');
     * // => 'hello fred'
     *
     * // Partially applied with placeholders.
     * var greetFred = _.partial(greet, _, 'fred');
     * greetFred('hi');
     * // => 'hi fred'
     */
    var partial = baseRest(function(func, partials) {
      var holders = replaceHolders(partials, getHolder(partial));
      return createWrap(func, WRAP_PARTIAL_FLAG, undefined, partials, holders);
    });

    /**
     * 这个方法类似 `_.partial`，但部分应用的参数被追加到它接收的参数后。
     *
     * `_.partialRight.placeholder` 值，在整体构建中默认为 `_`，可用作部分应用参数的占位符。
     *
     * **注意：** 此方法不会设置部分应用函数的 "length" 属性。
     *
     * @static
     * @memberOf _
     * @since 1.0.0
     * @category Function
     * @param {Function} func 要部分应用参数的函数。
     * @param {...*} [partials] 要部分应用的参数。
     * @returns {Function} 返回新的部分应用函数。
     * @example
     *
     * function greet(greeting, name) {
     *   return greeting + ' ' + name;
     * }
     *
     * var greetFred = _.partialRight(greet, 'fred');
     * greetFred('hi');
     * // => 'hi fred'
     *
     * // Partially applied with placeholders.
     * var sayHelloTo = _.partialRight(greet, 'hello', _);
     * sayHelloTo('fred');
     * // => 'hello fred'
     */
    var partialRight = baseRest(function(func, partials) {
      var holders = replaceHolders(partials, getHolder(partialRight));
      return createWrap(func, WRAP_PARTIAL_RIGHT_FLAG, undefined, partials, holders);
    });

    /**
     * 创建一个函数，调用 `func`，参数根据指定的 `indexes` 排列，
     * 其中第一个索引处的参数值作为第一个参数提供，
     * 第二个索引处的参数值作为第二个参数提供，以此类推。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Function
     * @param {Function} func 要重新排列参数的函数。
     * @param {...(number|number[])} indexes 排列的参数索引。
     * @returns {Function} 返回新的函数。
     * @example
     *
     * var rearged = _.rearg(function(a, b, c) {
     *   return [a, b, c];
     * }, [2, 0, 1]);
     *
     * rearged('b', 'c', 'a')
     * // => ['a', 'b', 'c']
     */
    var rearg = flatRest(function(func, indexes) {
      return createWrap(func, WRAP_REARG_FLAG, undefined, undefined, undefined, indexes);
    });

    /**
     * 创建一个函数，调用 `func`，绑定创建函数的 `this` 绑定，
     * 并将 `start` 及之后的参数作为数组提供。
     *
     * **注意：** 此方法基于
     * [rest 参数](https://mdn.io/rest_parameters)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Function
     * @param {Function} func 要应用 rest 参数的函数。
     * @param {number} [start=func.length-1] rest 参数的起始位置。
     * @returns {Function} 返回新的函数。
     * @example
     *
     * var say = _.rest(function(what, names) {
     *   return what + ' ' + _.initial(names).join(', ') +
     *     (_.size(names) > 1 ? ', & ' : '') + _.last(names);
     * });
     *
     * say('hello', 'fred', 'barney', 'pebbles');
     * // => 'hello fred, barney, & pebbles'
     */
    function rest(func, start) {
      if (typeof func != 'function') {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      start = start === undefined ? start : toInteger(start);
      return baseRest(func, start);
    }

    /**
     * 创建一个函数，调用 `func`，绑定创建函数的 `this` 绑定，
     * 并使用类似
     * [`Function#apply`](http://www.ecma-international.org/ecma-262/7.0/#sec-function.prototype.apply)
     * 的参数数组。
     *
     * **注意：** 此方法基于
     * [展开运算符](https://mdn.io/spread_operator)。
     *
     * @static
     * @memberOf _
     * @since 3.2.0
     * @category Function
     * @param {Function} func 要展开参数的函数。
     * @param {number} [start=0] 展开的起始位置。
     * @returns {Function} 返回新的函数。
     * @example
     *
     * var say = _.spread(function(who, what) {
     *   return who + ' says ' + what;
     * });
     *
     * say(['fred', 'hello']);
     * // => 'fred says hello'
     *
     * var numbers = Promise.all([
     *   Promise.resolve(40),
     *   Promise.resolve(36)
     * ]);
     *
     * numbers.then(_.spread(function(x, y) {
     *   return x + y;
     * }));
     * // => a Promise of 76
     */
    function spread(func, start) {
      if (typeof func != 'function') {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      start = start == null ? 0 : nativeMax(toInteger(start), 0);
      return baseRest(function(args) {
        var array = args[start],
            otherArgs = castSlice(args, 0, start);

        if (array) {
          arrayPush(otherArgs, array);
        }
        return apply(func, this, otherArgs);
      });
    }

    /**
     * Creates a throttled function that only invokes `func` at most once per
     * every `wait` milliseconds. The throttled function comes with a `cancel`
     * method to cancel delayed `func` invocations and a `flush` method to
     * immediately invoke them. Provide `options` to indicate whether `func`
     * should be invoked on the leading and/or trailing edge of the `wait`
     * timeout. The `func` is invoked with the last arguments provided to the
     * throttled function. Subsequent calls to the throttled function return the
     * result of the last `func` invocation.
     *
     * **Note:** If `leading` and `trailing` options are `true`, `func` is
     * invoked on the trailing edge of the timeout only if the throttled function
     * is invoked more than once during the `wait` timeout.
     *
     * If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
     * until to the next tick, similar to `setTimeout` with a timeout of `0`.
     *
     * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
     * for details over the differences between `_.throttle` and `_.debounce`.
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Function
     * @param {Function} func The function to throttle.
     * @param {number} [wait=0] The number of milliseconds to throttle invocations to.
     * @param {Object} [options={}] The options object.
     * @param {boolean} [options.leading=true]
     *  Specify invoking on the leading edge of the timeout.
     * @param {boolean} [options.trailing=true]
     *  Specify invoking on the trailing edge of the timeout.
     * @returns {Function} Returns the new throttled function.
     * @example
     *
     * // Avoid excessively updating the position while scrolling.
     * jQuery(window).on('scroll', _.throttle(updatePosition, 100));
     *
     * // Invoke `renewToken` when the click event is fired, but not more than once every 5 minutes.
     * var throttled = _.throttle(renewToken, 300000, { 'trailing': false });
     * jQuery(element).on('click', throttled);
     *
     * // Cancel the trailing throttled invocation.
     * jQuery(window).on('popstate', throttled.cancel);
     */
    function throttle(func, wait, options) {
      var leading = true,
          trailing = true;

      if (typeof func != 'function') {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      if (isObject(options)) {
        leading = 'leading' in options ? !!options.leading : leading;
        trailing = 'trailing' in options ? !!options.trailing : trailing;
      }
      return debounce(func, wait, {
        'leading': leading,
        'maxWait': wait,
        'trailing': trailing
      });
    }

    /**
     * Creates a function that accepts up to one argument, ignoring any
     * additional arguments.
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Function
     * @param {Function} func The function to cap arguments for.
     * @returns {Function} Returns the new capped function.
     * @example
     *
     * _.map(['6', '8', '10'], _.unary(parseInt));
     * // => [6, 8, 10]
     */
    function unary(func) {
      return ary(func, 1);
    }

    /**
     * 创建一个函数,将该函数的第一个参数提供给 `wrapper` 作为其第一个参数。
     * 提供给该函数的任何额外参数会附加到提供给 `wrapper` 的参数之后。
     * `wrapper` 会以创建函数的 `this` 绑定来调用。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Function
     * @param {*} value 要包装的值。
     * @param {Function} [wrapper=identity] 包装函数。
     * @returns {Function} 返回新函数。
     * @example
     *
     * var p = _.wrap(_.escape, function(func, text) {
     *   return '<p>' + func(text) + '</p>';
     * });
     *
     * p('fred, barney, & pebbles');
     * // => '<p>fred, barney, &amp; pebbles</p>'
     */
    function wrap(value, wrapper) {
      return partial(castFunction(wrapper), value);
    }

    /*------------------------------------------------------------------------*/

    /**
     * 如果 `value` 不是数组,则将其转换为数组。
     *
     * @static
     * @memberOf _
     * @since 4.4.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {Array} 返回转换后的数组。
     * @example
     *
     * _.castArray(1);
     * // => [1]
     *
     * _.castArray({ 'a': 1 });
     * // => [{ 'a': 1 }]
     *
     * _.castArray('abc');
     * // => ['abc']
     *
     * _.castArray(null);
     * // => [null]
     *
     * _.castArray(undefined);
     * // => [undefined]
     *
     * _.castArray();
     * // => []
     *
     * var array = [1, 2, 3];
     * console.log(_.castArray(array) === array);
     * // => true
     */
    function castArray() {
      if (!arguments.length) {
        return [];
      }
      var value = arguments[0];
      return isArray(value) ? value : [value];
    }

    /**
     * 创建 `value` 的浅拷贝。
     *
     * **注意:** 此方法基于结构化克隆算法,并支持克隆数组、ArrayBuffer、布尔值、
     * 日期对象、Map、数字、`Object` 对象、正则表达式、Set、字符串、Symbol 和类型化数组。
     * `arguments` 对象的自有可枚举属性会被克隆为普通对象。
     * 对于不可克隆的值(如错误对象、函数、DOM 节点和 WeakMap),会返回空对象。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Lang
     * @param {*} value 要克隆的值。
     * @returns {*} 返回克隆后的值。
     * @see _.cloneDeep
     * @example
     *
     * var objects = [{ 'a': 1 }, { 'b': 2 }];
     *
     * var shallow = _.clone(objects);
     * console.log(shallow[0] === objects[0]);
     * // => true
     */
    function clone(value) {
      return baseClone(value, CLONE_SYMBOLS_FLAG);
    }

    /**
     * 此方法类似 `_.clone`,但它接受一个 `customizer` 来自定义克隆。
     * 如果 `customizer` 返回 `undefined`,则由该方法处理克隆。
     * `customizer` 最多接受四个参数;(value [, index|key, object, stack])。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value 要克隆的值。
     * @param {Function} [customizer] 自定义克隆的函数。
     * @returns {*} 返回克隆后的值。
     * @see _.cloneDeepWith
     * @example
     *
     * function customizer(value) {
     *   if (_.isElement(value)) {
     *     return value.cloneNode(false);
     *   }
     * }
     *
     * var el = _.cloneWith(document.body, customizer);
     *
     * console.log(el === document.body);
     * // => false
     * console.log(el.nodeName);
     * // => 'BODY'
     * console.log(el.childNodes.length);
     * // => 0
     */
    function cloneWith(value, customizer) {
      customizer = typeof customizer == 'function' ? customizer : undefined;
      return baseClone(value, CLONE_SYMBOLS_FLAG, customizer);
    }

    /**
     * 此方法类似 `_.clone`,但它是递归克隆 `value`。
     *
     * @static
     * @memberOf _
     * @since 1.0.0
     * @category Lang
     * @param {*} value 要递归克隆的值。
     * @returns {*} 返回深克隆后的值。
     * @see _.clone
     * @example
     *
     * var objects = [{ 'a': 1 }, { 'b': 2 }];
     *
     * var deep = _.cloneDeep(objects);
     * console.log(deep[0] === objects[0]);
     * // => false
     */
    function cloneDeep(value) {
      return baseClone(value, CLONE_DEEP_FLAG | CLONE_SYMBOLS_FLAG);
    }

    /**
     * 此方法类似 `_.cloneWith`,但它是递归克隆 `value`。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value 要递归克隆的值。
     * @param {Function} [customizer] 自定义克隆的函数。
     * @returns {*} 返回深克隆后的值。
     * @see _.cloneWith
     * @example
     *
     * function customizer(value) {
     *   if (_.isElement(value)) {
     *     return value.cloneNode(true);
     *   }
     * }
     *
     * var el = _.cloneDeepWith(document.body, customizer);
     *
     * console.log(el === document.body);
     * // => false
     * console.log(el.nodeName);
     * // => 'BODY'
     * console.log(el.childNodes.length);
     * // => 20
     */
    function cloneDeepWith(value, customizer) {
      customizer = typeof customizer == 'function' ? customizer : undefined;
      return baseClone(value, CLONE_DEEP_FLAG | CLONE_SYMBOLS_FLAG, customizer);
    }

    /**
     * 通过调用 `source` 的断言属性来检查 `object` 是否符合 `source`。
     *
     * **注意:** 当 `source` 被部分应用时,此方法等价于 `_.conforms`。
     *
     * @static
     * @memberOf _
     * @since 4.14.0
     * @category Lang
     * @param {Object} object 要检查的对象。
     * @param {Object} source 符合属性的源对象。
     * @returns {boolean} 如果 `object` 符合则返回 `true`,否则返回 `false`。
     * @example
     *
     * var object = { 'a': 1, 'b': 2 };
     *
     * _.conformsTo(object, { 'b': function(n) { return n > 1; } });
     * // => true
     *
     * _.conformsTo(object, { 'b': function(n) { return n > 2; } });
     * // => false
     */
    function conformsTo(object, source) {
      return source == null || baseConformsTo(object, source, keys(source));
    }

    /**
     * 对两个值执行
     * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
     * 比较,判断它们是否相等。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value 要比较的值。
     * @param {*} other 要比较的另一个值。
     * @returns {boolean} 如果值相等则返回 `true`,否则返回 `false`。
     * @example
     *
     * var object = { 'a': 1 };
     * var other = { 'a': 1 };
     *
     * _.eq(object, object);
     * // => true
     *
     * _.eq(object, other);
     * // => false
     *
     * _.eq('a', 'a');
     * // => true
     *
     * _.eq('a', Object('a'));
     * // => false
     *
     * _.eq(NaN, NaN);
     * // => true
     */
    function eq(value, other) {
      return value === other || (value !== value && other !== other);
    }

    /**
     * 检查 `value` 是否大于 `other`。
     *
     * @static
     * @memberOf _
     * @since 3.9.0
     * @category Lang
     * @param {*} value 要比较的值。
     * @param {*} other 要比较的另一个值。
     * @returns {boolean} 如果 `value` 大于 `other` 则返回 `true`,否则返回 `false`。
     * @see _.lt
     * @example
     *
     * _.gt(3, 1);
     * // => true
     *
     * _.gt(3, 3);
     * // => false
     *
     * _.gt(1, 3);
     * // => false
     */
    var gt = createRelationalOperation(baseGt);

    /**
     * 检查 `value` 是否大于或等于 `other`。
     *
     * @static
     * @memberOf _
     * @since 3.9.0
     * @category Lang
     * @param {*} value 要比较的值。
     * @param {*} other 要比较的另一个值。
     * @returns {boolean} 如果 `value` 大于或等于 `other` 则返回 `true`,否则返回 `false`。
     * @see _.lte
     * @example
     *
     * _.gte(3, 1);
     * // => true
     *
     * _.gte(3, 3);
     * // => true
     *
     * _.gte(1, 3);
     * // => false
     */
    var gte = createRelationalOperation(function(value, other) {
      return value >= other;
    });

    /**
     * 检查 `value` 是否可能是 `arguments` 对象。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是 `arguments` 对象则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isArguments(function() { return arguments; }());
     * // => true
     *
     * _.isArguments([1, 2, 3]);
     * // => false
     */
    var isArguments = baseIsArguments(function() { return arguments; }()) ? baseIsArguments : function(value) {
      return isObjectLike(value) && hasOwnProperty.call(value, 'callee') &&
        !propertyIsEnumerable.call(value, 'callee');
    };

    /**
     * 检查 `value` 是否被分类为 `Array` 对象。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是数组则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isArray([1, 2, 3]);
     * // => true
     *
     * _.isArray(document.body.children);
     * // => false
     *
     * _.isArray('abc');
     * // => false
     *
     * _.isArray(_.noop);
     * // => false
     */
    var isArray = Array.isArray;

    /**
     * 检查 `value` 是否被分类为 `ArrayBuffer` 对象。
     *
     * @static
     * @memberOf _
     * @since 4.3.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是 ArrayBuffer 则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isArrayBuffer(new ArrayBuffer(2));
     * // => true
     *
     * _.isArrayBuffer(new Array(2));
     * // => false
     */
    var isArrayBuffer = nodeIsArrayBuffer ? baseUnary(nodeIsArrayBuffer) : baseIsArrayBuffer;

    /**
     * 检查 `value` 是否是类数组值。如果值不是函数且 `value.length`
     * 是大于等于 `0` 且小于等于 `Number.MAX_SAFE_INTEGER` 的整数,
     * 则视为类数组值。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是类数组则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isArrayLike([1, 2, 3]);
     * // => true
     *
     * _.isArrayLike(document.body.children);
     * // => true
     *
     * _.isArrayLike('abc');
     * // => true
     *
     * _.isArrayLike(_.noop);
     * // => false
     */
    function isArrayLike(value) {
      return value != null && isLength(value.length) && !isFunction(value);
    }

    /**
     * 此方法类似 `_.isArrayLike`,但它还检查 `value` 是否是对象。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是类数组对象则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isArrayLikeObject([1, 2, 3]);
     * // => true
     *
     * _.isArrayLikeObject(document.body.children);
     * // => true
     *
     * _.isArrayLikeObject('abc');
     * // => false
     *
     * _.isArrayLikeObject(_.noop);
     * // => false
     */
    function isArrayLikeObject(value) {
      return isObjectLike(value) && isArrayLike(value);
    }

    /**
     * 检查 `value` 是否被分类为布尔原始类型或对象。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是布尔值则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isBoolean(false);
     * // => true
     *
     * _.isBoolean(null);
     * // => false
     */
    function isBoolean(value) {
      return value === true || value === false ||
        (isObjectLike(value) && baseGetTag(value) == boolTag);
    }

    /**
     * 检查 `value` 是否是 Buffer。
     *
     * @static
     * @memberOf _
     * @since 4.3.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是 Buffer 则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isBuffer(new Buffer(2));
     * // => true
     *
     * _.isBuffer(new Uint8Array(2));
     * // => false
     */
    var isBuffer = nativeIsBuffer || stubFalse;

    /**
     * 检查 `value` 是否被分类为 `Date` 对象。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是日期对象则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isDate(new Date);
     * // => true
     *
     * _.isDate('Mon April 23 2012');
     * // => false
     */
    var isDate = nodeIsDate ? baseUnary(nodeIsDate) : baseIsDate;

    /**
     * 检查 `value` 是否可能是 DOM 元素。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是 DOM 元素则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isElement(document.body);
     * // => true
     *
     * _.isElement('<body>');
     * // => false
     */
    function isElement(value) {
      return isObjectLike(value) && value.nodeType === 1 && !isPlainObject(value);
    }

    /**
     * 检查 `value` 是否是空对象、集合、Map 或 Set。
     *
     * 如果对象没有自己的可枚举字符串键属性,则视为空。
     *
     * 类似数组的值(如 `arguments` 对象、数组、Buffer、字符串或类 jQuery 集合)
     * 如果 `length` 为 `0` 则视为空。同样,Map 和 Set 如果 `size` 为 `0` 也视为空。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 为空则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isEmpty(null);
     * // => true
     *
     * _.isEmpty(true);
     * // => true
     *
     * _.isEmpty(1);
     * // => true
     *
     * _.isEmpty([1, 2, 3]);
     * // => false
     *
     * _.isEmpty({ 'a': 1 });
     * // => false
     */
    function isEmpty(value) {
      if (value == null) {
        return true;
      }
      if (isArrayLike(value) &&
          (isArray(value) || typeof value == 'string' || typeof value.splice == 'function' ||
            isBuffer(value) || isTypedArray(value) || isArguments(value))) {
        return !value.length;
      }
      var tag = getTag(value);
      if (tag == mapTag || tag == setTag) {
        return !value.size;
      }
      if (isPrototype(value)) {
        return !baseKeys(value).length;
      }
      for (var key in value) {
        if (hasOwnProperty.call(value, key)) {
          return false;
        }
      }
      return true;
    }

    /**
     * 执行两个值的深度比较,确定它们是否相等。
     *
     * **注意:** 此方法支持比较数组、ArrayBuffer、布尔值、日期对象、错误对象、Map、
     * 数字、`Object` 对象、正则表达式、Set、字符串、Symbol 和类型化数组。
     * `Object` 对象通过自身的可枚举属性进行比较,而不是继承的属性。
     * 函数和 DOM 节点通过严格相等比较,即 `===`。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Lang
     * @param {*} value 要比较的值。
     * @param {*} other 要比较的另一个值。
     * @returns {boolean} 如果值相等则返回 `true`,否则返回 `false`。
     * @example
     *
     * var object = { 'a': 1 };
     * var other = { 'a': 1 };
     *
     * _.isEqual(object, other);
     * // => true
     *
     * object === other;
     * // => false
     */
    function isEqual(value, other) {
      return baseIsEqual(value, other);
    }

    /**
     * 此方法类似 `_.isEqual`,但它接受一个 `customizer` 来比较值。
     * 如果 `customizer` 返回 `undefined`,则由该方法处理比较。
     * `customizer` 最多接受六个参数:(objValue, othValue [, index|key, object, other, stack])。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value 要比较的值。
     * @param {*} other 要比较的另一个值。
     * @param {Function} [customizer] 自定义比较的函数。
     * @returns {boolean} 如果值相等则返回 `true`,否则返回 `false`。
     * @example
     *
     * function isGreeting(value) {
     *   return /^h(?:i|ello)$/.test(value);
     * }
     *
     * function customizer(objValue, othValue) {
     *   if (isGreeting(objValue) && isGreeting(othValue)) {
     *     return true;
     *   }
     * }
     *
     * var array = ['hello', 'goodbye'];
     * var other = ['hi', 'goodbye'];
     *
     * _.isEqualWith(array, other, customizer);
     * // => true
     */
    function isEqualWith(value, other, customizer) {
      customizer = typeof customizer == 'function' ? customizer : undefined;
      var result = customizer ? customizer(value, other) : undefined;
      return result === undefined ? baseIsEqual(value, other, undefined, customizer) : !!result;
    }

    /**
     * 检查 `value` 是否是 `Error`、`EvalError`、`RangeError`、`ReferenceError`、
     * `SyntaxError`、`TypeError` 或 `URIError` 对象。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是错误对象则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isError(new Error);
     * // => true
     *
     * _.isError(Error);
     * // => false
     */
    function isError(value) {
      if (!isObjectLike(value)) {
        return false;
      }
      var tag = baseGetTag(value);
      return tag == errorTag || tag == domExcTag ||
        (typeof value.message == 'string' && typeof value.name == 'string' && !isPlainObject(value));
    }

    /**
     * 检查 `value` 是否是有限原始数字。
     *
     * **注意:** 此方法基于
     * [`Number.isFinite`](https://mdn.io/Number/isFinite)。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是有限数字则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isFinite(3);
     * // => true
     *
     * _.isFinite(Number.MIN_VALUE);
     * // => true
     *
     * _.isFinite(Infinity);
     * // => false
     *
     * _.isFinite('3');
     * // => false
     */
    function isFinite(value) {
      return typeof value == 'number' && nativeIsFinite(value);
    }

    /**
     * 检查 `value` 是否被分类为 `Function` 对象。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是函数则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isFunction(_);
     * // => true
     *
     * _.isFunction(/abc/);
     * // => false
     */
    function isFunction(value) {
      if (!isObject(value)) {
        return false;
      }
      // The use of `Object#toString` avoids issues with the `typeof` operator
      // in Safari 9 which returns 'object' for typed arrays and other constructors.
      var tag = baseGetTag(value);
      return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
    }

    /**
     * 检查 `value` 是否是整数。
     *
     * **注意:** 此方法基于
     * [`Number.isInteger`](https://mdn.io/Number/isInteger)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是整数则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isInteger(3);
     * // => true
     *
     * _.isInteger(Number.MIN_VALUE);
     * // => false
     *
     * _.isInteger(Infinity);
     * // => false
     *
     * _.isInteger('3');
     * // => false
     */
    function isInteger(value) {
      return typeof value == 'number' && value == toInteger(value);
    }

    /**
     * 检查 `value` 是否是有效的类数组长度。
     *
     * **注意:** 此方法松散地基于
     * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是有效长度则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isLength(3);
     * // => true
     *
     * _.isLength(Number.MIN_VALUE);
     * // => false
     *
     * _.isLength(Infinity);
     * // => false
     *
     * _.isLength('3');
     * // => false
     */
    function isLength(value) {
      return typeof value == 'number' &&
        value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
    }

    /**
     * 检查 `value` 是否是
     * [语言类型](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
     * 的 `Object`。(例如数组、函数、对象、正则表达式、`new Number(0)` 和 `new String('')`)
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是对象则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isObject({});
     * // => true
     *
     * _.isObject([1, 2, 3]);
     * // => true
     *
     * _.isObject(_.noop);
     * // => true
     *
     * _.isObject(null);
     * // => false
     */
    function isObject(value) {
      var type = typeof value;
      return value != null && (type == 'object' || type == 'function');
    }

    /**
     * 检查 `value` 是否像对象。如果值不是 `null` 且 `typeof` 结果为 "object",
     * 则视为像对象。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 像对象则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isObjectLike({});
     * // => true
     *
     * _.isObjectLike([1, 2, 3]);
     * // => true
     *
     * _.isObjectLike(_.noop);
     * // => false
     *
     * _.isObjectLike(null);
     * // => false
     */
    function isObjectLike(value) {
      return value != null && typeof value == 'object';
    }

    /**
     * 检查 `value` 是否被分类为 `Map` 对象。
     *
     * @static
     * @memberOf _
     * @since 4.3.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是 Map 则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isMap(new Map);
     * // => true
     *
     * _.isMap(new WeakMap);
     * // => false
     */
    var isMap = nodeIsMap ? baseUnary(nodeIsMap) : baseIsMap;

    /**
     * 执行 `object` 和 `source` 的深度部分比较,确定 `object` 是否包含等价的属性值。
     *
     * **注意:** 当 `source` 被部分应用时,此方法等价于 `_.matches`。
     *
     * 部分比较会将空数组和空对象 `source` 值分别与任何数组或对象值进行匹配。
     * 有关支持的值比较列表,请参见 `_.isEqual`。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Lang
     * @param {Object} object 要检查的对象。
     * @param {Object} source 要匹配的属性值的源对象。
     * @returns {boolean} 如果 `object` 匹配则返回 `true`,否则返回 `false`。
     * @example
     *
     * var object = { 'a': 1, 'b': 2 };
     *
     * _.isMatch(object, { 'b': 2 });
     * // => true
     *
     * _.isMatch(object, { 'b': 1 });
     * // => false
     */
    function isMatch(object, source) {
      return object === source || baseIsMatch(object, source, getMatchData(source));
    }

    /**
     * 此方法类似 `_.isMatch`,但它接受一个 `customizer` 来比较值。
     * 如果 `customizer` 返回 `undefined`,则由该方法处理比较。
     * `customizer` 接受五个参数:(objValue, srcValue, index|key, object, source)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {Object} object 要检查的对象。
     * @param {Object} source 要匹配的属性值的源对象。
     * @param {Function} [customizer] 自定义比较的函数。
     * @returns {boolean} 如果 `object` 匹配则返回 `true`,否则返回 `false`。
     * @example
     *
     * function isGreeting(value) {
     *   return /^h(?:i|ello)$/.test(value);
     * }
     *
     * function customizer(objValue, srcValue) {
     *   if (isGreeting(objValue) && isGreeting(srcValue)) {
     *     return true;
     *   }
     * }
     *
     * var object = { 'greeting': 'hello' };
     * var source = { 'greeting': 'hi' };
     *
     * _.isMatchWith(object, source, customizer);
     * // => true
     */
    function isMatchWith(object, source, customizer) {
      customizer = typeof customizer == 'function' ? customizer : undefined;
      return baseIsMatch(object, source, getMatchData(source), customizer);
    }

    /**
     * 检查 `value` 是否是 `NaN`。
     *
     * **注意:** 此方法基于
     * [`Number.isNaN`](https://mdn.io/Number/isNaN),与全局
     * [`isNaN`](https://mdn.io/isNaN) 不同,后者对 `undefined` 和其他非数字值返回 `true`。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是 `NaN` 则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isNaN(NaN);
     * // => true
     *
     * _.isNaN(new Number(NaN));
     * // => true
     *
     * isNaN(undefined);
     * // => true
     *
     * _.isNaN(undefined);
     * // => false
     */
    function isNaN(value) {
      // An `NaN` primitive is the only value that is not equal to itself.
      // Perform the `toStringTag` check first to avoid errors with some
      // ActiveX objects in IE.
      return isNumber(value) && value != +value;
    }

    /**
     * 检查 `value` 是否是原始的原生函数。
     *
     * **注意:** 在存在 core-js 包的情况下,此方法无法可靠地检测原生函数,
     * 因为 core-js 绕过了这种检测。尽管多次请求,core-js 维护者已明确表示:
     * 任何修复检测的尝试都将被阻止。因此,我们几乎没有选择,只能抛出错误。
     * 不幸的是,这也影响了依赖 core-js 的包,如 [babel-polyfill](https://www.npmjs.com/package/babel-polyfill)。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是原生函数则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isNative(Array.prototype.push);
     * // => true
     *
     * _.isNative(_);
     * // => false
     */
    function isNative(value) {
      if (isMaskable(value)) {
        throw new Error(CORE_ERROR_TEXT);
      }
      return baseIsNative(value);
    }

    /**
     * 检查 `value` 是否是 `null`。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是 `null` 则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isNull(null);
     * // => true
     *
     * _.isNull(void 0);
     * // => false
     */
    function isNull(value) {
      return value === null;
    }

    /**
     * 检查 `value` 是否是 `null` 或 `undefined`。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是 null/undefined 则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isNil(null);
     * // => true
     *
     * _.isNil(void 0);
     * // => true
     *
     * _.isNil(NaN);
     * // => false
     */
    function isNil(value) {
      return value == null;
    }

    /**
     * 检查 `value` 是否被分类为数字原始类型或对象。
     *
     * **注意:** 要排除被分类为数字的 `Infinity`、`-Infinity` 和 `NaN`,
     * 请使用 `_.isFinite` 方法。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是数字则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isNumber(3);
     * // => true
     *
     * _.isNumber(Number.MIN_VALUE);
     * // => true
     *
     * _.isNumber(Infinity);
     * // => true
     *
     * _.isNumber('3');
     * // => false
     */
    function isNumber(value) {
      return typeof value == 'number' ||
        (isObjectLike(value) && baseGetTag(value) == numberTag);
    }

    /**
     * 检查 `value` 是否是普通对象,即由 `Object` 构造函数创建的对象,
     * 或者 `[[Prototype]]` 为 `null` 的对象。
     *
     * @static
     * @memberOf _
     * @since 0.8.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是普通对象则返回 `true`,否则返回 `false`。
     * @example
     *
     * function Foo() {
     *   this.a = 1;
     * }
     *
     * _.isPlainObject(new Foo);
     * // => false
     *
     * _.isPlainObject([1, 2, 3]);
     * // => false
     *
     * _.isPlainObject({ 'x': 0, 'y': 0 });
     * // => true
     *
     * _.isPlainObject(Object.create(null));
     * // => true
     */
    function isPlainObject(value) {
      if (!isObjectLike(value) || baseGetTag(value) != objectTag) {
        return false;
      }
      var proto = getPrototype(value);
      if (proto === null) {
        return true;
      }
      var Ctor = hasOwnProperty.call(proto, 'constructor') && proto.constructor;
      return typeof Ctor == 'function' && Ctor instanceof Ctor &&
        funcToString.call(Ctor) == objectCtorString;
    }

    /**
     * 检查 `value` 是否被分类为 `RegExp` 对象。
     *
     * @static
     * @memberOf _
     * @since 0.1.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是正则表达式则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isRegExp(/abc/);
     * // => true
     *
     * _.isRegExp('/abc/');
     * // => false
     */
    var isRegExp = nodeIsRegExp ? baseUnary(nodeIsRegExp) : baseIsRegExp;

    /**
     * 检查 `value` 是否是安全整数。安全整数是可以精确表示为 IEEE-754 双精度数字,
     * 且不是舍入不安全整数的结果。
     *
     * **注意:** 此方法基于
     * [`Number.isSafeInteger`](https://mdn.io/Number/isSafeInteger)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是安全整数则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isSafeInteger(3);
     * // => true
     *
     * _.isSafeInteger(Number.MIN_VALUE);
     * // => false
     *
     * _.isSafeInteger(Infinity);
     * // => false
     *
     * _.isSafeInteger('3');
     * // => false
     */
    function isSafeInteger(value) {
      return isInteger(value) && value >= -MAX_SAFE_INTEGER && value <= MAX_SAFE_INTEGER;
    }

    /**
     * 检查 `value` 是否被分类为 `Set` 对象。
     *
     * @static
     * @memberOf _
     * @since 4.3.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是 Set 则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isSet(new Set);
     * // => true
     *
     * _.isSet(new WeakSet);
     * // => false
     */
    var isSet = nodeIsSet ? baseUnary(nodeIsSet) : baseIsSet;

    /**
     * 检查 `value` 是否被分类为字符串原始类型或对象。
     *
     * @static
     * @since 0.1.0
     * @memberOf _
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是字符串则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isString('abc');
     * // => true
     *
     * _.isString(1);
     * // => false
     */
    function isString(value) {
      return typeof value == 'string' ||
        (!isArray(value) && isObjectLike(value) && baseGetTag(value) == stringTag);
    }

    /**
     * 检查 `value` 是否被分类为 Symbol 原始类型或对象。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是 Symbol 则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isSymbol(Symbol.iterator);
     * // => true
     *
     * _.isSymbol('abc');
     * // => false
     */
    function isSymbol(value) {
      return typeof value == 'symbol' ||
        (isObjectLike(value) && baseGetTag(value) == symbolTag);
    }

    /**
     * 检查 `value` 是否被分类为类型化数组。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是类型化数组则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isTypedArray(new Uint8Array);
     * // => true
     *
     * _.isTypedArray([]);
     * // => false
     */
    var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;

    /**
     * 检查 `value` 是否是 `undefined`。
     *
     * @static
     * @since 0.1.0
     * @memberOf _
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是 `undefined` 则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isUndefined(void 0);
     * // => true
     *
     * _.isUndefined(null);
     * // => false
     */
    function isUndefined(value) {
      return value === undefined;
    }

    /**
     * 检查 `value` 是否被分类为 `WeakMap` 对象。
     *
     * @static
     * @memberOf _
     * @since 4.3.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是 WeakMap 则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isWeakMap(new WeakMap);
     * // => true
     *
     * _.isWeakMap(new Map);
     * // => false
     */
    function isWeakMap(value) {
      return isObjectLike(value) && getTag(value) == weakMapTag;
    }

    /**
     * 检查 `value` 是否被分类为 `WeakSet` 对象。
     *
     * @static
     * @memberOf _
     * @since 4.3.0
     * @category Lang
     * @param {*} value 要检查的值。
     * @returns {boolean} 如果 `value` 是 WeakSet 则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.isWeakSet(new WeakSet);
     * // => true
     *
     * _.isWeakSet(new Set);
     * // => false
     */
    function isWeakSet(value) {
      return isObjectLike(value) && baseGetTag(value) == weakSetTag;
    }

    /**
     * 检查 `value` 是否小于 `other`。
     *
     * @static
     * @memberOf _
     * @since 3.9.0
     * @category Lang
     * @param {*} value 要比较的值。
     * @param {*} other 要比较的另一个值。
     * @returns {boolean} 如果 `value` 小于 `other` 则返回 `true`,否则返回 `false`。
     * @see _.gt
     * @example
     *
     * _.lt(1, 3);
     * // => true
     *
     * _.lt(3, 3);
     * // => false
     *
     * _.lt(3, 1);
     * // => false
     */
    var lt = createRelationalOperation(baseLt);

    /**
     * 检查 `value` 是否小于或等于 `other`。
     *
     * @static
     * @memberOf _
     * @since 3.9.0
     * @category Lang
     * @param {*} value 要比较的值。
     * @param {*} other 要比较的另一个值。
     * @returns {boolean} 如果 `value` 小于或等于 `other` 则返回 `true`,否则返回 `false`。
     * @see _.gte
     * @example
     *
     * _.lte(1, 3);
     * // => true
     *
     * _.lte(3, 3);
     * // => true
     *
     * _.lte(3, 1);
     * // => false
     */
    var lte = createRelationalOperation(function(value, other) {
      return value <= other;
    });

    /**
     * 将 `value` 转换为数组。
     *
     * @static
     * @since 0.1.0
     * @memberOf _
     * @category Lang
     * @param {*} value 要转换的值。
     * @returns {Array} 返回转换后的数组。
     * @example
     *
     * _.toArray({ 'a': 1, 'b': 2 });
     * // => [1, 2]
     *
     * _.toArray('abc');
     * // => ['a', 'b', 'c']
     *
     * _.toArray(1);
     * // => []
     *
     * _.toArray(null);
     * // => []
     */
    function toArray(value) {
      if (!value) {
        return [];
      }
      if (isArrayLike(value)) {
        return isString(value) ? stringToArray(value) : copyArray(value);
      }
      if (symIterator && value[symIterator]) {
        return iteratorToArray(value[symIterator]());
      }
      var tag = getTag(value),
          func = tag == mapTag ? mapToArray : (tag == setTag ? setToArray : values);

      return func(value);
    }

    /**
     * 将 `value` 转换为有限数字。
     *
     * @static
     * @memberOf _
     * @since 4.12.0
     * @category Lang
     * @param {*} value 要转换的值。
     * @returns {number} 返回转换后的数字。
     * @example
     *
     * _.toFinite(3.2);
     * // => 3.2
     *
     * _.toFinite(Number.MIN_VALUE);
     * // => 5e-324
     *
     * _.toFinite(Infinity);
     * // => 1.7976931348623157e+308
     *
     * _.toFinite('3.2');
     * // => 3.2
     */
    function toFinite(value) {
      if (!value) {
        return value === 0 ? value : 0;
      }
      value = toNumber(value);
      if (value === INFINITY || value === -INFINITY) {
        var sign = (value < 0 ? -1 : 1);
        return sign * MAX_INTEGER;
      }
      return value === value ? value : 0;
    }

    /**
     * 将 `value` 转换为整数。
     *
     * **注意:** 此方法松散地基于
     * [`ToInteger`](http://www.ecma-international.org/ecma-262/7.0/#sec-tointeger)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value 要转换的值。
     * @returns {number} 返回转换后的整数。
     * @example
     *
     * _.toInteger(3.2);
     * // => 3
     *
     * _.toInteger(Number.MIN_VALUE);
     * // => 0
     *
     * _.toInteger(Infinity);
     * // => 1.7976931348623157e+308
     *
     * _.toInteger('3.2');
     * // => 3
     */
    function toInteger(value) {
      var result = toFinite(value),
          remainder = result % 1;

      return result === result ? (remainder ? result - remainder : result) : 0;
    }

    /**
     * 将 `value` 转换为适合用作类数组对象长度的整数。
     *
     * **注意:** 此方法基于
     * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value 要转换的值。
     * @returns {number} 返回转换后的整数。
     * @example
     *
     * _.toLength(3.2);
     * // => 3
     *
     * _.toLength(Number.MIN_VALUE);
     * // => 0
     *
     * _.toLength(Infinity);
     * // => 4294967295
     *
     * _.toLength('3.2');
     * // => 3
     */
    function toLength(value) {
      return value ? baseClamp(toInteger(value), 0, MAX_ARRAY_LENGTH) : 0;
    }

    /**
     * 将 `value` 转换为数字。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value 要处理的值。
     * @returns {number} 返回数字。
     * @example
     *
     * _.toNumber(3.2);
     * // => 3.2
     *
     * _.toNumber(Number.MIN_VALUE);
     * // => 5e-324
     *
     * _.toNumber(Infinity);
     * // => Infinity
     *
     * _.toNumber('3.2');
     * // => 3.2
     */
    function toNumber(value) {
      if (typeof value == 'number') {
        return value;
      }
      if (isSymbol(value)) {
        return NAN;
      }
      if (isObject(value)) {
        var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
        value = isObject(other) ? (other + '') : other;
      }
      if (typeof value != 'string') {
        return value === 0 ? value : +value;
      }
      value = baseTrim(value);
      var isBinary = reIsBinary.test(value);
      return (isBinary || reIsOctal.test(value))
        ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
        : (reIsBadHex.test(value) ? NAN : +value);
    }

    /**
     * 将 `value` 转换为普通对象,将 `value` 继承的可枚举字符串键属性展平为普通对象的自有属性。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Lang
     * @param {*} value 要转换的值。
     * @returns {Object} 返回转换后的普通对象。
     * @example
     *
     * function Foo() {
     *   this.b = 2;
     * }
     *
     * Foo.prototype.c = 3;
     *
     * _.assign({ 'a': 1 }, new Foo);
     * // => { 'a': 1, 'b': 2 }
     *
     * _.assign({ 'a': 1 }, _.toPlainObject(new Foo));
     * // => { 'a': 1, 'b': 2, 'c': 3 }
     */
    function toPlainObject(value) {
      return copyObject(value, keysIn(value));
    }

    /**
     * 将 `value` 转换为安全整数。安全整数可以正确比较和表示。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value 要转换的值。
     * @returns {number} 返回转换后的整数。
     * @example
     *
     * _.toSafeInteger(3.2);
     * // => 3
     *
     * _.toSafeInteger(Number.MIN_VALUE);
     * // => 0
     *
     * _.toSafeInteger(Infinity);
     * // => 9007199254740991
     *
     * _.toSafeInteger('3.2');
     * // => 3
     */
    function toSafeInteger(value) {
      return value
        ? baseClamp(toInteger(value), -MAX_SAFE_INTEGER, MAX_SAFE_INTEGER)
        : (value === 0 ? value : 0);
    }

    /**
     * 将 `value` 转换为字符串。`null` 和 `undefined` 返回空字符串。
     * `-0` 的符号会被保留。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Lang
     * @param {*} value 要转换的值。
     * @returns {string} 返回转换后的字符串。
     * @example
     *
     * _.toString(null);
     * // => ''
     *
     * _.toString(-0);
     * // => '-0'
     *
     * _.toString([1, 2, 3]);
     * // => '1,2,3'
     */
    function toString(value) {
      return value == null ? '' : baseToString(value);
    }

    /*------------------------------------------------------------------------*/

    /**
     * Assigns own enumerable string keyed properties of source objects to the
     * destination object. Source objects are applied from left to right.
     * Subsequent sources overwrite property assignments of previous sources.
     *
     * **Note:** This method mutates `object` and is loosely based on
     * [`Object.assign`](https://mdn.io/Object/assign).
     *
     * @static
     * @memberOf _
     * @since 0.10.0
     * @category Object
     * @param {Object} object The destination object.
     * @param {...Object} [sources] The source objects.
     * @returns {Object} Returns `object`.
     * @see _.assignIn
     * @example
     *
     * function Foo() {
     *   this.a = 1;
     * }
     *
     * function Bar() {
     *   this.c = 3;
     * }
     *
     * Foo.prototype.b = 2;
     * Bar.prototype.d = 4;
     *
     * _.assign({ 'a': 0 }, new Foo, new Bar);
     * // => { 'a': 1, 'c': 3 }
     */
    var assign = createAssigner(function(object, source) {
      if (isPrototype(source) || isArrayLike(source)) {
        copyObject(source, keys(source), object);
        return;
      }
      for (var key in source) {
        if (hasOwnProperty.call(source, key)) {
          assignValue(object, key, source[key]);
        }
      }
    });

    /**
     * 此方法类似 `_.assign`,但它会迭代遍历自身和继承的源属性。
     *
     * **注意:** 此方法会改变 `object`。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @alias extend
     * @category Object
     * @param {Object} object 目标对象。
     * @param {...Object} [sources] 源对象。
     * @returns {Object} 返回 `object`。
     * @see _.assign
     * @example
     *
     * function Foo() {
     *   this.a = 1;
     * }
     *
     * function Bar() {
     *   this.c = 3;
     * }
     *
     * Foo.prototype.b = 2;
     * Bar.prototype.d = 4;
     *
     * _.assignIn({ 'a': 0 }, new Foo, new Bar);
     * // => { 'a': 1, 'b': 2, 'c': 3, 'd': 4 }
     */
    var assignIn = createAssigner(function(object, source) {
      copyObject(source, keysIn(source), object);
    });

    /**
     * 此方法类似 `_.assignIn`,但它接受一个 `customizer` 来产生分配的值。
     * 如果 `customizer` 返回 `undefined`,则由该方法处理分配。
     * `customizer` 接受五个参数:(objValue, srcValue, key, object, source)。
     *
     * **注意:** 此方法会改变 `object`。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @alias extendWith
     * @category Object
     * @param {Object} object 目标对象。
     * @param {...Object} sources 源对象。
     * @param {Function} [customizer] 自定义分配值的函数。
     * @returns {Object} 返回 `object`。
     * @see _.assignWith
     * @example
     *
     * function customizer(objValue, srcValue) {
     *   return _.isUndefined(objValue) ? srcValue : objValue;
     * }
     *
     * var defaults = _.partialRight(_.assignInWith, customizer);
     *
     * defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 });
     * // => { 'a': 1, 'b': 2 }
     */
    var assignInWith = createAssigner(function(object, source, srcIndex, customizer) {
      copyObject(source, keysIn(source), object, customizer);
    });

    /**
     * 此方法类似 `_.assign`,但它接受一个 `customizer` 来产生分配的值。
     * 如果 `customizer` 返回 `undefined`,则由该方法处理分配。
     * `customizer` 接受五个参数:(objValue, srcValue, key, object, source)。
     *
     * **注意:** 此方法会改变 `object`。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Object
     * @param {Object} object 目标对象。
     * @param {...Object} sources 源对象。
     * @param {Function} [customizer] 自定义分配值的函数。
     * @returns {Object} 返回 `object`。
     * @see _.assignInWith
     * @example
     *
     * function customizer(objValue, srcValue) {
     *   return _.isUndefined(objValue) ? srcValue : objValue;
     * }
     *
     * var defaults = _.partialRight(_.assignWith, customizer);
     *
     * defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 });
     * // => { 'a': 1, 'b': 2 }
     */
    var assignWith = createAssigner(function(object, source, srcIndex, customizer) {
      copyObject(source, keys(source), object, customizer);
    });

    /**
     * 创建一个包含 `object` 对应 `paths` 属性值的数组。
     *
     * @static
     * @memberOf _
     * @since 1.0.0
     * @category Object
     * @param {Object} object 要迭代的对象。
     * @param {...(string|string[])} [paths] 要选取的属性路径。
     * @returns {Array} 返回选取的值组成的数组。
     * @example
     *
     * var object = { 'a': [{ 'b': { 'c': 3 } }, 4] };
     *
     * _.at(object, ['a[0].b.c', 'a[1]']);
     * // => [3, 4]
     */
    var at = flatRest(baseAt);

    /**
     * 创建一个继承自 `prototype` 原型的对象。如果提供了 `properties` 对象,
     * 其自有可枚举字符串键属性会被分配给创建的对象。
     *
     * @static
     * @memberOf _
     * @since 2.3.0
     * @category Object
     * @param {Object} prototype 要继承的对象。
     * @param {Object} [properties] 要分配给对象的属性。
     * @returns {Object} 返回新对象。
     * @example
     *
     * function Shape() {
     *   this.x = 0;
     *   this.y = 0;
     * }
     *
     * function Circle() {
     *   Shape.call(this);
     * }
     *
     * Circle.prototype = _.create(Shape.prototype, {
     *   'constructor': Circle
     * });
     *
     * var circle = new Circle;
     * circle instanceof Circle;
     * // => true
     *
     * circle instanceof Shape;
     * // => true
     */
    function create(prototype, properties) {
      var result = baseCreate(prototype);
      return properties == null ? result : baseAssign(result, properties);
    }

    /**
     * 将源对象的自有和继承的可枚举字符串键属性分配到目标对象,
     * 对于所有解析为 `undefined` 的目标属性。源对象从左到右应用。
     * 一旦属性被设置,相同属性的后续值将被忽略。
     *
     * **注意:** 此方法会改变 `object`。
     *
     * @static
     * @since 0.1.0
     * @memberOf _
     * @category Object
     * @param {Object} object 目标对象。
     * @param {...Object} [sources] 源对象。
     * @returns {Object} 返回 `object`。
     * @see _.defaultsDeep
     * @example
     *
     * _.defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 });
     * // => { 'a': 1, 'b': 2 }
     */
    var defaults = baseRest(function(object, sources) {
      object = Object(object);

      var index = -1;
      var length = sources.length;
      var guard = length > 2 ? sources[2] : undefined;

      if (guard && isIterateeCall(sources[0], sources[1], guard)) {
        length = 1;
      }

      while (++index < length) {
        var source = sources[index];
        var props = keysIn(source);
        var propsIndex = -1;
        var propsLength = props.length;

        while (++propsIndex < propsLength) {
          var key = props[propsIndex];
          var value = object[key];

          if (value === undefined ||
              (eq(value, objectProto[key]) && !hasOwnProperty.call(object, key))) {
            object[key] = source[key];
          }
        }
      }

      return object;
    });

    /**
     * 此方法类似 `_.defaults`,但它会递归分配默认属性。
     *
     * **注意:** 此方法会改变 `object`。
     *
     * @static
     * @memberOf _
     * @since 3.10.0
     * @category Object
     * @param {Object} object 目标对象。
     * @param {...Object} [sources] 源对象。
     * @returns {Object} 返回 `object`。
     * @see _.defaults
     * @example
     *
     * _.defaultsDeep({ 'a': { 'b': 2 } }, { 'a': { 'b': 1, 'c': 3 } });
     * // => { 'a': { 'b': 2, 'c': 3 } }
     */
    var defaultsDeep = baseRest(function(args) {
      args.push(undefined, customDefaultsMerge);
      return apply(mergeWith, undefined, args);
    });

    /**
     * 此方法类似 `_.find`,但它返回 `predicate` 返回真值的第一个元素的 key,
     * 而不是元素本身。
     *
     * @static
     * @memberOf _
     * @since 1.1.0
     * @category Object
     * @param {Object} object 要检查的对象。
     * @param {Function} [predicate=_.identity] 每次迭代调用的函数。
     * @returns {string|undefined} 返回匹配元素的 key,否则返回 `undefined`。
     * @example
     *
     * var users = {
     *   'barney':  { 'age': 36, 'active': true },
     *   'fred':    { 'age': 40, 'active': false },
     *   'pebbles': { 'age': 1,  'active': true }
     * };
     *
     * _.findKey(users, function(o) { return o.age < 40; });
     * // => 'barney' (迭代顺序不保证)
     *
     * // The `_.matches` iteratee shorthand.
     * _.findKey(users, { 'age': 1, 'active': true });
     * // => 'pebbles'
     *
     * // The `_.matchesProperty` iteratee shorthand.
     * _.findKey(users, ['active', false]);
     * // => 'fred'
     *
     * // The `_.property` iteratee shorthand.
     * _.findKey(users, 'active');
     * // => 'barney'
     */
    function findKey(object, predicate) {
      return baseFindKey(object, getIteratee(predicate, 3), baseForOwn);
    }

    /**
     * 此方法类似 `_.findKey`,但它以相反的顺序迭代集合的元素。
     *
     * @static
     * @memberOf _
     * @since 2.0.0
     * @category Object
     * @param {Object} object 要检查的对象。
     * @param {Function} [predicate=_.identity] 每次迭代调用的函数。
     * @returns {string|undefined} 返回匹配元素的 key,否则返回 `undefined`。
     * @example
     *
     * var users = {
     *   'barney':  { 'age': 36, 'active': true },
     *   'fred':    { 'age': 40, 'active': false },
     *   'pebbles': { 'age': 1,  'active': true }
     * };
     *
     * _.findLastKey(users, function(o) { return o.age < 40; });
     * // => 假设 `_.findKey` 返回 'barney',则返回 'pebbles'
     *
     * // The `_.matches` iteratee shorthand.
     * _.findLastKey(users, { 'age': 36, 'active': true });
     * // => 'barney'
     *
     * // The `_.matchesProperty` iteratee shorthand.
     * _.findLastKey(users, ['active', false]);
     * // => 'fred'
     *
     * // The `_.property` iteratee shorthand.
     * _.findLastKey(users, 'active');
     * // => 'pebbles'
     */
    function findLastKey(object, predicate) {
      return baseFindKey(object, getIteratee(predicate, 3), baseForOwnRight);
    }

    /**
     * 迭代对象自身的和继承的可枚举字符串键属性,并对每个属性调用 `iteratee`。
     * iteratee 调用三个参数:(value, key, object)。迭代器函数可以通过明确返回 `false`
     * 来提前退出迭代。
     *
     * @static
     * @memberOf _
     * @since 0.3.0
     * @category Object
     * @param {Object} object 要迭代的对象。
     * @param {Function} [iteratee=_.identity] 每次迭代调用的函数。
     * @returns {Object} 返回 `object`。
     * @see _.forInRight
     * @example
     *
     * function Foo() {
     *   this.a = 1;
     *   this.b = 2;
     * }
     *
     * Foo.prototype.c = 3;
     *
     * _.forIn(new Foo, function(value, key) {
     *   console.log(key);
     * });
     * // => 记录 'a', 'b', 然后 'c'(迭代顺序不保证)。
     */
    function forIn(object, iteratee) {
      return object == null
        ? object
        : baseFor(object, getIteratee(iteratee, 3), keysIn);
    }

    /**
     * 此方法类似 `_.forIn`,但它以相反的顺序迭代 `object` 的属性。
     *
     * @static
     * @memberOf _
     * @since 2.0.0
     * @category Object
     * @param {Object} object 要迭代的对象。
     * @param {Function} [iteratee=_.identity] 每次迭代调用的函数。
     * @returns {Object} 返回 `object`。
     * @see _.forIn
     * @example
     *
     * function Foo() {
     *   this.a = 1;
     *   this.b = 2;
     * }
     *
     * Foo.prototype.c = 3;
     *
     * _.forInRight(new Foo, function(value, key) {
     *   console.log(key);
     * });
     * // => 假设 `_.forIn` 记录 'a', 'b', 然后 'c',则记录 'c', 'b', 然后 'a'。
     */
    function forInRight(object, iteratee) {
      return object == null
        ? object
        : baseForRight(object, getIteratee(iteratee, 3), keysIn);
    }

    /**
     * 迭代对象自身的可枚举字符串键属性,并对每个属性调用 `iteratee`。
     * iteratee 调用三个参数:(value, key, object)。迭代器函数可以通过明确返回 `false`
     * 来提前退出迭代。
     *
     * @static
     * @memberOf _
     * @since 0.3.0
     * @category Object
     * @param {Object} object 要迭代的对象。
     * @param {Function} [iteratee=_.identity] 每次迭代调用的函数。
     * @returns {Object} 返回 `object`。
     * @see _.forOwnRight
     * @example
     *
     * function Foo() {
     *   this.a = 1;
     *   this.b = 2;
     * }
     *
     * Foo.prototype.c = 3;
     *
     * _.forOwn(new Foo, function(value, key) {
     *   console.log(key);
     * });
     * // => 记录 'a' 然后 'b'(迭代顺序不保证)。
     */
    function forOwn(object, iteratee) {
      return object && baseForOwn(object, getIteratee(iteratee, 3));
    }

    /**
     * 此方法类似 `_.forOwn`,但它以相反的顺序迭代 `object` 的属性。
     *
     * @static
     * @memberOf _
     * @since 2.0.0
     * @category Object
     * @param {Object} object 要迭代的对象。
     * @param {Function} [iteratee=_.identity] 每次迭代调用的函数。
     * @returns {Object} 返回 `object`。
     * @see _.forOwn
     * @example
     *
     * function Foo() {
     *   this.a = 1;
     *   this.b = 2;
     * }
     *
     * Foo.prototype.c = 3;
     *
     * _.forOwnRight(new Foo, function(value, key) {
     *   console.log(key);
     * });
     * // => 假设 `_.forOwn` 记录 'a' 然后 'b',则记录 'b' 然后 'a'。
     */
    function forOwnRight(object, iteratee) {
      return object && baseForOwnRight(object, getIteratee(iteratee, 3));
    }

    /**
     * 从 `object` 自有的可枚举属性中创建函数属性名组成的数组。
     *
     * @static
     * @since 0.1.0
     * @memberOf _
     * @category Object
     * @param {Object} object 要检查的对象。
     * @returns {Array} 返回函数名数组。
     * @see _.functionsIn
     * @example
     *
     * function Foo() {
     *   this.a = _.constant('a');
     *   this.b = _.constant('b');
     * }
     *
     * Foo.prototype.c = _.constant('c');
     *
     * _.functions(new Foo);
     * // => ['a', 'b']
     */
    function functions(object) {
      return object == null ? [] : baseFunctions(object, keys(object));
    }

    /**
     * 从 `object` 自有的和继承的可枚举属性中创建函数属性名组成的数组。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Object
     * @param {Object} object 要检查的对象。
     * @returns {Array} 返回函数名数组。
     * @see _.functions
     * @example
     *
     * function Foo() {
     *   this.a = _.constant('a');
     *   this.b = _.constant('b');
     * }
     *
     * Foo.prototype.c = _.constant('c');
     *
     * _.functionsIn(new Foo);
     * // => ['a', 'b', 'c']
     */
    function functionsIn(object) {
      return object == null ? [] : baseFunctions(object, keysIn(object));
    }

    /**
     * 获取 `object` 的 `path` 路径上的值。如果解析的值是 `undefined`,
     * 则返回 `defaultValue` 作为替代。
     *
     * @static
     * @memberOf _
     * @since 3.7.0
     * @category Object
     * @param {Object} object 要查询的对象。
     * @param {Array|string} path 要获取的属性路径。
     * @param {*} [defaultValue] `undefined` 解析值返回的默认值。
     * @returns {*} 返回解析后的值。
     * @example
     *
     * var object = { 'a': [{ 'b': { 'c': 3 } }] };
     *
     * _.get(object, 'a[0].b.c');
     * // => 3
     *
     * _.get(object, ['a', '0', 'b', 'c']);
     * // => 3
     *
     * _.get(object, 'a.b.c', 'default');
     * // => 'default'
     */
    function get(object, path, defaultValue) {
      var result = object == null ? undefined : baseGet(object, path);
      return result === undefined ? defaultValue : result;
    }

    /**
     * 检查 `path` 是否是 `object` 的直接属性。
     *
     * @static
     * @since 0.1.0
     * @memberOf _
     * @category Object
     * @param {Object} object 要查询的对象。
     * @param {Array|string} path 要检查的路径。
     * @returns {boolean} 如果 `path` 存在则返回 `true`,否则返回 `false`。
     * @example
     *
     * var object = { 'a': { 'b': 2 } };
     * var other = _.create({ 'a': _.create({ 'b': 2 }) });
     *
     * _.has(object, 'a');
     * // => true
     *
     * _.has(object, 'a.b');
     * // => true
     *
     * _.has(object, ['a', 'b']);
     * // => true
     *
     * _.has(other, 'a');
     * // => false
     */
    function has(object, path) {
      return object != null && hasPath(object, path, baseHas);
    }

    /**
     * 检查 `path` 是否是 `object` 的直接属性或继承属性。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Object
     * @param {Object} object 要查询的对象。
     * @param {Array|string} path 要检查的路径。
     * @returns {boolean} 如果 `path` 存在则返回 `true`,否则返回 `false`。
     * @example
     *
     * var object = _.create({ 'a': _.create({ 'b': 2 }) });
     *
     * _.hasIn(object, 'a');
     * // => true
     *
     * _.hasIn(object, 'a.b');
     * // => true
     *
     * _.hasIn(object, ['a', 'b']);
     * // => true
     *
     * _.hasIn(object, 'b');
     * // => false
     */
    function hasIn(object, path) {
      return object != null && hasPath(object, path, baseHasIn);
    }

    /**
     * 创建一个由 `object` 的键值对倒置而成的对象。
     * 如果 `object` 包含重复的值,后续的值将覆盖先前属性的赋值。
     *
     * @static
     * @memberOf _
     * @since 0.7.0
     * @category Object
     * @param {Object} object 要倒置的对象。
     * @returns {Object} 返回新的倒置对象。
     * @example
     *
     * var object = { 'a': 1, 'b': 2, 'c': 1 };
     *
     * _.invert(object);
     * // => { '1': 'c', '2': 'b' }
     */
    var invert = createInverter(function(result, value, key) {
      if (value != null &&
          typeof value.toString != 'function') {
        value = nativeObjectToString.call(value);
      }

      result[value] = key;
    }, constant(identity));

    /**
     * 此方法类似 `_.invert`,但倒置的对象是从将 `object` 的每个元素
     * 通过 `iteratee` 运行的结果生成的。每个倒置键对应的倒置值是一个键数组,
     * 负责生成倒置值。iteratee 调用一个参数:(value)。
     *
     * @static
     * @memberOf _
     * @since 4.1.0
     * @category Object
     * @param {Object} object 要倒置的对象。
     * @param {Function} [iteratee=_.identity] 每个元素调用的 iteratee 函数。
     * @returns {Object} 返回新的倒置对象。
     * @example
     *
     * var object = { 'a': 1, 'b': 2, 'c': 1 };
     *
     * _.invertBy(object);
     * // => { '1': ['a', 'c'], '2': ['b'] }
     *
     * _.invertBy(object, function(value) {
     *   return 'group' + value;
     * });
     * // => { 'group1': ['a', 'c'], 'group2': ['b'] }
     */
    var invertBy = createInverter(function(result, value, key) {
      if (value != null &&
          typeof value.toString != 'function') {
        value = nativeObjectToString.call(value);
      }

      if (hasOwnProperty.call(result, value)) {
        result[value].push(key);
      } else {
        result[value] = [key];
      }
    }, getIteratee);

    /**
     * 调用 `object` 的 `path` 路径上的方法。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Object
     * @param {Object} object 要查询的对象。
     * @param {Array|string} path 要调用的方法路径。
     * @param {...*} [args] 调用方法时传入的参数。
     * @returns {*} 返回调用方法的结果。
     * @example
     *
     * var object = { 'a': [{ 'b': { 'c': [1, 2, 3, 4] } }] };
     *
     * _.invoke(object, 'a[0].b.c.slice', 1, 3);
     * // => [2, 3]
     */
    var invoke = baseRest(baseInvoke);

    /**
     * 创建包含 `object` 自有的可枚举属性名的数组。
     *
     * **注意:** 非对象值会被强制转换为对象。详见
     * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)。
     *
     * @static
     * @since 0.1.0
     * @memberOf _
     * @category Object
     * @param {Object} object 要查询的对象。
     * @returns {Array} 返回属性名数组。
     * @example
     *
     * function Foo() {
     *   this.a = 1;
     *   this.b = 2;
     * }
     *
     * Foo.prototype.c = 3;
     *
     * _.keys(new Foo);
     * // => ['a', 'b'] (迭代顺序不保证)
     *
     * _.keys('hi');
     * // => ['0', '1']
     */
    function keys(object) {
      return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
    }

    /**
     * 创建包含 `object` 自有的和继承的可枚举属性名的数组。
     *
     * **注意:** 非对象值会被强制转换为对象。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Object
     * @param {Object} object 要查询的对象。
     * @returns {Array} 返回属性名数组。
     * @example
     *
     * function Foo() {
     *   this.a = 1;
     *   this.b = 2;
     * }
     *
     * Foo.prototype.c = 3;
     *
     * _.keysIn(new Foo);
     * // => ['a', 'b', 'c'] (迭代顺序不保证)
     */
    function keysIn(object) {
      return isArrayLike(object) ? arrayLikeKeys(object, true) : baseKeysIn(object);
    }

    /**
     * 与 `_.mapValues` 相反;此方法创建一个对象,该对象具有与 `object` 相同的值,
     * 但键是通过将 `object` 的每个自有的可枚举字符串键属性
     * 通过 `iteratee` 运行生成的。iteratee 调用三个参数:(value, key, object)。
     *
     * @static
     * @memberOf _
     * @since 3.8.0
     * @category Object
     * @param {Object} object 要迭代的对象。
     * @param {Function} [iteratee=_.identity] 每次迭代调用的函数。
     * @returns {Object} 返回新的映射后的对象。
     * @see _.mapValues
     * @example
     *
     * _.mapKeys({ 'a': 1, 'b': 2 }, function(value, key) {
     *   return key + value;
     * });
     * // => { 'a1': 1, 'b2': 2 }
     */
    function mapKeys(object, iteratee) {
      var result = {};
      iteratee = getIteratee(iteratee, 3);

      baseForOwn(object, function(value, key, object) {
        baseAssignValue(result, iteratee(value, key, object), value);
      });
      return result;
    }

    /**
     * Creates an object with the same keys as `object` and values generated
     * by running each own enumerable string keyed property of `object` thru
     * `iteratee`. The iteratee is invoked with three arguments:
     * (value, key, object).
     *
     * @static
     * @memberOf _
     * @since 2.4.0
     * @category Object
     * @param {Object} object 要迭代的对象。
     * @param {Function} [iteratee=_.identity] 每次迭代调用的函数。
     * @returns {Object} 返回新的映射后的对象。
     * @see _.mapKeys
     * @example
     *
     * var users = {
     *   'fred':    { 'user': 'fred',    'age': 40 },
     *   'pebbles': { 'user': 'pebbles', 'age': 1 }
     * };
     *
     * _.mapValues(users, function(o) { return o.age; });
     * // => { 'fred': 40, 'pebbles': 1 } (迭代顺序不保证)
     *
     * // The `_.property` iteratee shorthand.
     * _.mapValues(users, 'age');
     * // => { 'fred': 40, 'pebbles': 1 } (迭代顺序不保证)
     */
    function mapValues(object, iteratee) {
      var result = {};
      iteratee = getIteratee(iteratee, 3);

      baseForOwn(object, function(value, key, object) {
        baseAssignValue(result, key, iteratee(value, key, object));
      });
      return result;
    }

    /**
     * 此方法类似 `_.assign`,但它递归地将源对象的自有的和继承的
     * 可枚举字符串键属性合并到目标对象中。如果目标值已存在,
     * 则跳过解析为 `undefined` 的源属性。数组和普通对象属性会递归合并。
     * 其他对象和值类型通过赋值覆盖。源对象从左到右应用。
     * 后续源将覆盖先前源的属性赋值。
     *
     * **注意:** 此方法会改变 `object`。
     *
     * @static
     * @memberOf _
     * @since 0.5.0
     * @category Object
     * @param {Object} object 目标对象。
     * @param {...Object} [sources] 源对象。
     * @returns {Object} 返回 `object`。
     * @example
     *
     * var object = {
     *   'a': [{ 'b': 2 }, { 'd': 4 }]
     * };
     *
     * var other = {
     *   'a': [{ 'c': 3 }, { 'e': 5 }]
     * };
     *
     * _.merge(object, other);
     * // => { 'a': [{ 'b': 2, 'c': 3 }, { 'd': 4, 'e': 5 }] }
     */
    var merge = createAssigner(function(object, source, srcIndex) {
      baseMerge(object, source, srcIndex);
    });

    /**
     * 此方法类似 `_.merge`,但它接受一个 `customizer`,用于生成目标属性和源属性的合并值。
     * 如果 `customizer` 返回 `undefined`,则由该方法处理合并。
     * `customizer` 调用六个参数:(objValue, srcValue, key, object, source, stack)。
     *
     * **注意:** 此方法会改变 `object`。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Object
     * @param {Object} object 目标对象。
     * @param {...Object} sources 源对象。
     * @param {Function} customizer 自定义分配值的函数。
     * @returns {Object} 返回 `object`。
     * @example
     *
     * function customizer(objValue, srcValue) {
     *   if (_.isArray(objValue)) {
     *     return objValue.concat(srcValue);
     *   }
     * }
     *
     * var object = { 'a': [1], 'b': [2] };
     * var other = { 'a': [3], 'b': [4] };
     *
     * _.mergeWith(object, other, customizer);
     * // => { 'a': [1, 3], 'b': [2, 4] }
     */
    var mergeWith = createAssigner(function(object, source, srcIndex, customizer) {
      baseMerge(object, source, srcIndex, customizer);
    });

    /**
     * 与 `_.pick` 相反;此方法创建一个对象,该对象由 `object` 的自有的和继承的
     * 可枚举属性路径中未省略的部分组成。
     *
     * **注意:** 此方法比 `_.pick` 慢得多。
     *
     * @static
     * @since 0.1.0
     * @memberOf _
     * @category Object
     * @param {Object} object 源对象。
     * @param {...(string|string[])} [paths] 要省略的属性路径。
     * @returns {Object} 返回新对象。
     * @example
     *
     * var object = { 'a': 1, 'b': '2', 'c': 3 };
     *
     * _.omit(object, ['a', 'c']);
     * // => { 'b': '2' }
     */
    var omit = flatRest(function(object, paths) {
      var result = {};
      if (object == null) {
        return result;
      }
      var isDeep = false;
      paths = arrayMap(paths, function(path) {
        path = castPath(path, object);
        isDeep || (isDeep = path.length > 1);
        return path;
      });
      copyObject(object, getAllKeysIn(object), result);
      if (isDeep) {
        result = baseClone(result, CLONE_DEEP_FLAG | CLONE_FLAT_FLAG | CLONE_SYMBOLS_FLAG, customOmitClone);
      }
      var length = paths.length;
      while (length--) {
        baseUnset(result, paths[length]);
      }
      return result;
    });

    /**
     * 与 `_.pickBy` 相反;此方法创建一个对象,该对象由 `object` 的自有的和继承的
     * 可枚举字符串键属性中 `predicate` 返回假值的部分组成。
     * predicate 调用两个参数:(value, key)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Object
     * @param {Object} object 源对象。
     * @param {Function} [predicate=_.identity] 每个属性调用的函数。
     * @returns {Object} 返回新对象。
     * @example
     *
     * var object = { 'a': 1, 'b': '2', 'c': 3 };
     *
     * _.omitBy(object, _.isNumber);
     * // => { 'b': '2' }
     */
    function omitBy(object, predicate) {
      return pickBy(object, negate(getIteratee(predicate)));
    }

    /**
     * 创建一个由选取的 `object` 属性组成的对象。
     *
     * @static
     * @since 0.1.0
     * @memberOf _
     * @category Object
     * @param {Object} object 源对象。
     * @param {...(string|string[])} [paths] 要选取的属性路径。
     * @returns {Object} 返回新对象。
     * @example
     *
     * var object = { 'a': 1, 'b': '2', 'c': 3 };
     *
     * _.pick(object, ['a', 'c']);
     * // => { 'a': 1, 'c': 3 }
     */
    var pick = flatRest(function(object, paths) {
      return object == null ? {} : basePick(object, paths);
    });

    /**
     * 创建一个由 `object` 的属性中 `predicate` 返回真值的部分组成的对象。
     * predicate 调用两个参数:(value, key)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Object
     * @param {Object} object 源对象。
     * @param {Function} [predicate=_.identity] 每个属性调用的函数。
     * @returns {Object} 返回新对象。
     * @example
     *
     * var object = { 'a': 1, 'b': '2', 'c': 3 };
     *
     * _.pickBy(object, _.isNumber);
     * // => { 'a': 1, 'c': 3 }
     */
    function pickBy(object, predicate) {
      if (object == null) {
        return {};
      }
      var props = arrayMap(getAllKeysIn(object), function(prop) {
        return [prop];
      });
      predicate = getIteratee(predicate);
      return basePickBy(object, props, function(value, path) {
        return predicate(value, path[0]);
      });
    }

    /**
     * 此方法类似 `_.get`,不同之处在于如果解析的值是函数,
     * 则使用其父对象的 `this` 绑定调用它,并返回其结果。
     *
     * @static
     * @since 0.1.0
     * @memberOf _
     * @category Object
     * @param {Object} object 要查询的对象。
     * @param {Array|string} path 要解析的属性路径。
     * @param {*} [defaultValue] `undefined` 解析值返回的默认值。
     * @returns {*} 返回解析后的值。
     * @example
     *
     * var object = { 'a': [{ 'b': { 'c1': 3, 'c2': _.constant(4) } }] };
     *
     * _.result(object, 'a[0].b.c1');
     * // => 3
     *
     * _.result(object, 'a[0].b.c2');
     * // => 4
     *
     * _.result(object, 'a[0].b.c3', 'default');
     * // => 'default'
     *
     * _.result(object, 'a[0].b.c3', _.constant('default'));
     * // => 'default'
     */
    function result(object, path, defaultValue) {
      path = castPath(path, object);

      var index = -1,
          length = path.length;

      // Ensure the loop is entered when path is empty.
      if (!length) {
        length = 1;
        object = undefined;
      }
      while (++index < length) {
        var value = object == null ? undefined : object[toKey(path[index])];
        if (value === undefined) {
          index = length;
          value = defaultValue;
        }
        object = isFunction(value) ? value.call(object) : value;
      }
      return object;
    }

    /**
     * 设置 `object` 的 `path` 路径上的值。如果 `path` 的某个部分不存在,则创建它。
     * 缺失的索引属性会创建数组,其他缺失的属性会创建对象。
     * 使用 `_.setWith` 自定义 `path` 的创建。
     *
     * **注意:** 此方法会改变 `object`。
     *
     * @static
     * @memberOf _
     * @since 3.7.0
     * @category Object
     * @param {Object} object 要修改的对象。
     * @param {Array|string} path 要设置的属性路径。
     * @param {*} value 要设置的值。
     * @returns {Object} 返回 `object`。
     * @example
     *
     * var object = { 'a': [{ 'b': { 'c': 3 } }] };
     *
     * _.set(object, 'a[0].b.c', 4);
     * console.log(object.a[0].b.c);
     * // => 4
     *
     * _.set(object, ['x', '0', 'y', 'z'], 5);
     * console.log(object.x[0].y.z);
     * // => 5
     */
    function set(object, path, value) {
      return object == null ? object : baseSet(object, path, value);
    }

    /**
     * 此方法类似 `_.set`,但它接受一个 `customizer`,用于生成 `path` 的对象。
     * 如果 `customizer` 返回 `undefined`,则由该方法处理路径创建。
     * `customizer` 调用三个参数:(nsValue, key, nsObject)。
     *
     * **注意:** 此方法会改变 `object`。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Object
     * @param {Object} object 要修改的对象。
     * @param {Array|string} path 要设置的属性路径。
     * @param {*} value 要设置的值。
     * @param {Function} [customizer] 自定义分配值的函数。
     * @returns {Object} 返回 `object`。
     * @example
     *
     * var object = {};
     *
     * _.setWith(object, '[0][1]', 'a', Object);
     * // => { '0': { '1': 'a' } }
     */
    function setWith(object, path, value, customizer) {
      customizer = typeof customizer == 'function' ? customizer : undefined;
      return object == null ? object : baseSet(object, path, value, customizer);
    }

    /**
     * 为 `object` 创建一个包含自有可枚举字符串键值对的数组,
     * 可通过 `_.fromPairs` 消费。如果 `object` 是 Map 或 Set,则返回其条目。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @alias entries
     * @category Object
     * @param {Object} object 要查询的对象。
     * @returns {Array} 返回键值对数组。
     * @example
     *
     * function Foo() {
     *   this.a = 1;
     *   this.b = 2;
     * }
     *
     * Foo.prototype.c = 3;
     *
     * _.toPairs(new Foo);
     * // => [['a', 1], ['b', 2]] (迭代顺序不保证)
     */
    var toPairs = createToPairs(keys);

    /**
     * 为 `object` 创建一个包含自有的和继承的可枚举字符串键值对的数组,
     * 可通过 `_.fromPairs` 消费。如果 `object` 是 Map 或 Set,则返回其条目。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @alias entriesIn
     * @category Object
     * @param {Object} object 要查询的对象。
     * @returns {Array} 返回键值对数组。
     * @example
     *
     * function Foo() {
     *   this.a = 1;
     *   this.b = 2;
     * }
     *
     * Foo.prototype.c = 3;
     *
     * _.toPairsIn(new Foo);
     * // => [['a', 1], ['b', 2], ['c', 3]] (迭代顺序不保证)
     */
    var toPairsIn = createToPairs(keysIn);

    /**
     * `_.reduce` 的替代方法;此方法将 `object` 转换为一个新的 `accumulator` 对象,
     * 该对象是通过将 `object` 的每个自有的可枚举字符串键属性
     * 通过 `iteratee` 运行的结果,每次调用都可能改变 `accumulator` 对象。
     * 如果未提供 `accumulator`,则使用具有相同 `[[Prototype]]` 的新对象。
     * iteratee 调用四个参数:(accumulator, value, key, object)。
     * 迭代器函数可以通过明确返回 `false` 来提前退出迭代。
     *
     * @static
     * @memberOf _
     * @since 1.3.0
     * @category Object
     * @param {Object} object 要迭代的对象。
     * @param {Function} [iteratee=_.identity] 每次迭代调用的函数。
     * @param {*} [accumulator] 自定义累加值。
     * @returns {*} 返回累加值。
     * @example
     *
     * _.transform([2, 3, 4], function(result, n) {
     *   result.push(n *= n);
     *   return n % 2 == 0;
     * }, []);
     * // => [4, 9]
     *
     * _.transform({ 'a': 1, 'b': 2, 'c': 1 }, function(result, value, key) {
     *   (result[value] || (result[value] = [])).push(key);
     * }, {});
     * // => { '1': ['a', 'c'], '2': ['b'] }
     */
    function transform(object, iteratee, accumulator) {
      var isArr = isArray(object),
          isArrLike = isArr || isBuffer(object) || isTypedArray(object);

      iteratee = getIteratee(iteratee, 4);
      if (accumulator == null) {
        var Ctor = object && object.constructor;
        if (isArrLike) {
          accumulator = isArr ? new Ctor : [];
        }
        else if (isObject(object)) {
          accumulator = isFunction(Ctor) ? baseCreate(getPrototype(object)) : {};
        }
        else {
          accumulator = {};
        }
      }
      (isArrLike ? arrayEach : baseForOwn)(object, function(value, index, object) {
        return iteratee(accumulator, value, index, object);
      });
      return accumulator;
    }

    /**
     * 删除 `object` 的 `path` 路径上的属性。
     *
     * **注意:** 此方法会改变 `object`。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Object
     * @param {Object} object 要修改的对象。
     * @param {Array|string} path 要删除的属性路径。
     * @returns {boolean} 如果属性被删除则返回 `true`,否则返回 `false`。
     * @example
     *
     * var object = { 'a': [{ 'b': { 'c': 7 } }] };
     * _.unset(object, 'a[0].b.c');
     * // => true
     *
     * console.log(object);
     * // => { 'a': [{ 'b': {} }] };
     *
     * _.unset(object, ['a', '0', 'b', 'c']);
     * // => true
     *
     * console.log(object);
     * // => { 'a': [{ 'b': {} }] };
     */
    function unset(object, path) {
      return object == null ? true : baseUnset(object, path);
    }

    /**
     * 此方法类似 `_.set`,但它接受一个 `updater` 来产生要设置的值。
     * 使用 `_.updateWith` 自定义 `path` 的创建。`updater` 调用一个参数:(value)。
     *
     * **注意:** 此方法会改变 `object`。
     *
     * @static
     * @memberOf _
     * @since 4.6.0
     * @category Object
     * @param {Object} object 要修改的对象。
     * @param {Array|string} path 要设置的属性路径。
     * @param {Function} updater 产生更新值的函数。
     * @returns {Object} 返回 `object`。
     * @example
     *
     * var object = { 'a': [{ 'b': { 'c': 3 } }] };
     *
     * _.update(object, 'a[0].b.c', function(n) { return n * n; });
     * console.log(object.a[0].b.c);
     * // => 9
     *
     * _.update(object, 'x[0].y.z', function(n) { return n ? n + 1 : 0; });
     * console.log(object.x[0].y.z);
     * // => 0
     */
    function update(object, path, updater) {
      return object == null ? object : baseUpdate(object, path, castFunction(updater));
    }

    /**
     * 此方法类似 `_.update`,但它接受一个 `customizer`,用于生成 `path` 的对象。
     * 如果 `customizer` 返回 `undefined`,则由该方法处理路径创建。
     * `customizer` 调用三个参数:(nsValue, key, nsObject)。
     *
     * **注意:** 此方法会改变 `object`。
     *
     * @static
     * @memberOf _
     * @since 4.6.0
     * @category Object
     * @param {Object} object 要修改的对象。
     * @param {Array|string} path 要设置的属性路径。
     * @param {Function} updater 产生更新值的函数。
     * @param {Function} [customizer] 自定义分配值的函数。
     * @returns {Object} 返回 `object`。
     * @example
     *
     * var object = {};
     *
     * _.updateWith(object, '[0][1]', _.constant('a'), Object);
     * // => { '0': { '1': 'a' } }
     */
    function updateWith(object, path, updater, customizer) {
      customizer = typeof customizer == 'function' ? customizer : undefined;
      return object == null ? object : baseUpdate(object, path, castFunction(updater), customizer);
    }

    /**
     * 创建包含 `object` 自有的可枚举字符串键属性值的数组。
     *
     * **注意:** 非对象值会被强制转换为对象。
     *
     * @static
     * @since 0.1.0
     * @memberOf _
     * @category Object
     * @param {Object} object 要查询的对象。
     * @returns {Array} 返回属性值数组。
     * @example
     *
     * function Foo() {
     *   this.a = 1;
     *   this.b = 2;
     * }
     *
     * Foo.prototype.c = 3;
     *
     * _.values(new Foo);
     * // => [1, 2] (迭代顺序不保证)
     *
     * _.values('hi');
     * // => ['h', 'i']
     */
    function values(object) {
      return object == null ? [] : baseValues(object, keys(object));
    }

    /**
     * 创建包含 `object` 自有的和继承的可枚举字符串键属性值的数组。
     *
     * **注意:** 非对象值会被强制转换为对象。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Object
     * @param {Object} object 要查询的对象。
     * @returns {Array} 返回属性值数组。
     * @example
     *
     * function Foo() {
     *   this.a = 1;
     *   this.b = 2;
     * }
     *
     * Foo.prototype.c = 3;
     *
     * _.valuesIn(new Foo);
     * // => [1, 2, 3] (迭代顺序不保证)
     */
    function valuesIn(object) {
      return object == null ? [] : baseValues(object, keysIn(object));
    }

    /*------------------------------------------------------------------------*/

    /**
     * 将 `number` 限制在 `lower` 和 `upper` 边界之间(含边界)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Number
     * @param {number} number 要限制的数字。
     * @param {number} [lower] 下界。
     * @param {number} upper 上界。
     * @returns {number} 返回限制后的数字。
     * @example
     *
     * _.clamp(-10, -5, 5);
     * // => -5
     *
     * _.clamp(10, -5, 5);
     * // => 5
     */
    function clamp(number, lower, upper) {
      if (upper === undefined) {
        upper = lower;
        lower = undefined;
      }
      if (upper !== undefined) {
        upper = toNumber(upper);
        upper = upper === upper ? upper : 0;
      }
      if (lower !== undefined) {
        lower = toNumber(lower);
        lower = lower === lower ? lower : 0;
      }
      return baseClamp(toNumber(number), lower, upper);
    }

    /**
     * 检查 `number` 是否在 `start` 和 `end` 之间(含 `start`,不含 `end`)。
     * 如果未指定 `end`,则将 `start` 设置为 `0`,并将 `end` 设置为先前的 `start` 值。
     * 如果 `start` 大于 `end`,则交换参数以支持负数范围。
     *
     * @static
     * @memberOf _
     * @since 3.3.0
     * @category Number
     * @param {number} number 要检查的数字。
     * @param {number} [start=0] 范围的起始值。
     * @param {number} end 范围的结束值。
     * @returns {boolean} 如果 `number` 在范围内则返回 `true`,否则返回 `false`。
     * @see _.range, _.rangeRight
     * @example
     *
     * _.inRange(3, 2, 4);
     * // => true
     *
     * _.inRange(4, 8);
     * // => true
     *
     * _.inRange(4, 2);
     * // => false
     *
     * _.inRange(2, 2);
     * // => false
     *
     * _.inRange(1.2, 2);
     * // => true
     *
     * _.inRange(5.2, 4);
     * // => false
     *
     * _.inRange(-3, -2, -6);
     * // => true
     */
    function inRange(number, start, end) {
      start = toFinite(start);
      if (end === undefined) {
        end = start;
        start = 0;
      } else {
        end = toFinite(end);
      }
      number = toNumber(number);
      return baseInRange(number, start, end);
    }

    /**
     * 产生一个在(含) `lower` 和 `upper` 边界之间的随机数。
     * 如果只提供一个参数,则返回一个介于 `0` 和给定数字之间的数字。
     * 如果 `floating` 为 `true`,或者 `lower` 或 `upper` 是浮点数,
     * 则返回浮点数而不是整数。
     *
     * **注意:** JavaScript 遵循 IEEE-754 标准处理浮点数,这可能产生意想不到的结果。
     *
     * **注意:** 如果 `lower` 大于 `upper`,则交换值。
     *
     * @static
     * @memberOf _
     * @since 0.7.0
     * @category Number
     * @param {number} [lower=0] 下界。
     * @param {number} [upper=1] 上界。
     * @param {boolean} [floating] 指定返回浮点数。
     * @returns {number} 返回随机数。
     * @example
     *
     * _.random(0, 5);
     * // => 0 到 5 之间的整数
     *
     * // 当 lower 大于 upper 时,值会被交换
     * _.random(5, 0);
     * // => 0 到 5 之间的整数
     *
     * _.random(5);
     * // => 同样返回 0 到 5 之间的整数
     *
     * _.random(-5);
     * // => -5 到 0 之间的整数
     *
     * _.random(5, true);
     * // => 0 到 5 之间的浮点数
     *
     * _.random(1.2, 5.2);
     * // => 1.2 到 5.2 之间的浮点数
     */
    function random(lower, upper, floating) {
      if (floating && typeof floating != 'boolean' && isIterateeCall(lower, upper, floating)) {
        upper = floating = undefined;
      }
      if (floating === undefined) {
        if (typeof upper == 'boolean') {
          floating = upper;
          upper = undefined;
        }
        else if (typeof lower == 'boolean') {
          floating = lower;
          lower = undefined;
        }
      }
      if (lower === undefined && upper === undefined) {
        lower = 0;
        upper = 1;
      }
      else {
        lower = toFinite(lower);
        if (upper === undefined) {
          upper = lower;
          lower = 0;
        } else {
          upper = toFinite(upper);
        }
      }
      if (lower > upper) {
        var temp = lower;
        lower = upper;
        upper = temp;
      }
      if (floating || lower % 1 || upper % 1) {
        var rand = nativeRandom();
        return nativeMin(lower + (rand * (upper - lower + freeParseFloat('1e-' + ((rand + '').length - 1)))), upper);
      }
      return baseRandom(lower, upper);
    }

    /*------------------------------------------------------------------------*/

    /**
     * 将 `string` 转换为[驼峰命名](https://en.wikipedia.org/wiki/CamelCase)。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category String
     * @param {string} [string=''] 要转换的字符串。
     * @returns {string} 返回驼峰命名的字符串。
     * @example
     *
     * _.camelCase('Foo Bar');
     * // => 'fooBar'
     *
     * _.camelCase('--foo-bar--');
     * // => 'fooBar'
     *
     * _.camelCase('__FOO_BAR__');
     * // => 'fooBar'
     */
    var camelCase = createCompounder(function(result, word, index) {
      word = word.toLowerCase();
      return result + (index ? capitalize(word) : word);
    });

    /**
     * 将 `string` 的第一个字符转换为大写,其余字符转换为小写。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category String
     * @param {string} [string=''] 要大写的字符串。
     * @returns {string} 返回大写后的字符串。
     * @example
     *
     * _.capitalize('FRED');
     * // => 'Fred'
     */
    function capitalize(string) {
      return upperFirst(toString(string).toLowerCase());
    }

    /**
     * 通过将
     * [Latin-1 补充](https://en.wikipedia.org/wiki/Latin-1_Supplement_(Unicode_block)#Character_table)
     * 和 [Latin Extended-A](https://en.wikipedia.org/wiki/Latin_Extended-A)
     * 字母转换为基本拉丁字母,并移除
     * [组合变音符号](https://en.wikipedia.org/wiki/Combining_Diacritical_Marks),
     * 来减轻 `string` 的发音。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category String
     * @param {string} [string=''] 要减轻发音的字符串。
     * @returns {string} 返回减轻发音后的字符串。
     * @example
     *
     * _.deburr('déjà vu');
     * // => 'deja vu'
     */
    function deburr(string) {
      string = toString(string);
      return string && string.replace(reLatin, deburrLetter).replace(reComboMark, '');
    }

    /**
     * 检查 `string` 是否以 `target` 结尾。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category String
     * @param {string} [string=''] 要检查的字符串。
     * @param {string} [target] 要搜索的字符串。
     * @param {number} [position=string.length] 搜索的位置。
     * @returns {boolean} 如果 `string` 以 `target` 结尾则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.endsWith('abc', 'c');
     * // => true
     *
     * _.endsWith('abc', 'b');
     * // => false
     *
     * _.endsWith('abc', 'b', 2);
     * // => true
     */
    function endsWith(string, target, position) {
      string = toString(string);
      target = baseToString(target);

      var length = string.length;
      position = position === undefined
        ? length
        : baseClamp(toInteger(position), 0, length);

      var end = position;
      position -= target.length;
      return position >= 0 && string.slice(position, end) == target;
    }

    /**
     * 将 `string` 中的字符 "&", "<", ">", '"', 和 "'" 转换为对应的 HTML 实体。
     *
     * **注意:** 不转义其他字符。要转义其他字符,请使用第三方库如 [_he_](https://mths.be/he)。
     *
     * 虽然出于对称性转义了 ">" 字符,但在 HTML 中 ">" 和 "/" 等字符不需要转义,
     * 除非它们是标签或未加引号的属性值的一部分。详见
     * [Mathias Bynens 的文章](https://mathiasbynens.be/notes/ambiguous-ampersands)
     * (在 "semi-related fun fact" 下)。
     *
     * 处理 HTML 时,应始终[引用属性值](http://wonko.com/post/html-escaping)以减少 XSS 攻击向量。
     *
     * @static
     * @since 0.1.0
     * @memberOf _
     * @category String
     * @param {string} [string=''] 要转义的字符串。
     * @returns {string} 返回转义后的字符串。
     * @example
     *
     * _.escape('fred, barney, & pebbles');
     * // => 'fred, barney, &amp; pebbles'
     */
    function escape(string) {
      string = toString(string);
      return (string && reHasUnescapedHtml.test(string))
        ? string.replace(reUnescapedHtml, escapeHtmlChar)
        : string;
    }

    /**
     * 转义 `string` 中的 `RegExp` 特殊字符 "^", "$", "\", ".", "*", "+",
     * "?", "(", ")", "[", "]", "{", "}", 和 "|"。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category String
     * @param {string} [string=''] 要转义的字符串。
     * @returns {string} 返回转义后的字符串。
     * @example
     *
     * _.escapeRegExp('[lodash](https://lodash.com/)');
     * // => '\[lodash\]\(https://lodash\.com/\)'
     */
    function escapeRegExp(string) {
      string = toString(string);
      return (string && reHasRegExpChar.test(string))
        ? string.replace(reRegExpChar, '\\$&')
        : string;
    }

    /**
     * 将 `string` 转换为
     * [短横线命名(kebab case)](https://en.wikipedia.org/wiki/Letter_case#Special_case_styles)。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category String
     * @param {string} [string=''] 要转换的字符串。
     * @returns {string} 返回短横线命名的字符串。
     * @example
     *
     * _.kebabCase('Foo Bar');
     * // => 'foo-bar'
     *
     * _.kebabCase('fooBar');
     * // => 'foo-bar'
     *
     * _.kebabCase('__FOO_BAR__');
     * // => 'foo-bar'
     */
    var kebabCase = createCompounder(function(result, word, index) {
      return result + (index ? '-' : '') + word.toLowerCase();
    });

    /**
     * 将 `string`(以空格分隔的单词)转换为小写。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category String
     * @param {string} [string=''] 要转换的字符串。
     * @returns {string} 返回小写后的字符串。
     * @example
     *
     * _.lowerCase('--Foo-Bar--');
     * // => 'foo bar'
     *
     * _.lowerCase('fooBar');
     * // => 'foo bar'
     *
     * _.lowerCase('__FOO_BAR__');
     * // => 'foo bar'
     */
    var lowerCase = createCompounder(function(result, word, index) {
      return result + (index ? ' ' : '') + word.toLowerCase();
    });

    /**
     * 将 `string` 的第一个字符转换为小写。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category String
     * @param {string} [string=''] 要转换的字符串。
     * @returns {string} 返回转换后的字符串。
     * @example
     *
     * _.lowerFirst('Fred');
     * // => 'fred'
     *
     * _.lowerFirst('FRED');
     * // => 'fRED'
     */
    var lowerFirst = createCaseFirst('toLowerCase');

    /**
     * 如果 `string` 比 `length` 短,则在左右两侧填充。
     * 如果填充字符不能被 `length` 整除,则截断填充字符。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category String
     * @param {string} [string=''] 要填充的字符串。
     * @param {number} [length=0] 填充长度。
     * @param {string} [chars=' '] 用作填充的字符串。
     * @returns {string} 返回填充后的字符串。
     * @example
     *
     * _.pad('abc', 8);
     * // => '  abc   '
     *
     * _.pad('abc', 8, '_-');
     * // => '_-abc_-_'
     *
     * _.pad('abc', 3);
     * // => 'abc'
     */
    function pad(string, length, chars) {
      string = toString(string);
      length = toInteger(length);

      var strLength = length ? stringSize(string) : 0;
      if (!length || strLength >= length) {
        return string;
      }
      var mid = (length - strLength) / 2;
      return (
        createPadding(nativeFloor(mid), chars) +
        string +
        createPadding(nativeCeil(mid), chars)
      );
    }

    /**
     * 如果 `string` 比 `length` 短,则在右侧填充。
     * 如果填充字符超过 `length`,则截断填充字符。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category String
     * @param {string} [string=''] 要填充的字符串。
     * @param {number} [length=0] 填充长度。
     * @param {string} [chars=' '] 用作填充的字符串。
     * @returns {string} 返回填充后的字符串。
     * @example
     *
     * _.padEnd('abc', 6);
     * // => 'abc   '
     *
     * _.padEnd('abc', 6, '_-');
     * // => 'abc_-_'
     *
     * _.padEnd('abc', 3);
     * // => 'abc'
     */
    function padEnd(string, length, chars) {
      string = toString(string);
      length = toInteger(length);

      var strLength = length ? stringSize(string) : 0;
      return (length && strLength < length)
        ? (string + createPadding(length - strLength, chars))
        : string;
    }

    /**
     * 如果 `string` 比 `length` 短,则在左侧填充。
     * 如果填充字符超过 `length`,则截断填充字符。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category String
     * @param {string} [string=''] 要填充的字符串。
     * @param {number} [length=0] 填充长度。
     * @param {string} [chars=' '] 用作填充的字符串。
     * @returns {string} 返回填充后的字符串。
     * @example
     *
     * _.padStart('abc', 6);
     * // => '   abc'
     *
     * _.padStart('abc', 6, '_-');
     * // => '_-_abc'
     *
     * _.padStart('abc', 3);
     * // => 'abc'
     */
    function padStart(string, length, chars) {
      string = toString(string);
      length = toInteger(length);

      var strLength = length ? stringSize(string) : 0;
      return (length && strLength < length)
        ? (createPadding(length - strLength, chars) + string)
        : string;
    }

    /**
     * 将 `string` 转换为指定进制的整数。如果 `radix` 是 `undefined` 或 `0`,
     * 则使用 `10` 作为 `radix`,除非 `value` 是十六进制,
     * 在这种情况下使用 `16` 作为 `radix`。
     *
     * **注意:** 此方法与 `parseInt` 的
     * [ES5 实现](https://es5.github.io/#x15.1.2.2) 对齐。
     *
     * @static
     * @memberOf _
     * @since 1.1.0
     * @category String
     * @param {string} string 要转换的字符串。
     * @param {number} [radix=10] 解释 `value` 的进制。
     * @param- {Object} [guard] 启用作为类似 `_.map` 方法的迭代器。
     * @returns {number} 返回转换后的整数。
     * @example
     *
     * _.parseInt('08');
     * // => 8
     *
     * _.map(['6', '08', '10'], _.parseInt);
     * // => [6, 8, 10]
     */
    function parseInt(string, radix, guard) {
      if (guard || radix == null) {
        radix = 0;
      } else if (radix) {
        radix = +radix;
      }
      return nativeParseInt(toString(string).replace(reTrimStart, ''), radix || 0);
    }

    /**
     * 将给定字符串重复 `n` 次。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category String
     * @param {string} [string=''] 要重复的字符串。
     * @param {number} [n=1] 重复字符串的次数。
     * @param- {Object} [guard] 启用作为类似 `_.map` 方法的迭代器。
     * @returns {string} 返回重复后的字符串。
     * @example
     *
     * _.repeat('*', 3);
     * // => '***'
     *
     * _.repeat('abc', 2);
     * // => 'abcabc'
     *
     * _.repeat('abc', 0);
     * // => ''
     */
    function repeat(string, n, guard) {
      if ((guard ? isIterateeCall(string, n, guard) : n === undefined)) {
        n = 1;
      } else {
        n = toInteger(n);
      }
      return baseRepeat(toString(string), n);
    }

    /**
     * 用 `replacement` 替换 `string` 中匹配 `pattern` 的部分。
     *
     * **注意:** 此方法基于
     * [`String#replace`](https://mdn.io/String/replace)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category String
     * @param {string} [string=''] 要修改的字符串。
     * @param {RegExp|string} pattern 要替换的模式。
     * @param {Function|string} replacement 匹配项的替换内容。
     * @returns {string} 返回修改后的字符串。
     * @example
     *
     * _.replace('Hi Fred', 'Fred', 'Barney');
     * // => 'Hi Barney'
     */
    function replace() {
      var args = arguments,
          string = toString(args[0]);

      return args.length < 3 ? string : string.replace(args[1], args[2]);
    }

    /**
     * 将 `string` 转换为
     * [蛇形命名(snake case)](https://en.wikipedia.org/wiki/Snake_case)。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category String
     * @param {string} [string=''] 要转换的字符串。
     * @returns {string} 返回蛇形命名的字符串。
     * @example
     *
     * _.snakeCase('Foo Bar');
     * // => 'foo_bar'
     *
     * _.snakeCase('fooBar');
     * // => 'foo_bar'
     *
     * _.snakeCase('--FOO-BAR--');
     * // => 'foo_bar'
     */
    var snakeCase = createCompounder(function(result, word, index) {
      return result + (index ? '_' : '') + word.toLowerCase();
    });

    /**
     * 通过 `separator` 分隔 `string`。
     *
     * **注意:** 此方法基于
     * [`String#split`](https://mdn.io/String/split)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category String
     * @param {string} [string=''] 要分隔的字符串。
     * @param {RegExp|string} separator 分隔的模式。
     * @param {number} [limit] 截断结果的长度。
     * @returns {Array} 返回字符串段。
     * @example
     *
     * _.split('a-b-c', '-', 2);
     * // => ['a', 'b']
     */
    function split(string, separator, limit) {
      if (limit && typeof limit != 'number' && isIterateeCall(string, separator, limit)) {
        separator = limit = undefined;
      }
      limit = limit === undefined ? MAX_ARRAY_LENGTH : limit >>> 0;
      if (!limit) {
        return [];
      }
      string = toString(string);
      if (string && (
            typeof separator == 'string' ||
            (separator != null && !isRegExp(separator))
          )) {
        separator = baseToString(separator);
        if (!separator && hasUnicode(string)) {
          return castSlice(stringToArray(string), 0, limit);
        }
      }
      return string.split(separator, limit);
    }

    /**
     * 将 `string` 转换为
     * [首字母大写(start case)](https://en.wikipedia.org/wiki/Letter_case#Stylistic_or_specialised_usage)。
     *
     * @static
     * @memberOf _
     * @since 3.1.0
     * @category String
     * @param {string} [string=''] 要转换的字符串。
     * @returns {string} 返回首字母大写后的字符串。
     * @example
     *
     * _.startCase('--foo-bar--');
     * // => 'Foo Bar'
     *
     * _.startCase('fooBar');
     * // => 'Foo Bar'
     *
     * _.startCase('__FOO_BAR__');
     * // => 'FOO BAR'
     */
    var startCase = createCompounder(function(result, word, index) {
      return result + (index ? ' ' : '') + upperFirst(word);
    });

    /**
     * 检查 `string` 是否以 `target` 开头。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category String
     * @param {string} [string=''] 要检查的字符串。
     * @param {string} [target] 要搜索的字符串。
     * @param {number} [position=0] 开始搜索的位置。
     * @returns {boolean} 如果 `string` 以 `target` 开头则返回 `true`,否则返回 `false`。
     * @example
     *
     * _.startsWith('abc', 'a');
     * // => true
     *
     * _.startsWith('abc', 'b');
     * // => false
     *
     * _.startsWith('abc', 'b', 1);
     * // => true
     */
    function startsWith(string, target, position) {
      string = toString(string);
      position = position == null
        ? 0
        : baseClamp(toInteger(position), 0, string.length);

      target = baseToString(target);
      return string.slice(position, position + target.length) == target;
    }

    /**
     * 创建一个编译后的模板函数,可以在 "interpolate" 分隔符中插入数据属性,
     * 在 "escape" 分隔符中对插入的数据属性进行 HTML 转义,
     * 在 "evaluate" 分隔符中执行 JavaScript。数据属性可以作为自由变量在模板中访问。
     * 如果提供了设置对象,它将优先于 `_.templateSettings` 值。
     *
     * **安全性:** `_.template` 不安全,不应使用。它将在 Lodash v5 中移除。
     * 避免不受信任的输入。详见
     * [威胁模型](https://github.com/lodash/lodash/blob/main/threat-model.md)。
     *
     * **注意:** 在开发构建中,`_.template` 使用
     * [sourceURLs](http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl)
     * 以便于调试。
     *
     * 有关预编译模板的更多信息,请参阅
     * [lodash 自定义构建文档](https://lodash.com/custom-builds)。
     *
     * 有关 Chrome 扩展沙箱的更多信息,请参阅
     * [Chrome 扩展文档](https://developer.chrome.com/extensions/sandboxingEval)。
     *
     * @static
     * @since 0.1.0
     * @memberOf _
     * @category String
     * @param {string} [string=''] 模板字符串。
     * @param {Object} [options={}] 选项对象。
     * @param {RegExp} [options.escape=_.templateSettings.escape]
     *  HTML "escape" 分隔符。
     * @param {RegExp} [options.evaluate=_.templateSettings.evaluate]
     *  "evaluate" 分隔符。
     * @param {Object} [options.imports=_.templateSettings.imports]
     *  导入到模板中作为自由变量的对象。
     * @param {RegExp} [options.interpolate=_.templateSettings.interpolate]
     *  "interpolate" 分隔符。
     * @param {string} [options.sourceURL='lodash.templateSources[n]']
     *  编译后模板的 sourceURL。
     * @param {string} [options.variable='obj']
     *  数据对象变量名。
     * @param- {Object} [guard] 启用作为类似 `_.map` 方法的迭代器。
     * @returns {Function} 返回编译后的模板函数。
     * @example
     *
     * // 使用 "interpolate" 分隔符创建编译后的模板。
     * var compiled = _.template('hello <%= user %>!');
     * compiled({ 'user': 'fred' });
     * // => 'hello fred!'
     *
     * // 使用 HTML "escape" 分隔符转义数据属性值。
     * var compiled = _.template('<b><%- value %></b>');
     * compiled({ 'value': '<script>' });
     * // => '<b>&lt;script&gt;</b>'
     *
     * // 使用 "evaluate" 分隔符执行 JavaScript 并生成 HTML。
     * var compiled = _.template('<% _.forEach(users, function(user) { %><li><%- user %></li><% }); %>');
     * compiled({ 'users': ['fred', 'barney'] });
     * // => '<li>fred</li><li>barney</li>'
     *
     * // 使用内部 `print` 函数在 "evaluate" 分隔符中。
     * var compiled = _.template('<% print("hello " + user); %>!');
     * compiled({ 'user': 'barney' });
     * // => 'hello barney!'
     *
     * // 使用 ES 模板字面量分隔符作为 "interpolate" 分隔符。
     * // 通过替换 "interpolate" 分隔符来禁用支持。
     * var compiled = _.template('hello ${ user }!');
     * compiled({ 'user': 'pebbles' });
     * // => 'hello pebbles!'
     *
     * // 使用反斜杠将分隔符作为纯文本处理。
     * var compiled = _.template('<%= "\\<%- value %\\>" %>');
     * compiled({ 'value': 'ignored' });
     * // => '<%- value %>'
     *
     * // 使用 `imports` 选项将 `jQuery` 作为 `jq` 导入。
     * var text = '<% jq.each(users, function(user) { %><li><%- user %></li><% }); %>';
     * var compiled = _.template(text, { 'imports': { 'jq': jQuery } });
     * compiled({ 'users': ['fred', 'barney'] });
     * // => '<li>fred</li><li>barney</li>'
     *
     * // 使用 `sourceURL` 选项为模板指定自定义 sourceURL。
     * var compiled = _.template('hello <%= user %>!', { 'sourceURL': '/basic/greeting.jst' });
     * compiled(data);
     * // => 在 web 检查器的 Sources 选项卡或 Resources 面板中找到 "greeting.jst" 的源代码。
     *
     * // 使用 `variable` 选项确保编译后的模板中不使用 with 语句。
     * var compiled = _.template('hi <%= data.user %>!', { 'variable': 'data' });
     * compiled.source;
     * // => function(data) {
     * //   var __t, __p = '';
     * //   __p += 'hi ' + ((__t = ( data.user )) == null ? '' : __t) + '!';
     * //   return __p;
     * // }
     *
     * // 使用自定义模板分隔符。
     * _.templateSettings.interpolate = /{{([\s\S]+?)}}/g;
     * var compiled = _.template('hello {{ user }}!');
     * compiled({ 'user': 'mustache' });
     * // => 'hello mustache!'
     *
     * // 使用 `source` 属性将编译后的模板内联,以便在错误消息和堆栈跟踪中获得有意义的行号。
     * fs.writeFileSync(path.join(process.cwd(), 'jst.js'), '\
     *   var JST = {\
     *     "main": ' + _.template(mainText).source + '\
     *   };\
     * ');
     */
    function template(string, options, guard) {
      // Based on John Resig's `tmpl` implementation
      // (http://ejohn.org/blog/javascript-micro-templating/)
      // and Laura Doktorova's doT.js (https://github.com/olado/doT).
      var settings = lodash.templateSettings;

      if (guard && isIterateeCall(string, options, guard)) {
        options = undefined;
      }
      string = toString(string);
      options = assignWith({}, options, settings, customDefaultsAssignIn);

      var imports = assignWith({}, options.imports, settings.imports, customDefaultsAssignIn),
          importsKeys = keys(imports),
          importsValues = baseValues(imports, importsKeys);

      arrayEach(importsKeys, function(key) {
        if (reForbiddenIdentifierChars.test(key)) {
          throw new Error(INVALID_TEMPL_IMPORTS_ERROR_TEXT);
        }
      });

      var isEscaping,
          isEvaluating,
          index = 0,
          interpolate = options.interpolate || reNoMatch,
          source = "__p += '";

      // Compile the regexp to match each delimiter.
      var reDelimiters = RegExp(
        (options.escape || reNoMatch).source + '|' +
        interpolate.source + '|' +
        (interpolate === reInterpolate ? reEsTemplate : reNoMatch).source + '|' +
        (options.evaluate || reNoMatch).source + '|$'
      , 'g');

      // Use a sourceURL for easier debugging.
      // The sourceURL gets injected into the source that's eval-ed, so be careful
      // to normalize all kinds of whitespace, so e.g. newlines (and unicode versions of it) can't sneak in
      // and escape the comment, thus injecting code that gets evaled.
      var sourceURL = '//# sourceURL=' +
        (hasOwnProperty.call(options, 'sourceURL')
          ? (options.sourceURL + '').replace(/\s/g, ' ')
          : ('lodash.templateSources[' + (++templateCounter) + ']')
        ) + '\n';

      string.replace(reDelimiters, function(match, escapeValue, interpolateValue, esTemplateValue, evaluateValue, offset) {
        interpolateValue || (interpolateValue = esTemplateValue);

        // Escape characters that can't be included in string literals.
        source += string.slice(index, offset).replace(reUnescapedString, escapeStringChar);

        // Replace delimiters with snippets.
        if (escapeValue) {
          isEscaping = true;
          source += "' +\n__e(" + escapeValue + ") +\n'";
        }
        if (evaluateValue) {
          isEvaluating = true;
          source += "';\n" + evaluateValue + ";\n__p += '";
        }
        if (interpolateValue) {
          source += "' +\n((__t = (" + interpolateValue + ")) == null ? '' : __t) +\n'";
        }
        index = offset + match.length;

        // The JS engine embedded in Adobe products needs `match` returned in
        // order to produce the correct `offset` value.
        return match;
      });

      source += "';\n";

      // If `variable` is not specified wrap a with-statement around the generated
      // code to add the data object to the top of the scope chain.
      var variable = hasOwnProperty.call(options, 'variable') && options.variable;
      if (!variable) {
        source = 'with (obj) {\n' + source + '\n}\n';
      }
      // Throw an error if a forbidden character was found in `variable`, to prevent
      // potential command injection attacks.
      else if (reForbiddenIdentifierChars.test(variable)) {
        throw new Error(INVALID_TEMPL_VAR_ERROR_TEXT);
      }

      // Cleanup code by stripping empty strings.
      source = (isEvaluating ? source.replace(reEmptyStringLeading, '') : source)
        .replace(reEmptyStringMiddle, '$1')
        .replace(reEmptyStringTrailing, '$1;');

      // Frame code as the function body.
      source = 'function(' + (variable || 'obj') + ') {\n' +
        (variable
          ? ''
          : 'obj || (obj = {});\n'
        ) +
        "var __t, __p = ''" +
        (isEscaping
           ? ', __e = _.escape'
           : ''
        ) +
        (isEvaluating
          ? ', __j = Array.prototype.join;\n' +
            "function print() { __p += __j.call(arguments, '') }\n"
          : ';\n'
        ) +
        source +
        'return __p\n}';

      var result = attempt(function() {
        return Function(importsKeys, sourceURL + 'return ' + source)
          .apply(undefined, importsValues);
      });

      // Provide the compiled function's source by its `toString` method or
      // the `source` property as a convenience for inlining compiled templates.
      result.source = source;
      if (isError(result)) {
        throw result;
      }
      return result;
    }

    /**
     * 将 `string` 整体转换为小写,类似于
     * [String#toLowerCase](https://mdn.io/toLowerCase)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category String
     * @param {string} [string=''] 要转换的字符串。
     * @returns {string} 返回小写后的字符串。
     * @example
     *
     * _.toLower('--Foo-Bar--');
     * // => '--foo-bar--'
     *
     * _.toLower('fooBar');
     * // => 'foobar'
     *
     * _.toLower('__FOO_BAR__');
     * // => '__foo_bar__'
     */
    function toLower(value) {
      return toString(value).toLowerCase();
    }

    /**
     * 将 `string` 整体转换为大写,类似于
     * [String#toUpperCase](https://mdn.io/toUpperCase)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category String
     * @param {string} [string=''] 要转换的字符串。
     * @returns {string} 返回大写后的字符串。
     * @example
     *
     * _.toUpper('--foo-bar--');
     * // => '--FOO-BAR--'
     *
     * _.toUpper('fooBar');
     * // => 'FOOBAR'
     *
     * _.toUpper('__foo_bar__');
     * // => '__FOO_BAR__'
     */
    function toUpper(value) {
      return toString(value).toUpperCase();
    }

    /**
     * 从 `string` 移除前后空白或指定字符。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category String
     * @param {string} [string=''] 要修剪的字符串。
     * @param {string} [chars=whitespace] 要修剪的字符。
     * @param- {Object} [guard] 启用作为类似 `_.map` 方法的迭代器。
     * @returns {string} 返回修剪后的字符串。
     * @example
     *
     * _.trim('  abc  ');
     * // => 'abc'
     *
     * _.trim('-_-abc-_-', '_-');
     * // => 'abc'
     *
     * _.map(['  foo  ', '  bar  '], _.trim);
     * // => ['foo', 'bar']
     */
    function trim(string, chars, guard) {
      string = toString(string);
      if (string && (guard || chars === undefined)) {
        return baseTrim(string);
      }
      if (!string || !(chars = baseToString(chars))) {
        return string;
      }
      var strSymbols = stringToArray(string),
          chrSymbols = stringToArray(chars),
          start = charsStartIndex(strSymbols, chrSymbols),
          end = charsEndIndex(strSymbols, chrSymbols) + 1;

      return castSlice(strSymbols, start, end).join('');
    }

    /**
     * 从 `string` 移除尾部空白或指定字符。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category String
     * @param {string} [string=''] 要修剪的字符串。
     * @param {string} [chars=whitespace] 要修剪的字符。
     * @param- {Object} [guard] 启用作为类似 `_.map` 方法的迭代器。
     * @returns {string} 返回修剪后的字符串。
     * @example
     *
     * _.trimEnd('  abc  ');
     * // => '  abc'
     *
     * _.trimEnd('-_-abc-_-', '_-');
     * // => '-_-abc'
     */
    function trimEnd(string, chars, guard) {
      string = toString(string);
      if (string && (guard || chars === undefined)) {
        return string.slice(0, trimmedEndIndex(string) + 1);
      }
      if (!string || !(chars = baseToString(chars))) {
        return string;
      }
      var strSymbols = stringToArray(string),
          end = charsEndIndex(strSymbols, stringToArray(chars)) + 1;

      return castSlice(strSymbols, 0, end).join('');
    }

    /**
     * 从 `string` 移除首部空白或指定字符。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category String
     * @param {string} [string=''] 要修剪的字符串。
     * @param {string} [chars=whitespace] 要修剪的字符。
     * @param- {Object} [guard] 启用作为类似 `_.map` 方法的迭代器。
     * @returns {string} 返回修剪后的字符串。
     * @example
     *
     * _.trimStart('  abc  ');
     * // => 'abc  '
     *
     * _.trimStart('-_-abc-_-', '_-');
     * // => 'abc-_-'
     */
    function trimStart(string, chars, guard) {
      string = toString(string);
      if (string && (guard || chars === undefined)) {
        return string.replace(reTrimStart, '');
      }
      if (!string || !(chars = baseToString(chars))) {
        return string;
      }
      var strSymbols = stringToArray(string),
          start = charsStartIndex(strSymbols, stringToArray(chars));

      return castSlice(strSymbols, start).join('');
    }

    /**
     * 如果 `string` 长度超过了最大字符串长度,则截断 `string`。
     * 截断后字符串的末尾字符会被省略字符串替换,省略字符串默认为 "..."。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category String
     * @param {string} [string=''] 要截断的字符串。
     * @param {Object} [options={}] 选项对象。
     * @param {number} [options.length=30] 最大字符串长度。
     * @param {string} [options.omission='...'] 指示省略文本的字符串。
     * @param {RegExp|string} [options.separator] 要截断的分隔符模式。
     * @returns {string} 返回截断后的字符串。
     * @example
     *
     * _.truncate('hi-diddly-ho there, neighborino');
     * // => 'hi-diddly-ho there, neighbo...'
     *
     * _.truncate('hi-diddly-ho there, neighborino', {
     *   'length': 24,
     *   'separator': ' '
     * });
     * // => 'hi-diddly-ho there,...'
     *
     * _.truncate('hi-diddly-ho there, neighborino', {
     *   'length': 24,
     *   'separator': /,? +/
     * });
     * // => 'hi-diddly-ho there...'
     *
     * _.truncate('hi-diddly-ho there, neighborino', {
     *   'omission': ' [...]'
     * });
     * // => 'hi-diddly-ho there, neig [...]'
     */
    function truncate(string, options) {
      var length = DEFAULT_TRUNC_LENGTH,
          omission = DEFAULT_TRUNC_OMISSION;

      if (isObject(options)) {
        var separator = 'separator' in options ? options.separator : separator;
        length = 'length' in options ? toInteger(options.length) : length;
        omission = 'omission' in options ? baseToString(options.omission) : omission;
      }
      string = toString(string);

      var strLength = string.length;
      if (hasUnicode(string)) {
        var strSymbols = stringToArray(string);
        strLength = strSymbols.length;
      }
      if (length >= strLength) {
        return string;
      }
      var end = length - stringSize(omission);
      if (end < 1) {
        return omission;
      }
      var result = strSymbols
        ? castSlice(strSymbols, 0, end).join('')
        : string.slice(0, end);

      if (separator === undefined) {
        return result + omission;
      }
      if (strSymbols) {
        end += (result.length - end);
      }
      if (isRegExp(separator)) {
        if (string.slice(end).search(separator)) {
          var match,
              substring = result;

          if (!separator.global) {
            separator = RegExp(separator.source, toString(reFlags.exec(separator)) + 'g');
          }
          separator.lastIndex = 0;
          while ((match = separator.exec(substring))) {
            var newEnd = match.index;
          }
          result = result.slice(0, newEnd === undefined ? end : newEnd);
        }
      } else if (string.indexOf(baseToString(separator), end) != end) {
        var index = result.lastIndexOf(separator);
        if (index > -1) {
          result = result.slice(0, index);
        }
      }
      return result + omission;
    }

    /**
     * `_.escape` 的反向操作;此方法将 `string` 中的 HTML 实体
     * `&amp;`, `&lt;`, `&gt;`, `&quot;`, 和 `&#39;` 转换为其对应的字符。
     *
     * **注意:** 不反转义其他 HTML 实体。要反转义其他 HTML 实体,
     * 请使用第三方库如 [_he_](https://mths.be/he)。
     *
     * @static
     * @memberOf _
     * @since 0.6.0
     * @category String
     * @param {string} [string=''] 要反转义的字符串。
     * @returns {string} 返回反转义后的字符串。
     * @example
     *
     * _.unescape('fred, barney, &amp; pebbles');
     * // => 'fred, barney, & pebbles'
     */
    function unescape(string) {
      string = toString(string);
      return (string && reHasEscapedHtml.test(string))
        ? string.replace(reEscapedHtml, unescapeHtmlChar)
        : string;
    }

    /**
     * 将 `string`(以空格分隔的单词)转换为大写。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category String
     * @param {string} [string=''] 要转换的字符串。
     * @returns {string} 返回大写后的字符串。
     * @example
     *
     * _.upperCase('--foo-bar');
     * // => 'FOO BAR'
     *
     * _.upperCase('fooBar');
     * // => 'FOO BAR'
     *
     * _.upperCase('__foo_bar__');
     * // => 'FOO BAR'
     */
    var upperCase = createCompounder(function(result, word, index) {
      return result + (index ? ' ' : '') + word.toUpperCase();
    });

    /**
     * 将 `string` 的第一个字符转换为大写。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category String
     * @param {string} [string=''] 要转换的字符串。
     * @returns {string} 返回转换后的字符串。
     * @example
     *
     * _.upperFirst('fred');
     * // => 'Fred'
     *
     * _.upperFirst('FRED');
     * // => 'FRED'
     */
    var upperFirst = createCaseFirst('toUpperCase');

    /**
     * Splits `string` into an array of its words.
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category String
     * @param {string} [string=''] 要检查的字符串。
     * @param {RegExp|string} [pattern] 匹配单词的模式。
     * @param- {Object} [guard] 启用作为类似 `_.map` 方法的迭代器。
     * @returns {Array} 返回 `string` 的单词数组。
     * @example
     *
     * _.words('fred, barney, & pebbles');
     * // => ['fred', 'barney', 'pebbles']
     *
     * _.words('fred, barney, & pebbles', /[^, ]+/g);
     * // => ['fred', 'barney', '&', 'pebbles']
     */
    function words(string, pattern, guard) {
      string = toString(string);
      pattern = guard ? undefined : pattern;

      if (pattern === undefined) {
        return hasUnicodeWord(string) ? unicodeWords(string) : asciiWords(string);
      }
      return string.match(pattern) || [];
    }

    /*------------------------------------------------------------------------*/

    /**
     * 尝试调用 `func`,返回结果或捕获的错误对象。
     * 调用时,任何额外的参数都会被提供给 `func`。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Util
     * @param {Function} func 要尝试调用的函数。
     * @param {...*} [args] 调用 `func` 时传入的参数。
     * @returns {*} 返回 `func` 的结果或错误对象。
     * @example
     *
     * // 避免为无效选择器抛出错误。
     * var elements = _.attempt(function(selector) {
     *   return document.querySelectorAll(selector);
     * }, '>_>');
     *
     * if (_.isError(elements)) {
     *   elements = [];
     * }
     */
    var attempt = baseRest(function(func, args) {
      try {
        return apply(func, undefined, args);
      } catch (e) {
        return isError(e) ? e : new Error(e);
      }
    });

    /**
     * 将对象的方法绑定到对象本身,覆盖现有方法。
     *
     * **注意:** 此方法不设置绑定函数的 "length" 属性。
     *
     * @static
     * @since 0.1.0
     * @memberOf _
     * @category Util
     * @param {Object} object 要绑定并分配绑定方法的对象。
     * @param {...(string|string[])} methodNames 要绑定的对象方法名。
     * @returns {Object} 返回 `object`。
     * @example
     *
     * var view = {
     *   'label': 'docs',
     *   'click': function() {
     *     console.log('clicked ' + this.label);
     *   }
     * };
     *
     * _.bindAll(view, ['click']);
     * jQuery(element).on('click', view.click);
     * // => 点击时记录 'clicked docs'。
     */
    var bindAll = flatRest(function(object, methodNames) {
      arrayEach(methodNames, function(key) {
        key = toKey(key);
        baseAssignValue(object, key, bind(object[key], object));
      });
      return object;
    });

    /**
     * 创建一个函数,遍历 `pairs`,并调用第一个返回真值的谓词对应的函数。
     * 谓词-函数对使用创建函数的 `this` 绑定和参数调用。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Util
     * @param {Array} pairs 谓词-函数对。
     * @returns {Function} 返回新的组合函数。
     * @example
     *
     * var func = _.cond([
     *   [_.matches({ 'a': 1 }),           _.constant('matches A')],
     *   [_.conforms({ 'b': _.isNumber }), _.constant('matches B')],
     *   [_.stubTrue,                      _.constant('no match')]
     * ]);
     *
     * func({ 'a': 1, 'b': 2 });
     * // => 'matches A'
     *
     * func({ 'a': 0, 'b': 1 });
     * // => 'matches B'
     *
     * func({ 'a': '1', 'b': '2' });
     * // => 'no match'
     */
    function cond(pairs) {
      var length = pairs == null ? 0 : pairs.length,
          toIteratee = getIteratee();

      pairs = !length ? [] : arrayMap(pairs, function(pair) {
        if (typeof pair[1] != 'function') {
          throw new TypeError(FUNC_ERROR_TEXT);
        }
        return [toIteratee(pair[0]), pair[1]];
      });

      return baseRest(function(args) {
        var index = -1;
        while (++index < length) {
          var pair = pairs[index];
          if (apply(pair[0], this, args)) {
            return apply(pair[1], this, args);
          }
        }
      });
    }

    /**
     * 创建一个函数,使用给定对象的对应属性值调用 `source` 的谓词属性,
     * 如果所有谓词都返回真值则返回 `true`,否则返回 `false`。
     *
     * **注意:** 创建的函数等价于 `_.conformsTo`,
     * 其中 `source` 被部分应用。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Util
     * @param {Object} source 符合属性的源对象。
     * @returns {Function} 返回新的 spec 函数。
     * @example
     *
     * var objects = [
     *   { 'a': 2, 'b': 1 },
     *   { 'a': 1, 'b': 2 }
     * ];
     *
     * _.filter(objects, _.conforms({ 'b': function(n) { return n > 1; } }));
     * // => [{ 'a': 1, 'b': 2 }]
     */
    function conforms(source) {
      return baseConforms(baseClone(source, CLONE_DEEP_FLAG));
    }

    /**
     * 创建一个返回 `value` 的函数。
     *
     * @static
     * @memberOf _
     * @since 2.4.0
     * @category Util
     * @param {*} value 新函数返回的值。
     * @returns {Function} 返回新的常量函数。
     * @example
     *
     * var objects = _.times(2, _.constant({ 'a': 1 }));
     *
     * console.log(objects);
     * // => [{ 'a': 1 }, { 'a': 1 }]
     *
     * console.log(objects[0] === objects[1]);
     * // => true
     */
    function constant(value) {
      return function() {
        return value;
      };
    }

    /**
     * 检查 `value` 以确定是否应返回其位置的默认值。
     * 如果 `value` 是 `NaN`、`null` 或 `undefined`,则返回 `defaultValue`。
     *
     * @static
     * @memberOf _
     * @since 4.14.0
     * @category Util
     * @param {*} value 要检查的值。
     * @param {*} defaultValue 默认值。
     * @returns {*} 返回解析后的值。
     * @example
     *
     * _.defaultTo(1, 10);
     * // => 1
     *
     * _.defaultTo(undefined, 10);
     * // => 10
     */
    function defaultTo(value, defaultValue) {
      return (value == null || value !== value) ? defaultValue : value;
    }

    /**
     * Creates a function that returns the result of invoking the given functions
     * 创建函数的 `this` 绑定,其中每个后续调用都提供前一个调用的返回值。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Util
     * @param {...(Function|Function[])} [funcs] 要调用的函数。
     * @returns {Function} 返回新的组合函数。
     * @see _.flowRight
     * @example
     *
     * function square(n) {
     *   return n * n;
     * }
     *
     * var addSquare = _.flow([_.add, square]);
     * addSquare(1, 2);
     * // => 9
     */
    var flow = createFlow();

    /**
     * 此方法类似 `_.flow`,但它创建一个从右到左调用给定函数的函数。
     *
     * @static
     * @since 3.0.0
     * @memberOf _
     * @category Util
     * @param {...(Function|Function[])} [funcs] 要调用的函数。
     * @returns {Function} 返回新的组合函数。
     * @see _.flow
     * @example
     *
     * function square(n) {
     *   return n * n;
     * }
     *
     * var addSquare = _.flowRight([square, _.add]);
     * addSquare(1, 2);
     * // => 9
     */
    var flowRight = createFlow(true);

    /**
     * 返回接收到的第一个参数。
     *
     * @static
     * @since 0.1.0
     * @memberOf _
     * @category Util
     * @param {*} value 任意值。
     * @returns {*} 返回 `value`。
     * @example
     *
     * var object = { 'a': 1 };
     *
     * console.log(_.identity(object) === object);
     * // => true
     */
    function identity(value) {
      return value;
    }

    /**
     * 创建一个函数,使用创建函数的参数调用 `func`。
     * 如果 `func` 是属性名,创建函数返回给定元素的属性值。
     * 如果 `func` 是数组或对象,创建函数对包含等价源属性的元素返回 `true`,
     * 否则返回 `false`。
     *
     * @static
     * @since 4.0.0
     * @memberOf _
     * @category Util
     * @param {*} [func=_.identity] 要转换为回调的值。
     * @returns {Function} 返回回调函数。
     * @example
     *
     * var users = [
     *   { 'user': 'barney', 'age': 36, 'active': true },
     *   { 'user': 'fred',   'age': 40, 'active': false }
     * ];
     *
     * // The `_.matches` iteratee shorthand.
     * _.filter(users, _.iteratee({ 'user': 'barney', 'active': true }));
     * // => [{ 'user': 'barney', 'age': 36, 'active': true }]
     *
     * // The `_.matchesProperty` iteratee shorthand.
     * _.filter(users, _.iteratee(['user', 'fred']));
     * // => [{ 'user': 'fred', 'age': 40 }]
     *
     * // The `_.property` iteratee shorthand.
     * _.map(users, _.iteratee('user'));
     * // => ['barney', 'fred']
     *
     * // Create custom iteratee shorthands.
     * _.iteratee = _.wrap(_.iteratee, function(iteratee, func) {
     *   return !_.isRegExp(func) ? iteratee(func) : function(string) {
     *     return func.test(string);
     *   };
     * });
     *
     * _.filter(['abc', 'def'], /ef/);
     * // => ['def']
     */
    function iteratee(func) {
      return baseIteratee(typeof func == 'function' ? func : baseClone(func, CLONE_DEEP_FLAG));
    }

    /**
     * 创建一个函数,执行给定对象和 `source` 的部分深度比较,
     * 如果给定对象具有等价的属性值则返回 `true`,否则返回 `false`。
     *
     * **注意:** 创建的函数等价于 `_.isMatch`,
     * 其中 `source` 被部分应用。
     *
     * 部分比较会将空数组和空对象 `source` 值分别与任何数组或对象值进行匹配。
     * 有关支持的值比较列表,请参见 `_.isEqual`。
     *
     * **注意:** 可以使用 `_.overSome` 组合多个匹配器来检查多个值。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Util
     * @param {Object} source 要匹配的属性值的源对象。
     * @returns {Function} 返回新的 spec 函数。
     * @example
     *
     * var objects = [
     *   { 'a': 1, 'b': 2, 'c': 3 },
     *   { 'a': 4, 'b': 5, 'c': 6 }
     * ];
     *
     * _.filter(objects, _.matches({ 'a': 4, 'c': 6 }));
     * // => [{ 'a': 4, 'b': 5, 'c': 6 }]
     *
     * // 检查多个可能的值
     * _.filter(objects, _.overSome([_.matches({ 'a': 1 }), _.matches({ 'a': 4 })]));
     * // => [{ 'a': 1, 'b': 2, 'c': 3 }, { 'a': 4, 'b': 5, 'c': 6 }]
     */
    function matches(source) {
      return baseMatches(baseClone(source, CLONE_DEEP_FLAG));
    }

    /**
     * 创建一个函数,执行给定对象 `path` 处值与 `srcValue` 的部分深度比较,
     * 如果对象值等价则返回 `true`,否则返回 `false`。
     *
     * **注意:** 部分比较会将空数组和空对象 `srcValue` 值分别与任何数组或对象值进行匹配。
     * 详见 `_.isEqual` 了解支持的值比较列表。
     *
     * **注意:** 可以使用 `_.overSome` 组合多个匹配器来检查多个值。
     *
     * @static
     * @memberOf _
     * @since 3.2.0
     * @category Util
     * @param {Array|string} path 要获取的属性路径。
     * @param {*} srcValue 要匹配的值。
     * @returns {Function} 返回新的 spec 函数。
     * @example
     *
     * var objects = [
     *   { 'a': 1, 'b': 2, 'c': 3 },
     *   { 'a': 4, 'b': 5, 'c': 6 }
     * ];
     *
     * _.find(objects, _.matchesProperty('a', 4));
     * // => { 'a': 4, 'b': 5, 'c': 6 }
     *
     * // 检查多个可能的值
     * _.filter(objects, _.overSome([_.matchesProperty('a', 1), _.matchesProperty('a', 4)]));
     * // => [{ 'a': 1, 'b': 2, 'c': 3 }, { 'a': 4, 'b': 5, 'c': 6 }]
     */
    function matchesProperty(path, srcValue) {
      return baseMatchesProperty(path, baseClone(srcValue, CLONE_DEEP_FLAG));
    }

    /**
     * 创建一个函数,调用给定对象的 `path` 处的方法。
     * 任何额外参数都会提供给调用的方法。
     *
     * @static
     * @memberOf _
     * @since 3.7.0
     * @category Util
     * @param {Array|string} path 要调用的方法路径。
     * @param {...*} [args] 调用方法时传入的参数。
     * @returns {Function} 返回新的调用者函数。
     * @example
     *
     * var objects = [
     *   { 'a': { 'b': _.constant(2) } },
     *   { 'a': { 'b': _.constant(1) } }
     * ];
     *
     * _.map(objects, _.method('a.b'));
     * // => [2, 1]
     *
     * _.map(objects, _.method(['a', 'b']));
     * // => [2, 1]
     */
    var method = baseRest(function(path, args) {
      return function(object) {
        return baseInvoke(object, path, args);
      };
    });

    /**
     * `_.method` 的反向操作;此方法创建一个函数,在 `object` 的给定路径上调用方法。
     * 任何额外参数都会提供给调用的方法。
     *
     * @static
     * @memberOf _
     * @since 3.7.0
     * @category Util
     * @param {Object} object 要查询的对象。
     * @param {...*} [args] 调用方法时传入的参数。
     * @returns {Function} 返回新的调用者函数。
     * @example
     *
     * var array = _.times(3, _.constant),
     *     object = { 'a': array, 'b': array, 'c': array };
     *
     * _.map(['a[2]', 'c[0]'], _.methodOf(object));
     * // => [2, 0]
     *
     * _.map([['a', '2'], ['c', '0']], _.methodOf(object));
     * // => [2, 0]
     */
    var methodOf = baseRest(function(object, args) {
      return function(path) {
        return baseInvoke(object, path, args);
      };
    });

    /**
     * 将源对象的所有自有可枚举字符串键函数属性添加到目标对象。
     * 如果 `object` 是函数,则方法也会添加到其原型。
     *
     * **注意:** 使用 `_.runInContext` 创建一个原始的 `lodash` 函数,
     * 以避免因修改原始函数而导致的冲突。
     *
     * @static
     * @since 0.1.0
     * @memberOf _
     * @category Util
     * @param {Function|Object} [object=lodash] 目标对象。
     * @param {Object} source 要添加的函数对象。
     * @param {Object} [options={}] 选项对象。
     * @param {boolean} [options.chain=true] 指定混合是否可链式调用。
     * @returns {Function|Object} 返回 `object`。
     * @example
     *
     * function vowels(string) {
     *   return _.filter(string, function(v) {
     *     return /[aeiou]/i.test(v);
     *   });
     * }
     *
     * _.mixin({ 'vowels': vowels });
     * _.vowels('fred');
     * // => ['e']
     *
     * _('fred').vowels().value();
     * // => ['e']
     *
     * _.mixin({ 'vowels': vowels }, { 'chain': false });
     * _('fred').vowels();
     * // => ['e']
     */
    function mixin(object, source, options) {
      var props = keys(source),
          methodNames = baseFunctions(source, props);

      if (options == null &&
          !(isObject(source) && (methodNames.length || !props.length))) {
        options = source;
        source = object;
        object = this;
        methodNames = baseFunctions(source, keys(source));
      }
      var chain = !(isObject(options) && 'chain' in options) || !!options.chain,
          isFunc = isFunction(object);

      arrayEach(methodNames, function(methodName) {
        var func = source[methodName];
        object[methodName] = func;
        if (isFunc) {
          object.prototype[methodName] = function() {
            var chainAll = this.__chain__;
            if (chain || chainAll) {
              var result = object(this.__wrapped__),
                  actions = result.__actions__ = copyArray(this.__actions__);

              actions.push({ 'func': func, 'args': arguments, 'thisArg': object });
              result.__chain__ = chainAll;
              return result;
            }
            return func.apply(object, arrayPush([this.value()], arguments));
          };
        }
      });

      return object;
    }

    /**
     * 将 `_` 变量恢复为其先前的值,并返回对 `lodash` 函数的引用。
     *
     * @static
     * @since 0.1.0
     * @memberOf _
     * @category Util
     * @returns {Function} 返回 `lodash` 函数。
     * @example
     *
     * var lodash = _.noConflict();
     */
    function noConflict() {
      if (root._ === this) {
        root._ = oldDash;
      }
      return this;
    }

    /**
     * 此方法返回 `undefined`。
     *
     * @static
     * @memberOf _
     * @since 2.3.0
     * @category Util
     * @example
     *
     * _.times(2, _.noop);
     * // => [undefined, undefined]
     */
    function noop() {
      // No operation performed.
    }

    /**
     * 创建一个获取索引 `n` 处参数的函数。如果 `n` 为负数,
     * 则从末尾返回第 n 个参数。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Util
     * @param {number} [n=0] 要返回的参数索引。
     * @returns {Function} 返回新的传通函数。
     * @example
     *
     * var func = _.nthArg(1);
     * func('a', 'b', 'c', 'd');
     * // => 'b'
     *
     * var func = _.nthArg(-2);
     * func('a', 'b', 'c', 'd');
     * // => 'c'
     */
    function nthArg(n) {
      n = toInteger(n);
      return baseRest(function(args) {
        return baseNth(args, n);
      });
    }

    /**
     * 创建一个函数,使用接收到的参数调用 `iteratees`,并返回它们的结果。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Util
     * @param {...(Function|Function[])} [iteratees=[_.identity]]
     *  要调用的迭代器。
     * @returns {Function} 返回新函数。
     * @example
     *
     * var func = _.over([Math.max, Math.min]);
     *
     * func(1, 2, 3, 4);
     * // => [4, 1]
     */
    var over = createOver(arrayMap);

    /**
     * 创建一个函数,检查当使用接收到的参数调用时,**所有** `predicates` 是否返回真值。
     *
     * 提供谓词有以下简写方式。
     * 传入 `Object` 将被用作 `_.matches` 的参数来创建谓词。
     * 传入 `_.matchesProperty` 的参数数组,将使用它们创建谓词。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Util
     * @param {...(Function|Function[])} [predicates=[_.identity]]
     *  要检查的谓词。
     * @returns {Function} 返回新函数。
     * @example
     *
     * var func = _.overEvery([Boolean, isFinite]);
     *
     * func('1');
     * // => true
     *
     * func(null);
     * // => false
     *
     * func(NaN);
     * // => false
     */
    var overEvery = createOver(arrayEvery);

    /**
     * 创建一个函数,检查当使用接收到的参数调用时,**任一** `predicates` 是否返回真值。
     *
     * 提供谓词有以下简写方式。
     * 传入 `Object` 将被用作 `_.matches` 的参数来创建谓词。
     * 传入 `_.matchesProperty` 的参数数组,将使用它们创建谓词。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Util
     * @param {...(Function|Function[])} [predicates=[_.identity]]
     *  要检查的谓词。
     * @returns {Function} 返回新函数。
     * @example
     *
     * var func = _.overSome([Boolean, isFinite]);
     *
     * func('1');
     * // => true
     *
     * func(null);
     * // => true
     *
     * func(NaN);
     * // => false
     *
     * var matchesFunc = _.overSome([{ 'a': 1 }, { 'a': 2 }])
     * var matchesPropertyFunc = _.overSome([['a', 1], ['a', 2]])
     */
    var overSome = createOver(arraySome);

    /**
     * 创建一个返回给定对象 `path` 处值的函数。
     *
     * @static
     * @memberOf _
     * @since 2.4.0
     * @category Util
     * @param {Array|string} path 要获取的属性路径。
     * @returns {Function} 返回新的访问器函数。
     * @example
     *
     * var objects = [
     *   { 'a': { 'b': 2 } },
     *   { 'a': { 'b': 1 } }
     * ];
     *
     * _.map(objects, _.property('a.b'));
     * // => [2, 1]
     *
     * _.map(_.sortBy(objects, _.property(['a', 'b'])), 'a.b');
     * // => [1, 2]
     */
    function property(path) {
      return isKey(path) ? baseProperty(toKey(path)) : basePropertyDeep(path);
    }

    /**
     * `_.property` 的反向操作;此方法创建一个函数,返回 `object` 给定路径处的值。
     *
     * @static
     * @memberOf _
     * @since 3.0.0
     * @category Util
     * @param {Object} object 要查询的对象。
     * @returns {Function} 返回新的访问器函数。
     * @example
     *
     * var array = [0, 1, 2],
     *     object = { 'a': array, 'b': array, 'c': array };
     *
     * _.map(['a[2]', 'c[0]'], _.propertyOf(object));
     * // => [2, 0]
     *
     * _.map([['a', '2'], ['c', '0']], _.propertyOf(object));
     * // => [2, 0]
     */
    function propertyOf(object) {
      return function(path) {
        return object == null ? undefined : baseGet(object, path);
      };
    }

    /**
     * 创建一个数字数组(正数和/或负数),从 `start` 递增到,但不包括 `end`。
     * 如果指定了负的 `start` 而没有 `end` 或 `step`,则使用 `-1` 作为步长。
     * 如果未指定 `end`,则将 `start` 设置为 `0`,并将先前的 `start` 值设置为 `end`。
     *
     * **注意:** JavaScript 遵循 IEEE-754 标准处理浮点数,这可能产生意想不到的结果。
     *
     * @static
     * @since 0.1.0
     * @memberOf _
     * @category Util
     * @param {number} [start=0] 范围的起始值。
     * @param {number} end 范围的结束值。
     * @param {number} [step=1] 递增或递减的值。
     * @returns {Array} 返回数字范围。
     * @see _.inRange, _.rangeRight
     * @example
     *
     * _.range(4);
     * // => [0, 1, 2, 3]
     *
     * _.range(-4);
     * // => [0, -1, -2, -3]
     *
     * _.range(1, 5);
     * // => [1, 2, 3, 4]
     *
     * _.range(0, 20, 5);
     * // => [0, 5, 10, 15]
     *
     * _.range(0, -4, -1);
     * // => [0, -1, -2, -3]
     *
     * _.range(1, 4, 0);
     * // => [1, 1, 1]
     *
     * _.range(0);
     * // => []
     */
    var range = createRange();

    /**
     * 此方法类似 `_.range`,但它以降序方式填充值。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Util
     * @param {number} [start=0] 范围的起始值。
     * @param {number} end 范围的结束值。
     * @param {number} [step=1] 递增或递减的值。
     * @returns {Array} 返回数字范围。
     * @see _.inRange, _.range
     * @example
     *
     * _.rangeRight(4);
     * // => [3, 2, 1, 0]
     *
     * _.rangeRight(-4);
     * // => [-3, -2, -1, 0]
     *
     * _.rangeRight(1, 5);
     * // => [4, 3, 2, 1]
     *
     * _.rangeRight(0, 20, 5);
     * // => [15, 10, 5, 0]
     *
     * _.rangeRight(0, -4, -1);
     * // => [-3, -2, -1, 0]
     *
     * _.rangeRight(1, 4, 0);
     * // => [1, 1, 1]
     *
     * _.rangeRight(0);
     * // => []
     */
    var rangeRight = createRange(true);

    /**
     * 此方法返回一个新的空数组。
     *
     * @static
     * @memberOf _
     * @since 4.13.0
     * @category Util
     * @returns {Array} 返回新的空数组。
     * @example
     *
     * var arrays = _.times(2, _.stubArray);
     *
     * console.log(arrays);
     * // => [[], []]
     *
     * console.log(arrays[0] === arrays[1]);
     * // => false
     */
    function stubArray() {
      return [];
    }

    /**
     * 此方法返回 `false`。
     *
     * @static
     * @memberOf _
     * @since 4.13.0
     * @category Util
     * @returns {boolean} 返回 `false`。
     * @example
     *
     * _.times(2, _.stubFalse);
     * // => [false, false]
     */
    function stubFalse() {
      return false;
    }

    /**
     * 此方法返回一个新的空对象。
     *
     * @static
     * @memberOf _
     * @since 4.13.0
     * @category Util
     * @returns {Object} 返回新的空对象。
     * @example
     *
     * var objects = _.times(2, _.stubObject);
     *
     * console.log(objects);
     * // => [{}, {}]
     *
     * console.log(objects[0] === objects[1]);
     * // => false
     */
    function stubObject() {
      return {};
    }

    /**
     * 此方法返回一个空字符串。
     *
     * @static
     * @memberOf _
     * @since 4.13.0
     * @category Util
     * @returns {string} 返回空字符串。
     * @example
     *
     * _.times(2, _.stubString);
     * // => ['', '']
     */
    function stubString() {
      return '';
    }

    /**
     * 此方法返回 `true`。
     *
     * @static
     * @memberOf _
     * @since 4.13.0
     * @category Util
     * @returns {boolean} 返回 `true`。
     * @example
     *
     * _.times(2, _.stubTrue);
     * // => [true, true]
     */
    function stubTrue() {
      return true;
    }

    /**
     * 调用 `iteratee` `n` 次,返回一个包含每次调用结果的数组。
     * iteratee 调用一个参数;(index)。
     *
     * @static
     * @since 0.1.0
     * @memberOf _
     * @category Util
     * @param {number} n 调用 `iteratee` 的次数。
     * @param {Function} [iteratee=_.identity] 每次迭代调用的函数。
     * @returns {Array} 返回结果数组。
     * @example
     *
     * _.times(3, String);
     * // => ['0', '1', '2']
     *
     *  _.times(4, _.constant(0));
     * // => [0, 0, 0, 0]
     */
    function times(n, iteratee) {
      n = toInteger(n);
      if (n < 1 || n > MAX_SAFE_INTEGER) {
        return [];
      }
      var index = MAX_ARRAY_LENGTH,
          length = nativeMin(n, MAX_ARRAY_LENGTH);

      iteratee = getIteratee(iteratee);
      n -= MAX_ARRAY_LENGTH;

      var result = baseTimes(length, iteratee);
      while (++index < n) {
        iteratee(index);
      }
      return result;
    }

    /**
     * 将 `value` 转换为属性路径数组。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Util
     * @param {*} value 要转换的值。
     * @returns {Array} 返回新的属性路径数组。
     * @example
     *
     * _.toPath('a.b.c');
     * // => ['a', 'b', 'c']
     *
     * _.toPath('a[0].b.c');
     * // => ['a', '0', 'b', 'c']
     */
    function toPath(value) {
      if (isArray(value)) {
        return arrayMap(value, toKey);
      }
      return isSymbol(value) ? [value] : copyArray(stringToPath(toString(value)));
    }

    /**
     * 生成一个唯一的 ID。如果提供了 `prefix`,则 ID 会附加到它后面。
     *
     * @static
     * @since 0.1.0
     * @memberOf _
     * @category Util
     * @param {string} [prefix=''] 要添加到 ID 前缀的值。
     * @returns {string} 返回唯一 ID。
     * @example
     *
     * _.uniqueId('contact_');
     * // => 'contact_104'
     *
     * _.uniqueId();
     * // => '105'
     */
    function uniqueId(prefix) {
      var id = ++idCounter;
      return toString(prefix) + id;
    }

    /*------------------------------------------------------------------------*/

    /**
     * 两数相加。
     *
     * @static
     * @memberOf _
     * @since 3.4.0
     * @category Math
     * @param {number} augend 加法中的第一个数字。
     * @param {number} addend 加法中的第二个数字。
     * @returns {number} 返回总和。
     * @example
     *
     * _.add(6, 4);
     * // => 10
     */
    var add = createMathOperation(function(augend, addend) {
      return augend + addend;
    }, 0);

    /**
     * 计算 `number` 向上舍入到指定精度。
     *
     * @static
     * @memberOf _
     * @since 3.10.0
     * @category Math
     * @param {number} number 要向上舍入的数字。
     * @param {number} [precision=0] 向上舍入的精度。
     * @returns {number} 返回向上舍入后的数字。
     * @example
     *
     * _.ceil(4.006);
     * // => 5
     *
     * _.ceil(6.004, 2);
     * // => 6.01
     *
     * _.ceil(6040, -2);
     * // => 6100
     */
    var ceil = createRound('ceil');

    /**
     * 两数相除。
     *
     * @static
     * @memberOf _
     * @since 4.7.0
     * @category Math
     * @param {number} dividend 除法中的被除数。
     * @param {number} divisor 除法中的除数。
     * @returns {number} 返回商。
     * @example
     *
     * _.divide(6, 4);
     * // => 1.5
     */
    var divide = createMathOperation(function(dividend, divisor) {
      return dividend / divisor;
    }, 1);

    /**
     * 计算 `number` 向下舍入到指定精度。
     *
     * @static
     * @memberOf _
     * @since 3.10.0
     * @category Math
     * @param {number} number 要向下舍入的数字。
     * @param {number} [precision=0] 向下舍入的精度。
     * @returns {number} 返回向下舍入后的数字。
     * @example
     *
     * _.floor(4.006);
     * // => 4
     *
     * _.floor(0.046, 2);
     * // => 0.04
     *
     * _.floor(4060, -2);
     * // => 4000
     */
    var floor = createRound('floor');

    /**
     * 计算数组中的最大值。如果数组是空的或为假值，则返回 `undefined`。
     *
     * @static
     * @since 0.1.0
     * @memberOf _
     * @category Math
     * @param {Array} array 要迭代的数组。
     * @returns {*} 返回最大值。
     * @example
     *
     * _.max([4, 2, 8, 6]);
     * // => 8
     *
     * _.max([]);
     * // => undefined
     */
    function max(array) {
      return (array && array.length)
        ? baseExtremum(array, identity, baseGt)
        : undefined;
    }

    /**
     * 此方法类似于 `_.max`，除了它接受 `iteratee`（迭代器），
     * 为数组中的每个元素调用以生成用于排序的标准。迭代器接收一个参数：(value)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Math
     * @param {Array} array 要迭代的数组。
     * @param {Function} [iteratee=_.identity] 每个元素调用的迭代器。
     * @returns {*} 返回最大值。
     * @example
     *
     * var objects = [{ 'n': 1 }, { 'n': 2 }];
     *
     * _.maxBy(objects, function(o) { return o.n; });
     * // => { 'n': 2 }
     *
     * // 使用 `_.property` 迭代器简写。
     * _.maxBy(objects, 'n');
     * // => { 'n': 2 }
     */
    function maxBy(array, iteratee) {
      return (array && array.length)
        ? baseExtremum(array, getIteratee(iteratee, 2), baseGt)
        : undefined;
    }

    /**
     * 计算数组中值的平均值。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Math
     * @param {Array} array 要迭代的数组。
     * @returns {number} 返回平均值。
     * @example
     *
     * _.mean([4, 2, 8, 6]);
     * // => 5
     */
    function mean(array) {
      return baseMean(array, identity);
    }

    /**
     * 此方法类似于 `_.mean`，除了它接受 `iteratee`（迭代器），
     * 为数组中的每个元素调用以生成要平均的值。迭代器接收一个参数：(value)。
     *
     * @static
     * @memberOf _
     * @since 4.7.0
     * @category Math
     * @param {Array} array 要迭代的数组。
     * @param {Function} [iteratee=_.identity] 每个元素调用的迭代器。
     * @returns {number} 返回平均值。
     * @example
     *
     * var objects = [{ 'n': 4 }, { 'n': 2 }, { 'n': 8 }, { 'n': 6 }];
     *
     * _.meanBy(objects, function(o) { return o.n; });
     * // => 5
     *
     * // 使用 `_.property` 迭代器简写。
     * _.meanBy(objects, 'n');
     * // => 5
     */
    function meanBy(array, iteratee) {
      return baseMean(array, getIteratee(iteratee, 2));
    }

    /**
     * 计算数组中的最小值。如果数组是空的或为假值，则返回 `undefined`。
     *
     * @static
     * @since 0.1.0
     * @memberOf _
     * @category Math
     * @param {Array} array 要迭代的数组。
     * @returns {*} 返回最小值。
     * @example
     *
     * _.min([4, 2, 8, 6]);
     * // => 2
     *
     * _.min([]);
     * // => undefined
     */
    function min(array) {
      return (array && array.length)
        ? baseExtremum(array, identity, baseLt)
        : undefined;
    }

    /**
     * 此方法类似于 `_.min`，除了它接受 `iteratee`（迭代器），
     * 为数组中的每个元素调用以生成用于排序的标准。迭代器接收一个参数：(value)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Math
     * @param {Array} array 要迭代的数组。
     * @param {Function} [iteratee=_.identity] 每个元素调用的迭代器。
     * @returns {*} 返回最小值。
     * @example
     *
     * var objects = [{ 'n': 1 }, { 'n': 2 }];
     *
     * _.minBy(objects, function(o) { return o.n; });
     * // => { 'n': 1 }
     *
     * // 使用 `_.property` 迭代器简写。
     * _.minBy(objects, 'n');
     * // => { 'n': 1 }
     */
    function minBy(array, iteratee) {
      return (array && array.length)
        ? baseExtremum(array, getIteratee(iteratee, 2), baseLt)
        : undefined;
    }

    /**
     * 两数相乘。
     *
     * @static
     * @memberOf _
     * @since 4.7.0
     * @category Math
     * @param {number} multiplier 乘法中的被乘数。
     * @param {number} multiplicand 乘法中的乘数。
     * @returns {number} 返回乘积。
     * @example
     *
     * _.multiply(6, 4);
     * // => 24
     */
    var multiply = createMathOperation(function(multiplier, multiplicand) {
      return multiplier * multiplicand;
    }, 1);

    /**
     * 计算 `number` 四舍五入到指定精度。
     *
     * @static
     * @memberOf _
     * @since 3.10.0
     * @category Math
     * @param {number} number 要舍入的数字。
     * @param {number} [precision=0] 舍入的精度。
     * @returns {number} 返回舍入后的数字。
     * @example
     *
     * _.round(4.006);
     * // => 4
     *
     * _.round(4.006, 2);
     * // => 4.01
     *
     * _.round(4060, -2);
     * // => 4100
     */
    var round = createRound('round');

    /**
     * 两数相减。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Math
     * @param {number} minuend 减法中的被减数。
     * @param {number} subtrahend 减法中的减数。
     * @returns {number} 返回差。
     * @example
     *
     * _.subtract(6, 4);
     * // => 2
     */
    var subtract = createMathOperation(function(minuend, subtrahend) {
      return minuend - subtrahend;
    }, 0);

    /**
     * 计算数组中值的总和。
     *
     * @static
     * @memberOf _
     * @since 3.4.0
     * @category Math
     * @param {Array} array 要迭代的数组。
     * @returns {number} 返回总和。
     * @example
     *
     * _.sum([4, 2, 8, 6]);
     * // => 20
     */
    function sum(array) {
      return (array && array.length)
        ? baseSum(array, identity)
        : 0;
    }

    /**
     * 此方法类似于 `_.sum`，除了它接受 `iteratee`（迭代器），
     * 为数组中的每个元素调用以生成要累加的值。迭代器接收一个参数：(value)。
     *
     * @static
     * @memberOf _
     * @since 4.0.0
     * @category Math
     * @param {Array} array 要迭代的数组。
     * @param {Function} [iteratee=_.identity] 每个元素调用的迭代器。
     * @returns {number} 返回总和。
     * @example
     *
     * var objects = [{ 'n': 4 }, { 'n': 2 }, { 'n': 8 }, { 'n': 6 }];
     *
     * _.sumBy(objects, function(o) { return o.n; });
     * // => 20
     *
     * // 使用 `_.property` 迭代器简写。
     * _.sumBy(objects, 'n');
     * // => 20
     */
    function sumBy(array, iteratee) {
      return (array && array.length)
        ? baseSum(array, getIteratee(iteratee, 2))
        : 0;
    }

    /*------------------------------------------------------------------------*/

    // Add methods that return wrapped values in chain sequences.
    lodash.after = after;
    lodash.ary = ary;
    lodash.assign = assign;
    lodash.assignIn = assignIn;
    lodash.assignInWith = assignInWith;
    lodash.assignWith = assignWith;
    lodash.at = at;
    lodash.before = before;
    lodash.bind = bind;
    lodash.bindAll = bindAll;
    lodash.bindKey = bindKey;
    lodash.castArray = castArray;
    lodash.chain = chain;
    lodash.chunk = chunk;
    lodash.compact = compact;
    lodash.concat = concat;
    lodash.cond = cond;
    lodash.conforms = conforms;
    lodash.constant = constant;
    lodash.countBy = countBy;
    lodash.create = create;
    lodash.curry = curry;
    lodash.curryRight = curryRight;
    lodash.debounce = debounce;
    lodash.defaults = defaults;
    lodash.defaultsDeep = defaultsDeep;
    lodash.defer = defer;
    lodash.delay = delay;
    lodash.difference = difference;
    lodash.differenceBy = differenceBy;
    lodash.differenceWith = differenceWith;
    lodash.drop = drop;
    lodash.dropRight = dropRight;
    lodash.dropRightWhile = dropRightWhile;
    lodash.dropWhile = dropWhile;
    lodash.fill = fill;
    lodash.filter = filter;
    lodash.flatMap = flatMap;
    lodash.flatMapDeep = flatMapDeep;
    lodash.flatMapDepth = flatMapDepth;
    lodash.flatten = flatten;
    lodash.flattenDeep = flattenDeep;
    lodash.flattenDepth = flattenDepth;
    lodash.flip = flip;
    lodash.flow = flow;
    lodash.flowRight = flowRight;
    lodash.fromPairs = fromPairs;
    lodash.functions = functions;
    lodash.functionsIn = functionsIn;
    lodash.groupBy = groupBy;
    lodash.initial = initial;
    lodash.intersection = intersection;
    lodash.intersectionBy = intersectionBy;
    lodash.intersectionWith = intersectionWith;
    lodash.invert = invert;
    lodash.invertBy = invertBy;
    lodash.invokeMap = invokeMap;
    lodash.iteratee = iteratee;
    lodash.keyBy = keyBy;
    lodash.keys = keys;
    lodash.keysIn = keysIn;
    lodash.map = map;
    lodash.mapKeys = mapKeys;
    lodash.mapValues = mapValues;
    lodash.matches = matches;
    lodash.matchesProperty = matchesProperty;
    lodash.memoize = memoize;
    lodash.merge = merge;
    lodash.mergeWith = mergeWith;
    lodash.method = method;
    lodash.methodOf = methodOf;
    lodash.mixin = mixin;
    lodash.negate = negate;
    lodash.nthArg = nthArg;
    lodash.omit = omit;
    lodash.omitBy = omitBy;
    lodash.once = once;
    lodash.orderBy = orderBy;
    lodash.over = over;
    lodash.overArgs = overArgs;
    lodash.overEvery = overEvery;
    lodash.overSome = overSome;
    lodash.partial = partial;
    lodash.partialRight = partialRight;
    lodash.partition = partition;
    lodash.pick = pick;
    lodash.pickBy = pickBy;
    lodash.property = property;
    lodash.propertyOf = propertyOf;
    lodash.pull = pull;
    lodash.pullAll = pullAll;
    lodash.pullAllBy = pullAllBy;
    lodash.pullAllWith = pullAllWith;
    lodash.pullAt = pullAt;
    lodash.range = range;
    lodash.rangeRight = rangeRight;
    lodash.rearg = rearg;
    lodash.reject = reject;
    lodash.remove = remove;
    lodash.rest = rest;
    lodash.reverse = reverse;
    lodash.sampleSize = sampleSize;
    lodash.set = set;
    lodash.setWith = setWith;
    lodash.shuffle = shuffle;
    lodash.slice = slice;
    lodash.sortBy = sortBy;
    lodash.sortedUniq = sortedUniq;
    lodash.sortedUniqBy = sortedUniqBy;
    lodash.split = split;
    lodash.spread = spread;
    lodash.tail = tail;
    lodash.take = take;
    lodash.takeRight = takeRight;
    lodash.takeRightWhile = takeRightWhile;
    lodash.takeWhile = takeWhile;
    lodash.tap = tap;
    lodash.throttle = throttle;
    lodash.thru = thru;
    lodash.toArray = toArray;
    lodash.toPairs = toPairs;
    lodash.toPairsIn = toPairsIn;
    lodash.toPath = toPath;
    lodash.toPlainObject = toPlainObject;
    lodash.transform = transform;
    lodash.unary = unary;
    lodash.union = union;
    lodash.unionBy = unionBy;
    lodash.unionWith = unionWith;
    lodash.uniq = uniq;
    lodash.uniqBy = uniqBy;
    lodash.uniqWith = uniqWith;
    lodash.unset = unset;
    lodash.unzip = unzip;
    lodash.unzipWith = unzipWith;
    lodash.update = update;
    lodash.updateWith = updateWith;
    lodash.values = values;
    lodash.valuesIn = valuesIn;
    lodash.without = without;
    lodash.words = words;
    lodash.wrap = wrap;
    lodash.xor = xor;
    lodash.xorBy = xorBy;
    lodash.xorWith = xorWith;
    lodash.zip = zip;
    lodash.zipObject = zipObject;
    lodash.zipObjectDeep = zipObjectDeep;
    lodash.zipWith = zipWith;

    // 添加别名。
    lodash.entries = toPairs;
    lodash.entriesIn = toPairsIn;
    lodash.extend = assignIn;
    lodash.extendWith = assignInWith;

    // 添加方法到 `lodash.prototype`。
    mixin(lodash, lodash);

    /*------------------------------------------------------------------------*/

    // 添加在链式序列中返回未包装值的方法。
    lodash.add = add;
    lodash.attempt = attempt;
    lodash.camelCase = camelCase;
    lodash.capitalize = capitalize;
    lodash.ceil = ceil;
    lodash.clamp = clamp;
    lodash.clone = clone;
    lodash.cloneDeep = cloneDeep;
    lodash.cloneDeepWith = cloneDeepWith;
    lodash.cloneWith = cloneWith;
    lodash.conformsTo = conformsTo;
    lodash.deburr = deburr;
    lodash.defaultTo = defaultTo;
    lodash.divide = divide;
    lodash.endsWith = endsWith;
    lodash.eq = eq;
    lodash.escape = escape;
    lodash.escapeRegExp = escapeRegExp;
    lodash.every = every;
    lodash.find = find;
    lodash.findIndex = findIndex;
    lodash.findKey = findKey;
    lodash.findLast = findLast;
    lodash.findLastIndex = findLastIndex;
    lodash.findLastKey = findLastKey;
    lodash.floor = floor;
    lodash.forEach = forEach;
    lodash.forEachRight = forEachRight;
    lodash.forIn = forIn;
    lodash.forInRight = forInRight;
    lodash.forOwn = forOwn;
    lodash.forOwnRight = forOwnRight;
    lodash.get = get;
    lodash.gt = gt;
    lodash.gte = gte;
    lodash.has = has;
    lodash.hasIn = hasIn;
    lodash.head = head;
    lodash.identity = identity;
    lodash.includes = includes;
    lodash.indexOf = indexOf;
    lodash.inRange = inRange;
    lodash.invoke = invoke;
    lodash.isArguments = isArguments;
    lodash.isArray = isArray;
    lodash.isArrayBuffer = isArrayBuffer;
    lodash.isArrayLike = isArrayLike;
    lodash.isArrayLikeObject = isArrayLikeObject;
    lodash.isBoolean = isBoolean;
    lodash.isBuffer = isBuffer;
    lodash.isDate = isDate;
    lodash.isElement = isElement;
    lodash.isEmpty = isEmpty;
    lodash.isEqual = isEqual;
    lodash.isEqualWith = isEqualWith;
    lodash.isError = isError;
    lodash.isFinite = isFinite;
    lodash.isFunction = isFunction;
    lodash.isInteger = isInteger;
    lodash.isLength = isLength;
    lodash.isMap = isMap;
    lodash.isMatch = isMatch;
    lodash.isMatchWith = isMatchWith;
    lodash.isNaN = isNaN;
    lodash.isNative = isNative;
    lodash.isNil = isNil;
    lodash.isNull = isNull;
    lodash.isNumber = isNumber;
    lodash.isObject = isObject;
    lodash.isObjectLike = isObjectLike;
    lodash.isPlainObject = isPlainObject;
    lodash.isRegExp = isRegExp;
    lodash.isSafeInteger = isSafeInteger;
    lodash.isSet = isSet;
    lodash.isString = isString;
    lodash.isSymbol = isSymbol;
    lodash.isTypedArray = isTypedArray;
    lodash.isUndefined = isUndefined;
    lodash.isWeakMap = isWeakMap;
    lodash.isWeakSet = isWeakSet;
    lodash.join = join;
    lodash.kebabCase = kebabCase;
    lodash.last = last;
    lodash.lastIndexOf = lastIndexOf;
    lodash.lowerCase = lowerCase;
    lodash.lowerFirst = lowerFirst;
    lodash.lt = lt;
    lodash.lte = lte;
    lodash.max = max;
    lodash.maxBy = maxBy;
    lodash.mean = mean;
    lodash.meanBy = meanBy;
    lodash.min = min;
    lodash.minBy = minBy;
    lodash.stubArray = stubArray;
    lodash.stubFalse = stubFalse;
    lodash.stubObject = stubObject;
    lodash.stubString = stubString;
    lodash.stubTrue = stubTrue;
    lodash.multiply = multiply;
    lodash.nth = nth;
    lodash.noConflict = noConflict;
    lodash.noop = noop;
    lodash.now = now;
    lodash.pad = pad;
    lodash.padEnd = padEnd;
    lodash.padStart = padStart;
    lodash.parseInt = parseInt;
    lodash.random = random;
    lodash.reduce = reduce;
    lodash.reduceRight = reduceRight;
    lodash.repeat = repeat;
    lodash.replace = replace;
    lodash.result = result;
    lodash.round = round;
    lodash.runInContext = runInContext;
    lodash.sample = sample;
    lodash.size = size;
    lodash.snakeCase = snakeCase;
    lodash.some = some;
    lodash.sortedIndex = sortedIndex;
    lodash.sortedIndexBy = sortedIndexBy;
    lodash.sortedIndexOf = sortedIndexOf;
    lodash.sortedLastIndex = sortedLastIndex;
    lodash.sortedLastIndexBy = sortedLastIndexBy;
    lodash.sortedLastIndexOf = sortedLastIndexOf;
    lodash.startCase = startCase;
    lodash.startsWith = startsWith;
    lodash.subtract = subtract;
    lodash.sum = sum;
    lodash.sumBy = sumBy;
    lodash.template = template;
    lodash.times = times;
    lodash.toFinite = toFinite;
    lodash.toInteger = toInteger;
    lodash.toLength = toLength;
    lodash.toLower = toLower;
    lodash.toNumber = toNumber;
    lodash.toSafeInteger = toSafeInteger;
    lodash.toString = toString;
    lodash.toUpper = toUpper;
    lodash.trim = trim;
    lodash.trimEnd = trimEnd;
    lodash.trimStart = trimStart;
    lodash.truncate = truncate;
    lodash.unescape = unescape;
    lodash.uniqueId = uniqueId;
    lodash.upperCase = upperCase;
    lodash.upperFirst = upperFirst;

    // 添加别名。
    lodash.each = forEach;
    lodash.eachRight = forEachRight;
    lodash.first = head;

    mixin(lodash, (function() {
      var source = {};
      baseForOwn(lodash, function(func, methodName) {
        if (!hasOwnProperty.call(lodash.prototype, methodName)) {
          source[methodName] = func;
        }
      });
      return source;
    }()), { 'chain': false });

    /*------------------------------------------------------------------------*/

    /**
     * 语义化版本号。
     *
     * @static
     * @memberOf _
     * @type {string}
     */
    lodash.VERSION = VERSION;

    // 分配默认占位符。
    arrayEach(['bind', 'bindKey', 'curry', 'curryRight', 'partial', 'partialRight'], function(methodName) {
      lodash[methodName].placeholder = lodash;
    });

    // 为 `_.drop` 和 `_.take` 变体添加 `LazyWrapper` 方法。
    arrayEach(['drop', 'take'], function(methodName, index) {
      LazyWrapper.prototype[methodName] = function(n) {
        n = n === undefined ? 1 : nativeMax(toInteger(n), 0);

        var result = (this.__filtered__ && !index)
          ? new LazyWrapper(this)
          : this.clone();

        if (result.__filtered__) {
          result.__takeCount__ = nativeMin(n, result.__takeCount__);
        } else {
          result.__views__.push({
            'size': nativeMin(n, MAX_ARRAY_LENGTH),
            'type': methodName + (result.__dir__ < 0 ? 'Right' : '')
          });
        }
        return result;
      };

      LazyWrapper.prototype[methodName + 'Right'] = function(n) {
        return this.reverse()[methodName](n).reverse();
      };
    });

    // 添加接受 `iteratee` 值的 `LazyWrapper` 方法。
    arrayEach(['filter', 'map', 'takeWhile'], function(methodName, index) {
      var type = index + 1,
          isFilter = type == LAZY_FILTER_FLAG || type == LAZY_WHILE_FLAG;

      LazyWrapper.prototype[methodName] = function(iteratee) {
        var result = this.clone();
        result.__iteratees__.push({
          'iteratee': getIteratee(iteratee, 3),
          'type': type
        });
        result.__filtered__ = result.__filtered__ || isFilter;
        return result;
      };
    });

    // 为 `_.head` 和 `_.last` 添加 `LazyWrapper` 方法。
    arrayEach(['head', 'last'], function(methodName, index) {
      var takeName = 'take' + (index ? 'Right' : '');

      LazyWrapper.prototype[methodName] = function() {
        return this[takeName](1).value()[0];
      };
    });

    // 为 `_.initial` 和 `_.tail` 添加 `LazyWrapper` 方法。
    arrayEach(['initial', 'tail'], function(methodName, index) {
      var dropName = 'drop' + (index ? '' : 'Right');

      LazyWrapper.prototype[methodName] = function() {
        return this.__filtered__ ? new LazyWrapper(this) : this[dropName](1);
      };
    });

    LazyWrapper.prototype.compact = function() {
      return this.filter(identity);
    };

    LazyWrapper.prototype.find = function(predicate) {
      return this.filter(predicate).head();
    };

    LazyWrapper.prototype.findLast = function(predicate) {
      return this.reverse().find(predicate);
    };

    LazyWrapper.prototype.invokeMap = baseRest(function(path, args) {
      if (typeof path == 'function') {
        return new LazyWrapper(this);
      }
      return this.map(function(value) {
        return baseInvoke(value, path, args);
      });
    });

    LazyWrapper.prototype.reject = function(predicate) {
      return this.filter(negate(getIteratee(predicate)));
    };

    LazyWrapper.prototype.slice = function(start, end) {
      start = toInteger(start);

      var result = this;
      if (result.__filtered__ && (start > 0 || end < 0)) {
        return new LazyWrapper(result);
      }
      if (start < 0) {
        result = result.takeRight(-start);
      } else if (start) {
        result = result.drop(start);
      }
      if (end !== undefined) {
        end = toInteger(end);
        result = end < 0 ? result.dropRight(-end) : result.take(end - start);
      }
      return result;
    };

    LazyWrapper.prototype.takeRightWhile = function(predicate) {
      return this.reverse().takeWhile(predicate).reverse();
    };

    LazyWrapper.prototype.toArray = function() {
      return this.take(MAX_ARRAY_LENGTH);
    };

    // 添加 `LazyWrapper` 方法到 `lodash.prototype`。
    baseForOwn(LazyWrapper.prototype, function(func, methodName) {
      var checkIteratee = /^(?:filter|find|map|reject)|While$/.test(methodName),
          isTaker = /^(?:head|last)$/.test(methodName),
          lodashFunc = lodash[isTaker ? ('take' + (methodName == 'last' ? 'Right' : '')) : methodName],
          retUnwrapped = isTaker || /^find/.test(methodName);

      if (!lodashFunc) {
        return;
      }
      lodash.prototype[methodName] = function() {
        var value = this.__wrapped__,
            args = isTaker ? [1] : arguments,
            isLazy = value instanceof LazyWrapper,
            iteratee = args[0],
            useLazy = isLazy || isArray(value);

        var interceptor = function(value) {
          var result = lodashFunc.apply(lodash, arrayPush([value], args));
          return (isTaker && chainAll) ? result[0] : result;
        };

        if (useLazy && checkIteratee && typeof iteratee == 'function' && iteratee.length != 1) {
          // 如果迭代器的 "length" 值不是 `1`，则避免使用懒加载。
          isLazy = useLazy = false;
        }
        var chainAll = this.__chain__,
            isHybrid = !!this.__actions__.length,
            isUnwrapped = retUnwrapped && !chainAll,
            onlyLazy = isLazy && !isHybrid;

        if (!retUnwrapped && useLazy) {
          value = onlyLazy ? value : new LazyWrapper(this);
          var result = func.apply(value, args);
          result.__actions__.push({ 'func': thru, 'args': [interceptor], 'thisArg': undefined });
          return new LodashWrapper(result, chainAll);
        }
        if (isUnwrapped && onlyLazy) {
          return func.apply(this, args);
        }
        result = this.thru(interceptor);
        return isUnwrapped ? (isTaker ? result.value()[0] : result.value()) : result;
      };
    });

    // 添加 `Array` 方法到 `lodash.prototype`。
    arrayEach(['pop', 'push', 'shift', 'sort', 'splice', 'unshift'], function(methodName) {
      var func = arrayProto[methodName],
          chainName = /^(?:push|sort|unshift)$/.test(methodName) ? 'tap' : 'thru',
          retUnwrapped = /^(?:pop|shift)$/.test(methodName);

      lodash.prototype[methodName] = function() {
        var args = arguments;
        if (retUnwrapped && !this.__chain__) {
          var value = this.value();
          return func.apply(isArray(value) ? value : [], args);
        }
        return this[chainName](function(value) {
          return func.apply(isArray(value) ? value : [], args);
        });
      };
    });

    // 将压缩后的方法名映射到它们的真实名称。
    baseForOwn(LazyWrapper.prototype, function(func, methodName) {
      var lodashFunc = lodash[methodName];
      if (lodashFunc) {
        var key = lodashFunc.name + '';
        if (!hasOwnProperty.call(realNames, key)) {
          realNames[key] = [];
        }
        realNames[key].push({ 'name': methodName, 'func': lodashFunc });
      }
    });

    realNames[createHybrid(undefined, WRAP_BIND_KEY_FLAG).name] = [{
      'name': 'wrapper',
      'func': undefined
    }];

    // 添加方法到 `LazyWrapper`。
    LazyWrapper.prototype.clone = lazyClone;
    LazyWrapper.prototype.reverse = lazyReverse;
    LazyWrapper.prototype.value = lazyValue;

    // 添加链式序列方法到 `lodash` 包装器。
    lodash.prototype.at = wrapperAt;
    lodash.prototype.chain = wrapperChain;
    lodash.prototype.commit = wrapperCommit;
    lodash.prototype.next = wrapperNext;
    lodash.prototype.plant = wrapperPlant;
    lodash.prototype.reverse = wrapperReverse;
    lodash.prototype.toJSON = lodash.prototype.valueOf = lodash.prototype.value = wrapperValue;

    // 添加懒加载别名。
    lodash.prototype.first = lodash.prototype.head;

    if (symIterator) {
      lodash.prototype[symIterator] = wrapperToIterator;
    }
    return lodash;
  });

  /*--------------------------------------------------------------------------*/

  // 导出 lodash。
  var _ = runInContext();

  // 一些 AMD 构建优化工具，如 r.js，检查条件模式如：
  if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
    // 在全局对象上暴露 Lodash，以防止当 Lodash 通过 script 标签加载时
    // 在存在 AMD 加载器的情况下出现错误。
    // 有关详细信息，请参阅 http://requirejs.org/docs/errors.html#mismatch。
    // 使用 `_.noConflict` 从全局对象中移除 Lodash。
    root._ = _;

    // 定义为匿名模块，以便通过路径映射，它可以作为 "underscore" 模块引用。
    define(function() {
      return _;
    });
  }
  // 在 `define` 之后检查 `exports`，以防构建优化工具添加它。
  else if (freeModule) {
    // 导出到 Node.js。
    (freeModule.exports = _)._ = _;
    // 导出以支持 CommonJS。
    freeExports._ = _;
  }
  else {
    // 导出到全局对象。
    root._ = _;
  }
}.call(this));
