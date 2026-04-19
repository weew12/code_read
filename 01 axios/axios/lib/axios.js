'use strict';

// Axios 库的主入口文件，负责创建默认的 axios 实例并导出所有公共 API

// 工具函数模块，提供常用的工具方法
import utils from './utils.js';
// bind 函数，用于绑定函数执行上下文（this）
import bind from './helpers/bind.js';
// Axios 核心类，封装 HTTP 请求的主要逻辑
import Axios from './core/Axios.js';
// 合并配置的函数
import mergeConfig from './core/mergeConfig.js';
// 默认配置对象
import defaults from './defaults/index.js';
// 将 FormData 转换为 JSON 的函数
import formDataToJSON from './helpers/formDataToJSON.js';
// 请求取消相关的错误类
import CanceledError from './cancel/CanceledError.js';
// 取消令牌类，用于取消请求
import CancelToken from './cancel/CancelToken.js';
// 判断一个值是否是取消原因的辅助函数
import isCancel from './cancel/isCancel.js';
// Axios 版本号
import { VERSION } from './env/data.js';
// 将数据转换为 FormData 格式的函数
import toFormData from './helpers/toFormData.js';
// Axios 错误类，用于封装请求错误信息
import AxiosError from './core/AxiosError.js';
// 将数组展开为函数参数的辅助函数（类似于 Function.prototype.apply）
import spread from './helpers/spread.js';
// 判断错误是否为 AxiosError 的辅助函数
import isAxiosError from './helpers/isAxiosError.js';
// Axios 头部管理类
import AxiosHeaders from './core/AxiosHeaders.js';
// 适配器模块，根据环境选择 XHR 或 HTTP 适配器
import adapters from './adapters/adapters.js';
// HTTP 状态码常量对象
import HttpStatusCode from './helpers/HttpStatusCode.js';

/**
 * Create an instance of Axios
 *
 * @param {Object} defaultConfig The default config for the instance
 *
 * @returns {Axios} A new instance of Axios
 */
// 创建 Axios 实例的工厂函数，是 axios 库的核心初始化逻辑
function createInstance(defaultConfig) {
  // 创建 Axios 类的实例，作为请求方法的执行上下文（this）
  const context = new Axios(defaultConfig);
  // 将 Axios.prototype.request 方法绑定到 context 上下文，作为实例的主函数
  const instance = bind(Axios.prototype.request, context);

  // 将 Axios 原型上的所有方法（如 get、post、put、delete 等）复制到 instance 上
  // 同时确保这些方法在调用时能正确绑定到 context 上下文
  utils.extend(instance, Axios.prototype, context, { allOwnKeys: true });

  // 将 context 实例自身的属性（如 interceptors、defaults 等）复制到 instance 上
  utils.extend(instance, context, null, { allOwnKeys: true });

  // 添加工厂方法 create，用于创建新的 axios 实例，继承当前实例的配置
  instance.create = function create(instanceConfig) {
    // 合并默认配置和新配置，创建新的实例
    return createInstance(mergeConfig(defaultConfig, instanceConfig));
  };

  return instance;
}

// 创建默认的 axios 实例，使用默认配置，这是整个库的入口点
const axios = createInstance(defaults);

// 将 Axios 类暴露到实例上，允许用户通过 axios.Axios 进行继承或扩展
axios.Axios = Axios;

// 暴露取消相关的类和函数，用于实现请求取消功能
axios.CanceledError = CanceledError; // 请求取消时抛出的错误类型
axios.CancelToken = CancelToken;     // 取消令牌，用于触发取消操作
axios.isCancel = isCancel;           // 判断一个值是否是取消原因
axios.VERSION = VERSION;             // Axios 版本号
axios.toFormData = toFormData;       // 将数据转换为 FormData 格式

// 暴露 AxiosError 类，用于表示 Axios 相关的错误
axios.AxiosError = AxiosError;

// 为了向后兼容，提供 Cancel 作为 CanceledError 的别名
axios.Cancel = axios.CanceledError;

// 暴露 all 和 spread 辅助函数，用于处理多个并发请求
axios.all = function all(promises) {
  return Promise.all(promises);      // 直接使用 Promise.all 实现
};

axios.spread = spread;               // 将数组展开为函数参数的辅助函数

// 暴露 isAxiosError 函数，用于判断错误是否为 AxiosError 实例
axios.isAxiosError = isAxiosError;

// 暴露 mergeConfig 函数，用于合并配置对象
axios.mergeConfig = mergeConfig;

// 暴露 AxiosHeaders 类，用于管理 HTTP 请求头
axios.AxiosHeaders = AxiosHeaders;

// 暴露 formToJSON 函数，将 FormData 或 HTML 表单转换为 JSON 格式
axios.formToJSON = (thing) => formDataToJSON(utils.isHTMLForm(thing) ? new FormData(thing) : thing);

// 暴露 getAdapter 函数，用于获取当前环境下的适配器（XHR 或 HTTP）
axios.getAdapter = adapters.getAdapter;

// 暴露 HTTP 状态码常量对象
axios.HttpStatusCode = HttpStatusCode;

// 为了兼容 CommonJS 模块系统，设置 default 属性指向自身
axios.default = axios;

// 此模块仅导出默认的 axios 实例，其他 API 都挂载在该实例上
export default axios;
