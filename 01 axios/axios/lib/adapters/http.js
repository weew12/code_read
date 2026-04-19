/**
 * @file Node.js HTTP适配器
 * 
 * 功能：axios在Node.js环境下的HTTP客户端实现。
 * 这是axios最复杂的模块之一，支持完整的HTTP/HTTPS/HTTP2协议栈。
 * 
 * 架构特点：
 * 1. 多协议支持：HTTP、HTTPS、HTTP/2
 * 2. 代理支持：自动从环境变量检测代理配置
 * 3. 重定向处理：使用follow-redirects库自动处理重定向
 * 4. 压缩解压：支持gzip、deflate、brotli等压缩算法
 * 5. 流式处理：支持大文件上传下载的流式处理
 * 6. HTTP/2会话管理：连接池和会话复用
 * 7. 进度事件：上传/下载进度跟踪
 * 8. 超时处理：连接超时、响应超时、socket超时
 * 9. 安全性：TLS/SSL配置、证书验证
 * 
 * 设计模式：
 * 1. 适配器模式：实现统一的HTTP客户端接口
 * 2. 观察者模式：事件驱动的请求/响应处理
 * 3. 连接池模式：HTTP/2会话复用
 * 4. 装饰器模式：进度事件装饰器
 * 
 * 模块依赖：
 * - Node.js内置模块：http, https, http2, stream, zlib, util
 * - 第三方库：follow-redirects, proxy-from-env
 * - axios内部模块：工具函数、错误处理、配置管理等
 */

import utils from '../utils.js';
import settle from '../core/settle.js';
import buildFullPath from '../core/buildFullPath.js';
import buildURL from '../helpers/buildURL.js';
import { getProxyForUrl } from 'proxy-from-env';  // 代理检测库
import http from 'http';        // Node.js HTTP模块
import https from 'https';      // Node.js HTTPS模块
import http2 from 'http2';      // Node.js HTTP/2模块
import util from 'util';        // Node.js工具模块
import followRedirects from 'follow-redirects';  // 重定向处理库
import zlib from 'zlib';        // 压缩解压模块
import { VERSION } from '../env/data.js';        // axios版本信息
import transitionalDefaults from '../defaults/transitional.js';  // 过渡性配置
import AxiosError from '../core/AxiosError.js';  // 错误处理
import CanceledError from '../cancel/CanceledError.js';  // 取消错误
import platform from '../platform/index.js';      // 平台检测
import fromDataURI from '../helpers/fromDataURI.js';  // Data URI解析
import stream from 'stream';    // Node.js流模块
import AxiosHeaders from '../core/AxiosHeaders.js';  // 头部管理
import AxiosTransformStream from '../helpers/AxiosTransformStream.js';  // 流转换
import { EventEmitter } from 'events';  // 事件发射器
import formDataToStream from '../helpers/formDataToStream.js';  // FormData转流
import readBlob from '../helpers/readBlob.js';  // Blob读取
import ZlibHeaderTransformStream from '../helpers/ZlibHeaderTransformStream.js';  // 压缩头部处理
import callbackify from '../helpers/callbackify.js';  // 回调风格转换
import {
  progressEventReducer,
  progressEventDecorator,
  asyncDecorator,
} from '../helpers/progressEventReducer.js';  // 进度事件处理
import estimateDataURLDecodedBytes from '../helpers/estimateDataURLDecodedBytes.js';  // Data URI大小估算

/**
 * zlib解压选项配置
 * 
 * 设计目的：配置gzip/deflate解压器的刷新行为，确保数据完整性。
 * Z_SYNC_FLUSH模式：每次解压后同步刷新输出，避免数据丢失。
 */
const zlibOptions = {
  flush: zlib.constants.Z_SYNC_FLUSH,
  finishFlush: zlib.constants.Z_SYNC_FLUSH,
};

/**
 * Brotli解压选项配置
 * 
 * Brotli是Google开发的高效压缩算法，需要专门的配置选项。
 * 这些常量确保Brotli解压器正确刷新输出缓冲区。
 */
const brotliOptions = {
  flush: zlib.constants.BROTLI_OPERATION_FLUSH,
  finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH,
};

/**
 * Brotli支持检测
 * 
 * 设计目的：运行时检测Node.js版本是否支持Brotli压缩。
 * Node.js v10.16.0+ 引入了zlib.createBrotliDecompress函数。
 * 此检测确保在不支持的版本上优雅降级。
 */
const isBrotliSupported = utils.isFunction(zlib.createBrotliDecompress);

/**
 * 重定向处理模块别名
 * 
 * follow-redirects库提供了自动处理HTTP重定向的功能。
 * 这里解构出http和https的重定向版本，用于替换原生的http/https模块。
 */
const { http: httpFollow, https: httpsFollow } = followRedirects;

