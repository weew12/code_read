'use strict';

/**
 * Creates a new URL by combining the specified URLs
 * 组合指定的 URL：将相对 URL 拼接到基础 URL 上
 *
 * @param {string} baseURL The base URL - 基础 URL
 * @param {string} relativeURL The relative URL - 相对 URL
 *
 * @returns {string} The combined URL - 组合后的 URL
 */
export default function combineURLs(baseURL, relativeURL) {
  return relativeURL
    ? baseURL.replace(/\/?\/$/, '') + '/' + relativeURL.replace(/^\/+/, '')  // 移除基础 URL 末尾的斜杠，移除相对 URL 开头的斜杠，然后组合
    : baseURL;  // 如果没有相对 URL，直接返回基础 URL
}
