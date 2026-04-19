'use strict';

// Axios 默认配置模块，定义了请求的默认行为和配置
import utils from '../utils.js';                    // 工具函数
import AxiosError from '../core/AxiosError.js';     // Axios 错误类
import transitionalDefaults from './transitional.js'; // 过渡性默认配置
import toFormData from '../helpers/toFormData.js';   // 数据转 FormData
import toURLEncodedForm from '../helpers/toURLEncodedForm.js'; // 数据转 URL 编码表单
import platform from '../platform/index.js';         // 平台检测
import formDataToJSON from '../helpers/formDataToJSON.js'; // FormData 转 JSON

/**
 * It takes a string, tries to parse it, and if it fails, it returns the stringified version
 * of the input
 *
 * 安全地字符串化值：如果输入是字符串，尝试解析它；如果解析失败，返回字符串化版本。
 * 用于处理 JSON 数据，避免重复字符串化已字符串化的 JSON。
 *
 * @param {any} rawValue - The value to be stringified. - 要字符串化的值
 * @param {Function} parser - A function that parses a string into a JavaScript object. - 解析函数
 * @param {Function} encoder - A function that takes a value and returns a string. - 编码函数
 *
 * @returns {string} A stringified version of the rawValue. - 字符串化后的值
 */
function stringifySafely(rawValue, parser, encoder) {
  // 如果输入是字符串，尝试解析它（检查是否是有效的 JSON）
  if (utils.isString(rawValue)) {
    try {
      (parser || JSON.parse)(rawValue);  // 尝试解析
      return utils.trim(rawValue);       // 如果是有效 JSON，返回原字符串（去除空白）
    } catch (e) {
      if (e.name !== 'SyntaxError') {
        throw e;  // 如果不是语法错误，重新抛出
      }
      // 如果是语法错误（不是有效 JSON），继续执行下面的字符串化逻辑
    }
  }

  // 否则，使用编码器（或 JSON.stringify）字符串化值
  return (encoder || JSON.stringify)(rawValue);
}

// Axios 默认配置对象，所有请求的基准配置
const defaults = {
  // 过渡性配置，用于处理版本升级期间的兼容性问题
  transitional: transitionalDefaults,

  // 适配器优先级列表：按顺序尝试使用 xhr、http、fetch 适配器
  adapter: ['xhr', 'http', 'fetch'],

  // 请求数据转换函数数组：在发送请求前对数据进行转换
  // 根据数据类型和 Content-Type 头部决定如何转换数据
  transformRequest: [
    function transformRequest(data, headers) {
      const contentType = headers.getContentType() || '';
      const hasJSONContentType = contentType.indexOf('application/json') > -1;
      const isObjectPayload = utils.isObject(data);

      if (isObjectPayload && utils.isHTMLForm(data)) {
        data = new FormData(data);
      }

      const isFormData = utils.isFormData(data);

      if (isFormData) {
        return hasJSONContentType ? JSON.stringify(formDataToJSON(data)) : data;
      }

      if (
        utils.isArrayBuffer(data) ||
        utils.isBuffer(data) ||
        utils.isStream(data) ||
        utils.isFile(data) ||
        utils.isBlob(data) ||
        utils.isReadableStream(data)
      ) {
        return data;
      }
      if (utils.isArrayBufferView(data)) {
        return data.buffer;
      }
      if (utils.isURLSearchParams(data)) {
        headers.setContentType('application/x-www-form-urlencoded;charset=utf-8', false);
        return data.toString();
      }

      let isFileList;

      if (isObjectPayload) {
        if (contentType.indexOf('application/x-www-form-urlencoded') > -1) {
          return toURLEncodedForm(data, this.formSerializer).toString();
        }

        if (
          (isFileList = utils.isFileList(data)) ||
          contentType.indexOf('multipart/form-data') > -1
        ) {
          const _FormData = this.env && this.env.FormData;

          return toFormData(
            isFileList ? { 'files[]': data } : data,
            _FormData && new _FormData(),
            this.formSerializer
          );
        }
      }

      if (isObjectPayload || hasJSONContentType) {
        headers.setContentType('application/json', false);
        return stringifySafely(data);
      }

      return data;
    },
  ],

  // 响应数据转换函数数组：在接收到响应后对数据进行转换
  // 主要处理 JSON 解析和错误处理
  transformResponse: [
    function transformResponse(data) {
      const transitional = this.transitional || defaults.transitional;
      const forcedJSONParsing = transitional && transitional.forcedJSONParsing;
      const JSONRequested = this.responseType === 'json';

      if (utils.isResponse(data) || utils.isReadableStream(data)) {
        return data;
      }

      if (
        data &&
        utils.isString(data) &&
        ((forcedJSONParsing && !this.responseType) || JSONRequested)
      ) {
        const silentJSONParsing = transitional && transitional.silentJSONParsing;
        const strictJSONParsing = !silentJSONParsing && JSONRequested;

        try {
          return JSON.parse(data, this.parseReviver);
        } catch (e) {
          if (strictJSONParsing) {
            if (e.name === 'SyntaxError') {
              throw AxiosError.from(e, AxiosError.ERR_BAD_RESPONSE, this, null, this.response);
            }
            throw e;
          }
        }
      }

      return data;
    },
  ],

  /**
   * A timeout in milliseconds to abort a request. If set to 0 (default) a
   * timeout is not created.
   * 请求超时时间（毫秒），0 表示不设置超时
   */
  timeout: 0,

  // XSRF（跨站请求伪造）保护相关配置
  xsrfCookieName: 'XSRF-TOKEN',    // XSRF token 的 cookie 名称
  xsrfHeaderName: 'X-XSRF-TOKEN',  // XSRF token 的请求头名称

  // 响应和请求体大小限制（-1 表示无限制）
  maxContentLength: -1,  // 最大响应内容长度
  maxBodyLength: -1,     // 最大请求体长度

  // 环境特定的类引用，用于跨平台兼容
  env: {
    FormData: platform.classes.FormData,  // 平台特定的 FormData 类
    Blob: platform.classes.Blob,          // 平台特定的 Blob 类
  },

  // 验证 HTTP 状态码是否成功（默认认为 2xx 状态码为成功）
  validateStatus: function validateStatus(status) {
    return status >= 200 && status < 300;  // 2xx 范围内的状态码表示成功
  },

  // 默认请求头配置
  headers: {
    common: {  // 所有请求通用的头部
      Accept: 'application/json, text/plain, */*',  // 接受的响应类型
      'Content-Type': undefined,  // 内容类型，默认为 undefined（根据数据自动设置）
    },
  },
};

// 为各种 HTTP 方法初始化空的头部配置对象
utils.forEach(['delete', 'get', 'head', 'post', 'put', 'patch'], (method) => {
  defaults.headers[method] = {};  // 每个方法特定的头部配置
});

// 导出默认配置对象
export default defaults;