/**
 * HTTPS协议检测正则表达式
 * 
 * 用于检测URL协议是否为HTTPS（支持"https:"和"https"格式）。
 * 这决定使用http模块还是https模块发起请求。
 */
const isHttps = /https:?/;

/**
 * 支持的协议列表
 * 
 * 从平台配置中获取支持的协议，并添加冒号后缀。
 * 用于验证请求URL的协议是否受支持。
 */
const supportedProtocols = platform.protocols.map((protocol) => {
  return protocol + ':';
});

/**
 * 流结束刷新工具函数
 * 
 * 设计目的：确保流在结束或出错时触发进度事件刷新。
 * 用于进度跟踪系统，避免进度事件在流结束时被遗漏。
 * 
 * @param {stream} stream - Node.js流对象
 * @param {Array} throttledFlushPair - [节流函数, 刷新函数]对
 * @returns {Function} 节流函数（便于链式调用）
 */
const flushOnFinish = (stream, [throttled, flush]) => {
  stream.on('end', flush).on('error', flush);

  return throttled;
};

/**
 * HTTP/2会话管理器
 * 
 * 设计目的：管理和复用HTTP/2连接，减少连接建立开销。
 * 
 * HTTP/2特性：
 * 1. 多路复用：单个连接可以并行处理多个请求
 * 2. 头部压缩：减少请求头大小
 * 3. 服务器推送：服务器可以主动推送资源
 * 
 * 会话管理策略：
 * 1. 按authority（主机+端口）组织会话
 * 2. 检查会话是否可用（未销毁、未关闭）
 * 3. 支持会话超时自动清理
 * 4. 支持配置深度比较确保会话兼容性
 * 
 * 性能优化：通过会话复用避免每次请求都建立新的TLS握手。
 */
class Http2Sessions {
  /**
   * 构造函数
   * 
   * 初始化会话存储结构。
   * 使用Object.create(null)创建无原型链的纯净对象，避免原型污染。
   */
  constructor() {
    this.sessions = Object.create(null);
  }

  /**
   * 获取或创建HTTP/2会话
   * 
   * 算法逻辑：
   * 1. 根据authority查找现有会话池
   * 2. 遍历会话池，查找可用的会话（未销毁、未关闭、配置相同）
   * 3. 如果找到可用会话，直接返回
   * 4. 否则创建新会话，添加到会话池，设置清理逻辑
   * 
   * 会话复用条件：
   * 1. 会话未销毁（!sessionHandle.destroyed）
   * 2. 会话未关闭（!sessionHandle.closed）
   * 3. 会话配置相同（util.isDeepStrictEqual比较）
   * 
   * @param {string} authority - 授权机构（格式：主机:端口）
   * @param {Object} options - HTTP/2会话选项
   * @returns {http2.ClientHttp2Session} HTTP/2会话对象
   */
  getSession(authority, options) {
    options = Object.assign(
      {
        sessionTimeout: 1000,
      },
      options
    );

    let authoritySessions = this.sessions[authority];

    if (authoritySessions) {
      let len = authoritySessions.length;

      for (let i = 0; i < len; i++) {
        const [sessionHandle, sessionOptions] = authoritySessions[i];
        if (
          !sessionHandle.destroyed &&
          !sessionHandle.closed &&
          util.isDeepStrictEqual(sessionOptions, options)
        ) {
          return sessionHandle;
        }
      }
    }

    const session = http2.connect(authority, options);

    let removed;

    const removeSession = () => {
      if (removed) {
        return;
      }

      removed = true;

      let entries = authoritySessions,
        len = entries.length,
        i = len;

      while (i--) {
        if (entries[i][0] === session) {
          if (len === 1) {
            delete this.sessions[authority];
          } else {
            entries.splice(i, 1);
          }
          if (!session.closed) {
            session.close();
          }
          return;
        }
      }
    };

    const originalRequestFn = session.request;

    const { sessionTimeout } = options;

    if (sessionTimeout != null) {
      let timer;
      let streamsCount = 0;

      session.request = function () {
        const stream = originalRequestFn.apply(this, arguments);

        streamsCount++;

        if (timer) {
          clearTimeout(timer);
          timer = null;
        }

        stream.once('close', () => {
          if (!--streamsCount) {
            timer = setTimeout(() => {
              timer = null;
              removeSession();
            }, sessionTimeout);
          }
        });

        return stream;
      };
    }

    session.once('close', removeSession);

    let entry = [session, options];

    authoritySessions
      ? authoritySessions.push(entry)
      : (authoritySessions = this.sessions[authority] = [entry]);

    return session;
  }
}

const http2Sessions = new Http2Sessions();

