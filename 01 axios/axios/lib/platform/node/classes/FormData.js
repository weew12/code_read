/**
 * @file Node.js环境FormData类导出
 * 
 * 功能：重新导出Node.js的'form-data'包中的FormData类。
 * 这是axios平台适配层的一部分，确保在Node.js环境中使用正确的FormData实现。
 * 
 * 设计目的：统一不同环境下的FormData API，使核心代码可以透明地使用FormData，
 * 而不需要关心环境差异。
 */

import FormData from 'form-data';

export default FormData;
