'use strict';

/**
 * @file Data URI解析器
 * 
 * 功能：将Data URI（RFC 2397格式）解析为Buffer或Blob对象。
 * 支持解析base64编码和纯文本编码的data: URI，自动处理MIME类型和编码类型。
 * 
 * Data URI格式：data:[<mediatype>][;base64],<data>
 * 示例：data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==
 * 
 * 设计目的：在浏览器和Node.js环境中统一处理Data URI，支持按需返回Buffer或Blob，
 * 为axios的文件上传和数据处理提供基础能力。
 */

import AxiosError from '../core/AxiosError.js';
import parseProtocol from './parseProtocol.js';
import platform from '../platform/index.js';

const DATA_URL_PATTERN = /^(?:([^;]+);)?(?:[^;]+;)?(base64|),([\s\S]*)$/;

/**
 * 将Data URI解析为Buffer或Blob对象
 *
 * 解析流程：
 * 1. 使用parseProtocol检测协议是否为"data"
 * 2. 通过正则表达式提取MIME类型、编码类型和主体数据
 * 3. 根据编码类型（base64或utf8）解码数据
 * 4. 根据asBlob参数和平台支持情况返回Buffer或Blob
 *
 * @param {String} uri - 要解析的Data URI字符串
 * @param {?Boolean} asBlob - 是否返回Blob对象（默认根据平台自动决定）
 * @param {?Object} options - 配置选项
 * @param {?Function} options.Blob - 自定义Blob构造函数（用于测试或特定环境）
 *
 * @returns {Buffer|Blob} 解析后的数据对象
 * @throws {AxiosError} 当URI格式无效或协议不支持时抛出错误
 */
export default function fromDataURI(uri, asBlob, options) {
  const _Blob = (options && options.Blob) || platform.classes.Blob;
  const protocol = parseProtocol(uri);

  if (asBlob === undefined && _Blob) {
    asBlob = true;
  }

  if (protocol === 'data') {
    uri = protocol.length ? uri.slice(protocol.length + 1) : uri;

    const match = DATA_URL_PATTERN.exec(uri);

    if (!match) {
      throw new AxiosError('Invalid URL', AxiosError.ERR_INVALID_URL);
    }

    const mime = match[1];
    const isBase64 = match[2];
    const body = match[3];
    const buffer = Buffer.from(decodeURIComponent(body), isBase64 ? 'base64' : 'utf8');

    if (asBlob) {
      if (!_Blob) {
        throw new AxiosError('Blob is not supported', AxiosError.ERR_NOT_SUPPORT);
      }

      return new _Blob([buffer], { type: mime });
    }

    return buffer;
  }

  throw new AxiosError('Unsupported protocol ' + protocol, AxiosError.ERR_NOT_SUPPORT);
}
