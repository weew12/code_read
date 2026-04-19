/**
 * @file Node.js环境URLSearchParams类导出
 * 
 * 功能：从Node.js的'url'模块重新导出URLSearchParams类。
 * 这是axios平台适配层的一部分，确保在Node.js环境中使用原生的URLSearchParams实现。
 * 
 * 注意：Node.js的URLSearchParams API与浏览器标准基本一致，
 * 但在旧版本中可能需要polyfill（通过AxiosURLSearchParams提供）。
 */

'use strict';

import url from 'url';
export default url.URLSearchParams;
