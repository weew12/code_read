/**
 * @file 浏览器环境URLSearchParams类导出（带polyfill回退）
 * 
 * 功能：优先导出浏览器原生的URLSearchParams类，如果不存在则回退到AxiosURLSearchParams polyfill。
 * 这是axios平台适配层的关键部分，确保在所有浏览器环境中都有可用的URLSearchParams实现。
 * 
 * 设计目的：提供无缝的兼容性，现代浏览器使用原生API获得最佳性能，
 * 旧版浏览器使用自定义实现保证功能可用性。
 */

'use strict';

import AxiosURLSearchParams from '../../../helpers/AxiosURLSearchParams.js';
export default typeof URLSearchParams !== 'undefined' ? URLSearchParams : AxiosURLSearchParams;
