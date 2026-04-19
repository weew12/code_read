/**
 * @file 流数据处理与进度跟踪工具
 * 
 * 功能：提供流式数据的分块处理、读取和进度跟踪能力。
 * 这是axios中处理大文件上传/下载进度监控的核心模块，实现了符合现代Streams API的
 * 异步迭代器模式，支持对ReadableStream进行细粒度控制。
 * 
 * 核心组件：
 * 1. streamChunk：将大块数据按指定大小切分为小块（生成器函数）
 * 2. readBytes：异步迭代器，从任意可迭代流中读取字节数据
 * 3. trackStream：包装流并添加进度回调，返回可跟踪的ReadableStream
 * 
 * 设计特点：
 * - 支持同步和异步迭代器统一处理
 * - 自动处理流取消和资源清理
 * - 通过高水位标记控制背压
 * - 提供精确的字节级进度报告
 */

/**
 * 将数据块按指定大小切分的生成器函数
 * 
 * 功能：将大的二进制数据块（ArrayBuffer/TypedArray）按chunkSize切分为多个小块。
 * 如果chunkSize未指定或数据块小于chunkSize，则直接返回原数据块。
 * 
 * 设计目的：支持对大文件进行分片处理，便于流式传输和进度跟踪。
 * 
 * @param {ArrayBuffer|Uint8Array} chunk - 要切分的二进制数据块
 * @param {number} chunkSize - 每个分片的字节大小
 * @yields {ArrayBuffer|Uint8Array} 分片后的数据块
 */
export const streamChunk = function* (chunk, chunkSize) {
  let len = chunk.byteLength;

  if (!chunkSize || len < chunkSize) {
    yield chunk;
    return;
  }

  let pos = 0;
  let end;

  while (pos < len) {
    end = pos + chunkSize;
    yield chunk.slice(pos, end);
    pos = end;
  }
};

/**
 * 从可迭代流中异步读取字节数据的生成器函数
 * 
 * 功能：从任意可迭代对象（ReadableStream、AsyncIterable等）中读取数据，
 * 并按指定大小对读取到的数据块进行分片处理。
 * 
 * 设计目的：提供统一的流读取接口，隐藏不同流类型（原生ReadableStream、自定义异步迭代器）
 * 的实现差异，同时支持数据分片。
 * 
 * @param {ReadableStream|AsyncIterable} iterable - 可迭代的流对象
 * @param {number} chunkSize - 输出数据块的大小（字节）
 * @yields {Uint8Array} 分片后的二进制数据
 */
export const readBytes = async function* (iterable, chunkSize) {
  for await (const chunk of readStream(iterable)) {
    yield* streamChunk(chunk, chunkSize);
  }
};

/**
 * 统一的流读取函数（内部使用）
 * 
 * 功能：检测流类型并选择适当的读取策略：
 * 1. 如果流是异步可迭代对象（有Symbol.asyncIterator），直接使用yield*迭代
 * 2. 否则，假设是标准ReadableStream，通过getReader()手动读取
 * 
 * 设计目的：抽象不同流类型的读取差异，提供一致的异步迭代接口。
 * 
 * @param {ReadableStream|AsyncIterable} stream - 要读取的流对象
 * @yields {any} 流中的数据块
 */
const readStream = async function* (stream) {
  if (stream[Symbol.asyncIterator]) {
    yield* stream;
    return;
  }

  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      yield value;
    }
  } finally {
    await reader.cancel();
  }
};

/**
 * 创建带有进度跟踪的ReadableStream
 * 
 * 功能：包装原始流，添加进度回调和完成回调，返回一个新的ReadableStream。
 * 在数据被读取时累加字节数并触发onProgress回调，在流完成或出错时触发onFinish回调。
 * 
 * 实现机制：
 * 1. 使用readBytes创建分片迭代器
 * 2. 实现ReadableStream的pull方法，在读取每个分片时更新进度
 * 3. 通过cancel方法处理流的中断，确保资源清理
 * 4. 设置高水位标记为2，平衡内存使用和吞吐量
 * 
 * 设计目的：为任意流添加进度监控能力，支持axios的上传/下载进度报告功能。
 * 
 * @param {ReadableStream|AsyncIterable} stream - 要跟踪的原始流
 * @param {number} chunkSize - 分片大小（字节）
 * @param {function(number): void} onProgress - 进度回调，接收已加载字节数
 * @param {function(Error|any): void} onFinish - 完成/错误回调
 * @returns {ReadableStream} 可跟踪进度的新ReadableStream
 */
export const trackStream = (stream, chunkSize, onProgress, onFinish) => {
  const iterator = readBytes(stream, chunkSize);

  let bytes = 0;
  let done;
  let _onFinish = (e) => {
    if (!done) {
      done = true;
      onFinish && onFinish(e);
    }
  };

  return new ReadableStream(
    {
      async pull(controller) {
        try {
          const { done, value } = await iterator.next();

          if (done) {
            _onFinish();
            controller.close();
            return;
          }

          let len = value.byteLength;
          if (onProgress) {
            let loadedBytes = (bytes += len);
            onProgress(loadedBytes);
          }
          controller.enqueue(new Uint8Array(value));
        } catch (err) {
          _onFinish(err);
          throw err;
        }
      },
      cancel(reason) {
        _onFinish(reason);
        return iterator.return();
      },
    },
    {
      highWaterMark: 2,
    }
  );
};
