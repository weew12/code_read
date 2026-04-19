'use strict';

// 数据转换模块，负责对请求和响应数据进行转换处理
import utils from '../utils.js';              // 工具函数
import defaults from '../defaults/index.js';  // 默认配置
import AxiosHeaders from '../core/AxiosHeaders.js';  // 头部管理类

/**
 * Transform the data for a request or a response
 * 转换请求或响应的数据
 *
 * @param {Array|Function} fns A single function or Array of functions - 单个函数或函数数组
 * @param {?Object} response The response object - 响应对象（对于响应转换）
 *
 * @returns {*} The resulting transformed data - 转换后的数据
 */
export default function transformData(fns, response) {
  // 获取配置：使用函数的 this 上下文或默认配置
  const config = this || defaults;
  // 确定上下文：如果有响应对象使用响应，否则使用配置
  const context = response || config;
  // 转换头部为 AxiosHeaders 实例
  const headers = AxiosHeaders.from(context.headers);
  // 获取原始数据
  let data = context.data;

  // 遍历所有转换函数，依次应用
  utils.forEach(fns, function transform(fn) {
    // 调用转换函数，传入参数：数据、规范化后的头部、响应状态码（仅响应转换时）
    data = fn.call(config, data, headers.normalize(), response ? response.status : undefined);
  });

  // 确保头部被规范化
  headers.normalize();

  // 返回转换后的数据
  return data;
}
