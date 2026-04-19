'use strict';

// URL 构建模块，负责将参数序列化并拼接到 URL 上
import utils from '../utils.js';                          // 工具函数
import AxiosURLSearchParams from '../helpers/AxiosURLSearchParams.js';  // URL 参数处理类

/**
 * It replaces URL-encoded forms of `:`, `$`, `,`, and spaces with
 * their plain counterparts (`:`, `$`, `,`, `+`).
 *
 * 替换 URL 编码后的 `:`, `$`, `,` 和空格为它们的原始形式（`:`, `$`, `,`, `+`）。
 * 这是一种特殊的编码方式，用于处理 URL 查询参数。
 *
 * @param {string} val The value to be encoded. - 要编码的值
 *
 * @returns {string} The encoded value. - 编码后的值
 */
function encode(val) {
  return encodeURIComponent(val)
    .replace(/%3A/gi, ':')  // 将 %3A 替换回 :
    .replace(/%24/g, '$')   // 将 %24 替换回 $
    .replace(/%2C/gi, ',')  // 将 %2C 替换回 ,
    .replace(/%20/g, '+');  // 将 %20 替换为 +（空格在查询参数中通常编码为 +）
}

/**
 * Build a URL by appending params to the end
 * 构建 URL：将参数追加到 URL 末尾
 *
 * @param {string} url The base of the url (e.g., http://www.google.com) - 基础 URL
 * @param {object} [params] The params to be appended - 要追加的参数
 * @param {?(object|Function)} options - 选项对象或序列化函数
 *
 * @returns {string} The formatted url - 格式化后的 URL
 */
export default function buildURL(url, params, options) {
  // 如果没有参数，直接返回原始 URL
  if (!params) {
    return url;
  }

  // 获取编码函数：优先使用 options.encode，否则使用默认的 encode 函数
  const _encode = (options && options.encode) || encode;

  // 标准化 options：如果 options 是函数，则包装为 { serialize: options }
  const _options = utils.isFunction(options)
    ? {
        serialize: options,
      }
    : options;

  // 获取序列化函数
  const serializeFn = _options && _options.serialize;

  let serializedParams;  // 序列化后的参数字符串

  // 使用自定义序列化函数或默认方式序列化参数
  if (serializeFn) {
    serializedParams = serializeFn(params, _options);
  } else {
    serializedParams = utils.isURLSearchParams(params)
      ? params.toString()  // 如果已经是 URLSearchParams，直接调用 toString
      : new AxiosURLSearchParams(params, _options).toString(_encode);  // 否则使用 AxiosURLSearchParams
  }

  // 如果有序列化后的参数，将其拼接到 URL 上
  if (serializedParams) {
    const hashmarkIndex = url.indexOf('#');  // 查找 URL 中的 hash 部分

    // 如果存在 hash，去除 hash 部分（查询参数应该放在 hash 之前）
    if (hashmarkIndex !== -1) {
      url = url.slice(0, hashmarkIndex);
    }
    // 拼接参数：如果 URL 中已有问号，使用 & 连接，否则使用 ? 开头
    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }

  return url;
}