/**
 * 重定向前回调分发函数
 * 
 * 设计目的：在HTTP重定向发生前，执行用户配置的回调函数。
 * 这些回调可以修改重定向请求的配置，或执行自定义逻辑。
 * 
 * 支持的回调类型：
 * 1. beforeRedirects.proxy: 代理重定向回调（处理代理配置）
 * 2. beforeRedirects.config: 配置重定向回调（处理通用配置）
 * 
 * 调用时机：follow-redirects库在发起重定向请求前调用此函数。
 * 
 * @param {Object<string, any>} options - 请求选项对象
 * @param {Object} responseDetails - 响应详情（状态码、头部等）
 * @returns {Object<string, any>} 未修改的选项对象
 */
function dispatchBeforeRedirect(options, responseDetails) {
  if (options.beforeRedirects.proxy) {
    options.beforeRedirects.proxy(options);
  }
  if (options.beforeRedirects.config) {
    options.beforeRedirects.config(options, responseDetails);
  }
}

/**
 * 代理配置函数
 * 
 * 功能：根据axios配置和环境变量设置HTTP代理。
 * 
 * 代理配置来源（按优先级）：
 * 1. 直接配置：config.proxy（axios配置中的proxy选项）
 * 2. 环境变量：通过proxy-from-env库自动检测
 * 3. 显式禁用：proxy: false 表示明确不使用代理
 * 
 * 代理认证支持：
 * 1. 基础认证：proxy.username / proxy.password
 * 2. 认证对象：proxy.auth { username, password }
 * 3. 自动生成Proxy-Authorization头部（Base64编码）
 * 
 * 代理重定向处理：设置beforeRedirects.proxy回调，确保重定向请求也使用相同的代理配置。
 * 
 * @param {http.ClientRequestArgs} options - Node.js HTTP客户端选项
 * @param {AxiosProxyConfig} configProxy - axios配置中的代理设置
 * @param {string} location - 请求URL路径
 * @returns {http.ClientRequestArgs} 更新后的选项对象
 */
function setProxy(options, configProxy, location) {
  let proxy = configProxy;
  if (!proxy && proxy !== false) {
    const proxyUrl = getProxyForUrl(location);
    if (proxyUrl) {
      proxy = new URL(proxyUrl);
    }
  }
  if (proxy) {
    // Basic proxy authorization
    if (proxy.username) {
      proxy.auth = (proxy.username || '') + ':' + (proxy.password || '');
    }

    if (proxy.auth) {
      // Support proxy auth object form
      const validProxyAuth = Boolean(proxy.auth.username || proxy.auth.password);

      if (validProxyAuth) {
        proxy.auth = (proxy.auth.username || '') + ':' + (proxy.auth.password || '');
      } else if (typeof proxy.auth === 'object') {
        throw new AxiosError('Invalid proxy authorization', AxiosError.ERR_BAD_OPTION, { proxy });
      }

      const base64 = Buffer.from(proxy.auth, 'utf8').toString('base64');

      options.headers['Proxy-Authorization'] = 'Basic ' + base64;
    }

    options.headers.host = options.hostname + (options.port ? ':' + options.port : '');
    const proxyHost = proxy.hostname || proxy.host;
    options.hostname = proxyHost;
    // Replace 'host' since options is not a URL object
    options.host = proxyHost;
    options.port = proxy.port;
    options.path = location;
    if (proxy.protocol) {
      options.protocol = proxy.protocol.includes(':') ? proxy.protocol : `${proxy.protocol}:`;
    }
  }

  options.beforeRedirects.proxy = function beforeRedirect(redirectOptions) {
    // Configure proxy for redirected request, passing the original config proxy to apply
    // the exact same logic as if the redirected request was performed by axios directly.
    setProxy(redirectOptions, configProxy, redirectOptions.href);
  };
}

/**
 * Node.js环境适配器支持检测
 * 
 * 检测逻辑：
 * 1. 检查全局process对象是否存在（Node.js环境特征）
 * 2. 检查process对象的类型是否为'process'（排除伪造对象）
 * 
 * 设计目的：确保此适配器只在Node.js环境中运行。
 * 在浏览器环境中，应使用xhr或fetch适配器。
 */
const isHttpAdapterSupported =
  typeof process !== 'undefined' && utils.kindOf(process) === 'process';

/**
 * 异步执行器包装函数（临时修复）
 * 
 * 功能：将异步执行器包装为Promise，提供完成回调机制。
 * 
 * 设计目的：处理需要知道Promise何时"完成"的场景。
 * 通过onDone回调，外部代码可以知道Promise已解决或拒绝。
 * 
 * 使用场景：在适配器中，需要确保所有清理操作在Promise完成后执行。
 * 
 * @param {Function} asyncExecutor - 异步执行器函数，接收(resolve, reject, onDone)参数
 * @returns {Promise} 包装后的Promise
 */
const wrapAsync = (asyncExecutor) => {
  return new Promise((resolve, reject) => {
    let onDone;
    let isDone;

    const done = (value, isRejected) => {
      if (isDone) return;
      isDone = true;
      onDone && onDone(value, isRejected);
    };

    const _resolve = (value) => {
      done(value);
      resolve(value);
    };

    const _reject = (reason) => {
      done(reason, true);
      reject(reason);
    };

    asyncExecutor(_resolve, _reject, (onDoneHandler) => (onDone = onDoneHandler)).catch(_reject);
  });
};

