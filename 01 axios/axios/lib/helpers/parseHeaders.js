'use strict';

import utils from '../utils.js';

/**
 * @file HTTP响应头解析器
 * 
 * 功能：将原始的HTTP响应头字符串（多行文本）解析为JavaScript对象。
 * 
 * 设计考虑：
 * 1. 遵循Node.js的头部处理规范：某些头部字段的重复值应被忽略
 * 2. 特殊处理Set-Cookie头部：允许存储多个值（数组）
 * 3. 合并重复头部：非特殊头部使用逗号分隔符合并多个值
 * 4. 头部名称规范化：转换为小写，便于后续的查找和比较
 */

/**
 * 需要忽略重复值的头部字段集合
 * 
 * 设计依据：根据Node.js的HTTP模块规范，某些头部字段的重复值应被忽略。
 * 参考：https://nodejs.org/api/http.html#http_message_headers
 * 
 * 这些字段通常是唯一值字段，如Content-Type、Authorization等。
 * 使用utils.toObjectSet转换为对象，便于O(1)时间复杂度的查找。
 */
const ignoreDuplicateOf = utils.toObjectSet([
  'age',
  'authorization',
  'content-length',
  'content-type',
  'etag',
  'expires',
  'from',
  'host',
  'if-modified-since',
  'if-unmodified-since',
  'last-modified',
  'location',
  'max-forwards',
  'proxy-authorization',
  'referer',
  'retry-after',
  'user-agent',
]);

/**
 * 将HTTP头部字符串解析为对象
 * 
 * 输入示例：
 * ```
 * Date: Wed, 27 Aug 2014 08:58:49 GMT
 * Content-Type: application/json
 * Connection: keep-alive
 * Transfer-Encoding: chunked
 * Set-Cookie: sessionId=abc123; Path=/
 * Set-Cookie: userId=42; Path=/user
 * ```
 * 
 * 算法逻辑：
 * 1. 按换行符分割头部字符串
 * 2. 对每一行，按冒号分割为键和值
 * 3. 键名转换为小写并修剪空白
 * 4. 根据头部类型进行特殊处理
 * 
 * 特殊处理规则：
 * 1. 空键名或被忽略的重复头部：跳过
 * 2. Set-Cookie头部：存储为数组（允许多个cookie）
 * 3. 其他重复头部：使用逗号分隔符合并
 * 
 * @param {String} rawHeaders 需要解析的原始头部字符串
 * @returns {Object} 解析后的头部对象
 */
export default (rawHeaders) => {
  const parsed = {};
  let key;
  let val;
  let i;

  // 防御性编程：确保rawHeaders存在
  rawHeaders &&
    // 按换行符分割头部字符串（HTTP规范中使用CRLF，但这里处理通用情况）
    rawHeaders.split('\n').forEach(function parser(line) {
      // 查找冒号分隔符的位置
      i = line.indexOf(':');
      
      // 提取键名：冒号前的部分，去除空白并转为小写
      key = line.substring(0, i).trim().toLowerCase();
      
      // 提取键值：冒号后的部分，去除空白
      val = line.substring(i + 1).trim();

      // 跳过无效行或应忽略的重复头部
      if (!key || (parsed[key] && ignoreDuplicateOf[key])) {
        return;
      }

      // 特殊处理：Set-Cookie头部（允许多个值）
      if (key === 'set-cookie') {
        if (parsed[key]) {
          // 已存在Set-Cookie值，推入数组
          parsed[key].push(val);
        } else {
          // 第一个Set-Cookie值，创建数组
          parsed[key] = [val];
        }
      } else {
        // 常规头部：合并重复值（使用逗号分隔符）
        // 遵循HTTP规范：相同头部字段的多个值应使用逗号分隔
        parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
      }
    });

  return parsed;
};
