'use strict';

// Axios 核心类，定义了 HTTP 请求的主要逻辑和拦截器机制

// 工具函数模块
import utils from '../utils.js';
// 构建 URL 的函数，用于将参数序列化并拼接到 URL 上
import buildURL from '../helpers/buildURL.js';
// 拦截器管理器，用于管理请求和响应拦截器
import InterceptorManager from './InterceptorManager.js';
// 分发请求的函数，负责调用适配器发送请求
import dispatchRequest from './dispatchRequest.js';
// 合并配置的函数
import mergeConfig from './mergeConfig.js';
// 构建完整请求路径的函数，处理 baseURL 和相对路径
import buildFullPath from './buildFullPath.js';
// 配置验证器，用于验证配置项的合法性
import validator from '../helpers/validator.js';
// Axios 头部管理类
import AxiosHeaders from './AxiosHeaders.js';
// 过渡性默认配置，用于处理版本升级期间的兼容性问题
import transitionalDefaults from '../defaults/transitional.js';

// 验证器函数的引用，用于验证配置项
const validators = validator.validators;

/**
 * Create a new instance of Axios
 *
 * @param {Object} instanceConfig The default config for the instance
 *
 * @return {Axios} A new instance of Axios
 */
// Axios 核心类，封装了 HTTP 请求的完整生命周期，包括配置合并、拦截器链执行、请求发送和响应处理
class Axios {
  constructor(instanceConfig) {
    // 存储实例的默认配置
    this.defaults = instanceConfig || {};
    // 初始化拦截器管理器，分为请求拦截器和响应拦截器
    this.interceptors = {
      request: new InterceptorManager(),  // 请求拦截器，在请求发送前执行
      response: new InterceptorManager(), // 响应拦截器，在响应返回后执行
    };
  }

  /**
   * Dispatch a request
   *
   * @param {String|Object} configOrUrl The config specific for this request (merged with this.defaults)
   * @param {?Object} config
   *
   * @returns {Promise} The Promise to be fulfilled
   */
  // 主要的请求方法，对外暴露的 API，内部调用 _request 方法并处理错误堆栈
  async request(configOrUrl, config) {
    try {
      return await this._request(configOrUrl, config);
    } catch (err) {
      // 如果是 Error 类型，尝试增强其堆栈信息，便于调试
      if (err instanceof Error) {
        let dummy = {};

        // 获取当前调用堆栈（不包含当前帧）
        Error.captureStackTrace ? Error.captureStackTrace(dummy) : (dummy = new Error());

        // 去掉堆栈的第一行（通常是 "Error: ..." 信息）
        const stack = dummy.stack ? dummy.stack.replace(/^.+\n/, '') : '';
        try {
          if (!err.stack) {
            // 如果原始错误没有堆栈，直接使用当前堆栈
            err.stack = stack;
            // match without the 2 top stack lines
          } else if (stack && !String(err.stack).endsWith(stack.replace(/^.+\n.+\n/, ''))) {
            // 如果原始错误有堆栈，但当前堆栈不重复，则追加当前堆栈
            err.stack += '\n' + stack;
          }
        } catch (e) {
          // 忽略堆栈属性不可写的情况（某些环境下 stack 是只读的）
        }
      }

      throw err;
    }
  }

