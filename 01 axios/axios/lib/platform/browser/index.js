/**
 * @file 浏览器平台配置
 * 
 * 功能：定义浏览器环境的平台特性和类实现。
 * 
 * 设计目的：
 * 1. 标识环境：设置isBrowser: true，标识当前为浏览器环境
 * 2. 提供原生类：使用浏览器原生的URLSearchParams、FormData、Blob类
 * 3. 定义支持协议：列出浏览器环境支持的URL协议
 * 
 * 与Node.js平台的区别：
 * 1. 类实现：直接使用浏览器原生类，而非polyfill
 * 2. 支持协议：包含浏览器特有的协议（blob:, data:, file:）
 * 3. 环境标志：isBrowser vs isNode
 * 
 * 构建时替换：在Node.js构建中，此文件被替换为node/index.js。
 * 这是通过构建工具的别名解析实现的。
 */

import URLSearchParams from './classes/URLSearchParams.js';  // 浏览器原生URLSearchParams
import FormData from './classes/FormData.js';                // 浏览器原生FormData
import Blob from './classes/Blob.js';                        // 浏览器原生Blob

/**
 * 浏览器平台导出配置
 * 
 * 配置项：
 * 1. isBrowser: true - 环境标识，用于条件逻辑
 * 2. classes - 浏览器原生类引用
 *    - URLSearchParams: 用于URL查询参数处理
 *    - FormData: 用于multipart/form-data编码
 *    - Blob: 用于二进制数据处理
 * 3. protocols - 支持的URL协议列表
 *    - http/https: 标准Web协议
 *    - file: 本地文件协议（部分浏览器限制）
 *    - blob/data: 浏览器特有的数据协议
 *    - url: 通用URL协议
 */
export default {
  isBrowser: true,
  classes: {
    URLSearchParams,
    FormData,
    Blob,
  },
  protocols: ['http', 'https', 'file', 'blob', 'url', 'data'],
};
