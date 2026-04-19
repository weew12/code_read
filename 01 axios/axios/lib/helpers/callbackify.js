/**
 * @file Promise函数转回调风格适配器
 * 
 * 功能：将返回Promise的函数转换为Node.js风格的回调函数（错误优先回调）。
 * 这是axios中兼容旧式回调API的桥梁，允许异步函数以两种风格（Promise/回调）使用。
 * 
 * 转换规则：
 * 1. 如果fn是异步函数（返回Promise），包装它：自动提取最后一个参数作为回调
 * 2. 如果fn不是异步函数，直接返回原函数（无包装开销）
 * 3. 支持reducer函数：将Promise的单个返回值映射为回调的多个参数
 * 
 * 设计目的：在保持Promise核心的同时，提供向后兼容的回调接口。
 */

import utils from '../utils.js';

/**
 * 将Promise函数转换为回调风格函数
 * 
 * 包装逻辑：
 * - 识别最后一个参数为回调函数cb
 * - 调用原函数（除cb外的所有参数）
 * - Promise成功：调用cb(null, value) 或 cb(null, ...reducer(value))
 * - Promise失败：直接调用cb(err)
 * 
 * @param {Function} fn - 要转换的函数（可能返回Promise）
 * @param {Function} [reducer] - 返回值转换器，将单个值映射为多个回调参数
 * @returns {Function} 转换后的回调风格函数（或原函数）
 */
const callbackify = (fn, reducer) => {
  return utils.isAsyncFn(fn)
    ? function (...args) {
        const cb = args.pop();
        fn.apply(this, args).then((value) => {
          try {
            reducer ? cb(null, ...reducer(value)) : cb(null, value);
          } catch (err) {
            cb(err);
          }
        }, cb);
      }
    : fn;
};

export default callbackify;
