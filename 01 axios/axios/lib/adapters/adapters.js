// 适配器解析模块，负责根据环境选择合适的 HTTP 适配器（XHR、Fetch 或 Node.js HTTP）
import utils from '../utils.js';            // 工具函数
import httpAdapter from './http.js';       // Node.js HTTP 适配器
import xhrAdapter from './xhr.js';         // 浏览器 XMLHttpRequest 适配器
import * as fetchAdapter from './fetch.js'; // Fetch API 适配器
import AxiosError from '../core/AxiosError.js'; // Axios 错误类

/**
 * Known adapters mapping.
 * Provides environment-specific adapters for Axios:
 * - `http` for Node.js
 * - `xhr` for browsers
 * - `fetch` for fetch API-based requests
 *
 * 已知适配器映射表，为 Axios 提供环境特定的适配器：
 * - `http`: Node.js 环境
 * - `xhr`: 浏览器环境（XMLHttpRequest）
 * - `fetch`: 基于 Fetch API 的请求
 *
 * @type {Object<string, Function|Object>}
 */
const knownAdapters = {
  http: httpAdapter,            // Node.js HTTP 适配器
  xhr: xhrAdapter,              // 浏览器 XMLHttpRequest 适配器
  fetch: {
    get: fetchAdapter.getFetch, // Fetch API 适配器（通过 get 方法动态获取）
  },
};

// 为适配器分配名称，便于调试和识别（设置 name 和 adapterName 属性）
utils.forEach(knownAdapters, (fn, value) => {
  if (fn) {
    try {
      Object.defineProperty(fn, 'name', { value }); // 设置函数名（某些环境可能不可写）
    } catch (e) {
      // eslint-disable-next-line no-empty
    }
    Object.defineProperty(fn, 'adapterName', { value }); // 设置 adapterName 属性
  }
});

/**
 * Render a rejection reason string for unknown or unsupported adapters
 * 渲染适配器拒绝原因的字符串
 *
 * @param {string} reason
 * @returns {string}
 */
const renderReason = (reason) => `- ${reason}`;

/**
 * Check if the adapter is resolved (function, null, or false)
 * 检查适配器是否已解析（函数、null 或 false）
 *
 * @param {Function|null|false} adapter
 * @returns {boolean}
 */
const isResolvedHandle = (adapter) =>
  utils.isFunction(adapter) || adapter === null || adapter === false;

/**
 * Get the first suitable adapter from the provided list.
 * Tries each adapter in order until a supported one is found.
 * Throws an AxiosError if no adapter is suitable.
 *
 * 从提供的列表中获取第一个合适的适配器。
 * 按顺序尝试每个适配器，直到找到支持的适配器。
 * 如果没有合适的适配器，则抛出 AxiosError。
 *
 * @param {Array<string|Function>|string|Function} adapters - Adapter(s) by name or function.
 * @param {Object} config - Axios request configuration
 * @throws {AxiosError} If no suitable adapter is available
 * @returns {Function} The resolved adapter function
 */
function getAdapter(adapters, config) {
  // 标准化适配器参数为数组
  adapters = utils.isArray(adapters) ? adapters : [adapters];

  const { length } = adapters;
  let nameOrAdapter;  // 适配器名称或函数
  let adapter;        // 解析后的适配器函数

  const rejectedReasons = {};  // 记录每个适配器失败的原因

  // 遍历适配器列表，尝试找到第一个可用的适配器
  for (let i = 0; i < length; i++) {
    nameOrAdapter = adapters[i];
    let id;  // 适配器标识符（名称）

    adapter = nameOrAdapter;  // 假设已经是函数

    // 如果参数不是函数、null 或 false，则尝试从 knownAdapters 中查找
    if (!isResolvedHandle(nameOrAdapter)) {
      adapter = knownAdapters[(id = String(nameOrAdapter)).toLowerCase()];  // 转为小写后查找

      if (adapter === undefined) {
        throw new AxiosError(`Unknown adapter '${id}'`);  // 未知适配器名称
      }
    }

    // 检查适配器是否可用：如果是函数直接使用，否则尝试调用其 get 方法
    if (adapter && (utils.isFunction(adapter) || (adapter = adapter.get(config)))) {
      break;  // 找到可用的适配器，停止遍历
    }

    // 记录失败原因
    rejectedReasons[id || '#' + i] = adapter;
  }

  // 如果没有找到可用的适配器
  if (!adapter) {
    // 构建详细的失败原因描述
    const reasons = Object.entries(rejectedReasons).map(
      ([id, state]) =>
        `adapter ${id} ` +
        (state === false ? 'is not supported by the environment' : 'is not available in the build')
    );

    // 格式化错误信息
    let s = length
      ? reasons.length > 1
        ? 'since :\n' + reasons.map(renderReason).join('\n')  // 多个原因
        : ' ' + renderReason(reasons[0])                     // 单个原因
      : 'as no adapter specified';                           // 未指定适配器

    throw new AxiosError(
      `There is no suitable adapter to dispatch the request ` + s,
      'ERR_NOT_SUPPORT'
    );
  }

  return adapter;  // 返回解析后的适配器函数
}

/**
 * Exports Axios adapters and utility to resolve an adapter
 * 导出 Axios 适配器和解析适配器的工具函数
 */
export default {
  /**
   * Resolve an adapter from a list of adapter names or functions.
   * 从适配器名称或函数列表中解析适配器
   * @type {Function}
   */
  getAdapter,

  /**
   * Exposes all known adapters
   * 暴露所有已知适配器
   * @type {Object<string, Function|Object>}
   */
  adapters: knownAdapters,
};
