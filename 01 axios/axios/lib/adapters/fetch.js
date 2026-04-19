/**
 * @file Fetch API适配器
 * 
 * 功能：使用浏览器Fetch API实现HTTP客户端。
 * 这是axios在现代浏览器环境中的推荐适配器。
 * 
 * 设计特点：
 * 1. 现代API：基于Fetch API，支持Promise、Stream、AbortSignal等现代特性
 * 2. 流式支持：支持请求和响应流（ReadableStream）
 * 3. 进度跟踪：通过装饰器模式实现上传/下载进度事件
 * 4. 信号合成：支持多个取消信号（cancelToken + AbortSignal）
 * 5. 环境检测：运行时检测Fetch API和相关特性的可用性
 * 6. 回退机制：在不支持某些特性时优雅降级
 * 
 * 与XHR适配器的比较：
 * 1. 更现代的API设计
 * 2. 更好的流式处理支持
 * 3. 内置的AbortSignal支持
 * 4. 更简洁的代码结构
 * 5. 但不支持IE浏览器（需要polyfill）
 * 
 * 兼容性：需要现代浏览器或Node.js 18+（with fetch）
 */

import platform from '../platform/index.js';        // 平台检测
import utils from '../utils.js';                   // 工具函数
import AxiosError from '../core/AxiosError.js';    // 错误处理
import composeSignals from '../helpers/composeSignals.js';  // 信号合成
import { trackStream } from '../helpers/trackStream.js';    // 流跟踪
import AxiosHeaders from '../core/AxiosHeaders.js'; // 头部管理
import {
  progressEventReducer,
  progressEventDecorator,
  asyncDecorator,
} from '../helpers/progressEventReducer.js';  // 进度事件处理
import resolveConfig from '../helpers/resolveConfig.js';  // 配置解析
import settle from '../core/settle.js';        // Promise状态裁决

/**
 * 默认块大小（64KB）
 * 
 * 用于流式读取的块大小。较大的值可能提高性能，但增加内存使用。
 * 64KB是一个平衡值，适合大多数场景。
 */
const DEFAULT_CHUNK_SIZE = 64 * 1024;

// 从utils中解构常用函数，提高代码可读性
const { isFunction } = utils;

/**
 * 全局Fetch API提取
 * 
 * 设计目的：安全地从全局对象中提取Request和Response构造函数。
 * 使用IIFE和对象解构，避免在不受支持的环境中出现ReferenceError。
 * 
 * utils.global是跨平台的全局对象引用（window/global/self）。
 */
const globalFetchAPI = (({ Request, Response }) => ({
  Request,
  Response,
}))(utils.global);

/**
 * 全局API解构
 * 
 * 从全局对象中提取ReadableStream和TextEncoder。
 * 这些API在现代浏览器和Node.js 18+中可用。
 */
const { ReadableStream, TextEncoder } = utils.global;

/**
 * 安全测试函数
 * 
 * 功能：安全地测试函数是否可用且不抛出异常。
 * 
 * 设计目的：在特性检测中，某些API调用可能在不支持的环境中抛出异常。
 * 此函数封装try-catch逻辑，提供统一的测试接口。
 * 
 * @param {Function} fn - 要测试的函数
 * @param {...*} args - 函数参数
 * @returns {boolean} 函数是否成功执行且返回truthy值
 */
const test = (fn, ...args) => {
  try {
    return !!fn(...args);
  } catch (e) {
    return false;
  }
};

/**
 * Fetch适配器工厂函数
 * 
 * 功能：创建Fetch适配器实例或返回false（如果Fetch API不支持）。
 * 
 * 设计模式：工厂函数模式，支持环境注入和特性检测。
 * 
 * 工作流程：
 * 1. 合并环境配置：将传入的env与全局Fetch API合并
 * 2. 特性检测：检测Fetch、Request、Response、ReadableStream等API的可用性
 * 3. 能力检测：检测请求流、响应流等高级特性的支持情况
 * 4. 返回适配器：如果支持则返回适配器函数，否则返回false
 * 
 * 环境注入：允许测试环境或特殊环境提供自定义的Fetch实现。
 * 
 * @param {Object} env - 环境配置，可覆盖全局Fetch API
 * @returns {Function|boolean} Fetch适配器函数，或false（如果不支持）
 */
