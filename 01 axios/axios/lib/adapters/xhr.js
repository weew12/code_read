/**
 * @file XMLHttpRequest 适配器（浏览器环境核心适配器）
 * 
 * 功能：在浏览器环境中使用XMLHttpRequest发送HTTP请求。
 * 这是axios在浏览器环境中的主要适配器，支持现代浏览器的所有高级特性。
 * 
 * 架构特点：
 * 1. 基于Promise的异步封装：将XHR的回调风格转换为Promise
 * 2. 进度事件支持：上传/下载进度跟踪，支持节流控制
 * 3. 取消机制：支持CancelToken和AbortSignal两种取消方式
 * 4. 跨域支持：自动处理CORS相关头部和凭据
 * 5. 超时处理：请求超时自动取消
 * 6. 响应类型：支持text、json、arraybuffer、blob、document等响应类型
 * 7. 头部管理：使用AxiosHeaders进行规范的头部操作
 * 8. 错误处理：统一错误格式化为AxiosError
 * 
 * 设计模式：
 * 1. 适配器模式：统一HTTP客户端接口，隐藏XHR实现细节
 * 2. 观察者模式：通过事件监听器处理请求生命周期事件
 * 3. 装饰器模式：进度事件装饰器实现节流控制
 * 4. 工厂模式：根据环境支持情况动态导出适配器
 * 
 * 关键实现细节：
 * 1. onloadend模拟：在不支持onloadend的浏览器中使用onreadystatechange模拟
 * 2. 进度事件节流：避免进度回调过于频繁影响性能
 * 3. 请求取消清理：确保取消请求时正确清理事件监听器和资源
 * 4. 超时错误区分：根据配置区分连接超时和请求超时错误类型
 * 5. 响应数据处理：根据responseType正确处理响应内容
 * 
 * 浏览器兼容性：
 * - 支持所有现代浏览器（IE10+）
 * - 自动检测XMLHttpRequest可用性
 * - 优雅降级：在不支持XHR的环境中不导出此适配器
 */

import utils from '../utils.js';
import settle from '../core/settle.js';
import transitionalDefaults from '../defaults/transitional.js';
import AxiosError from '../core/AxiosError.js';
import CanceledError from '../cancel/CanceledError.js';
import parseProtocol from '../helpers/parseProtocol.js';
import platform from '../platform/index.js';
import AxiosHeaders from '../core/AxiosHeaders.js';
import { progressEventReducer } from '../helpers/progressEventReducer.js';
import resolveConfig from '../helpers/resolveConfig.js';

/**
 * XMLHttpRequest支持检测
 * 
 * 功能：检测当前浏览器环境是否支持XMLHttpRequest。
 * 这是浏览器适配器的前提条件，在不支持XHR的环境中（如Node.js、Service Worker），此适配器不会被导出。
 * 
 * 设计目的：实现条件导出，避免在不支持的环境中出现运行时错误。
 */
const isXHRAdapterSupported = typeof XMLHttpRequest !== 'undefined';

/**
 * XMLHttpRequest适配器（条件导出）
 * 
 * 功能：将axios配置转换为XMLHttpRequest请求，并返回Promise。
 * 这是适配器模式的浏览器端实现，与Node.js的http适配器形成对称设计。
 * 
 * 注意：此函数仅在isXHRAdapterSupported为true时导出，确保在不支持XHR的环境中不会加载。
 */
