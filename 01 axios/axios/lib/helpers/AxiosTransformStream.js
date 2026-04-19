'use strict';

/**
 * @file Axios流转换器（带速率限制和进度跟踪）
 * 
 * 功能：继承Node.js的Transform流，在数据传输过程中实现速率限制和进度跟踪。
 * 这是axios流式传输的核心组件，用于控制上传/下载速度并实时报告进度。
 * 
 * 设计特点：
 * 1. 速率限制：支持最大传输速率（maxRate）控制，避免网络拥堵
 * 2. 进度跟踪：实时触发'progress'事件，报告已传输字节数
 * 3. 流控机制：实现背压（backpressure）感知，避免内存溢出
 * 4. 时间窗口：基于时间窗口的速率计算，平滑流量控制
 * 5. 块分割：自动将大数据块分割为合适大小的块，便于速率控制
 * 
 * 使用场景：
 * 1. 大文件上传/下载：控制传输速度，避免占用过多带宽
 * 2. 实时进度显示：通过'progress'事件提供实时进度信息
 * 3. 流式数据处理：在数据流经时进行转换和监控
 * 
 * 技术实现：基于Node.js的stream.Transform类，重写_transform和_read方法。
 */

import stream from 'stream';
import utils from '../utils.js';

/**
 * Symbol键名，用于存储流内部状态，避免外部访问和污染。
 * 这是JavaScript的私有属性模式，确保内部状态不被外部修改。
 */
const kInternals = Symbol('internals');

/**
 * Axios流转换器类
 * 
 * 继承自Node.js的stream.Transform，实现带速率限制和进度跟踪的流转换。
 * 通过重写_transform方法控制数据传输速率，通过事件发射器报告进度。
 */
class AxiosTransformStream extends stream.Transform {
  /**
   * 构造函数
   * 
   * 初始化流转换器，设置配置选项和内部状态。
   * 使用惰性进度跟踪：仅当有'progress'事件监听器时才跟踪进度，避免不必要的计算。
   * 
   * 配置选项说明：
   * @param {Object} options - 配置对象
   * @param {number} [options.maxRate=0] - 最大传输速率（字节/秒），0表示无限制
   * @param {number} [options.chunkSize=65536] - 块大小（字节），默认64KB，影响背压和水位线
   * @param {number} [options.minChunkSize=100] - 最小块大小（字节），避免过小的块导致性能下降
   * @param {number} [options.timeWindow=500] - 时间窗口（毫秒），速率计算的时间粒度
   * @param {number} [options.ticksRate=2] - 时间窗口内的触发次数，用于平滑速率控制
   * @param {number} [options.samplesCount=15] - 采样计数，用于速率计算的历史窗口大小
   * 
   * 内部状态说明：
   * - timeWindow: 时间窗口配置
   * - chunkSize: 块大小配置
   * - maxRate: 最大速率配置
   * - minChunkSize: 最小块大小配置
   * - bytesSeen: 已处理的字节总数（用于进度跟踪）
   * - isCaptured: 是否启用了进度跟踪（有'progress'事件监听器时设为true）
   * - notifiedBytesLoaded: 已通知的字节数（用于去重）
   * - ts: 时间戳，记录上次速率计算的时间
   * - bytes: 当前时间窗口内已传输的字节数
   * - onReadCallback: 读取回调函数，用于处理背压
   */
  constructor(options) {
    // 扁平化配置对象，合并默认值
    options = utils.toFlatObject(
      options,
      {
        maxRate: 0,
        chunkSize: 64 * 1024,
        minChunkSize: 100,
        timeWindow: 500,
        ticksRate: 2,
        samplesCount: 15,
      },
      null,
      (prop, source) => {
        return !utils.isUndefined(source[prop]);
      }
    );

    // 调用父类构造函数，设置可读流的高水位标记
    super({
      readableHighWaterMark: options.chunkSize,
    });

    // 初始化内部状态对象（使用Symbol键名确保私有性）
    const internals = (this[kInternals] = {
      timeWindow: options.timeWindow,
      chunkSize: options.chunkSize,
      maxRate: options.maxRate,
      minChunkSize: options.minChunkSize,
      bytesSeen: 0,
      isCaptured: false,
      notifiedBytesLoaded: 0,
      ts: Date.now(),
      bytes: 0,
      onReadCallback: null,
    });

    // 监听新的事件监听器，实现惰性进度跟踪
    // 只有当用户添加'progress'事件监听器时，才开始跟踪进度
    this.on('newListener', (event) => {
      if (event === 'progress') {
        if (!internals.isCaptured) {
          internals.isCaptured = true;
        }
      }
    });
  }