/**
 * 解析地址族（IPv4/IPv6）
 * 
 * 功能：标准化地址对象，确保包含address和family字段。
 * 如果未提供family，根据地址格式自动推断：
 * 1. 地址包含点号('.') -> IPv4地址 (family = 4)
 * 2. 地址不包含点号 -> IPv6地址 (family = 6)
 * 
 * 设计目的：统一处理DNS查找返回的地址格式，支持Node.js的dns.lookup函数。
 * 
 * @param {Object} param0 - 地址参数对象
 * @param {string} param0.address - IP地址字符串
 * @param {number} [param0.family] - 地址族（4=IPv4, 6=IPv6）
 * @returns {Object} 标准化的地址对象 { address: string, family: number }
 */
const resolveFamily = ({ address, family }) => {
  if (!utils.isString(address)) {
    throw TypeError('address must be a string');
  }
  return {
    address,
    family: family || (address.indexOf('.') < 0 ? 6 : 4),
  };
};

/**
 * 构建标准地址条目
 * 
 * 功能：将地址参数转换为标准化的地址对象。
 * 支持两种输入格式：
 * 1. 对象格式：{ address: string, family?: number } - 直接传递给resolveFamily
 * 2. 分离格式：(address: string, family?: number) - 组合成对象后传递
 * 
 * 设计目的：提供灵活的API，兼容Node.js dns.lookup函数的多种返回值格式。
 * 
 * @param {string|Object} address - IP地址字符串或地址对象
 * @param {number} [family] - 地址族（4=IPv4, 6=IPv6）
 * @returns {Object} 标准化的地址对象 { address: string, family: number }
 */
const buildAddressEntry = (address, family) =>
  resolveFamily(utils.isObject(address) ? address : { address, family });

/**
 * HTTP/2传输适配器
 * 
 * 功能：提供与Node.js HTTP/2模块兼容的传输层实现。
 * 这是http2模块的薄封装，与http2Sessions管理器集成，实现会话复用。
 * 
 * 设计特点：
 * 1. 会话复用：通过http2Sessions.getSession复用HTTP/2连接
 * 2. 头部映射：将HTTP/1.1风格的头部转换为HTTP/2专用头部格式
 * 3. 双工流：HTTP/2请求/响应使用同一个双工流对象
 * 4. 响应转换：将HTTP/2响应转换为类似HTTP/1.1的响应格式
 * 
 * HTTP/2专用头部：
 * - :scheme: 协议（http/https）
 * - :method: HTTP方法
 * - :path: 请求路径
 * - :status: 状态码（响应头）
 * 
 * 注意：HTTP/2禁止使用以':'开头的伪头部作为普通头部，因此过滤掉这些头部。
 */
const http2Transport = {
  /**
   * HTTP/2请求方法
   * 
   * 执行流程：
   * 1. 构建authority标识符（协议://主机:端口）
   * 2. 从http2Sessions获取或创建会话
   * 3. 构建HTTP/2专用头部（:scheme, :method, :path）
   * 4. 合并用户自定义头部（过滤伪头部）
   * 5. 通过会话发起请求，监听响应事件
   * 6. 转换响应格式，回调给上层
   * 
   * @param {Object} options - 请求选项（协议、主机名、端口、方法、路径、头部等）
   * @param {Function} cb - 回调函数，接收响应对象
   * @returns {http2.ClientHttp2Stream} HTTP/2流对象
   */
  request(options, cb) {
    const authority =
      options.protocol +
      '//' +
      options.hostname +
      ':' +
      (options.port || (options.protocol === 'https:' ? 443 : 80));

    const { http2Options, headers } = options;

    const session = http2Sessions.getSession(authority, http2Options);

    const { HTTP2_HEADER_SCHEME, HTTP2_HEADER_METHOD, HTTP2_HEADER_PATH, HTTP2_HEADER_STATUS } =
      http2.constants;

    const http2Headers = {
      [HTTP2_HEADER_SCHEME]: options.protocol.replace(':', ''),
      [HTTP2_HEADER_METHOD]: options.method,
      [HTTP2_HEADER_PATH]: options.path,
    };

    utils.forEach(headers, (header, name) => {
      name.charAt(0) !== ':' && (http2Headers[name] = header);
    });

    const req = session.request(http2Headers);

    req.once('response', (responseHeaders) => {
      const response = req; //duplex

      responseHeaders = Object.assign({}, responseHeaders);

      const status = responseHeaders[HTTP2_HEADER_STATUS];

      delete responseHeaders[HTTP2_HEADER_STATUS];

      response.headers = responseHeaders;

      response.statusCode = +status;

      cb(response);
    });

    return req;
  },
};

