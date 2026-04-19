'use strict';

/**
 * @file Zlib压缩流头部自动添加转换器
 * 
 * 功能：检测流数据是否包含zlib压缩头部，如果没有则自动添加默认的zlib头部（0x78 0x9C）。
 * 这是axios中处理Node.js环境下gzip/deflate压缩响应的兼容性模块，确保无头部的压缩数据能够被正确解压。
 * 
 * 背景知识：zlib格式的压缩数据通常以2字节头部开始：
 * - 0x78 0x9C：默认压缩级别（Default Compression）
 * - 0x78 0xDA：最大压缩级别（Best Compression）
 * 
 * 某些服务器可能返回无头部的纯DEFLATE数据，此转换器确保数据兼容标准zlib库。
 */

import stream from 'stream';

/**
 * Zlib头部自动添加转换流类
 * 
 * 功能：继承Node.js的stream.Transform，在第一个非空数据块前检测并添加zlib头部。
 * 采用惰性初始化模式：首次_transform调用时检测头部并可能添加头部，之后委托给__transform方法。
 * 
 * 设计目的：避免修改已有头部的数据，仅对无头部数据添加默认头部，保持透明传输特性。
 */
class ZlibHeaderTransformStream extends stream.Transform {
  /**
   * 实际的转换逻辑（添加头部后使用）
   * @private
   */
  __transform(chunk, encoding, callback) {
    this.push(chunk);
    callback();
  }

  /**
   * 转换流的核心方法（首次调用时初始化）
   * 
   * 逻辑流程：
   * 1. 首次收到非空数据块时，检测第一个字节是否为0x78（标准的zlib头部标志）
   * 2. 如果不是0x78，则创建并推送默认的zlib头部（0x78 0x9C）
   * 3. 将自身_transform方法替换为__transform，避免重复检测
   * 4. 调用__transform处理当前数据块
   * 
   * 注意：空数据块（chunk.length === 0）会跳过头部检测，直接传递给后续处理。
   * 
   * @param {Buffer|string} chunk - 输入数据块
   * @param {string} encoding - 数据编码
   * @param {function} callback - 完成回调
   */
  _transform(chunk, encoding, callback) {
    if (chunk.length !== 0) {
      this._transform = this.__transform;

      // 如果不存在zlib头部，则添加默认压缩头部
      if (chunk[0] !== 120) { // 0x78
        const header = Buffer.alloc(2);
        header[0] = 120; // 0x78
        header[1] = 156; // 0x9C
        this.push(header, encoding);
      }
    }

    this.__transform(chunk, encoding, callback);
  }
}

export default ZlibHeaderTransformStream;
