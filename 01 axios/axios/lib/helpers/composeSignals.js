/**
 * @file 信号组合器（AbortSignal组合与超时管理）
 * 
 * 功能：组合多个取消信号（AbortSignal）和超时设置，返回一个统一的组合信号。
 * 当任何一个输入信号触发或超时发生时，组合信号将触发，并传播适当的错误类型。
 * 
 * 支持信号类型：
 * 1. 标准AbortSignal（addEventListener/removeEventListener）
 * 2. 自定义信号（unsubscribe方法）
 * 3. 超时信号（通过timeout参数创建）
 * 
 * 设计目的：统一管理axios请求的多种取消方式（用户取消、超时取消、依赖取消等），
 * 简化取消逻辑的复杂度。
 */

import CanceledError from '../cancel/CanceledError.js';
import AxiosError from '../core/AxiosError.js';
import utils from '../utils.js';

/**
 * 创建组合的取消信号
 * 
 * 实现机制：
 * 1. 创建新的AbortController作为组合信号源
 * 2. 为每个输入信号添加abort事件监听器
 * 3. 设置超时定时器（如果提供了timeout参数）
 * 4. 任何信号触发时，清理所有监听器和定时器，并触发组合信号
 * 5. 错误类型转换：将非AxiosError转换为CanceledError
 * 
 * @param {Array<AbortSignal|{unsubscribe: Function}>} signals - 要组合的信号数组
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {AbortSignal} 组合后的信号，带有unsubscribe方法用于清理
 */
const composeSignals = (signals, timeout) => {
  const { length } = (signals = signals ? signals.filter(Boolean) : []);

  if (timeout || length) {
    let controller = new AbortController();

    let aborted;

    const onabort = function (reason) {
      if (!aborted) {
        aborted = true;
        unsubscribe();
        const err = reason instanceof Error ? reason : this.reason;
        controller.abort(
          err instanceof AxiosError
            ? err
            : new CanceledError(err instanceof Error ? err.message : err)
        );
      }
    };

    let timer =
      timeout &&
      setTimeout(() => {
        timer = null;
        onabort(new AxiosError(`timeout of ${timeout}ms exceeded`, AxiosError.ETIMEDOUT));
      }, timeout);

    const unsubscribe = () => {
      if (signals) {
        timer && clearTimeout(timer);
        timer = null;
        signals.forEach((signal) => {
          signal.unsubscribe
            ? signal.unsubscribe(onabort)
            : signal.removeEventListener('abort', onabort);
        });
        signals = null;
      }
    };

    signals.forEach((signal) => signal.addEventListener('abort', onabort));

    const { signal } = controller;

    signal.unsubscribe = () => utils.asap(unsubscribe);

    return signal;
  }
};

export default composeSignals;