/*eslint consistent-return:0*/

/**
 * Node.js HTTP适配器主函数
 * 
 * 功能：axios在Node.js环境下的核心HTTP客户端实现。
 * 这是适配器模式的最终实现，负责将axios配置转换为Node.js HTTP请求。
 * 
 * 执行流程概览：
 * 1. 环境检测：确保在Node.js环境中运行
 * 2. 配置解析：处理URL、协议、代理、超时等配置
 * 3. 协议选择：根据配置选择HTTP/1.1或HTTP/2
 * 4. 请求构建：使用Node.js http/https/http2模块构建请求
 * 5. 数据发送：处理请求体数据（Buffer、流、FormData等）
 * 6. 响应处理：处理响应流、解压、进度事件、超时等
 * 7. 错误处理：统一错误格式化为AxiosError
 * 8. 清理工作：取消令牌、信号、事件监听器等
 * 
 * 设计特点：
 * 1. 异步包装：使用wrapAsync确保正确的完成回调机制
 * 2. 协议透明：统一处理HTTP/1.1和HTTP/2，上层无感知
 * 3. 流式处理：支持大文件上传下载，内存友好
 * 4. 进度跟踪：实时跟踪上传/下载进度
 * 5. 取消支持：通过CancelToken和AbortSignal支持请求取消
 * 6. 重定向处理：自动处理HTTP重定向（follow-redirects库）
 * 7. 压缩解压：自动处理gzip/deflate/brotli压缩
 * 8. 代理支持：支持HTTP代理和代理认证
 * 
 * @param {Object} config - axios配置对象
 * @returns {Promise} 请求Promise，resolve时返回响应对象，reject时返回AxiosError
 */
