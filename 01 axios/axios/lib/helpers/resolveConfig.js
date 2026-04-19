/**
 * @file 配置解析器
 * 
 * 功能：在请求发送前，对配置进行最终解析和规范化。
 * 这是axios请求准备流程的最后一步，将用户配置转换为适配器可用的格式。
 * 
 * 主要处理：
 * 1. URL构建：合并baseURL和相对URL，序列化查询参数
 * 2. 认证头：HTTP基本认证（Basic Auth）
 * 3. FormData处理：自动设置Content-Type头部
 * 4. XSRF保护：添加XSRF令牌头部（浏览器环境）
 * 5. 头部规范化：转换为AxiosHeaders实例
 * 
 * 设计位置：在dispatchRequest中调用，在适配器执行前应用。
 * 确保所有配置已正确解析，适配器只需处理标准化的请求选项。
 */

import platform from '../platform/index.js';          // 平台检测
import utils from '../utils.js';                     // 工具函数
import isURLSameOrigin from './isURLSameOrigin.js';  // 同源检查
import cookies from './cookies.js';                  // Cookie操作
import buildFullPath from '../core/buildFullPath.js'; // URL路径构建
import mergeConfig from '../core/mergeConfig.js';    // 配置合并
import AxiosHeaders from '../core/AxiosHeaders.js';  // 头部管理类
import buildURL from './buildURL.js';                // URL构建器

/**
 * 配置解析主函数
 * 
 * 算法步骤：
 * 1. 配置合并：使用空对象作为基础，确保返回新对象（不变性原则）
 * 2. 头部标准化：将headers转换为AxiosHeaders实例
 * 3. URL构建：构建完整URL并序列化查询参数
 * 4. 认证处理：HTTP基本认证头部生成
 * 5. FormData处理：根据环境设置合适的Content-Type
 * 6. XSRF保护：浏览器环境下添加XSRF令牌头部
 * 
 * 设计原则：
 * 1. 不变性：不修改输入配置，返回新的配置对象
 * 2. 环境感知：根据运行环境（浏览器/Node.js）采取不同策略
 * 3. 安全性：谨慎处理敏感信息（认证、XSRF令牌）
 * 4. 兼容性：支持不同形式的FormData实现
 * 
 * @param {Object} config - 原始请求配置
 * @returns {Object} 解析后的新配置对象
 */
export default (config) => {
  // 步骤1：配置合并（使用空对象作为基础，确保返回全新对象）
  const newConfig = mergeConfig({}, config);

  // 解构常用配置项（使用let因为withXSRFToken可能被重新赋值）
  let { data, withXSRFToken, xsrfHeaderName, xsrfCookieName, headers, auth } = newConfig;

  // 步骤2：头部标准化（转换为AxiosHeaders实例，便于链式操作）
  newConfig.headers = headers = AxiosHeaders.from(headers);

  // 步骤3：URL构建
  //  - 构建完整路径（baseURL + url）
  //  - 序列化查询参数（params -> query string）
  //  - 注意：使用原始config.params而非newConfig.params，因为mergeConfig可能修改
  newConfig.url = buildURL(
    buildFullPath(newConfig.baseURL, newConfig.url, newConfig.allowAbsoluteUrls),
    config.params,
    config.paramsSerializer
  );

  // 步骤4：HTTP基本认证处理
  if (auth) {
    /**
     * 基本认证头部格式：Authorization: Basic <base64(username:password)>
     * 
     * 特殊处理：密码使用encodeURIComponent/unescape处理非ASCII字符
     * 这是为了兼容旧的btoa函数（只支持Latin1字符集）
     * 
     * 注意：在现代浏览器中，可以直接使用btoa(utf8)，但这里保持兼容性
     */
    headers.set(
      'Authorization',
      'Basic ' +
        btoa(
          (auth.username || '') +
            ':' +
            (auth.password ? unescape(encodeURIComponent(auth.password)) : '')
        )
    );
  }

  // 步骤5：FormData处理
  if (utils.isFormData(data)) {
    if (platform.hasStandardBrowserEnv || platform.hasStandardBrowserWebWorkerEnv) {
      // 浏览器环境：浏览器会自动设置Content-Type为multipart/form-data
      // 设置undefined让浏览器处理，避免冲突
      headers.setContentType(undefined);
    } else if (utils.isFunction(data.getHeaders)) {
      // Node.js环境（form-data包）：从FormData实例获取头部
      const formHeaders = data.getHeaders();
      
      // 安全考虑：只允许设置安全的头部，避免覆盖安全相关的头部
      const allowedHeaders = ['content-type', 'content-length'];
      
      Object.entries(formHeaders).forEach(([key, val]) => {
        if (allowedHeaders.includes(key.toLowerCase())) {
          headers.set(key, val);
        }
      });
    }
  }

  // 步骤6：XSRF保护（仅标准浏览器环境）
  // 设计目的：防止跨站请求伪造攻击
  // 不应用于Web Worker或React Native环境
  if (platform.hasStandardBrowserEnv) {
    // 支持动态withXSRFToken函数（根据配置决定是否添加XSRF头部）
    withXSRFToken && utils.isFunction(withXSRFToken) && (withXSRFToken = withXSRFToken(newConfig));

    /**
     * XSRF头部添加条件（满足任一）：
     * 1. withXSRFToken为true（明确要求）
     * 2. withXSRFToken不为false且请求同源（默认行为）
     * 
     * 注意：withXSRFToken !== false 允许undefined值触发默认行为
     */
    if (withXSRFToken || (withXSRFToken !== false && isURLSameOrigin(newConfig.url))) {
      // 从cookie读取XSRF令牌值
      const xsrfValue = xsrfHeaderName && xsrfCookieName && cookies.read(xsrfCookieName);

      if (xsrfValue) {
        headers.set(xsrfHeaderName, xsrfValue);
      }
    }
  }

  // 返回解析后的配置
  return newConfig;
};
