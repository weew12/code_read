'use strict';

/**
 * @file 函数绑定工具
 * 
 * 功能：创建一个绑定特定`this`上下文的新函数。
 * 
 * 设计目的：
 * 1. 提供与Function.prototype.bind类似的功能，但更轻量
 * 2. 确保axios内部函数调用时的正确上下文
 * 3. 作为工具函数供其他模块使用
 * 
 * 与原生bind()的区别：
 * 1. 不支持部分应用（即不预设参数）
 * 2. 实现更简单，性能可能更好
 * 3. 专门为axios的内部需求定制
 */

/**
 * 创建绑定特定`this`上下文的函数版本
 * 
 * 实现原理：利用闭包和Function.prototype.apply方法。
 * 返回的新函数在调用时，会将原始函数fn以thisArg作为this上下文执行。
 * 
 * 注意：此实现不支持参数预设（partial application），
 * 调用时传递的所有参数都会原样传递给原始函数。
 * 
 * 使用场景：在axios中常用于确保回调函数在正确的对象上下文中执行，
 * 例如拦截器、适配器中的方法调用。
 * 
 * @param {Function} fn - 需要绑定的原始函数
 * @param {*} thisArg - 作为`this`参数传递的值
 * @returns {Function} 新的包装函数，调用时将使用指定的`this`上下文
 */
export default function bind(fn, thisArg) {
  /**
   * 包装函数：闭包捕获fn和thisArg
   * 
   * 设计特点：使用arguments对象接收所有参数，
   * 通过apply方法将thisArg作为this上下文传递给原始函数。
   * 
   * 性能考虑：由于现代JavaScript引擎对闭包和apply的优化，
   * 这种简单实现通常有良好的性能表现。
   */
  return function wrap() {
    return fn.apply(thisArg, arguments);
  };
}