const factory = (env) => {
  // 合并环境配置：优先使用传入的env，回退到全局API
  // skipUndefined: true 忽略undefined值，避免覆盖已定义的API
  env = utils.merge.call(
    {
      skipUndefined: true,
    },
    globalFetchAPI,
    env
  );

  // 从环境中解构关键API
  const { fetch: envFetch, Request, Response } = env;
  
  // 特性检测：检查Fetch、Request、Response是否可用
  const isFetchSupported = envFetch ? isFunction(envFetch) : typeof fetch === 'function';
  const isRequestSupported = isFunction(Request);
  const isResponseSupported = isFunction(Response);

  // 如果Fetch API完全不可用，返回false（触发回退到其他适配器）
  if (!isFetchSupported) {
    return false;
  }

  const isReadableStreamSupported = isFetchSupported && isFunction(ReadableStream);

  const encodeText =
    isFetchSupported &&
    (typeof TextEncoder === 'function'
      ? (
          (encoder) => (str) =>
            encoder.encode(str)
        )(new TextEncoder())
      : async (str) => new Uint8Array(await new Request(str).arrayBuffer()));

  const supportsRequestStream =
    isRequestSupported &&
    isReadableStreamSupported &&
    test(() => {
      let duplexAccessed = false;

      const body = new ReadableStream();

      const hasContentType = new Request(platform.origin, {
        body,
        method: 'POST',
        get duplex() {
          duplexAccessed = true;
          return 'half';
        },
      }).headers.has('Content-Type');

      body.cancel();

      return duplexAccessed && !hasContentType;
    });

  const supportsResponseStream =
    isResponseSupported &&
    isReadableStreamSupported &&
    test(() => utils.isReadableStream(new Response('').body));

  const resolvers = {
    stream: supportsResponseStream && ((res) => res.body),
  };

  isFetchSupported &&
    (() => {
      ['text', 'arrayBuffer', 'blob', 'formData', 'stream'].forEach((type) => {
        !resolvers[type] &&
          (resolvers[type] = (res, config) => {
            let method = res && res[type];

            if (method) {
              return method.call(res);
            }

            throw new AxiosError(
              `Response type '${type}' is not supported`,
              AxiosError.ERR_NOT_SUPPORT,
              config
            );
          });
      });
    })();

  const getBodyLength = async (body) => {
    if (body == null) {
      return 0;
    }

    if (utils.isBlob(body)) {
      return body.size;
    }

    if (utils.isSpecCompliantForm(body)) {
      const _request = new Request(platform.origin, {
        method: 'POST',
        body,
      });
      return (await _request.arrayBuffer()).byteLength;
    }

    if (utils.isArrayBufferView(body) || utils.isArrayBuffer(body)) {
      return body.byteLength;
    }

    if (utils.isURLSearchParams(body)) {
      body = body + '';
    }

    if (utils.isString(body)) {
      return (await encodeText(body)).byteLength;
    }
  };

  const resolveBodyLength = async (headers, body) => {
    const length = utils.toFiniteNumber(headers.getContentLength());

    return length == null ? getBodyLength(body) : length;
  };

  return async (config) => {
    let {
      url,
      method,
      data,
      signal,
      cancelToken,
      timeout,
      onDownloadProgress,
      onUploadProgress,
      responseType,
      headers,
      withCredentials = 'same-origin',
      fetchOptions,
    } = resolveConfig(config);

    let _fetch = envFetch || fetch;

    responseType = responseType ? (responseType + '').toLowerCase() : 'text';

    let composedSignal = composeSignals(
      [signal, cancelToken && cancelToken.toAbortSignal()],
      timeout
    );

    let request = null;

    const unsubscribe =
      composedSignal &&
      composedSignal.unsubscribe &&
      (() => {
        composedSignal.unsubscribe();
      });

    let requestContentLength;

    try {
      if (
        onUploadProgress &&
        supportsRequestStream &&
        method !== 'get' &&
        method !== 'head' &&
        (requestContentLength = await resolveBodyLength(headers, data)) !== 0
      ) {
        let _request = new Request(url, {
          method: 'POST',
          body: data,
          duplex: 'half',
        });

        let contentTypeHeader;

        if (utils.isFormData(data) && (contentTypeHeader = _request.headers.get('content-type'))) {
          headers.setContentType(contentTypeHeader);
        }

        if (_request.body) {
          const [onProgress, flush] = progressEventDecorator(
            requestContentLength,
            progressEventReducer(asyncDecorator(onUploadProgress))
          );

          data = trackStream(_request.body, DEFAULT_CHUNK_SIZE, onProgress, flush);
        }
      }

      if (!utils.isString(withCredentials)) {
        withCredentials = withCredentials ? 'include' : 'omit';
      }

      // Cloudflare Workers throws when credentials are defined
      // see https://github.com/cloudflare/workerd/issues/902
      const isCredentialsSupported = isRequestSupported && 'credentials' in Request.prototype;

      const resolvedOptions = {
        ...fetchOptions,
        signal: composedSignal,
        method: method.toUpperCase(),
        headers: headers.normalize().toJSON(),
        body: data,
        duplex: 'half',
        credentials: isCredentialsSupported ? withCredentials : undefined,
      };

      request = isRequestSupported && new Request(url, resolvedOptions);

      let response = await (isRequestSupported
        ? _fetch(request, fetchOptions)
        : _fetch(url, resolvedOptions));

      const isStreamResponse =
        supportsResponseStream && (responseType === 'stream' || responseType === 'response');

      if (supportsResponseStream && (onDownloadProgress || (isStreamResponse && unsubscribe))) {
        const options = {};

        ['status', 'statusText', 'headers'].forEach((prop) => {
          options[prop] = response[prop];
        });

        const responseContentLength = utils.toFiniteNumber(response.headers.get('content-length'));

        const [onProgress, flush] =
          (onDownloadProgress &&
            progressEventDecorator(
              responseContentLength,
              progressEventReducer(asyncDecorator(onDownloadProgress), true)
            )) ||
          [];

        response = new Response(
          trackStream(response.body, DEFAULT_CHUNK_SIZE, onProgress, () => {
            flush && flush();
            unsubscribe && unsubscribe();
          }),
          options
        );
      }

      responseType = responseType || 'text';

      let responseData = await resolvers[utils.findKey(resolvers, responseType) || 'text'](
        response,
        config
      );

      !isStreamResponse && unsubscribe && unsubscribe();

      return await new Promise((resolve, reject) => {
        settle(resolve, reject, {
          data: responseData,
          headers: AxiosHeaders.from(response.headers),
          status: response.status,
          statusText: response.statusText,
          config,
          request,
        });
      });
    } catch (err) {
      unsubscribe && unsubscribe();

      if (err && err.name === 'TypeError' && /Load failed|fetch/i.test(err.message)) {
        throw Object.assign(
          new AxiosError(
            'Network Error',
            AxiosError.ERR_NETWORK,
            config,
            request,
            err && err.response
          ),
          {
            cause: err.cause || err,
          }
        );
      }

      throw AxiosError.from(err, err && err.code, config, request, err && err.response);
    }
  };
};

