'use strict';

/**
 * @file 取消错误类
 * 
 * 功能：表示请求被取消时的错误，继承自AxiosError。
 * 
 * 设计目的：
 * 1. 提供专门的取消错误类型，便于错误处理逻辑区分取消和其他错误
 * 2. 保持与AxiosError的兼容性，继承错误代码、配置、请求等上下文
 * 3. 提供特殊的标记（__CANCEL__）便于isCancel函数识别
 * 
 * 使用场景：当用户调用cancelToken的cancel()方法时，会抛出此错误。
 * 错误处理代码可以通过检查error.__CANCEL__或error instanceof CanceledError
 * 来判断错误是否由请求取消引起。
 */

import AxiosError from '../core/AxiosError.js';

/**
 * 取消错误类，继承自 AxiosError，表示请求被取消时的错误
 */
class CanceledError extends AxiosError {
  /**
   * 取消错误构造函数
   * 
   * 设计特点：
   * 1. 默认消息：如果没有提供message，使用'canceled'作为默认消息
   * 2. 固定错误代码：始终使用AxiosError.ERR_CANCELED（'ERR_CANCELED'）
   * 3. 继承上下文：传递config和request给父类，保持错误上下文完整
   * 4. 名称设置：设置name属性为'CanceledError'，便于类型检查
   * 5. 特殊标记：设置__CANCEL__ = true，便于isCancel函数快速识别
   * 
   * 为什么需要__CANCEL__标记？
   * 除了instanceof检查外，__CANCEL__标记提供了一种更简单的检查方式。
   * 某些打包工具或环境可能破坏原型链，使用标记更可靠。
   * 
   * @param {string=} message - 可选的错误消息
   * @param {Object=} config - 可选的请求配置
   * @param {Object=} request - 可选的请求对象
   */
  constructor(message, config, request) {
    // 调用父类构造函数
    // 1. 消息处理：如果message为null或undefined，使用默认消息'canceled'
    // 2. 错误代码：固定为ERR_CANCELED，表示取消错误
    // 3. 上下文：传递config和request，保持错误信息完整
    super(message == null ? 'canceled' : message, AxiosError.ERR_CANCELED, config, request);
    
    // 设置错误名称，便于console.log和错误处理
    this.name = 'CanceledError';
    
    /**
     * 特殊标记：标识这是一个取消错误
     * 
     * 用途：
     * 1. 被isCancel()函数用于快速检测取消错误
     * 2. 提供额外的类型检查方式，补充instanceof
     * 3. 序列化时可能保留（取决于序列化方法）
     * 
     * 注意：使用双下划线前缀表示内部属性，避免与用户属性冲突。
     */
    this.__CANCEL__ = true;
  }
}

export default CanceledError;
