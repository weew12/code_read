/**
 * @file 环境无关的FormData类导出（智能选择）
 * 
 * 功能：智能选择FormData实现，优先使用浏览器原生FormData，
 * 否则使用Node.js的'form-data'包作为polyfill。
 * 
 * 设计目的：提供跨环境的FormData引用，使代码可以在浏览器和Node.js中
 * 使用相同的API，无需关心环境差异。
 */

import _FormData from 'form-data';
export default typeof FormData !== 'undefined' ? FormData : _FormData;
