'use strict';

/**
 * @file URL协议解析器
 * 
 * 功能：从URL字符串中提取协议部分（如http、https、data、file等）。
 * 支持标准协议格式（protocol://）和一些特殊格式（protocol:）。
 * 
 * 正则表达式说明：匹配1-25个字符（字母、数字、下划线、连字符、加号），
 * 后跟"://"或":"。加号支持特殊协议如"web+http"。
 * 
 * 设计目的：为axios的URL处理和协议检测提供基础工具，用于区分不同协议的处理逻辑。
 */

/**
 * 解析URL中的协议部分
 * 
 * 示例：
 * - parseProtocol("http://example.com") => "http"
 * - parseProtocol("data:text/plain,hello") => "data"
 * - parseProtocol("web+http://example.com") => "web+http"
 * 
 * @param {string} url - 要解析的URL字符串
 * @returns {string} 协议名称，未找到时返回空字符串
 */
export default function parseProtocol(url) {
  const match = /^([-+\w]{1,25})(:?\/\/|:)/.exec(url);
  return (match && match[1]) || '';
}
