'use strict';

/**
 * @file 对象到FormData转换器
 * 
 * 功能：将JavaScript对象（包括嵌套对象、数组、文件等）转换为FormData实例。
 * 
 * 设计目的：
 * 1. 支持复杂数据结构：嵌套对象、数组、混合类型
 * 2. 多种编码格式：支持带括号的数组表示法和点表示法
 * 3. 文件处理：自动处理File、Blob等二进制类型
 * 4. 循环引用避免：检测并避免无限递归
 * 5. 浏览器兼容：生成浏览器和服务器都能正确解析的FormData
 * 
 * 算法概述：
 * 1. 递归遍历对象属性
 * 2. 根据dots和metaIndexes选项决定键名格式
 * 3. 处理数组和嵌套对象
 * 4. 添加值到FormData，处理特殊类型（File、Blob等）
 * 
 * 使用场景：将复杂JavaScript对象转换为multipart/form-data格式，
 * 用于文件上传或复杂表单提交。
 */

import utils from '../utils.js';
import AxiosError from '../core/AxiosError.js';
// 临时修复：避免循环引用，直到AxiosURLSearchParams重构完成
import PlatformFormData from '../platform/node/classes/FormData.js';

/**
 * 判断给定值是否可访问（即是否为纯对象或数组）
 * 
 * 功能：确定是否需要对值进行递归遍历。
 * 只有纯对象和数组需要进一步递归处理，其他类型（字符串、数字、文件等）直接添加到FormData。
 * 
 * @param {any} thing - 要检查的值（对象或数组）
 * @returns {boolean} 如果是纯对象或数组则返回true，否则返回false
 */
function isVisitable(thing) {
  return utils.isPlainObject(thing) || utils.isArray(thing);
}

/**
 * 移除字符串末尾的方括号（"[]"）
 * 
 * 功能：处理数组键名表示法，将"key[]"转换为"key"。
 * 这是FormData数组表示法的标准格式，用于表示数组字段。
 * 
 * @param {string} key - 参数键名（可能包含"[]"后缀）
 * @returns {string} 移除"[]"后的键名
 */
function removeBrackets(key) {
  return utils.endsWith(key, '[]') ? key.slice(0, -2) : key;
}

/**
 * 渲染完整的FormData键名
 * 
 * 功能：根据路径、当前键名和格式选项生成完整的FormData字段名。
 * 
 * 键名格式选项：
 * 1. dots为false（默认）：使用方括号表示法，如"user[profile][name]"
 * 2. dots为true：使用点表示法，如"user.profile.name"
 * 
 * 算法步骤：
 * 1. 将路径数组与当前键名连接
 * 2. 对每个部分移除可能的"[]"后缀
 * 3. 根据dots选项决定使用方括号还是点号连接
 * 
 * @param {Array<string>} path - 当前递归路径（数组形式）
 * @param {string} key - 当前处理的键名
 * @param {boolean} dots - 是否使用点表示法（否则使用方括号表示法）
 * @returns {string} 完整的FormData字段名
 */
function renderKey(path, key, dots) {
  if (!path) return key;
  return path
    .concat(key)
    .map(function each(token, i) {
      // eslint-disable-next-line no-param-reassign
      token = removeBrackets(token);
      return !dots && i ? '[' + token + ']' : token;
    })
    .join(dots ? '.' : '');
}

/**
 * 判断数组是否为扁平数组（即不包含可访问元素）
 * 
 * 功能：检测数组是否只包含基本类型（字符串、数字等）而不包含对象或嵌套数组。
 * 扁平数组可以直接展开为多个同名字段，而非扁平数组需要特殊处理。
 * 
 * @param {Array<any>} arr - 要检查的数组
 * @returns {boolean} 如果是扁平数组则返回true，否则返回false
 */
function isFlatArray(arr) {
  return utils.isArray(arr) && !arr.some(isVisitable);
}

/**
 * 类型谓词函数集合
 * 
 * 功能：收集utils模块中所有以"is"开头的类型检测函数（如isArray、isPlainObject等）。
 * 使用utils.toFlatObject扁平化工具函数，便于动态调用类型检测。
 * 
 * 设计目的：在转换过程中动态检测值类型，决定如何处理（如文件、Blob、流等特殊类型）。
 */
const predicates = utils.toFlatObject(utils, {}, null, function filter(prop) {
  return /^is[A-Z]/.test(prop);
});

/**
 * 将JavaScript对象转换为FormData对象（核心转换函数）
 * 
 * 功能：递归遍历对象属性，生成符合multipart/form-data格式的FormData实例。
 * 支持复杂数据结构包括嵌套对象、数组、文件、Blob等。
 * 
 * 选项参数说明：
 * @param {Object} obj - 要转换的源对象
 * @param {FormData} [formData] - 目标FormData对象（可选，不提供则创建新实例）
 * @param {Object} [options] - 转换选项
 * @param {Function} [options.visitor] - 访问者函数，可在添加每个字段前进行自定义处理
 * @param {Boolean} [options.metaTokens=true] - 是否保留元令牌（如"[]"）
 * @param {Boolean} [options.dots=false] - 是否使用点表示法（否则使用方括号表示法）
 * @param {Boolean} [options.indexes=false] - 是否在数组键名中包含索引
 * 
 * 转换算法：
 * 1. 参数验证和默认值设置
 * 2. 递归遍历对象属性
 * 3. 根据选项生成正确的字段名格式
 * 4. 处理特殊类型（文件、Blob、流等）
 * 5. 使用访问者模式允许自定义处理
 * 6. 将值追加到FormData
 * 
 * 返回：填充后的FormData对象
 */
