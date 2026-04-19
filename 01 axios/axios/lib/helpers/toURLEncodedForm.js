'use strict';

/**
 * @file 将数据转换为URL编码表单格式（application/x-www-form-urlencoded）
 * 
 * 功能：将JavaScript对象转换为符合application/x-www-form-urlencoded格式的URLSearchParams对象。
 * 这是axios中处理HTTP POST请求体格式化的关键工具，特别适用于传统的表单提交场景。
 * 
 * 实现机制：
 * 1. 复用toFormData转换逻辑，但使用URLSearchParams作为容器而非FormData
 * 2. 针对Node.js环境特殊处理Buffer类型，自动转换为base64编码
 * 3. 支持通过options参数传递自定义配置（如dots、indexes等格式选项）
 * 
 * 核心设计：通过visitor模式拦截特定类型的值转换，在保持toFormData通用性的同时
 *          实现URL编码表单的特殊需求。
 */

import utils from '../utils.js';
import toFormData from './toFormData.js';
import platform from '../platform/index.js';

/**
 * 将数据对象转换为URL编码表单格式（URLSearchParams实例）
 * 
 * 功能：将任意JavaScript对象转换为符合application/x-www-form-urlencoded格式的URLSearchParams对象。
 * 内部复用toFormData的转换逻辑，但使用URLSearchParams作为目标容器，并特殊处理Buffer类型。
 * 
 * 转换流程：
 * 1. 创建平台对应的URLSearchParams实例（可能是原生实现或AxiosURLSearchParams polyfill）
 * 2. 调用toFormData进行通用对象到键值对的转换
 * 3. 通过visitor函数拦截Buffer值，在Node.js环境下转换为base64字符串
 * 4. 其他类型的值使用默认转换逻辑
 * 
 * @param {Object|Array|FormData} data - 要转换的源数据，支持对象、数组等复杂结构
 * @param {Object} options - 转换选项，传递给toFormData函数
 * @returns {URLSearchParams} 包含转换后键值对的URLSearchParams实例
 */
export default function toURLEncodedForm(data, options) {
  return toFormData(data, new platform.classes.URLSearchParams(), {
    visitor: function (value, key, path, helpers) {
      if (platform.isNode && utils.isBuffer(value)) {
        this.append(key, value.toString('base64'));
        return false;
      }

      return helpers.defaultVisitor.apply(this, arguments);
    },
    ...options,
  });
}