export default isXHRAdapterSupported &&
  function (config) {
    // 返回一个 Promise，封装 XMLHttpRequest 的异步操作
    return new Promise(function dispatchXhrRequest(resolve, reject) {
      const _config = resolveConfig(config);
      let requestData = _config.data;
      const requestHeaders = AxiosHeaders.from(_config.headers).normalize();
      let { responseType, onUploadProgress, onDownloadProgress } = _config;
      let onCanceled;
      let uploadThrottled, downloadThrottled;
      let flushUpload, flushDownload;

      /**
       * 请求完成清理函数
       * 
       * 功能：在请求完成（成功或失败）后执行清理操作。
       * 清理内容包括：
       * 1. 刷新进度事件：确保所有缓存的进度事件被触发
       * 2. 取消令牌清理：取消对cancelToken的订阅
       * 3. 信号清理：移除对AbortSignal的事件监听
       * 
       * 设计目的：防止内存泄漏，确保请求结束后所有事件监听器都被正确移除。
       * 此函数在settle函数的resolve/reject回调中被调用。
       */
      function done() {
        flushUpload && flushUpload(); // flush events
        flushDownload && flushDownload(); // flush events

        _config.cancelToken && _config.cancelToken.unsubscribe(onCanceled);

        _config.signal && _config.signal.removeEventListener('abort', onCanceled);
      }

      let request = new XMLHttpRequest();

      request.open(_config.method.toUpperCase(), _config.url, true);

      // Set the request timeout in MS
      request.timeout = _config.timeout;

      /**
       * 请求完成处理函数（onloadend事件处理器）
       * 
       * 功能：处理XMLHttpRequest请求的完成事件（无论成功或失败）。
       * 这是XHR请求生命周期的最终处理阶段，负责：
       * 1. 构建响应对象：从XHR对象提取状态、头部、数据
       * 2. 调用settle函数：根据HTTP状态码决定resolve或reject
       * 3. 清理资源：将request设为null，防止内存泄漏
       * 
       * 响应数据提取逻辑：
       * - 当responseType为text、json或未指定时：使用responseText（字符串）
       * - 其他responseType（arraybuffer、blob等）：使用response属性
       * 
       * 设计目的：统一处理请求完成逻辑，确保资源正确清理和Promise状态正确转换。
       */
      function onloadend() {
        if (!request) {
          return;
        }
        // Prepare the response
        const responseHeaders = AxiosHeaders.from(
          'getAllResponseHeaders' in request && request.getAllResponseHeaders()
        );
        const responseData =
          !responseType || responseType === 'text' || responseType === 'json'
            ? request.responseText
            : request.response;
        const response = {
          data: responseData,
          status: request.status,
          statusText: request.statusText,
          headers: responseHeaders,
          config,
          request,
        };

        settle(
          function _resolve(value) {
            resolve(value);
            done();
          },
          function _reject(err) {
            reject(err);
            done();
          },
          response
        );

        // Clean up request
        request = null;
      }

      if ('onloadend' in request) {
        // Use onloadend if available
        request.onloadend = onloadend;
      } else {
        // Listen for ready state to emulate onloadend
        request.onreadystatechange = function handleLoad() {
          if (!request || request.readyState !== 4) {
            return;
          }

          // The request errored out and we didn't get a response, this will be
          // handled by onerror instead
          // With one exception: request that using file: protocol, most browsers
          // will return status as 0 even though it's a successful request
          if (
            request.status === 0 &&
            !(request.responseURL && request.responseURL.indexOf('file:') === 0)
          ) {
            return;
          }
          // readystate handler is calling before onerror or ontimeout handlers,
          // so we should call onloadend on the next 'tick'
          setTimeout(onloadend);
        };
      }

      /**
       * 请求中止事件处理函数（onabort）
       * 
       * 功能：处理浏览器发起的请求中止（如用户导航离开页面）。
       * 这与手动取消（通过cancelToken或AbortSignal）不同，是浏览器自动触发的。
       * 
       * 错误类型：ECONNABORTED（连接中止）
       * 设计目的：区分浏览器中止和用户取消，提供更准确的错误信息。
       */
      request.onabort = function handleAbort() {
        if (!request) {
          return;
        }

        reject(new AxiosError('Request aborted', AxiosError.ECONNABORTED, config, request));

        // Clean up request
        request = null;
      };

      /**
       * 网络错误事件处理函数（onerror）
       * 
       * 功能：处理底层网络错误（如DNS解析失败、CORS错误、连接拒绝等）。
       * 浏览器在XHR onerror事件中传递ProgressEvent对象，可能包含错误信息。
       * 
       * 错误类型：ERR_NETWORK（网络错误）
       * 错误信息：优先使用event.message，否则使用默认的'Network Error'
       * 事件附加：将原始ProgressEvent附加到错误对象上，供需要详细信息的消费者使用
       * 
       * 参考：https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/error_event
       */
      request.onerror = function handleError(event) {
        // Browsers deliver a ProgressEvent in XHR onerror
        // (message may be empty; when present, surface it)
        // See https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/error_event
        const msg = event && event.message ? event.message : 'Network Error';
        const err = new AxiosError(msg, AxiosError.ERR_NETWORK, config, request);
        // attach the underlying event for consumers who want details
        err.event = event || null;
        reject(err);
        request = null;
      };

      /**
       * 请求超时事件处理函数（ontimeout）
       * 
       * 功能：处理请求超时事件（在config.timeout指定的时间内未收到响应）。
       * 超时错误类型可根据transitional配置选择：
       * - clarifyTimeoutError为true：ETIMEDOUT（明确超时错误）
       * - clarifyTimeoutError为false：ECONNABORTED（连接中止，历史兼容性）
       * 
       * 错误信息优先级：
       * 1. 用户自定义的timeoutErrorMessage配置
       * 2. 根据timeout值生成的默认消息
       * 
       * 设计目的：提供清晰的超时错误信息，同时支持历史兼容性配置。
       */
      request.ontimeout = function handleTimeout() {
        let timeoutErrorMessage = _config.timeout
          ? 'timeout of ' + _config.timeout + 'ms exceeded'
          : 'timeout exceeded';
        const transitional = _config.transitional || transitionalDefaults;
        if (_config.timeoutErrorMessage) {
          timeoutErrorMessage = _config.timeoutErrorMessage;
        }
        reject(
          new AxiosError(
            timeoutErrorMessage,
            transitional.clarifyTimeoutError ? AxiosError.ETIMEDOUT : AxiosError.ECONNABORTED,
            config,
            request
          )
        );

        // Clean up request
        request = null;
      };

      // Remove Content-Type if data is undefined
      requestData === undefined && requestHeaders.setContentType(null);

      // Add headers to the request
      if ('setRequestHeader' in request) {
        utils.forEach(requestHeaders.toJSON(), function setRequestHeader(val, key) {
          request.setRequestHeader(key, val);
        });
      }

      // Add withCredentials to request if needed
      if (!utils.isUndefined(_config.withCredentials)) {
        request.withCredentials = !!_config.withCredentials;
      }

      // Add responseType to request if needed
      if (responseType && responseType !== 'json') {
        request.responseType = _config.responseType;
      }

      // Handle progress if needed
      if (onDownloadProgress) {
        [downloadThrottled, flushDownload] = progressEventReducer(onDownloadProgress, true);
        request.addEventListener('progress', downloadThrottled);
      }

      // Not all browsers support upload events
      if (onUploadProgress && request.upload) {
        [uploadThrottled, flushUpload] = progressEventReducer(onUploadProgress);

        request.upload.addEventListener('progress', uploadThrottled);

        request.upload.addEventListener('loadend', flushUpload);
      }

      if (_config.cancelToken || _config.signal) {
        // Handle cancellation
        // eslint-disable-next-line func-names
        onCanceled = (cancel) => {
          if (!request) {
            return;
          }
          reject(!cancel || cancel.type ? new CanceledError(null, config, request) : cancel);
          request.abort();
          request = null;
        };

        _config.cancelToken && _config.cancelToken.subscribe(onCanceled);
        if (_config.signal) {
          _config.signal.aborted
            ? onCanceled()
            : _config.signal.addEventListener('abort', onCanceled);
        }
      }

      const protocol = parseProtocol(_config.url);

      if (protocol && platform.protocols.indexOf(protocol) === -1) {
        reject(
          new AxiosError(
            'Unsupported protocol ' + protocol + ':',
            AxiosError.ERR_BAD_REQUEST,
            config
          )
        );
        return;
      }

      // Send the request
      request.send(requestData || null);
    });
  };
