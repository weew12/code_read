'use strict';

// 拦截器管理器，用于管理请求和响应拦截器的添加、移除和遍历
import utils from '../utils.js';  // 工具函数，提供 forEach 等方法

// 拦截器管理器类，采用数组存储拦截器，支持同步/异步拦截器和条件执行
class InterceptorManager {
  constructor() {
    this.handlers = [];  // 存储拦截器对象的数组，每个对象包含 fulfilled、rejected、synchronous、runWhen 属性
  }

  /**
   * Add a new interceptor to the stack
   *
   * @param {Function} fulfilled The function to handle `then` for a `Promise`
   * @param {Function} rejected The function to handle `reject` for a `Promise`
   * @param {Object} options The options for the interceptor, synchronous and runWhen
   *
   * @return {Number} An ID used to remove interceptor later
   */
  // 添加拦截器到栈中，返回拦截器 ID（用于后续移除）
  use(fulfilled, rejected, options) {
    this.handlers.push({
      fulfilled,      // 成功处理函数，对应 Promise.then 的第一个参数
      rejected,       // 失败处理函数，对应 Promise.then 的第二个参数
      synchronous: options ? options.synchronous : false,  // 是否同步执行，默认为 false（异步）
      runWhen: options ? options.runWhen : null,           // 条件执行函数，返回 false 时跳过该拦截器
    });
    return this.handlers.length - 1;  // 返回新拦截器的索引作为 ID
  }

  /**
   * Remove an interceptor from the stack
   *
   * @param {Number} id The ID that was returned by `use`
   *
   * @returns {void}
   */
  // 移除指定 ID 的拦截器（设置为 null 而不是删除，避免影响遍历索引）
  eject(id) {
    if (this.handlers[id]) {
      this.handlers[id] = null;  // 设置为 null 而不是 splice，保证 forEach 能正确跳过
    }
  }

  /**
   * Clear all interceptors from the stack
   *
   * @returns {void}
   */
  // 清空所有拦截器（重置 handlers 数组）
  clear() {
    if (this.handlers) {
      this.handlers = [];  // 直接赋值为空数组
    }
  }

  /**
   * Iterate over all the registered interceptors
   *
   * This method is particularly useful for skipping over any
   * interceptors that may have become `null` calling `eject`.
   *
   * @param {Function} fn The function to call for each interceptor
   *
   * @returns {void}
   */
  // 遍历所有拦截器（自动跳过被 eject 设置为 null 的拦截器）
  forEach(fn) {
    utils.forEach(this.handlers, function forEachHandler(h) {
      if (h !== null) {
        fn(h);  // 只对非 null 的拦截器执行回调函数
      }
    });
  }
}

export default InterceptorManager;