export default isHttpAdapterSupported &&
  function httpAdapter(config) {
    return wrapAsync(async function dispatchHttpRequest(resolve, reject, onDone) {
      let { data, lookup, family, httpVersion = 1, http2Options } = config;
      const { responseType, responseEncoding } = config;
      const method = config.method.toUpperCase();
      let isDone;
      let rejected = false;
      let req;

      httpVersion = +httpVersion;

      if (Number.isNaN(httpVersion)) {
        throw TypeError(`Invalid protocol version: '${config.httpVersion}' is not a number`);
      }

      if (httpVersion !== 1 && httpVersion !== 2) {
        throw TypeError(`Unsupported protocol version '${httpVersion}'`);
      }

      const isHttp2 = httpVersion === 2;

      if (lookup) {
        const _lookup = callbackify(lookup, (value) => (utils.isArray(value) ? value : [value]));
        // hotfix to support opt.all option which is required for node 20.x
        lookup = (hostname, opt, cb) => {
          _lookup(hostname, opt, (err, arg0, arg1) => {
            if (err) {
              return cb(err);
            }

            const addresses = utils.isArray(arg0)
              ? arg0.map((addr) => buildAddressEntry(addr))
              : [buildAddressEntry(arg0, arg1)];

            opt.all ? cb(err, addresses) : cb(err, addresses[0].address, addresses[0].family);
          });
        };
      }

      const abortEmitter = new EventEmitter();

      function abort(reason) {
        try {
          abortEmitter.emit(
            'abort',
            !reason || reason.type ? new CanceledError(null, config, req) : reason
          );
        } catch (err) {
          console.warn('emit error', err);
        }
      }

      abortEmitter.once('abort', reject);

      const onFinished = () => {
        if (config.cancelToken) {
          config.cancelToken.unsubscribe(abort);
        }

        if (config.signal) {
          config.signal.removeEventListener('abort', abort);
        }

        abortEmitter.removeAllListeners();
      };

      if (config.cancelToken || config.signal) {
        config.cancelToken && config.cancelToken.subscribe(abort);
        if (config.signal) {
          config.signal.aborted ? abort() : config.signal.addEventListener('abort', abort);
        }
      }

      onDone((response, isRejected) => {
        isDone = true;

        if (isRejected) {
          rejected = true;
          onFinished();
          return;
        }

        const { data } = response;

        if (data instanceof stream.Readable || data instanceof stream.Duplex) {
          const offListeners = stream.finished(data, () => {
            offListeners();
            onFinished();
          });
        } else {
          onFinished();
        }
      });

      // Parse url
      const fullPath = buildFullPath(config.baseURL, config.url, config.allowAbsoluteUrls);
      const parsed = new URL(fullPath, platform.hasBrowserEnv ? platform.origin : undefined);
      const protocol = parsed.protocol || supportedProtocols[0];

      if (protocol === 'data:') {
        // Apply the same semantics as HTTP: only enforce if a finite, non-negative cap is set.
        if (config.maxContentLength > -1) {
          // Use the exact string passed to fromDataURI (config.url); fall back to fullPath if needed.
          const dataUrl = String(config.url || fullPath || '');
          const estimated = estimateDataURLDecodedBytes(dataUrl);

          if (estimated > config.maxContentLength) {
            return reject(
              new AxiosError(
                'maxContentLength size of ' + config.maxContentLength + ' exceeded',
                AxiosError.ERR_BAD_RESPONSE,
                config
              )
            );
          }
        }

        let convertedData;

        if (method !== 'GET') {
          return settle(resolve, reject, {
            status: 405,
            statusText: 'method not allowed',
            headers: {},
            config,
          });
        }

        try {
          convertedData = fromDataURI(config.url, responseType === 'blob', {
            Blob: config.env && config.env.Blob,
          });
        } catch (err) {
          throw AxiosError.from(err, AxiosError.ERR_BAD_REQUEST, config);
        }

        if (responseType === 'text') {
          convertedData = convertedData.toString(responseEncoding);

          if (!responseEncoding || responseEncoding === 'utf8') {
            convertedData = utils.stripBOM(convertedData);
          }
        } else if (responseType === 'stream') {
          convertedData = stream.Readable.from(convertedData);
        }

        return settle(resolve, reject, {
          data: convertedData,
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
        });
      }

      if (supportedProtocols.indexOf(protocol) === -1) {
        return reject(
          new AxiosError('Unsupported protocol ' + protocol, AxiosError.ERR_BAD_REQUEST, config)
        );
      }

      const headers = AxiosHeaders.from(config.headers).normalize();

      // Set User-Agent (required by some servers)
      // See https://github.com/axios/axios/issues/69
      // User-Agent is specified; handle case where no UA header is desired
      // Only set header if it hasn't been set in config
      headers.set('User-Agent', 'axios/' + VERSION, false);

      const { onUploadProgress, onDownloadProgress } = config;
      const maxRate = config.maxRate;
      let maxUploadRate = undefined;
      let maxDownloadRate = undefined;

      // support for spec compliant FormData objects
      if (utils.isSpecCompliantForm(data)) {
        const userBoundary = headers.getContentType(/boundary=([-_\w\d]{10,70})/i);

        data = formDataToStream(
          data,
          (formHeaders) => {
            headers.set(formHeaders);
          },
          {
            tag: `axios-${VERSION}-boundary`,
            boundary: (userBoundary && userBoundary[1]) || undefined,
          }
        );
        // support for https://www.npmjs.com/package/form-data api
      } else if (utils.isFormData(data) && utils.isFunction(data.getHeaders)) {
        headers.set(data.getHeaders());

        if (!headers.hasContentLength()) {
          try {
            const knownLength = await util.promisify(data.getLength).call(data);
            Number.isFinite(knownLength) &&
              knownLength >= 0 &&
              headers.setContentLength(knownLength);
            /*eslint no-empty:0*/
          } catch (e) {}
        }
      } else if (utils.isBlob(data) || utils.isFile(data)) {
        data.size && headers.setContentType(data.type || 'application/octet-stream');
        headers.setContentLength(data.size || 0);
        data = stream.Readable.from(readBlob(data));
      } else if (data && !utils.isStream(data)) {
        if (Buffer.isBuffer(data)) {
          // Nothing to do...
        } else if (utils.isArrayBuffer(data)) {
          data = Buffer.from(new Uint8Array(data));
        } else if (utils.isString(data)) {
          data = Buffer.from(data, 'utf-8');
        } else {
          return reject(
            new AxiosError(
              'Data after transformation must be a string, an ArrayBuffer, a Buffer, or a Stream',
              AxiosError.ERR_BAD_REQUEST,
              config
            )
          );
        }

        // Add Content-Length header if data exists
        headers.setContentLength(data.length, false);

        if (config.maxBodyLength > -1 && data.length > config.maxBodyLength) {
          return reject(
            new AxiosError(
              'Request body larger than maxBodyLength limit',
              AxiosError.ERR_BAD_REQUEST,
              config
            )
          );
        }
      }

      const contentLength = utils.toFiniteNumber(headers.getContentLength());

      if (utils.isArray(maxRate)) {
        maxUploadRate = maxRate[0];
        maxDownloadRate = maxRate[1];
      } else {
        maxUploadRate = maxDownloadRate = maxRate;
      }

      if (data && (onUploadProgress || maxUploadRate)) {
        if (!utils.isStream(data)) {
          data = stream.Readable.from(data, { objectMode: false });
        }

        data = stream.pipeline(
          [
            data,
            new AxiosTransformStream({
              maxRate: utils.toFiniteNumber(maxUploadRate),
            }),
          ],
          utils.noop
        );

        onUploadProgress &&
          data.on(
            'progress',
            flushOnFinish(
              data,
              progressEventDecorator(
                contentLength,
                progressEventReducer(asyncDecorator(onUploadProgress), false, 3)
              )
            )
          );
      }

      // HTTP basic authentication
      let auth = undefined;
      if (config.auth) {
        const username = config.auth.username || '';
        const password = config.auth.password || '';
        auth = username + ':' + password;
      }

      if (!auth && parsed.username) {
        const urlUsername = parsed.username;
        const urlPassword = parsed.password;
        auth = urlUsername + ':' + urlPassword;
      }

      auth && headers.delete('authorization');

      let path;

      try {
        path = buildURL(
          parsed.pathname + parsed.search,
          config.params,
          config.paramsSerializer
        ).replace(/^\?/, '');
      } catch (err) {
        const customErr = new Error(err.message);
        customErr.config = config;
        customErr.url = config.url;
        customErr.exists = true;
        return reject(customErr);
      }

      headers.set(
        'Accept-Encoding',
        'gzip, compress, deflate' + (isBrotliSupported ? ', br' : ''),
        false
      );

      const options = {
        path,
        method: method,
        headers: headers.toJSON(),
        agents: { http: config.httpAgent, https: config.httpsAgent },
        auth,
        protocol,
        family,
        beforeRedirect: dispatchBeforeRedirect,
        beforeRedirects: {},
        http2Options,
      };

      // cacheable-lookup integration hotfix
      !utils.isUndefined(lookup) && (options.lookup = lookup);

      if (config.socketPath) {
        options.socketPath = config.socketPath;
      } else {
        options.hostname = parsed.hostname.startsWith('[')
          ? parsed.hostname.slice(1, -1)
          : parsed.hostname;
        options.port = parsed.port;
        setProxy(
          options,
          config.proxy,
          protocol + '//' + parsed.hostname + (parsed.port ? ':' + parsed.port : '') + options.path
        );
      }
      let transport;
      const isHttpsRequest = isHttps.test(options.protocol);
      options.agent = isHttpsRequest ? config.httpsAgent : config.httpAgent;

      if (isHttp2) {
        transport = http2Transport;
      } else {
        if (config.transport) {
          transport = config.transport;
        } else if (config.maxRedirects === 0) {
          transport = isHttpsRequest ? https : http;
        } else {
          if (config.maxRedirects) {
            options.maxRedirects = config.maxRedirects;
          }
          if (config.beforeRedirect) {
            options.beforeRedirects.config = config.beforeRedirect;
          }
          transport = isHttpsRequest ? httpsFollow : httpFollow;
        }
      }

      if (config.maxBodyLength > -1) {
        options.maxBodyLength = config.maxBodyLength;
      } else {
        // follow-redirects does not skip comparison, so it should always succeed for axios -1 unlimited
        options.maxBodyLength = Infinity;
      }

      if (config.insecureHTTPParser) {
        options.insecureHTTPParser = config.insecureHTTPParser;
      }

      // Create the request
      req = transport.request(options, function handleResponse(res) {
        if (req.destroyed) return;

        const streams = [res];

        const responseLength = utils.toFiniteNumber(res.headers['content-length']);

        if (onDownloadProgress || maxDownloadRate) {
          const transformStream = new AxiosTransformStream({
            maxRate: utils.toFiniteNumber(maxDownloadRate),
          });

          onDownloadProgress &&
            transformStream.on(
              'progress',
              flushOnFinish(
                transformStream,
                progressEventDecorator(
                  responseLength,
                  progressEventReducer(asyncDecorator(onDownloadProgress), true, 3)
                )
              )
            );

          streams.push(transformStream);
        }

        // decompress the response body transparently if required
        let responseStream = res;

        // return the last request in case of redirects
        const lastRequest = res.req || req;

        // if decompress disabled we should not decompress
        if (config.decompress !== false && res.headers['content-encoding']) {
          // if no content, but headers still say that it is encoded,
          // remove the header not confuse downstream operations
          if (method === 'HEAD' || res.statusCode === 204) {
            delete res.headers['content-encoding'];
          }

          switch ((res.headers['content-encoding'] || '').toLowerCase()) {
            /*eslint default-case:0*/
            case 'gzip':
            case 'x-gzip':
            case 'compress':
            case 'x-compress':
              // add the unzipper to the body stream processing pipeline
              streams.push(zlib.createUnzip(zlibOptions));

              // remove the content-encoding in order to not confuse downstream operations
              delete res.headers['content-encoding'];
              break;
            case 'deflate':
              streams.push(new ZlibHeaderTransformStream());

              // add the unzipper to the body stream processing pipeline
              streams.push(zlib.createUnzip(zlibOptions));

              // remove the content-encoding in order to not confuse downstream operations
              delete res.headers['content-encoding'];
              break;
            case 'br':
              if (isBrotliSupported) {
                streams.push(zlib.createBrotliDecompress(brotliOptions));
                delete res.headers['content-encoding'];
              }
          }
        }

        responseStream = streams.length > 1 ? stream.pipeline(streams, utils.noop) : streams[0];

        const response = {
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: new AxiosHeaders(res.headers),
          config,
          request: lastRequest,
        };

        if (responseType === 'stream') {
          response.data = responseStream;
          settle(resolve, reject, response);
        } else {
          const responseBuffer = [];
          let totalResponseBytes = 0;

          responseStream.on('data', function handleStreamData(chunk) {
            responseBuffer.push(chunk);
            totalResponseBytes += chunk.length;

            // make sure the content length is not over the maxContentLength if specified
            if (config.maxContentLength > -1 && totalResponseBytes > config.maxContentLength) {
              // stream.destroy() emit aborted event before calling reject() on Node.js v16
              rejected = true;
              responseStream.destroy();
              abort(
                new AxiosError(
                  'maxContentLength size of ' + config.maxContentLength + ' exceeded',
                  AxiosError.ERR_BAD_RESPONSE,
                  config,
                  lastRequest
                )
              );
            }
          });

          responseStream.on('aborted', function handlerStreamAborted() {
            if (rejected) {
              return;
            }

            const err = new AxiosError(
              'stream has been aborted',
              AxiosError.ERR_BAD_RESPONSE,
              config,
              lastRequest
            );
            responseStream.destroy(err);
            reject(err);
          });

          responseStream.on('error', function handleStreamError(err) {
            if (req.destroyed) return;
            reject(AxiosError.from(err, null, config, lastRequest));
          });

          responseStream.on('end', function handleStreamEnd() {
            try {
              let responseData =
                responseBuffer.length === 1 ? responseBuffer[0] : Buffer.concat(responseBuffer);
              if (responseType !== 'arraybuffer') {
                responseData = responseData.toString(responseEncoding);
                if (!responseEncoding || responseEncoding === 'utf8') {
                  responseData = utils.stripBOM(responseData);
                }
              }
              response.data = responseData;
            } catch (err) {
              return reject(AxiosError.from(err, null, config, response.request, response));
            }
            settle(resolve, reject, response);
          });
        }

        abortEmitter.once('abort', (err) => {
          if (!responseStream.destroyed) {
            responseStream.emit('error', err);
            responseStream.destroy();
          }
        });
      });

      abortEmitter.once('abort', (err) => {
        if (req.close) {
          req.close();
        } else {
          req.destroy(err);
        }
      });

      // Handle errors
      req.on('error', function handleRequestError(err) {
        reject(AxiosError.from(err, null, config, req));
      });

      // set tcp keep alive to prevent drop connection by peer
      req.on('socket', function handleRequestSocket(socket) {
        // default interval of sending ack packet is 1 minute
        socket.setKeepAlive(true, 1000 * 60);
      });

      // Handle request timeout
      if (config.timeout) {
        // This is forcing a int timeout to avoid problems if the `req` interface doesn't handle other types.
        const timeout = parseInt(config.timeout, 10);

        if (Number.isNaN(timeout)) {
          abort(
            new AxiosError(
              'error trying to parse `config.timeout` to int',
              AxiosError.ERR_BAD_OPTION_VALUE,
              config,
              req
            )
          );

          return;
        }

        // Sometime, the response will be very slow, and does not respond, the connect event will be block by event loop system.
        // And timer callback will be fired, and abort() will be invoked before connection, then get "socket hang up" and code ECONNRESET.
        // At this time, if we have a large number of request, nodejs will hang up some socket on background. and the number will up and up.
        // And then these socket which be hang up will devouring CPU little by little.
        // ClientRequest.setTimeout will be fired on the specify milliseconds, and can make sure that abort() will be fired after connect.
        req.setTimeout(timeout, function handleRequestTimeout() {
          if (isDone) return;
          let timeoutErrorMessage = config.timeout
            ? 'timeout of ' + config.timeout + 'ms exceeded'
            : 'timeout exceeded';
          const transitional = config.transitional || transitionalDefaults;
          if (config.timeoutErrorMessage) {
            timeoutErrorMessage = config.timeoutErrorMessage;
          }
          abort(
            new AxiosError(
              timeoutErrorMessage,
              transitional.clarifyTimeoutError ? AxiosError.ETIMEDOUT : AxiosError.ECONNABORTED,
              config,
              req
            )
          );
        });
      } else {
        // explicitly reset the socket timeout value for a possible `keep-alive` request
        req.setTimeout(0);
      }

      // Send the request
      if (utils.isStream(data)) {
        let ended = false;
        let errored = false;

        data.on('end', () => {
          ended = true;
        });

        data.once('error', (err) => {
          errored = true;
          req.destroy(err);
        });

        data.on('close', () => {
          if (!ended && !errored) {
            abort(new CanceledError('Request stream has been aborted', config, req));
          }
        });

        data.pipe(req);
      } else {
        data && req.write(data);
        req.end();
      }
    });
  };

export const __setProxy = setProxy;
