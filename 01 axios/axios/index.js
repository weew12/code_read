/**
 * @file axios主入口文件
 * 
 * 功能：提供统一的模块导出接口，支持ES模块和CommonJS模块。
 * 
 * 设计目的：
 * 1. 重新导出：从lib/axios.js导入默认导出，然后重新导出为命名导出
 * 2. 兼容性：确保ES模块和CommonJS模块有相同的API接口
 * 3. 树摇优化：支持打包工具进行死代码消除
 * 4. 类型支持：为TypeScript提供清晰的类型导出
 * 
 * 模块结构：
 * - 默认导出：axios函数（工厂函数，创建axios实例）
 * - 命名导出：所有相关的类、工具函数、常量
 * 
 * 使用方式：
 * 1. ES模块：import axios, { AxiosError, CancelToken } from 'axios'
 * 2. CommonJS：const { default: axios, AxiosError } = require('axios')
 * 
 * 注意：此文件是包的入口点，在package.json中指定为"main"和"module"。
 */

import axios from './lib/axios.js';

/**
 * 从axios默认导出中解构出所有静态属性和方法
 * 
 * 设计原因：lib/axios.js导出一个函数（默认导出），该函数具有多个静态属性。
 * 为了提供更好的模块体验，这里将它们解构为独立的命名导出。
 * 
 * 解构的成员包括：
 * 1. 核心类：Axios, AxiosError, CanceledError, AxiosHeaders
 * 2. 取消相关：CancelToken, Cancel, isCancel
 * 3. 工具函数：all, spread, toFormData, formToJSON, getAdapter, mergeConfig, isAxiosError
 * 4. 常量：VERSION, HttpStatusCode
 */
const {
  Axios,
  AxiosError,
  CanceledError,
  isCancel,
  CancelToken,
  VERSION,
  all,
  Cancel,
  isAxiosError,
  spread,
  toFormData,
  AxiosHeaders,
  HttpStatusCode,
  formToJSON,
  getAdapter,
  mergeConfig,
} = axios;

/**
 * 模块导出
 * 
 * 导出策略：
 * 1. 默认导出：axios函数（保持向后兼容）
 * 2. 命名导出：所有相关的类、函数、常量
 * 
 * 注意：export { axios as default } 将导入的axios变量重命名为default导出。
 * 这允许同时提供默认导出和命名导出，满足不同使用习惯。
 */
export {
  axios as default,
  Axios,
  AxiosError,
  CanceledError,
  isCancel,
  CancelToken,
  VERSION,
  all,
  Cancel,
  isAxiosError,
  spread,
  toFormData,
  AxiosHeaders,
  HttpStatusCode,
  formToJSON,
  getAdapter,
  mergeConfig,
};
