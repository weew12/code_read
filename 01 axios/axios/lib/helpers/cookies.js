/**
 * @file Cookie操作适配器（浏览器环境检测）
 * 
 * 功能：提供跨环境的Cookie读写接口，根据运行环境自动选择实现：
 * 1. 标准浏览器环境：使用document.cookie API进行实际操作
 * 2. 非标准环境（Web Workers、React Native等）：提供空操作实现
 * 
 * 设计目的：确保axios在浏览器和非浏览器环境中的兼容性，
 * 避免在缺乏DOM API的环境中抛出错误。
 */

import utils from '../utils.js';
import platform from '../platform/index.js';

export default platform.hasStandardBrowserEnv
  ? // 标准浏览器环境支持document.cookie
    {
      /**
       * 写入Cookie
       * 
       * 功能：按照HTTP Cookie规范设置cookie值，支持所有标准属性。
       * 在非浏览器环境中静默失败。
       * 
       * @param {string} name - cookie名称
       * @param {string} value - cookie值（自动进行URI编码）
       * @param {number} [expires] - 过期时间戳（毫秒）
       * @param {string} [path] - 路径范围
       * @param {string} [domain] - 域名范围
       * @param {boolean} [secure] - 是否仅限HTTPS
       * @param {string} [sameSite] - SameSite策略（Strict/Lax/None）
       */
      write(name, value, expires, path, domain, secure, sameSite) {
        if (typeof document === 'undefined') return;

        const cookie = [`${name}=${encodeURIComponent(value)}`];

        if (utils.isNumber(expires)) {
          cookie.push(`expires=${new Date(expires).toUTCString()}`);
        }
        if (utils.isString(path)) {
          cookie.push(`path=${path}`);
        }
        if (utils.isString(domain)) {
          cookie.push(`domain=${domain}`);
        }
        if (secure === true) {
          cookie.push('secure');
        }
        if (utils.isString(sameSite)) {
          cookie.push(`SameSite=${sameSite}`);
        }

        document.cookie = cookie.join('; ');
      },

      /**
       * 读取Cookie值
       * 
       * 功能：从document.cookie中读取指定名称的cookie值。
       * 使用正则表达式匹配，正确处理cookie字符串中的分号分隔。
       * 在非浏览器环境中返回null。
       * 
       * @param {string} name - 要读取的cookie名称
       * @returns {string|null} cookie值（自动进行URI解码），未找到时返回null
       */
      read(name) {
        if (typeof document === 'undefined') return null;
        const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : null;
      },

      /**
       * 删除Cookie
       * 
       * 功能：通过设置过期时间为过去（24小时前）来删除cookie。
       * 同时设置路径为'/'确保删除所有路径下的同名cookie。
       * 
       * @param {string} name - 要删除的cookie名称
       */
      remove(name) {
        this.write(name, '', Date.now() - 86400000, '/');
      },
    }
  : // 非标准浏览器环境（Web Workers、React Native等）缺乏必要支持
    {
      /**
       * 空操作write方法（非浏览器环境）
       */
      write() {},
      /**
       * 空操作read方法（非浏览器环境）
       * @returns {null}
       */
      read() {
        return null;
      },
      /**
       * 空操作remove方法（非浏览器环境）
       */
      remove() {},
    };