  // 内部请求方法，处理配置合并、验证、拦截器链执行等核心逻辑
  _request(configOrUrl, config) {
    /*eslint no-param-reassign:0*/
    // 支持两种调用方式：axios('example/url'[, config])（类似 fetch API）或 axios(config)
    if (typeof configOrUrl === 'string') {
      config = config || {};
      config.url = configOrUrl;  // 将字符串参数作为 url
    } else {
      config = configOrUrl || {};
    }

    // 合并实例默认配置和请求特定配置
    config = mergeConfig(this.defaults, config);

    // 解构配置中的 transitional、paramsSerializer 和 headers 字段
    const { transitional, paramsSerializer, headers } = config;

    // 验证 transitional 配置（用于版本迁移的过渡性配置）
    if (transitional !== undefined) {
      validator.assertOptions(
        transitional,
        {
          silentJSONParsing: validators.transitional(validators.boolean),        // 静默 JSON 解析
          forcedJSONParsing: validators.transitional(validators.boolean),        // 强制 JSON 解析
          clarifyTimeoutError: validators.transitional(validators.boolean),      // 澄清超时错误
          legacyInterceptorReqResOrdering: validators.transitional(validators.boolean), // 传统拦截器顺序
        },
        false  // 不允许多余的属性
      );
    }

    // 处理参数序列化器（paramsSerializer）
    if (paramsSerializer != null) {
      if (utils.isFunction(paramsSerializer)) {
        // 如果 paramsSerializer 是函数，包装成对象形式
        config.paramsSerializer = {
          serialize: paramsSerializer,
        };
      } else {
        // 否则验证对象格式的 paramsSerializer
        validator.assertOptions(
          paramsSerializer,
          {
            encode: validators.function,   // encode 必须是函数
            serialize: validators.function, // serialize 必须是函数
          },
          true  // 允许多余的属性
        );
      }
    }

    // 设置 allowAbsoluteUrls 配置，决定是否允许绝对 URL
    if (config.allowAbsoluteUrls !== undefined) {
      // 如果请求配置中已明确设置，则保持原样
    } else if (this.defaults.allowAbsoluteUrls !== undefined) {
      // 否则使用实例默认配置
      config.allowAbsoluteUrls = this.defaults.allowAbsoluteUrls;
    } else {
      // 最后使用全局默认值 true（允许绝对 URL）
      config.allowAbsoluteUrls = true;
    }

    // 验证配置中的拼写错误（常见拼写错误纠正）
    validator.assertOptions(
      config,
      {
        baseUrl: validators.spelling('baseURL'),        // 纠正 baseUrl -> baseURL
        withXsrfToken: validators.spelling('withXSRFToken'), // 纠正 withXsrfToken -> withXSRFToken
      },
      true  // 允许多余的属性
    );

    // 设置请求方法，默认值为 'get'，并转换为小写
    config.method = (config.method || this.defaults.method || 'get').toLowerCase();

    // 扁平化头部配置：将 headers.common 和 headers[method] 合并为上下文头部
    let contextHeaders = headers && utils.merge(headers.common, headers[config.method]);

    // 删除 headers 对象中的方法特定头部和 common 头部，避免重复
    headers &&
      utils.forEach(['delete', 'get', 'head', 'post', 'put', 'patch', 'common'], (method) => {
        delete headers[method];
      });

    // 使用 AxiosHeaders.concat 合并上下文头部和剩余的头部配置
    config.headers = AxiosHeaders.concat(contextHeaders, headers);

    // 构建拦截器链：过滤跳过的拦截器，并确定执行顺序
    const requestInterceptorChain = [];          // 请求拦截器链，存储 fulfilled 和 rejected 处理函数
    let synchronousRequestInterceptors = true;   // 标记所有请求拦截器是否都是同步的
    
    // 遍历请求拦截器，构建拦截器链
    this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
      // 如果定义了 runWhen 函数且返回 false，则跳过此拦截器
      if (typeof interceptor.runWhen === 'function' && interceptor.runWhen(config) === false) {
        return;
      }

      // 检查拦截器是否为同步执行（synchronous 为 true）
      synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;

      // 获取 transitional 配置，决定拦截器的顺序（传统顺序 vs 新顺序）
      const transitional = config.transitional || transitionalDefaults;
      const legacyInterceptorReqResOrdering =
        transitional && transitional.legacyInterceptorReqResOrdering;

      if (legacyInterceptorReqResOrdering) {
        // 传统顺序：将拦截器添加到链的开头（unshift），执行顺序与添加顺序相反
        requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected);
      } else {
        // 新顺序：将拦截器添加到链的末尾（push），执行顺序与添加顺序相同
        requestInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
      }
    });

    // 构建响应拦截器链（响应拦截器总是添加到链的末尾）
    const responseInterceptorChain = [];
    this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
      responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
    });

    let promise;  // 最终返回的 Promise
    let i = 0;     // 索引变量，用于遍历拦截器链
    let len;       // 链的长度

    // 情况1：存在异步请求拦截器（或所有拦截器都是异步的）
    if (!synchronousRequestInterceptors) {
      // 构建完整的 Promise 链：[请求拦截器..., dispatchRequest, undefined, 响应拦截器...]
      const chain = [dispatchRequest.bind(this), undefined]; // undefined 作为 dispatchRequest 的 rejected 处理
      chain.unshift(...requestInterceptorChain);  // 请求拦截器添加到链的开头
      chain.push(...responseInterceptorChain);    // 响应拦截器添加到链的末尾
      len = chain.length;

      // 从配置对象开始 Promise 链
      promise = Promise.resolve(config);

      // 循环构建 Promise 链：每个 then 接收两个处理函数（fulfilled 和 rejected）
      while (i < len) {
        promise = promise.then(chain[i++], chain[i++]);
      }

      return promise;  // 返回最终的 Promise
    }

    // 情况2：所有请求拦截器都是同步的（传统模式，性能更好）
    len = requestInterceptorChain.length;

    let newConfig = config;

    // 同步执行请求拦截器链
    while (i < len) {
      const onFulfilled = requestInterceptorChain[i++];  // fulfilled 处理函数
      const onRejected = requestInterceptorChain[i++];   // rejected 处理函数
      try {
        newConfig = onFulfilled(newConfig);  // 执行拦截器，可能修改配置
      } catch (error) {
        onRejected.call(this, error);        // 如果出错，执行 rejected 处理
        break;                               // 中断拦截器链
      }
    }

    // 调用 dispatchRequest 发送请求（可能抛出同步错误）
    try {
      promise = dispatchRequest.call(this, newConfig);
    } catch (error) {
      return Promise.reject(error);          // 将同步错误转换为 rejected Promise
    }

    // 重置索引，准备处理响应拦截器
    i = 0;
    len = responseInterceptorChain.length;

    // 异步执行响应拦截器链（通过 Promise.then）
    while (i < len) {
      promise = promise.then(responseInterceptorChain[i++], responseInterceptorChain[i++]);
    }

    return promise;  // 返回最终的 Promise
  }

  // 获取请求的完整 URL（不发送请求），用于调试或日志记录
  getUri(config) {
    config = mergeConfig(this.defaults, config);  // 合并配置
    const fullPath = buildFullPath(config.baseURL, config.url, config.allowAbsoluteUrls);  // 构建完整路径
    return buildURL(fullPath, config.params, config.paramsSerializer);  // 添加查询参数并返回完整 URL
  }
}

