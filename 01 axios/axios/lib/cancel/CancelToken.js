'use strict';

// 取消令牌类，用于实现请求取消功能
import CanceledError from './CanceledError.js';  // 取消错误类

/**
 * A `CancelToken` is an object that can be used to request cancellation of an operation.
 *
 * @param {Function} executor The executor function.
 *
 * @returns {CancelToken}
 */
// 取消令牌类，基于 Promise 实现，允许外部触发取消操作，并通知所有订阅者
class CancelToken {
  constructor(executor) {
    // 验证 executor 必须是函数
    if (typeof executor !== 'function') {
      throw new TypeError('executor must be a function.');
    }

    let resolvePromise;  // 用于解析内部 Promise 的函数引用

    // 创建一个 Promise，其 resolve 函数由外部控制
    this.promise = new Promise(function promiseExecutor(resolve) {
      resolvePromise = resolve;  // 保存 resolve 函数，供取消时调用
    });

    const token = this;  // 保存当前实例的引用，供闭包使用

    // 监听内部 Promise 的解析（当取消被触发时）
    // eslint-disable-next-line func-names
    this.promise.then((cancel) => {
      // 如果有监听器，通知所有监听器取消事件
      if (!token._listeners) return;

      let i = token._listeners.length;

      // 逆序遍历监听器（确保先添加的先执行？实际上逆序执行）
      while (i-- > 0) {
        token._listeners[i](cancel);  // 传递取消原因
      }
      token._listeners = null;  // 清空监听器列表
    });

    // 重写 promise.then 方法，使其返回一个可取消的 Promise
    // eslint-disable-next-line func-names
    this.promise.then = (onfulfilled) => {
      let _resolve;  // 保存新 Promise 的 resolve 函数
      // eslint-disable-next-line func-names
      const promise = new Promise((resolve) => {
        // 订阅取消事件，当取消发生时 resolve 新 Promise
        token.subscribe(resolve);
        _resolve = resolve;  // 保存引用，用于取消订阅
      }).then(onfulfilled);  // 链式调用用户提供的 onfulfilled

      // 为返回的 Promise 添加 cancel 方法，用于取消订阅
      promise.cancel = function reject() {
        token.unsubscribe(_resolve);
      };

      return promise;  // 返回可取消的 Promise
    };

    // 执行用户提供的 executor 函数，传入 cancel 函数作为参数
    executor(function cancel(message, config, request) {
      // 如果已经取消过，直接返回（幂等性）
      if (token.reason) {
        return;
      }

      // 创建取消原因（CanceledError 实例）
      token.reason = new CanceledError(message, config, request);
      // 解析内部 Promise，触发监听器
      resolvePromise(token.reason);
    });
  }

  /**
   * Throws a `CanceledError` if cancellation has been requested.
   */
  // 如果取消已被请求，则抛出 CanceledError（用于在请求发送前检查）
  throwIfRequested() {
    if (this.reason) {
      throw this.reason;  // 抛出保存的取消原因
    }
  }

  /**
   * Subscribe to the cancel signal
   */
  // 订阅取消信号，当取消发生时调用监听器函数
  subscribe(listener) {
    // 如果取消已经发生，立即调用监听器
    if (this.reason) {
      listener(this.reason);
      return;
    }

    // 否则将监听器添加到列表中
    if (this._listeners) {
      this._listeners.push(listener);
    } else {
      this._listeners = [listener];  // 惰性初始化数组
    }
  }

  /**
   * Unsubscribe from the cancel signal
   */
  // 取消订阅，从监听器列表中移除指定的监听器
  unsubscribe(listener) {
    if (!this._listeners) {
      return;  // 如果没有监听器列表，直接返回
    }
    const index = this._listeners.indexOf(listener);
    if (index !== -1) {
      this._listeners.splice(index, 1);  // 移除监听器
    }
  }

  // 将 CancelToken 转换为 AbortSignal（现代 Fetch API 的取消机制）
  toAbortSignal() {
    const controller = new AbortController();  // 创建 AbortController

    const abort = (err) => {
      controller.abort(err);  // 当 CancelToken 取消时，触发 AbortController
    };

    this.subscribe(abort);  // 订阅 CancelToken 的取消事件

    // 为返回的 signal 添加 unsubscribe 方法，用于清理订阅
    controller.signal.unsubscribe = () => this.unsubscribe(abort);

    return controller.signal;  // 返回 AbortSignal
  }

  /**
   * Returns an object that contains a new `CancelToken` and a function that, when called,
   * cancels the `CancelToken`.
   */
  // 静态工厂方法，返回一个包含 token 和 cancel 函数的对象，便于使用
  static source() {
    let cancel;  // 用于保存取消函数的引用
    // 创建 CancelToken，executor 函数接收 cancel 函数并保存到外部变量
    const token = new CancelToken(function executor(c) {
      cancel = c;
    });
    return {
      token,   // CancelToken 实例
      cancel,  // 调用此函数将取消对应的 token
    };
  }
}

export default CancelToken;
