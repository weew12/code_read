'use strict';

/**
 * @file 过渡性配置选项
 * 
 * 功能：定义axios的过渡性行为配置，用于API的平滑演进。
 * 
 * 设计目的：
 * 1. 向后兼容：在新版本中保留旧版本的行为，给用户迁移时间
 * 2. 渐进式变更：逐步引入破坏性变更，通过配置控制行为
 * 3. 弃用路径：为将被移除的功能提供明确的迁移路径
 * 
 * 过渡性选项说明：
 * 1. silentJSONParsing: true - 静默JSON解析失败（旧行为）
 *    false时会抛出SyntaxError，true时返回null
 * 2. forcedJSONParsing: true - 强制JSON解析（旧行为）
 *    即使响应类型不是'json'也尝试解析JSON响应
 * 3. clarifyTimeoutError: false - 超时错误澄清（新行为默认关闭）
 *    true时超时错误使用ETIMEDOUT代码，false时使用ECONNABORTED
 * 4. legacyInterceptorReqResOrdering: true - 拦截器执行顺序（旧行为）
 *    保持旧的拦截器执行顺序（请求拦截器后进先出）
 * 
 * 迁移建议：新项目应将这些选项设置为false，以获得更标准的行为。
 * 现有项目可以逐步将这些选项改为false，测试兼容性。
 */

export default {
  silentJSONParsing: true,                 // 静默JSON解析失败（兼容性）
  forcedJSONParsing: true,                 // 强制JSON解析（兼容性）
  clarifyTimeoutError: false,              // 澄清超时错误类型（默认关闭）
  legacyInterceptorReqResOrdering: true,   // 旧版拦截器执行顺序（兼容性）
};
