'use strict';

/**
 * @file 构建完整URL路径
 * 
 * 功能：将基础URL（baseURL）和请求URL组合成完整路径。
 * 
 * 设计原则：
 * 1. 绝对URL优先：如果请求URL已经是绝对URL，直接使用（除非强制使用baseURL）
 * 2. 相对URL组合：如果请求URL是相对URL，与baseURL组合
 * 3. 灵活性：通过allowAbsoluteUrls参数控制是否强制使用baseURL
 * 
 * 使用场景：在axios中，用户可能配置了baseURL（如"https://api.example.com"），
 * 然后发送请求时使用相对路径（如"/users"）。此函数将它们组合成完整URL。
 */

import isAbsoluteURL from '../helpers/isAbsoluteURL.js';  // 绝对 URL 检测
import combineURLs from '../helpers/combineURLs.js';      // URL 组合函数

/**
 * 构建完整URL路径
 * 
 * 决策逻辑：
 * 1. 检查requestedURL是否是绝对URL
 * 2. 如果有baseURL 且 (requestedURL是相对URL 或 allowAbsoluteUrls == false)
 *    → 组合baseURL和requestedURL
 * 3. 否则 → 直接返回requestedURL
 * 
 * allowAbsoluteUrls参数的特殊用途：
 * - undefined/true: 默认行为，允许绝对URL（不强制使用baseURL）
 * - false: 强制使用baseURL，即使requestedURL是绝对URL
 * 
 * 设计考虑：
 * 1. 安全性：在某些场景下，可能希望强制所有请求都通过baseURL（代理、API网关）
 * 2. 灵活性：支持绝对URL和相对URL的混合使用
 * 3. 兼容性：与浏览器和Node.js的URL处理保持一致
 * 
 * @param {string} baseURL - 基础URL（如"https://api.example.com"）
 * @param {string} requestedURL - 请求URL，可以是绝对或相对URL
 * @param {boolean} [allowAbsoluteUrls] - 是否允许绝对URL（控制是否强制使用baseURL）
 * @returns {string} 组合后的完整路径
 */
export default function buildFullPath(baseURL, requestedURL, allowAbsoluteUrls) {
  // 步骤1：检查请求URL是否是相对URL（不是绝对URL）
  let isRelativeUrl = !isAbsoluteURL(requestedURL);
  
  /**
   * 步骤2：决定是否组合URL
   * 
   * 组合条件（同时满足）：
   * 1. baseURL存在（非空、非undefined）
   * 2. 满足以下任一条件：
   *    a. requestedURL是相对URL（需要baseURL）
   *    b. allowAbsoluteUrls == false（强制使用baseURL，安全考虑）
   * 
   * 注意：使用"==" false而不是"==="，因为allowAbsoluteUrls可能是undefined。
   * 当allowAbsoluteUrls === false时，即使绝对URL也会与baseURL组合。
   * 这可以用于确保所有请求都通过特定的API网关或代理。
   */
  if (baseURL && (isRelativeUrl || allowAbsoluteUrls == false)) {
    // 组合URL：处理路径拼接、斜杠规范化等细节
    return combineURLs(baseURL, requestedURL);
  }
  
  /**
   * 步骤3：直接返回请求URL
   * 
   * 以下情况直接返回requestedURL：
   * 1. 没有baseURL
   * 2. requestedURL是绝对URL且allowAbsoluteUrls不为false
   * 3. requestedURL是相对URL但没有baseURL（这种情况可能出错，但由调用者处理）
   */
  return requestedURL;
}
