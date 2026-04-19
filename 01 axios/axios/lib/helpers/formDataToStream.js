/**
 * @file FormData到Multipart流转换器
 * 
 * 功能：将FormData对象转换为符合multipart/form-data格式的ReadableStream。
 * 这是axios中处理文件上传的核心模块，支持大文件流式上传和进度跟踪。
 * 
 * 实现特性：
 * 1. 自动生成符合RFC 7578规范的multipart边界
 * 2. 计算准确的Content-Length（如果可能）
 * 3. 流式编码，避免一次性内存占用
 * 4. 支持文本和二进制混合内容
 * 5. 自动处理文件名和Content-Type
 * 
 * 设计目的：为浏览器和Node.js提供统一的FormData流式上传能力，
 * 支持大文件上传和进度监控。
 */

import util from 'util';
import { Readable } from 'stream';
import utils from '../utils.js';
import readBlob from './readBlob.js';
import platform from '../platform/index.js';

const BOUNDARY_ALPHABET = platform.ALPHABET.ALPHA_DIGIT + '-_';

const textEncoder = typeof TextEncoder === 'function' ? new TextEncoder() : new util.TextEncoder();

const CRLF = '\r\n';
const CRLF_BYTES = textEncoder.encode(CRLF);
const CRLF_BYTES_COUNT = 2;

/**
 * FormData单个部分（part）的编码器
 * 
 * 功能：封装FormData中的一个字段（键值对），负责：
 * 1. 生成符合规范的HTTP头部（Content-Disposition, Content-Type）
 * 2. 计算部分的大小（包括头部、内容和分隔符）
 * 3. 提供流式编码接口（encode方法）
 * 
 * 设计目的：将FormData的每个字段独立封装，支持流式处理和精确大小计算。
 */
class FormDataPart {
  /**
   * 创建FormData部分
   * @param {string} name - 字段名称
   * @param {string|Blob|File|TypedArray} value - 字段值
   */
  constructor(name, value) {
    const { escapeName } = this.constructor;
    const isStringValue = utils.isString(value);

    let headers = `Content-Disposition: form-data; name="${escapeName(name)}"${
      !isStringValue && value.name ? `; filename="${escapeName(value.name)}"` : ''
    }${CRLF}`;

    if (isStringValue) {
      value = textEncoder.encode(String(value).replace(/\r?\n|\r\n?/g, CRLF));
    } else {
      headers += `Content-Type: ${value.type || 'application/octet-stream'}${CRLF}`;
    }

    this.headers = textEncoder.encode(headers + CRLF);

    this.contentLength = isStringValue ? value.byteLength : value.size;

    this.size = this.headers.byteLength + this.contentLength + CRLF_BYTES_COUNT;

    this.name = name;
    this.value = value;
  }

  /**
   * 流式编码FormData部分
   * 
   * 编码顺序：
   * 1. 头部字节（Content-Disposition + Content-Type + 空行）
   * 2. 内容字节（文本值编码后或二进制值流式读取）
   * 3. CRLF分隔符字节
   * 
   * @yields {Uint8Array} 编码后的字节块
   */
  async *encode() {
    yield this.headers;

    const { value } = this;

    if (utils.isTypedArray(value)) {
      yield value;
    } else {
      yield* readBlob(value);
    }

    yield CRLF_BYTES;
  }

  /**
   * 转义字段名中的特殊字符
   * 
   * 功能：根据RFC 7578规范，转义字段名中的回车、换行和双引号字符。
   * 防止这些字符破坏multipart格式的解析。
   * 
   * @param {string} name - 原始字段名
   * @returns {string} 转义后的字段名
   */
  static escapeName(name) {
    return String(name).replace(
      /[\r\n"]/g,
      (match) =>
        ({
          '\r': '%0D',
          '\n': '%0A',
          '"': '%22',
        })[match]
    );
  }
}

/**
 * 将FormData对象转换为multipart/form-data格式的ReadableStream
 * 
 * 转换流程：
 * 1. 验证输入是否为有效的FormData实例
 * 2. 生成或使用提供的boundary字符串
 * 3. 将每个FormData字段封装为FormDataPart
 * 4. 计算整个multipart消息的总大小（如果可能）
 * 5. 调用headersHandler回调返回计算出的头部信息
 * 6. 创建并返回流式编码的ReadableStream
 * 
 * @param {FormData} form - 要转换的FormData对象
 * @param {function(Object): void} [headersHandler] - 头部信息回调函数
 * @param {Object} [options] - 配置选项
 * @param {string} [options.tag='form-data-boundary'] - boundary前缀标签
 * @param {number} [options.size=25] - boundary随机部分长度
 * @param {string} [options.boundary] - 自定义boundary字符串
 * @returns {ReadableStream} 编码后的multipart数据流
 * @throws {TypeError} 当form不是FormData实例时
 * @throws {Error} 当boundary长度不符合规范时
 */
const formDataToStream = (form, headersHandler, options) => {
  const {
    tag = 'form-data-boundary',
    size = 25,
    boundary = tag + '-' + platform.generateString(size, BOUNDARY_ALPHABET),
  } = options || {};

  if (!utils.isFormData(form)) {
    throw TypeError('FormData instance required');
  }

  if (boundary.length < 1 || boundary.length > 70) {
    throw Error('boundary must be 10-70 characters long');
  }

  const boundaryBytes = textEncoder.encode('--' + boundary + CRLF);
  const footerBytes = textEncoder.encode('--' + boundary + '--' + CRLF);
  let contentLength = footerBytes.byteLength;

  const parts = Array.from(form.entries()).map(([name, value]) => {
    const part = new FormDataPart(name, value);
    contentLength += part.size;
    return part;
  });

  contentLength += boundaryBytes.byteLength * parts.length;

  contentLength = utils.toFiniteNumber(contentLength);

  const computedHeaders = {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
  };

  if (Number.isFinite(contentLength)) {
    computedHeaders['Content-Length'] = contentLength;
  }

  headersHandler && headersHandler(computedHeaders);

  return Readable.from(
    (async function* () {
      for (const part of parts) {
        yield boundaryBytes;
        yield* part.encode();
      }

      yield footerBytes;
    })()
  );
};

export default formDataToStream;