  /**
   * 可读流读取方法（重写）
   * 
   * 当可读流被消费（调用read()或通过pipe()自动消费）时调用此方法。
   * 主要功能是处理背压（backpressure）：当_transform方法因为缓冲区满而暂停时，
   * 会设置onReadCallback，等待此方法被调用后再继续传输。
   * 
   * 背压处理机制：
   * 1. 当可写流写入速度超过可读流消费速度时，可读流缓冲区会满
   * 2. this.push()返回false，表示缓冲区已满
   * 3. _transform方法设置onReadCallback，暂停进一步处理
   * 4. 当消费端读取数据后，_read方法被调用
   * 5. 执行onReadCallback，恢复_transform处理
   * 
   * @param {number} size - 请求读取的字节数（Node.js流API参数）
   * @returns {void}
   */
  _read(size) {
    const internals = this[kInternals];

    if (internals.onReadCallback) {
      internals.onReadCallback();
    }

    return super._read(size);
  }

  /**
   * 流转换核心方法（重写）
   * 
   * 处理传入的数据块，实现速率限制、块分割和进度跟踪。
   * 这是Transform流的核心方法，每个数据块都会经过此方法处理。
   * 
   * 算法概述：
   * 1. 计算速率限制参数（bytesThreshold, minChunkSize）
   * 2. 定义pushChunk函数：推送数据块、更新进度、处理背压
   * 3. 定义transformChunk函数：实现速率限制和块分割逻辑
   * 4. 递归处理数据块，直到所有数据都被处理
   * 
   * 速率限制原理：
   * - 将时间划分为固定窗口（timeWindow，默认500ms）
   * - 计算每个窗口允许的最大字节数：bytesThreshold = maxRate / (1000 / timeWindow)
   * - 跟踪当前窗口内已传输的字节数（internals.bytes）
   * - 如果当前窗口额度已用尽，延迟到下一个窗口再传输
   * 
   * @param {Buffer|string} chunk - 输入数据块
   * @param {string} encoding - 编码方式（如果是字符串）
   * @param {Function} callback - 转换完成回调函数
   */
  _transform(chunk, encoding, callback) {
    const internals = this[kInternals];
    const maxRate = internals.maxRate;

    const readableHighWaterMark = this.readableHighWaterMark;

    const timeWindow = internals.timeWindow;

    // 计算速率限制参数
    // divider: 每秒有多少个时间窗口（例如1000/500=2，即每秒2个窗口）
    // bytesThreshold: 每个时间窗口允许的最大字节数
    const divider = 1000 / timeWindow;
    const bytesThreshold = maxRate / divider;
    // 最小块大小：确保不会因为速率限制而产生过多微小块
    const minChunkSize =
      internals.minChunkSize !== false
        ? Math.max(internals.minChunkSize, bytesThreshold * 0.01)
        : 0;

    /**
     * 推送数据块函数
     * 
     * 功能：将处理后的数据块推送到可读流，并更新内部状态。
     * 处理步骤：
     * 1. 计算数据块字节数，更新已处理字节计数器
     * 2. 如果启用了进度跟踪，触发'progress'事件
     * 3. 尝试推送数据到可读流：
     *    - 成功（this.push返回true）：立即回调，继续处理
     *    - 失败（缓冲区满）：设置onReadCallback，等待_read方法调用
     * 
     * 背压处理：当可读流缓冲区满时，暂停进一步处理，等待消费端读取数据。
     * 
     * @param {Buffer} _chunk - 要推送的数据块
     * @param {Function} _callback - 推送完成回调
     */
    const pushChunk = (_chunk, _callback) => {
      const bytes = Buffer.byteLength(_chunk);
      internals.bytesSeen += bytes;
      internals.bytes += bytes;

      internals.isCaptured && this.emit('progress', internals.bytesSeen);

      if (this.push(_chunk)) {
        process.nextTick(_callback);
      } else {
        internals.onReadCallback = () => {
          internals.onReadCallback = null;
          process.nextTick(_callback);
        };
      }
    };

    /**
     * 转换数据块函数（递归）
     * 
     * 功能：根据速率限制策略处理单个数据块。
     * 处理逻辑：
     * 1. 检查速率限制：如果当前时间窗口额度已用尽，延迟到下一个窗口
     * 2. 计算最大块大小：考虑速率限制和水位线限制
     * 3. 块分割：如果数据块太大，分割为合适大小的块
     * 4. 递归处理：剩余部分递归调用自身处理
     * 
     * 时间窗口管理：
     * - 如果上次时间戳不存在或已超过timeWindow，重置时间窗口
     * - 计算当前窗口剩余额度：bytesLeft = bytesThreshold - internals.bytes
     * - 如果已超支（bytesLeft < 0），将超支部分计入下一个窗口
     * 
     * @param {Buffer} _chunk - 要处理的数据块
     * @param {Function} _callback - 处理完成回调，参数(err, remainingChunk)
     */
    const transformChunk = (_chunk, _callback) => {
      const chunkSize = Buffer.byteLength(_chunk);
      let chunkRemainder = null;
      let maxChunkSize = readableHighWaterMark;
      let bytesLeft;
      let passed = 0;

      if (maxRate) {
        const now = Date.now();

        // 检查是否需要重置时间窗口
        if (!internals.ts || (passed = now - internals.ts) >= timeWindow) {
          internals.ts = now;
          bytesLeft = bytesThreshold - internals.bytes;
          // 处理超支：如果上个窗口超支，将超支部分从当前窗口扣除
          internals.bytes = bytesLeft < 0 ? -bytesLeft : 0;
          passed = 0;
        }

        bytesLeft = bytesThreshold - internals.bytes;
      }

      if (maxRate) {
        if (bytesLeft <= 0) {
          // 当前窗口额度已用尽，延迟到下一个窗口再处理
          return setTimeout(() => {
            _callback(null, _chunk);
          }, timeWindow - passed);
        }

        if (bytesLeft < maxChunkSize) {
          maxChunkSize = bytesLeft;
        }
      }

      // 块分割：如果数据块大于最大允许大小，且剩余部分大于最小块大小，则分割
      if (maxChunkSize && chunkSize > maxChunkSize && chunkSize - maxChunkSize > minChunkSize) {
        chunkRemainder = _chunk.subarray(maxChunkSize);
        _chunk = _chunk.subarray(0, maxChunkSize);
      }

      // 推送处理后的数据块，如果有剩余部分则递归处理
      pushChunk(
        _chunk,
        chunkRemainder
          ? () => {
              process.nextTick(_callback, null, chunkRemainder);
            }
          : _callback
      );
    };

    // 开始递归处理数据块
    transformChunk(chunk, function transformNextChunk(err, _chunk) {
      if (err) {
        return callback(err);
      }

      if (_chunk) {
        // 还有剩余数据需要处理，递归调用
        transformChunk(_chunk, transformNextChunk);
      } else {
        // 所有数据处理完成
        callback(null);
      }
    });
  }
}

export default AxiosTransformStream;
