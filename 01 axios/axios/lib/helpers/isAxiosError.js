'use strict';

/**
 * @file Axios错误检测函数
 * 
 * 功能：判断一个值是否是Axios抛出的错误对象（AxiosError实例）。
 * 
 * 设计目的：
 * 1. 提供统一的错误类型检测接口，封装实现细节
 * 2. 支持错误处理逻辑根据错误类型采取不同策略
 * 3. 改善代码可读性：isAxiosError(err)比err.isAxiosError === true更清晰
 * 
 * 检测原理：检查对象是否具有isAxiosError属性且值为true。
 * AxiosError类在其构造函数中设置this.isAxiosError = true。
 * 
 * 与instanceof AxiosError的比较：
 * 1. instanceof检查原型链，可能在某些打包工具或跨领域环境中失效
 * 2. 属性检查更可靠，但依赖AxiosError正确设置该属性
 * 3. 此函数结合了两种方式的优点：先检查对象类型，再检查属性
 * 
 * 扩展性：未来如果需要更复杂的检测逻辑，可以在此函数中修改而不影响调用方。
 */

import utils from '../utils.js';

/**
 * 判断负载是否是Axios抛出的错误
 * 
 * 实现逻辑：
 * 1. 检查payload是否是对象（使用utils.isObject，包括数组、函数等）
 * 2. 检查payload.isAxiosError属性是否严格等于true
 * 
 * 注意：使用严格相等（=== true）确保只有明确标记为true的对象才被识别。
 * 这避免了truthy值（如1、"true"、非空对象）被误判。
 * 
 * 为什么需要专门的检测函数？
 * 1. 封装性：隐藏实现细节，调用方不依赖具体属性名
 * 2. 类型安全：提供明确的函数签名和返回类型
 * 3. 可维护性：集中错误检测逻辑，便于修改和测试
 * 
 * @param {*} payload - 要测试的值（通常是错误对象）
 * @returns {boolean} 如果是Axios错误返回true，否则返回false
 */
export default function isAxiosError(payload) {
  return utils.isObject(payload) && payload.isAxiosError === true;
}
