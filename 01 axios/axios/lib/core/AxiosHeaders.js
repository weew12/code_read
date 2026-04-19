'use strict';

/**
 * @file Axios头部管理类
 * 
 * 功能：提供强大的HTTP头部操作功能，是axios头部处理的核心。
 * 
 * 设计特点：
 * 1. 大小写不敏感的头部访问：自动处理头部名称的大小写变体
 * 2. 头部值规范化：自动清理和格式化头部值
 * 3. 灵活的头部设置：支持多种输入格式（对象、字符串、迭代器）
 * 4. 动态访问器生成：为常用头部生成get/set/has方法（如getContentType）
 * 5. 头部匹配与过滤：支持函数、正则表达式、字符串等多种匹配方式
 * 6. 迭代器支持：可遍历头部键值对
 * 
 * 架构模式：采用类设计，结合静态方法和实例方法，提供完整的头部管理能力。
 */

import utils from '../utils.js';                    // 工具函数
import parseHeaders from '../helpers/parseHeaders.js';  // 头部解析函数

/**
 * 内部状态符号键
 * 
 * 设计目的：使用Symbol作为私有属性的键，避免与公共API冲突。
 * 存储类的内部状态，如已生成的访问器缓存。
 */
const $internals = Symbol('internals');

/**
 * 规范化头部名称
 * 
 * 设计目的：确保头部名称的一致性，便于后续的查找和比较。
 * HTTP头部名称在规范中是大小写不敏感的，此函数将头部名称转换为小写并去除空白。
 * 
 * @param {string} header - 原始头部名称
 * @returns {string} 规范化后的头部名称（小写，无前后空白）
 */
function normalizeHeader(header) {
  return header && String(header).trim().toLowerCase();
}

/**
 * 规范化头部值
 * 
 * 设计目的：清理和标准化头部值，确保值的格式符合HTTP规范。
 * 
 * 特殊处理：
 * 1. false和null值：原样返回，用于表示"移除头部"的语义
 * 2. 数组值：递归规范化每个元素
 * 3. 字符串值：去除末尾的换行符（\r\n），保持值的整洁
 * 
 * 注意：false值在axios中有特殊含义，表示应该删除该头部。
 * 例如：set('Content-Type', false) 会删除Content-Type头部。
 * 
 * @param {*} value - 原始头部值
 * @returns {*} 规范化后的头部值
 */
function normalizeValue(value) {
  if (value === false || value == null) {
    return value;
  }

  return utils.isArray(value)
    ? value.map(normalizeValue)
    : String(value).replace(/[\r\n]+$/, '');
}

/**
 * 解析头部值中的令牌（token）
 * 
 * 设计目的：解析HTTP头部值中的复杂结构，如Accept头部的quality values。
 * 例如：Accept: text/html, application/xhtml+xml; q=0.9, */*; q=0.8
 * 
 * 正则表达式 tokensRE 解析模式：
 * - ([^\s,;=]+): 捕获令牌名（不含空白、逗号、分号、等号）
 * - \s*: 可选空白
 * - (?:=\s*([^,;]+))?: 可选的值捕获组（等号后的值）
 * 
 * @param {string} str - 包含令牌的头部值字符串
 * @returns {Object} 令牌对象，键为令牌名，值为令牌值（如果存在）
 */
function parseTokens(str) {
  const tokens = Object.create(null);
  const tokensRE = /([^\s,;=]+)\s*(?:=\s*([^,;]+))?/g;
  let match;

  while ((match = tokensRE.exec(str))) {
    tokens[match[1]] = match[2];
  }

  return tokens;
}

/**
 * 验证头部名称是否有效
 * 
 * 设计目的：根据HTTP规范验证头部名称的合法性。
 * 正则表达式允许的字符：字母、数字、连字符、下划线以及一些特殊字符。
 * 参考规范：RFC 7230中定义的token字符集。
 * 
 * @param {string} str - 待验证的头部名称
 * @returns {boolean} 是否有效的头部名称
 */
