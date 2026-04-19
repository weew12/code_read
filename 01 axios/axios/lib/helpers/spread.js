'use strict';

/**
 * @file 参数展开工具（函数柯里化的一种形式）
 * 
 * 功能：创建一个新函数，该函数接受一个数组参数，并将数组元素展开作为原始函数的独立参数。
 * 
 * 设计目的：
 * 1. 提供Function.prototype.apply的语法糖，提高代码可读性
 * 2. 支持函数式编程风格，便于函数组合
 * 3. 在axios中用于处理Promise链中的数组形式的结果
 * 
 * 使用场景：
 * 1. 将返回数组的Promise结果展开为多个参数
 * 2. 将数组参数应用于接受多个独立参数的函数
 * 3. 函数式编程中的参数适配
 */

/**
 * 参数展开函数（柯里化函数）
 * 
 * 实现原理：利用闭包捕获原始函数callback，返回一个新函数wrap。
 * wrap函数接受数组arr，通过apply方法将数组元素展开为callback的独立参数。
 * 
 * 与Function.prototype.apply的关系：
 * 这是一个高阶函数，封装了apply的调用模式，提供更清晰的API。
 * 
 * 在axios中的具体应用：
 * 常用于Promise的then链中，处理返回数组的异步操作。
 * 例如：Promise.resolve([1, 2, 3]).then(spread((x, y, z) => ...))
 * 
 * @param {Function} callback - 原始函数，接受多个独立参数
 * @returns {Function} 包装函数，接受一个数组参数
 */
export default function spread(callback) {
  /**
   * 包装函数：接受数组参数，展开调用原始函数
   * 
   * 设计特点：
   * 1. 使用null作为apply的this上下文（适合纯函数）
   * 2. 假设arr是数组或类数组对象
   * 3. 函数式编程风格：无副作用，输入输出明确
   * 
   * 注意：此实现不进行参数验证，调用者需确保arr是有效的可展开对象。
   */
  return function wrap(arr) {
    return callback.apply(null, arr);
  };
}
