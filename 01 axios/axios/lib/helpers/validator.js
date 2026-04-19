'use strict';

import { VERSION } from '../env/data.js';
import AxiosError from '../core/AxiosError.js';

/**
 * @file 配置验证器模块
 * 
 * 该模块提供了axios配置选项的验证功能，包括：
 * 1. 基本类型验证（object, boolean, number, function, string, symbol）
 * 2. 过渡性选项验证（用于API演进期间的向后兼容）
 * 3. 拼写错误检查
 * 4. 完整的配置断言
 * 
 * 设计目的：在运行时确保配置选项的类型和值符合预期，提供清晰的错误信息，
 * 并支持API的平滑演进（通过过渡性选项机制）。
 */

const validators = {};

// eslint-disable-next-line func-names
['object', 'boolean', 'number', 'function', 'string', 'symbol'].forEach((type, i) => {
  /**
   * 动态生成基本类型验证函数
   * 
   * 设计思路：通过闭包为每种JavaScript基本类型创建验证函数。
   * 验证函数返回true（验证通过）或一个错误信息字符串（验证失败）。
   * 错误信息字符串的生成考虑了英语语法：元音字母开头的类型前加"an"（如"an object"），
   * 辅音字母开头的类型前加"a"（如"a boolean"）。
   * 
   * 注意：symbol类型在ES6中引入，axios也提供了相应的验证支持。
   */
  validators[type] = function validator(thing) {
    return typeof thing === type || 'a' + (i < 1 ? 'n ' : ' ') + type;
  };
});

/**
 * 已弃用警告缓存，确保每个选项只警告一次（单例模式）
 */
const deprecatedWarnings = {};

/**
 * 过渡性选项验证器工厂函数
 * 
 * 设计目的：支持API的平滑演进。当某些配置选项被弃用或移除时，
 * 通过此机制提供清晰的迁移路径。
 * 
 * 工作模式：
 * 1. 如果validator参数为false：选项已被移除，直接抛出错误
 * 2. 如果提供了version参数：选项已被弃用，控制台输出警告（仅首次）
 * 3. 否则：执行传入的验证器函数
 * 
 * @param {function|boolean?} validator - 设置为false表示选项已被移除
 * @param {string?} version - 弃用/移除的版本号
 * @param {string?} message - 附加信息
 * @returns {function} 返回一个验证器函数
 */
validators.transitional = function transitional(validator, version, message) {
  /**
   * 格式化错误/警告消息
   * 包含axios版本、选项名称和状态描述
   */
  function formatMessage(opt, desc) {
    return (
      '[Axios v' +
      VERSION +
      "] Transitional option '" +
      opt +
      "'" +
      desc +
      (message ? '. ' + message : '')
    );
  }

  // eslint-disable-next-line func-names
  return (value, opt, opts) => {
    // 情况1：选项已被完全移除，抛出错误
    if (validator === false) {
      throw new AxiosError(
        formatMessage(opt, ' has been removed' + (version ? ' in ' + version : '')),
        AxiosError.ERR_DEPRECATED
      );
    }

    // 情况2：选项已被弃用，输出控制台警告（仅首次）
    if (version && !deprecatedWarnings[opt]) {
      deprecatedWarnings[opt] = true;
      // eslint-disable-next-line no-console
      console.warn(
        formatMessage(
          opt,
          ' has been deprecated since v' + version + ' and will be removed in the near future'
        )
      );
    }

    // 情况3：执行自定义验证器或直接通过（当validator为null/undefined时）
    return validator ? validator(value, opt, opts) : true;
  };
};

/**
 * 拼写错误检查器工厂函数
 * 
 * 设计目的：捕获常见的配置选项拼写错误，提供友好的纠正建议。
 * 例如：如果用户误将"timeout"写为"timeot"，此函数会输出警告。
 * 
 * 注意：此验证器总是返回true（不阻止请求），仅输出警告信息。
 * 
 * @param {string} correctSpelling - 正确的拼写
 * @returns {function} 返回一个验证器函数
 */
validators.spelling = function spelling(correctSpelling) {
  return (value, opt) => {
    // eslint-disable-next-line no-console
    console.warn(`${opt} is likely a misspelling of ${correctSpelling}`);
    return true;
  };
};

/**
 * 断言配置选项符合预期的模式
 * 
 * 算法逻辑：
 * 1. 验证options参数必须是对象
 * 2. 遍历options的所有属性（使用倒序循环，一种常见的性能优化模式）
 * 3. 对每个属性：
 *    a. 如果在schema中找到对应的验证器，执行验证
 *    b. 如果未找到且allowUnknown不为true，抛出未知选项错误
 * 
 * 设计特点：
 * - 支持可选参数（value === undefined时跳过验证）
 * - 验证器可以返回true（通过）或错误信息字符串（失败）
 * - 使用倒序循环，可能出于性能考虑或代码风格偏好
 * - 集成AxiosError，提供标准化的错误代码
 * 
 * @param {object} options - 待验证的配置对象
 * @param {object} schema - 验证模式对象，键为选项名，值为验证器函数
 * @param {boolean?} allowUnknown - 是否允许未知选项
 * @returns {object} 无返回值，验证失败时抛出异常
 */
function assertOptions(options, schema, allowUnknown) {
  // 基础类型检查：options必须是对象
  if (typeof options !== 'object') {
    throw new AxiosError('options must be an object', AxiosError.ERR_BAD_OPTION_VALUE);
  }
  
  const keys = Object.keys(options);
  let i = keys.length;
  
  // 倒序遍历所有选项键（常见的性能优化模式）
  while (i-- > 0) {
    const opt = keys[i];
    const validator = schema[opt];
    
    if (validator) {
      // 选项在schema中有定义，执行验证
      const value = options[opt];
      
      // 注意：undefined值会被跳过，这支持了可选参数的设计
      const result = value === undefined || validator(value, opt, options);
      
      if (result !== true) {
        // 验证失败：result包含错误信息字符串（如"a string"）
        throw new AxiosError(
          'option ' + opt + ' must be ' + result,
          AxiosError.ERR_BAD_OPTION_VALUE
        );
      }
      continue;
    }
    
    // 选项不在schema中，检查是否允许未知选项
    if (allowUnknown !== true) {
      throw new AxiosError('Unknown option ' + opt, AxiosError.ERR_BAD_OPTION);
    }
  }
}

/**
 * 模块导出
 * 
 * 公共API：
 * 1. assertOptions - 主要的配置断言函数
 * 2. validators - 验证器集合，包含基本类型验证器和工厂函数
 * 
 * 使用示例：
 * ```javascript
 * import validator from './validator.js';
 * 
 * const schema = {
 *   timeout: validator.validators.number,
 *   url: validator.validators.string
 * };
 * 
 * validator.assertOptions(config, schema, false);
 * ```
 */
export default {
  assertOptions,
  validators,
};
