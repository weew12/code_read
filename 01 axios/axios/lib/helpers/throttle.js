/**
 * @file 节流函数（带刷新功能）
 * 
 * 功能：创建节流版本的函数，控制函数执行频率，并支持刷新等待的调用。
 * 这是进度事件节流的核心实现，用于避免过于频繁的进度回调影响性能。
 * 
 * 设计特点：
 * 1. 频率控制：确保函数在指定频率（次/秒）内最多执行一次
 * 2. 延迟执行：如果在冷却期内调用，将最近一次调用参数保存并延迟执行
 * 3. 刷新机制：提供flush函数立即执行等待的调用，避免进度事件丢失
 * 4. 取消定时器：在手动调用时清除等待中的定时器
 * 
 * 使用场景：进度事件回调、窗口resize事件、滚动事件等高频触发的场景。
 */

/**
 * 节流装饰器工厂函数
 * 
 * 功能：将原始函数包装为节流版本，返回[throttled, flush]数组。
 * 
 * 节流算法：
 * 1. 计算阈值：threshold = 1000 / freq（每次调用最小间隔，毫秒）
 * 2. 记录上次执行时间戳（timestamp）
 * 3. 当调用throttled函数时：
 *    a. 计算距离上次执行的时间差（passed）
 *    b. 如果passed >= threshold，立即执行
 *    c. 否则，保存参数（lastArgs），设置定时器在剩余时间后执行
 * 4. 定时器确保在冷却期结束后执行最后一次调用
 * 
 * 刷新机制：flush函数立即执行等待中的调用（如果有），用于确保在请求结束时
 * 所有进度事件都被触发，避免最后一个进度事件丢失。
 * 
 * @param {Function} fn - 需要节流的原始函数
 * @param {Number} freq - 节流频率（次/秒），例如3表示每秒最多3次
 * @return {Array} 返回两个元素的数组：[throttledFunction, flushFunction]
 */
function throttle(fn, freq) {
  let timestamp = 0;
  let threshold = 1000 / freq;
  let lastArgs;
  let timer;

  /**
   * 实际执行函数（内部方法）
   * 
   * 功能：执行原始函数，更新状态，清理定时器。
   * 
   * @param {Array} args - 函数参数数组
   * @param {number} [now=Date.now()] - 当前时间戳
   */
  const invoke = (args, now = Date.now()) => {
    timestamp = now;
    lastArgs = null;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    fn(...args);
  };

  /**
   * 节流后的函数
   * 
   * 功能：根据节流策略决定立即执行、延迟执行或忽略调用。
   * 
   * @param {...*} args - 传递给原始函数的参数
   */
  const throttled = (...args) => {
    const now = Date.now();
    const passed = now - timestamp;
    if (passed >= threshold) {
      invoke(args, now);
    } else {
      lastArgs = args;
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          invoke(lastArgs);
        }, threshold - passed);
      }
    }
  };

  /**
   * 刷新函数
   * 
   * 功能：立即执行等待中的调用（如果有）。
   * 用于在适当的时候（如请求结束）确保所有挂起的进度事件被触发。
   * 
   * @returns {void}
   */
  const flush = () => lastArgs && invoke(lastArgs);

  return [throttled, flush];
}

export default throttle;
