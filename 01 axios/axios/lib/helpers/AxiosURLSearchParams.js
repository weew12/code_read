'use strict';

/**
 * @file Axios URL查询参数实现（URLSearchParams的替代/兼容实现）
 * 
 * 功能：提供与浏览器URLSearchParams API兼容的查询参数处理类。
 * 当运行环境不支持原生URLSearchParams时（如旧版Node.js），使用此实现作为polyfill。
 * 
 * 设计特点：
 * 1. 兼容API：实现append、toString等标准URLSearchParams方法
 * 2. 编码定制：提供自定义编码函数支持，默认使用符合RFC标准的URL编码
 * 3. 内部存储：使用_pairs数组存储键值对，保持插入顺序
 * 4. FormData集成：利用toFormData进行参数转换，支持复杂数据结构
 * 
 * 使用场景：构建URL查询字符串、处理application/x-www-form-urlencoded格式数据。
 */

import toFormData from './toFormData.js';

/**
 * URL编码函数（符合RFC标准）
 * 
 * 功能：对字符串进行URL编码，将非保留字符替换为其百分号编码等效值。
 * 与标准encodeURIComponent不同，此函数对一些特殊字符进行额外处理：
 * - '!' -> '%21'
 * - "'" -> '%27'
 * - '(' -> '%28'
 * - ')' -> '%29'
 * - '~' -> '%7E'
 * - '%20' -> '+'（空格特殊处理）
 * - '%00' -> '\x00'（空字符处理）
 * 
 * 设计目的：生成符合application/x-www-form-urlencoded格式的查询字符串。
 * 
 * @param {string} str - 要编码的字符串
 * @returns {string} 编码后的字符串
 */
function encode(str) {
  const charMap = {
    '!': '%21',
    "'": '%27',
    '(': '%28',
    ')': '%29',
    '~': '%7E',
    '%20': '+',
    '%00': '\x00',
  };
  return encodeURIComponent(str).replace(/[!'()~]|%20|%00/g, function replacer(match) {
    return charMap[match];
  });
}

/**
 * AxiosURLSearchParams 构造函数
 * 
 * 功能：创建URL查询参数对象，将参数对象转换为FormData格式存储。
 * 内部使用toFormData进行转换，支持嵌套对象、数组等复杂数据结构。
 * 
 * 设计目的：提供与浏览器URLSearchParams一致的构造函数API，
 * 同时支持axios特有的配置选项（如dots、indexes等格式选项）。
 * 
 * @param {Object<string, any>} params - 要转换为FormData对象的参数对象
 * @param {Object<string, any>} options - 传递给Axios构造函数的选项对象
 * @returns {void}
 */
function AxiosURLSearchParams(params, options) {
  this._pairs = [];

  params && toFormData(params, this, options);
}

const prototype = AxiosURLSearchParams.prototype;

prototype.append = function append(name, value) {
  this._pairs.push([name, value]);
};

prototype.toString = function toString(encoder) {
  const _encode = encoder
    ? function (value) {
        return encoder.call(this, value, encode);
      }
    : encode;

  return this._pairs
    .map(function each(pair) {
      return _encode(pair[0]) + '=' + _encode(pair[1]);
    }, '')
    .join('&');
};

export default AxiosURLSearchParams;
