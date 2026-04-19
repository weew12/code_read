'use strict';

// Axios 错误类，扩展自 Error，用于表示 Axios 相关的错误
import utils from '../utils.js';  // 工具函数，用于 toJSONObject

// Axios 错误类，继承自 Error，增加了 Axios 特有的属性（config、request、response、code 等）
class AxiosError extends Error {
  /**
   * 从现有错误创建 AxiosError 实例（工厂方法）
   * @param {Error} error - 原始错误对象
   * @param {string} [code] - 错误代码
   * @param {Object} [config] - 请求配置
   * @param {Object} [request] - 请求对象
   * @param {Object} [response] - 响应对象
   * @param {Object} [customProps] - 自定义属性
   * @returns {AxiosError} 新的 AxiosError 实例
   */
  static from(error, code, config, request, response, customProps) {
    // 创建新的 AxiosError 实例，继承原始错误的消息和代码
    const axiosError = new AxiosError(error.message, code || error.code, config, request, response);
    axiosError.cause = error;    // 保存原始错误作为 cause
    axiosError.name = error.name; // 保持原始错误的名称

    // 如果原始错误有 status 且新实例没有，则保留原始错误的 status
    if (error.status != null && axiosError.status == null) {
      axiosError.status = error.status;
    }

    // 合并自定义属性
    customProps && Object.assign(axiosError, customProps);
    return axiosError;
  }

    /**
     * Create an Error with the specified message, config, error code, request and response.
     * 创建具有指定消息、配置、错误代码、请求和响应的错误。
     *
     * @param {string} message The error message. - 错误消息
     * @param {string} [code] The error code (for example, 'ECONNABORTED'). - 错误代码
     * @param {Object} [config] The config. - 请求配置
     * @param {Object} [request] The request. - 请求对象
     * @param {Object} [response] The response. - 响应对象
     *
     * @returns {Error} The created error. - 创建的错误对象
     */
    constructor(message, code, config, request, response) {
      super(message);  // 调用父类 Error 的构造函数
      
      // 使 message 属性可枚举以保持向后兼容性
      // 原生 Error 构造函数将 message 设置为不可枚举，
      // 但 axios < v1.13.3 中它是可枚举的
      Object.defineProperty(this, 'message', {
          value: message,
          enumerable: true,   // 设置为可枚举
          writable: true,     // 可写
          configurable: true  // 可配置
      });
      
      this.name = 'AxiosError';    // 错误名称
      this.isAxiosError = true;    // 标记为 Axios 错误（便于识别）
      code && (this.code = code);  // 设置错误代码
      config && (this.config = config);      // 保存请求配置
      request && (this.request = request);   // 保存请求对象
      if (response) {
          this.response = response;          // 保存响应对象
          this.status = response.status;     // 从响应中提取状态码
      }
    }

  /**
   * 将错误对象转换为 JSON 格式（用于序列化）
   * 包含标准错误属性、浏览器特定属性和 Axios 特定属性
   * @returns {Object} JSON 格式的错误对象
   */
  toJSON() {
    return {
      // Standard - 标准错误属性
      message: this.message,
      name: this.name,
      // Microsoft - Microsoft 浏览器错误属性
      description: this.description,
      number: this.number,
      // Mozilla - Mozilla 浏览器错误属性
      fileName: this.fileName,
      lineNumber: this.lineNumber,
      columnNumber: this.columnNumber,
      stack: this.stack,  // 堆栈跟踪
      // Axios - Axios 特定属性
      config: utils.toJSONObject(this.config),  // 使用 toJSONObject 处理循环引用
      code: this.code,    // 错误代码
      status: this.status, // HTTP 状态码
    };
  }
}

// 错误代码常量定义
// 注意：这些可以改为静态属性，但需要更新 .eslint.cjs 中的解析器选项

// 配置相关错误
AxiosError.ERR_BAD_OPTION_VALUE = 'ERR_BAD_OPTION_VALUE';  // 配置选项值错误
AxiosError.ERR_BAD_OPTION = 'ERR_BAD_OPTION';              // 配置选项错误

// 连接相关错误
AxiosError.ECONNABORTED = 'ECONNABORTED';                  // 连接被中止
AxiosError.ETIMEDOUT = 'ETIMEDOUT';                        // 连接超时

// 网络错误
AxiosError.ERR_NETWORK = 'ERR_NETWORK';                    // 网络错误

// 重定向错误
AxiosError.ERR_FR_TOO_MANY_REDIRECTS = 'ERR_FR_TOO_MANY_REDIRECTS';  // 重定向次数过多

// 其他错误
AxiosError.ERR_DEPRECATED = 'ERR_DEPRECATED';              // 已弃用的功能
AxiosError.ERR_BAD_RESPONSE = 'ERR_BAD_RESPONSE';          // 响应错误
AxiosError.ERR_BAD_REQUEST = 'ERR_BAD_REQUEST';            // 请求错误
AxiosError.ERR_CANCELED = 'ERR_CANCELED';                  // 请求被取消
AxiosError.ERR_NOT_SUPPORT = 'ERR_NOT_SUPPORT';            // 不支持的功能
AxiosError.ERR_INVALID_URL = 'ERR_INVALID_URL';            // 无效的 URL

export default AxiosError;
