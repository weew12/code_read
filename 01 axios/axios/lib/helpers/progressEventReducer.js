/**
 * @file 进度事件处理器（节流与装饰器）
 * 
 * 功能：处理HTTP请求的上传/下载进度事件，提供节流控制、速率计算和进度数据装饰。
 * 该模块是axios进度跟踪系统的核心，用于优化性能并丰富进度事件数据。
 * 
 * 设计模式：
 * 1. 装饰器模式：progressEventDecorator用于装饰节流函数，添加特定进度数据
 * 2. 函数式编程：高阶函数组合，progressEventReducer返回节流后的处理器
 * 3. 观察者模式：监听原始进度事件，转换为富进度数据通知观察者
 * 
 * 性能优化：
 * 1. 事件节流：避免过于频繁的进度回调影响性能
 * 2. 速率采样：使用speedometer计算实时传输速率
 * 3. 异步执行：使用asyncDecorator确保回调在下一个事件循环执行
 * 
 * 应用场景：在xhr、fetch、http适配器中用于跟踪上传/下载进度。
 */

import speedometer from './speedometer.js';
import throttle from './throttle.js';
import utils from '../utils.js';

/**
 * 进度事件处理器（核心函数）
 * 
 * 功能：将原始的ProgressEvent转换为富进度数据对象，并应用节流控制。
 * 此函数是进度事件处理流水线的入口，负责数据转换、速率计算和节流调度。
 * 
 * 算法步骤：
 * 1. 初始化字节计数器和速度计算器（speedometer）
 * 2. 返回一个节流函数，在事件触发时执行以下操作：
 *    a. 计算自上次通知以来的字节增量（progressBytes）
 *    b. 使用speedometer计算实时传输速率（bytes/ms）
 *    c. 检查已加载字节是否在总字节范围内（inRange）
 *    d. 更新已通知字节数
 *    e. 构建富进度数据对象
 *    f. 调用用户提供的监听器
 * 
 * 进度数据对象字段说明：
 * - loaded: 已加载的字节数
 * - total: 总字节数（如果可计算）
 * - progress: 进度比例（0-1），如果total存在
 * - bytes: 自上次通知以来的字节增量
 * - rate: 当前传输速率（字节/毫秒）
 * - estimated: 估计剩余时间（毫秒），如果速率和总量可计算且加载量在范围内
 * - event: 原始ProgressEvent对象
 * - lengthComputable: 总字节数是否可计算
 * - download/upload: 标识是下载还是上传进度
 * 
 * 设计目的：
 * 1. 数据丰富化：将简单的loaded/total转换为有意义的进度信息
 * 2. 性能优化：通过节流避免过于频繁的回调影响应用性能
 * 3. 速率计算：提供实时传输速率，便于UI显示和进度估计
 * 4. 错误防御：处理lengthComputable为false的情况
 * 
 * @param {Function} listener - 进度事件回调函数，接收富进度数据对象
 * @param {boolean} isDownloadStream - 是否为下载流（true=下载，false=上传）
 * @param {number} [freq=3] - 节流频率（毫秒），控制回调的最小时间间隔
 * @returns {Function} 节流后的进度事件处理函数，可传递给addEventListener
 */
export const progressEventReducer = (listener, isDownloadStream, freq = 3) => {
  let bytesNotified = 0;
  const _speedometer = speedometer(50, 250);

  return throttle((e) => {
    const loaded = e.loaded;
    const total = e.lengthComputable ? e.total : undefined;
    const progressBytes = loaded - bytesNotified;
    const rate = _speedometer(progressBytes);
    const inRange = loaded <= total;

    bytesNotified = loaded;

    const data = {
      loaded,
      total,
      progress: total ? loaded / total : undefined,
      bytes: progressBytes,
      rate: rate ? rate : undefined,
      estimated: rate && total && inRange ? (total - loaded) / rate : undefined,
      event: e,
      lengthComputable: total != null,
      [isDownloadStream ? 'download' : 'upload']: true,
    };

    listener(data);
  }, freq);
};

/**
 * 进度事件装饰器
 * 
 * 功能：装饰一个节流函数对，使其能够处理手动触发的进度更新。
 * 当进度事件不是由浏览器自动触发，而是需要手动计算和触发时使用此装饰器。
 * 
 * 使用场景：
 * 1. 流式传输：当数据以流的形式传输时，需要手动计算已加载的字节数
 * 2. 自定义进度：当进度信息来自非标准来源时
 * 3. 适配器内部：在fetch和http适配器中装饰进度处理函数
 * 
 * 输入输出：
 * - 输入：total（总字节数）和throttled（[节流函数, 刷新函数]对）
 * - 输出：新的[装饰后的节流函数, 原始刷新函数]对
 * 
 * 设计目的：
 * 1. 接口统一：提供与progressEventReducer相似的API，便于替换
 * 2. 手动控制：允许手动传入loaded值，而不是依赖ProgressEvent
 * 3. 函数组合：保持节流函数的刷新功能不变，仅装饰处理逻辑
 * 
 * @param {number|null} total - 总字节数，如果为null表示长度不可计算
 * @param {Array} throttled - 节流函数对 [throttledFunction, flushFunction]
 * @returns {Array} 装饰后的节流函数对 [decoratedFunction, flushFunction]
 */
export const progressEventDecorator = (total, throttled) => {
  const lengthComputable = total != null;

  return [
    (loaded) =>
      throttled[0]({
        lengthComputable,
        total,
        loaded,
      }),
    throttled[1],
  ];
};

/**
 * 异步装饰器
 * 
 * 功能：将同步函数转换为异步执行，确保在下一个事件循环中调用。
 * 使用utils.asap（setImmediate或setTimeout的封装）实现异步调度。
 * 
 * 设计目的：
 * 1. 非阻塞执行：避免进度回调阻塞主线程，影响UI响应性
 * 2. 批量更新：在同一个事件循环中的多个进度事件可以被合并
 * 3. 错误隔离：如果回调函数抛出错误，不会阻塞进度事件处理流程
 * 
 * 使用场景：包装进度事件监听器，确保即使监听器执行耗时操作也不会阻塞网络请求。
 * 
 * @param {Function} fn - 要异步执行的函数
 * @returns {Function} 异步版本的函数，接受相同参数但在下一个事件循环执行
 */
export const asyncDecorator =
  (fn) =>
  (...args) =>
    utils.asap(() => fn(...args));