function toFormData(obj, formData, options) {
  if (!utils.isObject(obj)) {
    throw new TypeError('target must be an object');
  }

  // eslint-disable-next-line no-param-reassign
  formData = formData || new (PlatformFormData || FormData)();

  // eslint-disable-next-line no-param-reassign
  options = utils.toFlatObject(
    options,
    {
      metaTokens: true,
      dots: false,
      indexes: false,
    },
    false,
    function defined(option, source) {
      // eslint-disable-next-line no-eq-null,eqeqeq
      return !utils.isUndefined(source[option]);
    }
  );

  const metaTokens = options.metaTokens;
  // eslint-disable-next-line no-use-before-define
  const visitor = options.visitor || defaultVisitor;
  const dots = options.dots;
  const indexes = options.indexes;
  const _Blob = options.Blob || (typeof Blob !== 'undefined' && Blob);
  const useBlob = _Blob && utils.isSpecCompliantForm(formData);

  if (!utils.isFunction(visitor)) {
    throw new TypeError('visitor must be a function');
  }

  function convertValue(value) {
    if (value === null) return '';

    if (utils.isDate(value)) {
      return value.toISOString();
    }

    if (utils.isBoolean(value)) {
      return value.toString();
    }

    if (!useBlob && utils.isBlob(value)) {
      throw new AxiosError('Blob is not supported. Use a Buffer instead.');
    }

    if (utils.isArrayBuffer(value) || utils.isTypedArray(value)) {
      return useBlob && typeof Blob === 'function' ? new Blob([value]) : Buffer.from(value);
    }

    return value;
  }

  /**
   * 默认访问者函数（visitor模式）
   * 
   * 功能：处理每个字段的值，决定是否递归访问其属性。
   * 这是访问者模式的实现，用户可以通过options.visitor提供自定义访问者函数。
   * 
   * 返回值语义：
   * - true：继续递归访问该值的属性（适用于对象和数组）
   * - false：停止递归，直接将当前值添加到FormData
   * 
   * @param {*} value - 当前字段的值
   * @param {String|Number} key - 当前字段的键名
   * @param {Array<String|Number>} path - 当前递归路径
   * @this {FormData} - 函数执行上下文（FormData实例）
   * @returns {boolean} 返回true表示递归访问值的属性，false表示停止递归
   */
  function defaultVisitor(value, key, path) {
    let arr = value;

    if (utils.isReactNative(formData) && utils.isReactNativeBlob(value)) {
      formData.append(renderKey(path, key, dots), convertValue(value));
      return false;
    }

    if (value && !path && typeof value === 'object') {
      if (utils.endsWith(key, '{}')) {
        // eslint-disable-next-line no-param-reassign
        key = metaTokens ? key : key.slice(0, -2);
        // eslint-disable-next-line no-param-reassign
        value = JSON.stringify(value);
      } else if (
        (utils.isArray(value) && isFlatArray(value)) ||
        ((utils.isFileList(value) || utils.endsWith(key, '[]')) && (arr = utils.toArray(value)))
      ) {
        // eslint-disable-next-line no-param-reassign
        key = removeBrackets(key);

        arr.forEach(function each(el, index) {
          !(utils.isUndefined(el) || el === null) &&
            formData.append(
              // eslint-disable-next-line no-nested-ternary
              indexes === true
                ? renderKey([key], index, dots)
                : indexes === null
                  ? key
                  : key + '[]',
              convertValue(el)
            );
        });
        return false;
      }
    }

    if (isVisitable(value)) {
      return true;
    }

    formData.append(renderKey(path, key, dots), convertValue(value));

    return false;
  }

  const stack = [];

  const exposedHelpers = Object.assign(predicates, {
    defaultVisitor,
    convertValue,
    isVisitable,
  });

  function build(value, path) {
    if (utils.isUndefined(value)) return;

    if (stack.indexOf(value) !== -1) {
      throw Error('Circular reference detected in ' + path.join('.'));
    }

    stack.push(value);

    utils.forEach(value, function each(el, key) {
      const result =
        !(utils.isUndefined(el) || el === null) &&
        visitor.call(formData, el, utils.isString(key) ? key.trim() : key, path, exposedHelpers);

      if (result === true) {
        build(el, path ? path.concat(key) : [key]);
      }
    });

    stack.pop();
  }

  if (!utils.isObject(obj)) {
    throw new TypeError('data must be an object');
  }

  build(obj);

  return formData;
}

export default toFormData;
