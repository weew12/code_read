/**
 * @file 浏览器环境FormData类导出
 * 
 * 功能：导出浏览器原生的FormData类，如果不存在则导出null。
 * 这是axios平台适配层的一部分，用于检测浏览器是否支持FormData API。
 * 
 * 设计目的：提供统一的FormData引用，在支持的环境中直接使用原生实现，
 * 在不支持的环境中返回null，由上层逻辑处理兼容性。
 */

'use strict';

export default typeof FormData !== 'undefined' ? FormData : null;