const isValidHeaderName = (str) => /^[-_a-zA-Z0-9^`|~,!#$%&'*+.]+$/.test(str.trim());

/**
 * 匹配头部值（或头部名称）
 * 
 * 设计目的：提供灵活的头部匹配机制，支持多种匹配器类型。
 * 在has、delete、clear等方法中用于筛选特定的头部。
 * 
 * 支持的匹配器类型：
 * 1. 函数：调用函数并传入值和头部名称
 * 2. 字符串：检查值是否包含该字符串
 * 3. 正则表达式：测试值是否匹配模式
 * 
 * @param {Object} context - 执行上下文（this值）
 * @param {*} value - 头部值
 * @param {string} header - 头部名称
 * @param {*} filter - 匹配器（函数、字符串、正则表达式）
 * @param {boolean} isHeaderNameFilter - 是否匹配头部名称而非值
 * @returns {boolean|undefined} 匹配结果，或不匹配时返回undefined
 */
function matchHeaderValue(context, value, header, filter, isHeaderNameFilter) {
  // 情况1：函数匹配器
  if (utils.isFunction(filter)) {
    return filter.call(this, value, header);
  }

  // 情况2：匹配头部名称而非值（用于clear方法）
  if (isHeaderNameFilter) {
    value = header;
  }

  // 非字符串值无法进行字符串匹配
  if (!utils.isString(value)) return;

  // 情况3：字符串匹配器（子字符串查找）
  if (utils.isString(filter)) {
    return value.indexOf(filter) !== -1;
  }

  // 情况4：正则表达式匹配器
  if (utils.isRegExp(filter)) {
    return filter.test(value);
  }
}

/**
 * 格式化头部名称（首字母大写）
 * 
 * 设计目的：将头部名称转换为"首字母大写"格式，提高可读性。
 * 例如："content-type" -> "Content-Type"
 * 
 * 算法：使用正则表达式捕获每个单词的首字符并转换为大写。
 * 正则表达式 /([a-z\d])(\w*)/g 匹配模式：
 * - ([a-z\d]): 捕获首字符（字母或数字）
 * - (\w*): 捕获剩余字符
 * 
 * @param {string} header - 原始头部名称
 * @returns {string} 格式化后的头部名称
 */
function formatHeader(header) {
  return header
    .trim()
    .toLowerCase()
    .replace(/([a-z\d])(\w*)/g, (w, char, str) => {
      return char.toUpperCase() + str;
    });
}

/**
 * 为特定头部构建访问器方法（getXxx, setXxx, hasXxx）
 * 
 * 设计目的：为常用头部提供便捷的链式调用API。
 * 例如：headers.setContentType('application/json').getContentType()
 * 
 * 实现原理：使用Object.defineProperty动态添加方法到原型。
 * 每个访问器方法内部调用对应的通用方法（get/set/has）。
 * 
 * 生成的访问器命名规则：
 * - get + 驼峰化的头部名称（如getContentType）
 * - set + 驼峰化的头部名称（如setContentType）
 * - has + 驼峰化的头部名称（如hasContentType）
 * 
 * @param {Object} obj - 目标对象（通常是AxiosHeaders.prototype）
 * @param {string} header - 头部名称
 */
function buildAccessors(obj, header) {
  const accessorName = utils.toCamelCase(' ' + header);

  ['get', 'set', 'has'].forEach((methodName) => {
    Object.defineProperty(obj, methodName + accessorName, {
      value: function (arg1, arg2, arg3) {
        // 委托给通用的get/set/has方法
        return this[methodName].call(this, header, arg1, arg2, arg3);
      },
      configurable: true, // 允许重新配置
    });
  });
}

/**
 * AxiosHeaders类 - HTTP头部管理
 * 
 * 核心功能：提供完整的HTTP头部操作API，包括设置、获取、删除、匹配、规范化等。
 * 设计模式：采用类设计，支持实例方法和静态方法，提供链式调用。
 * 
 * 实例特性：
 * 1. 继承自Object，但通过Symbol和内部状态管理头部数据
 * 2. 支持大小写不敏感的头部操作
 * 3. 提供迭代器接口，可遍历头部键值对
 * 4. 支持JSON序列化和字符串表示
 */
class AxiosHeaders {
  /**
   * 构造函数
   * 
   * 设计特点：支持多种初始化方式，通过set方法统一处理。
   * 如果提供了headers参数，立即调用set方法设置头部。
   * 
   * @param {*} headers - 可选的初始头部数据（对象、字符串、迭代器等）
   */
  constructor(headers) {
    headers && this.set(headers);
  }

  /**
   * 设置头部（支持多种输入格式）
   * 
   * 方法签名重载：
   * 1. set(headersObject, rewrite?) - 设置多个头部
   * 2. set(headersString, rewrite?) - 解析并设置头部字符串
   * 3. set(headerName, value, rewrite?) - 设置单个头部
   * 4. set(iterable, rewrite?) - 从迭代器设置头部
   * 
   * rewrite参数控制行为：
   * - true: 总是覆盖现有值
   * - false: 总是保留现有值
   * - undefined: 智能覆盖（保留false值，覆盖其他值）
   * 
   * @param {*} header - 头部名称、头部对象或头部字符串
   * @param {*} valueOrRewrite - 头部值或重写标志
   * @param {boolean} rewrite - 重写标志（仅当header为字符串名称时使用）
   * @returns {AxiosHeaders} this，支持链式调用
   */
  set(header, valueOrRewrite, rewrite) {
    const self = this;

    /**
     * 内部函数：设置单个头部
     * 
     * 算法逻辑：
     * 1. 规范化头部名称
     * 2. 查找已存在的键（大小写不敏感）
     * 3. 根据rewrite标志决定是否覆盖
     * 4. 规范化并存储值
     * 
     * 覆盖策略：
     * - 键不存在或值为undefined：总是设置
     * - rewrite === true：总是覆盖
     * - rewrite === false：永不覆盖
     * - rewrite === undefined：如果现有值不为false则覆盖
     * 
     * false值的特殊语义：表示"删除头部"，因此保留false值有意义。
     */
    function setHeader(_value, _header, _rewrite) {
      const lHeader = normalizeHeader(_header);

      if (!lHeader) {
        throw new Error('header name must be a non-empty string');
      }

      const key = utils.findKey(self, lHeader);

      if (
        !key ||
        self[key] === undefined ||
        _rewrite === true ||
        (_rewrite === undefined && self[key] !== false)
      ) {
        self[key || _header] = normalizeValue(_value);
      }
    }

    /**
     * 内部函数：批量设置头部
     * 遍历对象或Map的键值对，对每个头部调用setHeader
     */
    const setHeaders = (headers, _rewrite) =>
      utils.forEach(headers, (_value, _header) => setHeader(_value, _header, _rewrite));

    // 情况1：普通对象或AxiosHeaders实例
    if (utils.isPlainObject(header) || header instanceof this.constructor) {
      setHeaders(header, valueOrRewrite);
    } 
    // 情况2：头部字符串（如"Content-Type: application/json"）
    else if (utils.isString(header) && (header = header.trim()) && !isValidHeaderName(header)) {
      // 注意：如果字符串是有效的单个头部名称（如"content-type"），则进入情况4
      // 这里检查!isValidHeaderName(header)确保字符串是多行头部
      setHeaders(parseHeaders(header), valueOrRewrite);
    } 
    // 情况3：可迭代对象（如Map、Array的迭代器）
    else if (utils.isObject(header) && utils.isIterable(header)) {
      let obj = {},
        dest,
        key;
      // 将迭代器转换为对象，处理重复键（合并为数组）
      for (const entry of header) {
        if (!utils.isArray(entry)) {
          throw TypeError('Object iterator must return a key-value pair');
        }

        obj[(key = entry[0])] = (dest = obj[key])
          ? utils.isArray(dest)
            ? [...dest, entry[1]]          // 已有数组：推入新值
            : [dest, entry[1]]             // 已有非数组值：创建数组
          : entry[1];                      // 新键：直接赋值
      }

      setHeaders(obj, valueOrRewrite);
    } 
    // 情况4：单个头部名称和值
    else {
      header != null && setHeader(valueOrRewrite, header, rewrite);
    }

    return this;
  }

  /**
   * 获取头部值
   * 
   * 功能：根据头部名称获取值，支持多种解析选项。
   * 
   * 设计特点：
   * 1. 大小写不敏感查找
   * 2. 支持值解析（令牌解析、自定义函数、正则匹配）
   * 3. 如果头部不存在，返回undefined
   * 
   * parser参数选项：
   * - undefined/null: 返回原始值
   * - true: 使用parseTokens解析值为令牌对象
   * - 函数: 调用函数并传入值和键
   * - 正则表达式: 执行正则匹配
   * 
   * @param {string} header - 头部名称
   * @param {*} parser - 可选的解析器
   * @returns {*} 头部值或解析结果
   */
  get(header, parser) {
    header = normalizeHeader(header);

    if (header) {
      const key = utils.findKey(this, header);

      if (key) {
        const value = this[key];

        // 情况1：无解析器，返回原始值
        if (!parser) {
          return value;
        }

        // 情况2：parser === true，解析为令牌对象
        if (parser === true) {
          return parseTokens(value);
        }

        // 情况3：函数解析器
        if (utils.isFunction(parser)) {
          return parser.call(this, value, key);
        }

        // 情况4：正则表达式解析器
        if (utils.isRegExp(parser)) {
          return parser.exec(value);
        }

        throw new TypeError('parser must be boolean|regexp|function');
      }
    }
  }

  /**
   * 检查头部是否存在
   * 
   * 功能：检查指定头部是否存在且值不为undefined。
   * 可选地使用matcher进一步验证头部值是否符合条件。
   * 
   * 验证逻辑：
   * 1. 头部名称规范化
   * 2. 查找对应的键（大小写不敏感）
   * 3. 检查值是否为undefined（false值被认为是存在的）
   * 4. 如果提供了matcher，验证值是否匹配
   * 
   * 注意：false值在axios中表示"已删除的头部"，但has方法仍返回true。
   * 这是因为false是一个有效的存储值，表示明确的删除意图。
   * 
   * @param {string} header - 头部名称
   * @param {*} matcher - 可选的匹配器（函数、字符串、正则表达式）
   * @returns {boolean} 头部是否存在且匹配条件（如果提供了matcher）
   */
  has(header, matcher) {
    header = normalizeHeader(header);

    if (header) {
      const key = utils.findKey(this, header);

      return !!(
        key &&
        this[key] !== undefined &&
        (!matcher || matchHeaderValue(this, this[key], key, matcher))
      );
    }

    return false;
  }

  /**
   * 删除头部
   * 
   * 功能：删除一个或多个头部，可选地使用匹配器筛选。
   * 
   * 设计特点：
   * 1. 支持删除单个头部或多个头部（数组）
   * 2. 支持使用matcher条件删除
   * 3. 返回布尔值表示是否实际删除了任何头部
   * 
   * 删除逻辑：
   * 1. 规范化头部名称
   * 2. 查找对应的键（大小写不敏感）
   * 3. 如果未提供matcher或值匹配matcher，则删除
   * 4. 使用delete操作符从对象中删除属性
   * 
   * 注意：与set(header, false)不同，delete是永久移除属性。
   * set(header, false)将值设置为false，而delete完全移除属性。
   * 
   * @param {string|string[]} header - 要删除的头部名称或名称数组
   * @param {*} matcher - 可选的匹配器，仅删除匹配的头部
   * @returns {boolean} 是否成功删除了至少一个头部
   */
  delete(header, matcher) {
    const self = this;
    let deleted = false;

    /**
     * 内部函数：删除单个头部
     */
    function deleteHeader(_header) {
      _header = normalizeHeader(_header);

      if (_header) {
        const key = utils.findKey(self, _header);

        if (key && (!matcher || matchHeaderValue(self, self[key], key, matcher))) {
          delete self[key];

          deleted = true;
        }
      }
    }

    // 支持批量删除（数组）或单个删除
    if (utils.isArray(header)) {
      header.forEach(deleteHeader);
    } else {
      deleteHeader(header);
    }

    return deleted;
  }

  /**
   * 清除头部
   * 
   * 功能：清除所有头部或根据匹配器清除特定头部。
   * 
   * 设计特点：
   * 1. 使用倒序遍历（性能优化，避免索引变化）
   * 2. 匹配器应用于头部名称（isHeaderNameFilter = true）
   * 3. 返回布尔值表示是否实际删除了任何头部
   * 
   * 与delete方法的区别：
   * 1. clear() 清除所有头部
   * 2. clear(matcher) 清除匹配的头部（基于名称匹配）
   * 3. delete() 删除指定名称的头部（基于值匹配）
   * 
   * 注意：matcher参数在这里匹配的是头部名称（key），而不是值。
   * 这是因为clear通常用于按名称模式批量删除（如删除所有"x-"开头的头部）。
   * 
   * @param {*} matcher - 可选的匹配器，应用于头部名称
   * @returns {boolean} 是否成功删除了至少一个头部
   */
  clear(matcher) {
    const keys = Object.keys(this);
    let i = keys.length;
    let deleted = false;

    // 倒序遍历所有键（避免删除时索引变化）
    while (i--) {
      const key = keys[i];
      // 注意：isHeaderNameFilter参数为true，匹配头部名称而非值
      if (!matcher || matchHeaderValue(this, this[key], key, matcher, true)) {
        delete this[key];
        deleted = true;
      }
    }

    return deleted;
  }

  /**
   * 规范化头部名称
   * 
   * 功能：统一头部名称的格式，消除大小写变体，可选地格式化为首字母大写。
   * 
   * 算法逻辑：
   * 1. 遍历当前所有头部
   * 2. 对于每个头部：
   *    a. 检查是否已存在规范化版本的键（大小写不敏感）
   *    b. 如果存在，将值合并到现有键，删除原键
   *    c. 如果不存在，根据format参数格式化键名
   *    d. 如果新键名与原键名不同，删除原键
   *    e. 设置新键值对
   *    f. 记录已处理的规范化键名
   * 
   * 设计目的：确保头部名称的一致性，避免因大小写不同导致的重复头部。
   * 
   * @param {boolean} format - 是否格式化头部名称（首字母大写）
   * @returns {AxiosHeaders} this，支持链式调用
   */
  normalize(format) {
    const self = this;
    const headers = {}; // 记录已处理的规范化键名

    utils.forEach(this, (value, header) => {
      const key = utils.findKey(headers, header);

      // 情况1：已存在规范化版本的键（大小写冲突）
      if (key) {
        self[key] = normalizeValue(value);
        delete self[header]; // 删除原键（大小写变体）
        return;
      }

      // 情况2：新键，根据format参数决定格式化方式
      const normalized = format ? formatHeader(header) : String(header).trim();

      // 如果规范化后的键名不同，删除原键
      if (normalized !== header) {
        delete self[header];
      }

      // 设置规范化键值对
      self[normalized] = normalizeValue(value);

      // 记录已处理的键名（用于检测大小写冲突）
      headers[normalized] = true;
    });

    return this;
  }

  /**
   * 连接头部
   * 
   * 功能：创建新的AxiosHeaders实例，包含当前头部和指定的目标头部。
   * 实现方式：委托给静态方法concat。
   * 
   * 合并规则：使用set方法的默认合并逻辑（智能覆盖）。
   * 
   * @param {...*} targets - 要连接的头部源（对象、字符串、AxiosHeaders等）
   * @returns {AxiosHeaders} 新的AxiosHeaders实例
   */
  concat(...targets) {
    return this.constructor.concat(this, ...targets);
  }

  /**
   * 转换为JSON对象
   * 
   * 功能：将头部转换为普通的JavaScript对象。
   * 
   * 过滤规则：
   * 1. 忽略null和undefined值
   * 2. 忽略false值（表示已删除的头部）
   * 3. 当asStrings为true时，将数组值连接为逗号分隔的字符串
   * 
   * 设计目的：提供序列化接口，便于存储、传输或日志记录。
   * 
   * @param {boolean} asStrings - 是否将数组值转换为字符串
   * @returns {Object} 普通对象，键为头部名称，值为头部值
   */
  toJSON(asStrings) {
    const obj = Object.create(null);

    utils.forEach(this, (value, header) => {
      value != null &&
        value !== false &&
        (obj[header] = asStrings && utils.isArray(value) ? value.join(', ') : value);
    });

    return obj;
  }

  /**
   * 迭代器接口
   * 
   * 功能：使AxiosHeaders实例可迭代，支持for...of循环和解构赋值。
   * 
   * 实现方式：委托给Object.entries(this.toJSON())的迭代器。
   * 过滤掉了null、undefined和false值，只返回有效的头部。
   * 
   * 使用示例：
   * ```javascript
   * for (const [header, value] of headers) {
   *   console.log(header, value);
   * }
   * ```
   * 
   * @returns {Iterator} 迭代器，产生[key, value]对
   */
  [Symbol.iterator]() {
    return Object.entries(this.toJSON())[Symbol.iterator]();
  }

  /**
   * 字符串表示
   * 
   * 功能：将头部格式化为HTTP头部字符串（多行文本）。
   * 
   * 格式：每行"header: value"，行间用换行符分隔。
   * 过滤掉了null、undefined和false值，只包含有效的头部。
   * 
   * 使用场景：调试、日志记录、或直接作为HTTP头部发送。
   * 
   * @returns {string} HTTP头部格式的字符串
   */
  toString() {
    return Object.entries(this.toJSON())
      .map(([header, value]) => header + ': ' + value)
      .join('\n');
  }

  /**
   * 获取Set-Cookie头部
   * 
   * 功能：专门处理Set-Cookie头部的便捷方法。
   * 
   * 设计原因：Set-Cookie头部是特殊的，允许多个值（数组）。
   * 此方法确保始终返回数组，即使没有Set-Cookie头部也返回空数组。
   * 
   * @returns {Array} Set-Cookie值数组
   */
  getSetCookie() {
    return this.get('set-cookie') || [];
  }

  /**
   * Symbol.toStringTag
   * 
   * 功能：定义Object.prototype.toString()的返回值。
   * 
   * 作用：使Object.prototype.toString.call(headers)返回"[object AxiosHeaders]"。
   * 有助于类型检查和调试。
   * 
   * @returns {string} 类型标签"AxiosHeaders"
   */
  get [Symbol.toStringTag]() {
    return 'AxiosHeaders';
  }

  /**
   * 工厂方法：从任意值创建AxiosHeaders实例
   * 
   * 功能：如果输入已经是AxiosHeaders实例，则直接返回；
   * 否则创建新的实例。
   * 
   * 设计模式：类似"工厂方法"或"静态工厂"模式。
   * 提供统一的实例创建接口，避免不必要的实例化。
   * 
   * @param {*} thing - 任意值（对象、字符串、AxiosHeaders等）
   * @returns {AxiosHeaders} AxiosHeaders实例
   */
  static from(thing) {
    return thing instanceof this ? thing : new this(thing);
  }

  /**
   * 静态方法：连接多个头部源
   * 
   * 功能：创建新的AxiosHeaders实例，包含所有输入源中的头部。
   * 
   * 合并顺序：从左到右，后面的源会覆盖前面的源（根据set的默认规则）。
   * 
   * @param {*} first - 第一个头部源
   * @param {...*} targets - 其他头部源
   * @returns {AxiosHeaders} 新的AxiosHeaders实例
   */
  static concat(first, ...targets) {
    const computed = new this(first);

    targets.forEach((target) => computed.set(target));

    return computed;
  }

  /**
   * 静态方法：为头部生成访问器方法
   * 
   * 功能：为指定的头部名称动态生成getXxx、setXxx、hasXxx方法。
   * 使用缓存机制确保每个头部只生成一次访问器。
   * 
   * 设计目的：提供类型安全的便捷API，改善开发体验。
   * 例如：headers.setContentType('application/json') 比 headers.set('content-type', 'application/json') 更清晰。
   * 
   * 实现细节：
   * 1. 使用Symbol键存储内部状态，避免污染公共API
   * 2. 缓存已生成的访问器，避免重复定义
   * 3. 委托给buildAccessors函数实际创建方法
   * 
   * @param {string|string[]} header - 头部名称或名称数组
   * @returns {Function} 类构造函数（支持链式调用）
   */
  static accessor(header) {
    // 初始化或获取内部状态
    const internals =
      (this[$internals] =
      this[$internals] =
        {
          accessors: {}, // 缓存已生成访问器的头部
        });

    const accessors = internals.accessors;
    const prototype = this.prototype;

    /**
     * 内部函数：为单个头部定义访问器
     */
    function defineAccessor(_header) {
      const lHeader = normalizeHeader(_header);

      // 检查是否已为此头部生成过访问器
      if (!accessors[lHeader]) {
        buildAccessors(prototype, _header);
        accessors[lHeader] = true; // 标记为已生成
      }
    }

    // 支持单个头部或头部数组
    utils.isArray(header) ? header.forEach(defineAccessor) : defineAccessor(header);

    return this; // 返回类，支持链式调用
  }
}

/**
 * 预定义常用头部的访问器
 * 
 * 这些是HTTP请求和响应中最常用的头部，为它们生成便捷的访问器方法。
 * 例如：getContentType(), setAccept(), hasAuthorization()等。
 */
AxiosHeaders.accessor([
  'Content-Type',
  'Content-Length',
  'Accept',
  'Accept-Encoding',
  'User-Agent',
  'Authorization',
]);

/**
 * 保留名称修复
 * 
 * 问题：某些头部名称可能与JavaScript的保留字或内置属性冲突。
 * 例如：头部名称"constructor"会覆盖对象的constructor属性。
 * 
 * 解决方案：使用utils.reduceDescriptors为这些冲突的属性创建安全的访问器。
 * 当访问冲突属性时，重定向到首字母大写的版本。
 * 例如：headers.constructor 实际上访问 headers.Constructor。
 */
utils.reduceDescriptors(AxiosHeaders.prototype, ({ value }, key) => {
  let mapped = key[0].toUpperCase() + key.slice(1); // map `set` => `Set`
  return {
    get: () => value,
    set(headerValue) {
      this[mapped] = headerValue;
    },
  };
});

/**
 * 冻结方法
 * 
 * 安全措施：防止AxiosHeaders类的方法被修改、重写或删除。
 * 确保库的行为一致性。
 */
utils.freezeMethods(AxiosHeaders);

export default AxiosHeaders;