/**
 * 适配器种子缓存（单例模式）
 * 
 * 功能：缓存不同环境配置对应的Fetch适配器实例。
 * 设计目的：避免重复创建适配器实例，提高性能。
 * 使用嵌套Map结构存储：Request -> Response -> fetch -> adapter实例
 */
const seedCache = new Map();

/**
 * 获取Fetch适配器实例（缓存工厂函数）
 * 
 * 功能：根据配置获取对应的Fetch适配器实例，支持缓存和复用。
 * 设计模式：嵌套Map缓存 + 工厂函数模式。
 * 
 * 算法逻辑：
 * 1. 从配置中提取环境对象（env），包含fetch、Request、Response等API引用
 * 2. 构建种子数组：[Request, Response, fetch]，作为缓存键
 * 3. 遍历种子数组，在嵌套Map中查找或创建适配器实例
 * 4. 如果找到缓存，直接返回；否则调用factory函数创建新实例并缓存
 * 
 * 嵌套Map结构：Request -> Response -> fetch -> adapter实例
 * 这种设计确保不同环境配置（如测试环境、不同polyfill）使用独立的适配器实例。
 * 
 * @param {Object} config - axios配置对象，可包含env属性
 * @returns {Function|boolean} Fetch适配器函数，如果不支持Fetch API则返回false
 */
export const getFetch = (config) => {
  let env = (config && config.env) || {};
  const { fetch, Request, Response } = env;
  const seeds = [Request, Response, fetch];

  let len = seeds.length,
    i = len,
    seed,
    target,
    map = seedCache;

  while (i--) {
    seed = seeds[i];
    target = map.get(seed);

    target === undefined && map.set(seed, (target = i ? new Map() : factory(env)));

    map = target;
  }

  return target;
};

const adapter = getFetch();

export default adapter;
