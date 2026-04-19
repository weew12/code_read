'use strict';

// 请求分发器，负责调用适配器发送请求，并处理请求/响应数据的转换

// 数据转换函数，用于转换请求和响应数据
import transformData from './transformData.js';
// 判断是否为取消错误的辅助函数
import isCancel from '../cancel/isCancel.js';
// 默认配置
import defaults from '../defaults/index.js';
// 取消错误类
import CanceledError from '../cancel/CanceledError.js';
// 头部管理类
import AxiosHeaders from '../core/AxiosHeaders.js';
// 适配器模块，根据环境选择 XHR 或 HTTP 适配器
import adapters from '../adapters/adapters.js';

/**
 * Throws a `CanceledError` if cancellation has been requested.
 *
 * @param {Object} config The config that is to be used for the request
 *
 * @returns {void}
 */
// 检查取消状态，如果请求已被取消，则抛出 CanceledError
function throwIfCancellationRequested(config) {
  // 检查传统的 cancelToken 取消方式
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested();  // 如果已取消，内部会抛出 CanceledError
  }

  // 检查现代的 AbortSignal 取消方式（Fetch API 风格）
  if (config.signal && config.signal.aborted) {
    throw new CanceledError(null, config);  // 直接抛出 CanceledError
  }
}

/**
 * Dispatch a request to the server using the configured adapter.
 *
 * @param {object} config The config that is to be used for the request
 *
 * @returns {Promise} The Promise to be fulfilled
 */
// 分发请求的核心函数，负责调用适配器发送请求，并处理请求/响应数据的转换
export default function dispatchRequest(config) {
  // 检查请求是否已被取消（发送前检查）
  throwIfCancellationRequested(config);

  // 将 headers 转换为 AxiosHeaders 实例，便于统一操作
  config.headers = AxiosHeaders.from(config.headers);

  // 转换请求数据（根据 config.transformRequest 配置）
  config.data = transformData.call(config, config.transformRequest);

  // 对于 POST、PUT、PATCH 请求，如果没有显式设置 Content-Type，默认设置为 application/x-www-form-urlencoded
  if (['post', 'put', 'patch'].indexOf(config.method) !== -1) {
    config.headers.setContentType('application/x-www-form-urlencoded', false);  // false 表示不覆盖已存在的 Content-Type
  }

  // 获取适配器（XHR 或 HTTP），优先使用 config.adapter，否则使用默认适配器
  const adapter = adapters.getAdapter(config.adapter || defaults.adapter, config);

  // 调用适配器发送请求，并处理响应
  return adapter(config).then(
    // 适配器成功处理（请求成功）
    function onAdapterResolution(response) {
      // 再次检查取消状态（请求可能在被发送后但响应返回前被取消）
      throwIfCancellationRequested(config);

      // 转换响应数据（根据 config.transformResponse 配置）
      response.data = transformData.call(config, config.transformResponse, response);

      // 将响应 headers 转换为 AxiosHeaders 实例
      response.headers = AxiosHeaders.from(response.headers);

      return response;  // 返回处理后的响应
    },
    // 适配器处理失败（请求失败）
    function onAdapterRejection(reason) {
      // 如果失败原因不是取消错误，则继续处理
      if (!isCancel(reason)) {
        // 检查取消状态
        throwIfCancellationRequested(config);

        // 如果失败原因包含响应（如 HTTP 错误状态码），则转换响应数据
        if (reason && reason.response) {
          reason.response.data = transformData.call(
            config,
            config.transformResponse,
            reason.response
          );
          reason.response.headers = AxiosHeaders.from(reason.response.headers);
        }
      }

      // 将失败原因继续抛出
      return Promise.reject(reason);
    }
  );
}
