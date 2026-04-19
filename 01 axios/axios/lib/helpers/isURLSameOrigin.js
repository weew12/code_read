/**
 * @file URL同源检查函数
 * 
 * 功能：判断一个URL是否与当前页面同源。
 * 
 * 同源策略（Same-origin policy）定义：
 * 两个URL在协议（protocol）、主机（host）、端口（port）都相同时才算是同源。
 * 这是Web安全的重要基础，用于防止跨站脚本攻击（XSS）和跨站请求伪造（CSRF）。
 * 
 * 设计特点：
 * 1. 环境自适应：仅在标准浏览器环境中进行同源检查，其他环境返回true
 * 2. IE兼容：Internet Explorer有特殊的端口处理逻辑
 * 3. 性能优化：使用闭包缓存当前源和浏览器检测结果
 * 
 * 使用场景：在axios中用于决定是否自动添加XSRF令牌头部。
 * 只有同源请求才需要添加XSRF令牌，跨域请求由服务器通过CORS策略控制。
 */

import platform from '../platform/index.js';

/**
 * 同源检查函数（环境自适应）
 * 
 * 实现策略：
 * 1. 标准浏览器环境：返回实际的同源检查函数
 * 2. 其他环境（Node.js、Web Worker、React Native）：返回始终返回true的函数
 * 
 * 设计目的：避免在非浏览器环境中进行无意义的同源检查。
 * 在Node.js中，没有"当前页面"的概念，因此所有请求都视为"同源"。
 * 
 * 条件导出语法解析：
 * platform.hasStandardBrowserEnv ? (浏览器实现) : (非浏览器实现)
 */
export default platform.hasStandardBrowserEnv
  ? /**
     * 浏览器环境同源检查函数（使用IIFE创建闭包）
     * 
     * 实现原理：立即执行函数返回一个函数，闭包缓存：
     * 1. origin: 当前页面的URL对象（解析platform.origin）
     * 2. isMSIE: 是否是Internet Explorer浏览器
     * 
     * 闭包优势：避免每次调用都重新计算当前源和浏览器检测
     */
    ((origin, isMSIE) => 
      /**
       * 同源检查函数
       * 
       * 算法逻辑：
       * 1. 解析目标URL（使用platform.origin作为基础URL解析相对URL）
       * 2. 比较协议（protocol）、主机（host）、端口（port）
       * 3. IE特殊处理：IE忽略端口比较（历史兼容性原因）
       * 
       * 同源判断条件：
       * 1. 协议相同（http/https）
       * 2. 主机相同（域名或IP地址）
       * 3. 端口相同（或IE浏览器）
       * 
       * @param {string} url - 要检查的URL
       * @returns {boolean} 是否同源
       */
      (url) => {
        // 解析目标URL（支持相对URL，使用当前页面origin作为基础）
        url = new URL(url, platform.origin);

        return (
          origin.protocol === url.protocol &&
          origin.host === url.host &&
          (isMSIE || origin.port === url.port)
        );
      }
    )(
      // IIFE参数1：当前页面源URL对象
      new URL(platform.origin),
      // IIFE参数2：IE浏览器检测
      platform.navigator && /(msie|trident)/i.test(platform.navigator.userAgent)
    )
  : /**
     * 非浏览器环境同源检查函数
     * 
     * 设计原因：在Node.js、Web Worker、React Native等环境中，
     * 没有"当前页面"的概念，因此无法进行有意义的同源检查。
     * 返回始终为true的函数，避免破坏现有逻辑。
     * 
     * @returns {boolean} 总是返回true
     */
    () => true;
