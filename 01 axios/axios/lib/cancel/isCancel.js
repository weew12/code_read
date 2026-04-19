'use strict';

/**
 * @file 取消检测函数
 * 
 * 功能：判断一个值是否是取消错误（CanceledError）。
 * 
 * 设计目的：
 * 1. 提供统一的取消错误检测接口，封装实现细节
 * 2. 支持多种检测方式（__CANCEL__标记检查）
 * 3. 提高代码可读性和可维护性
 * 
 * 为什么需要专门的isCancel函数？
 * 1. 封装性：隐藏实现细节（__CANCEL__标记）
 * 2. 兼容性：未来可能改变检测逻辑而不影响调用方
 * 3. 可读性：isCancel(value)比!!(value && value.__CANCEL__)更清晰
 * 
 * 与instanceof CanceledError的比较：
 * 1. instanceof检查原型链，可能在某些打包工具或跨领域环境中失效
 * 2. __CANCEL__标记更可靠，但需要CanceledError正确设置该标记
 * 3. isCancel函数可以结合多种检测方式，提供最可靠的结果
 */

/**
 * 判断一个值是否是取消错误
 * 
 * 实现逻辑：检查值是否存在且具有__CANCEL__属性且该属性为truthy值。
 * 
 * 设计考虑：
 * 1. 防御性编程：先检查value是否存在，避免访问null/undefined的属性
 * 2. 标记检查：依赖CanceledError设置的__CANCEL__标记
 * 3. 布尔化：使用!!运算符确保返回严格的布尔值
 * 
 * 性能考虑：这是一个非常简单的检查，性能开销极小。
 * 在Promise链的错误处理中频繁调用也不会成为性能瓶颈。
 * 
 * 扩展性：未来如果需要支持更多取消错误类型或检测方式，
 * 可以在此函数中添加逻辑而不改变API。
 * 
 * @param {*} value - 要检查的值（通常是错误对象）
 * @returns {boolean} 如果是取消错误返回true，否则返回false
 */
export default function isCancel(value) {
  /**
   * 检查逻辑分解：
   * 1. value && value.__CANCEL__: 
   *    - 如果value为falsy（null、undefined、0、""等），返回value（falsy）
   *    - 如果value存在，检查value.__CANCEL__属性
   *    - 如果__CANCEL__为truthy（true、非零数字、非空字符串等），返回该值
   *    - 如果__CANCEL__为falsy（false、0、""、undefined等），返回该值
   * 2. !!: 将结果转换为严格的布尔值
   * 
   * 注意：此实现假设CanceledError正确设置了__CANCEL__ = true。
   * 如果用户手动创建对象并设置__CANCEL__属性，也会被识别为取消错误。
   */
  return !!(value && value.__CANCEL__);
}
