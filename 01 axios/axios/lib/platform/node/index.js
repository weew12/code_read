/**
 * @file Node.js平台配置
 * 
 * 功能：定义Node.js环境的平台特性和类实现。
 * 
 * 设计目的：
 * 1. 标识环境：设置isNode: true，标识当前为Node.js环境
 * 2. 提供类实现：使用Node.js特定的FormData和URLSearchParams实现
 * 3. 随机字符串生成：利用Node.js的crypto模块生成安全随机字符串
 * 4. 定义支持协议：列出Node.js环境支持的URL协议
 * 
 * Node.js特定功能：
 * 1. crypto模块：用于生成密码学安全的随机字符串
 * 2. 自定义类：FormData和URLSearchParams的Node.js实现（非原生）
 * 3. 协议限制：不支持浏览器的blob:协议（除非全局Blob存在）
 */

import crypto from 'crypto';  // Node.js加密模块
import URLSearchParams from './classes/URLSearchParams.js';  // Node.js URLSearchParams实现
import FormData from './classes/FormData.js';                // Node.js FormData实现

// 字母表定义，用于随机字符串生成
const ALPHA = 'abcdefghijklmnopqrstuvwxyz';      // 小写字母
const DIGIT = '0123456789';                       // 数字

/**
 * 字母表配置对象
 * 
 * 用途：提供不同字符集的预设，用于随机字符串生成。
 * 例如：生成CSRF令牌、临时文件名等。
 */
const ALPHABET = {
  DIGIT,                                          // 仅数字
  ALPHA,                                          // 仅小写字母
  ALPHA_DIGIT: ALPHA + ALPHA.toUpperCase() + DIGIT, // 字母数字混合（大小写+数字）
};

/**
 * 生成随机字符串
 * 
 * 功能：生成密码学安全的随机字符串。
 * 
 * 实现原理：
 * 1. 使用crypto.randomFillSync填充Uint32Array（性能优于Math.random）
 * 2. 取模运算将随机数映射到字母表范围
 * 3. 拼接字符生成最终字符串
 * 
 * 安全性：使用Node.js的crypto模块，提供密码学安全的随机数。
 * 适用于生成CSRF令牌、会话ID等安全相关字符串。
 * 
 * @param {number} size - 字符串长度（默认16）
 * @param {string} alphabet - 字符集（默认字母数字混合）
 * @returns {string} 随机字符串
 */
const generateString = (size = 16, alphabet = ALPHABET.ALPHA_DIGIT) => {
  let str = '';
  const { length } = alphabet;
  const randomValues = new Uint32Array(size);
  
  // 使用同步版本填充随机值（性能更好，适用于非阻塞场景）
  crypto.randomFillSync(randomValues);
  
  for (let i = 0; i < size; i++) {
    str += alphabet[randomValues[i] % length];
  }

  return str;
};

/**
 * Node.js平台导出配置
 * 
 * 配置项：
 * 1. isNode: true - 环境标识，用于条件逻辑
 * 2. classes - 类实现
 *    - URLSearchParams: Node.js实现（可能来自'url'模块的polyfill）
 *    - FormData: Node.js实现（通常来自'form-data'包）
 *    - Blob: 如果全局Blob存在则使用，否则为null（Node.js 18+引入了Blob）
 * 3. ALPHABET - 字母表预设，用于随机字符串生成
 * 4. generateString - 随机字符串生成函数
 * 5. protocols - 支持的URL协议列表
 *    - http/https: 标准网络协议
 *    - file: 本地文件系统协议
 *    - data: Data URL协议
 */
export default {
  isNode: true,
  classes: {
    URLSearchParams,
    FormData,
    Blob: (typeof Blob !== 'undefined' && Blob) || null,  // Node.js 18+支持Blob
  },
  ALPHABET,
  generateString,
  protocols: ['http', 'https', 'file', 'data'],
};