// 为支持的 HTTP 方法提供别名（快捷方法），这些方法最终都会调用 this.request

// 不需要请求体的方法：delete、get、head、options
utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function (url, config) {
    return this.request(
      mergeConfig(config || {}, {
        method,            // HTTP 方法
        url,               // 请求 URL
        data: (config || {}).data,  // 保留可能的 data 配置（虽然这些方法通常不带请求体）
      })
    );
  };
});

// 需要请求体的方法：post、put、patch（支持普通请求和表单提交）
utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  // 生成 HTTP 方法函数，isForm 参数指示是否为表单提交
  function generateHTTPMethod(isForm) {
    return function httpMethod(url, data, config) {
      return this.request(
        mergeConfig(config || {}, {
          method,
          headers: isForm
            ? {
                'Content-Type': 'multipart/form-data',  // 表单提交时设置 Content-Type
              }
            : {},          // 非表单提交时使用默认头部
          url,
          data,            // 请求体数据
        })
      );
    };
  }

  // 为每个方法添加普通版本（如 post、put、patch）
  Axios.prototype[method] = generateHTTPMethod();
  // 为每个方法添加表单提交版本（如 postForm、putForm、patchForm）
  Axios.prototype[method + 'Form'] = generateHTTPMethod(true);
});

export default Axios;
