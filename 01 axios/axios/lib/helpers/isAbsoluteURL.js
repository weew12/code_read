'use strict';

/**
 * Determines whether the specified URL is absolute
 * 判断指定的 URL 是否为绝对 URL
 *
 * @param {string} url The URL to test - 要测试的 URL
 *
 * @returns {boolean} True if the specified URL is absolute, otherwise false - 如果是绝对 URL 返回 true，否则返回 false
 */
export default function isAbsoluteURL(url) {
  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
  // by any combination of letters, digits, plus, period, or hyphen.
  // 一个 URL 被认为是绝对的，如果它以 "<scheme>://" 或 "//"（协议相对 URL）开头。
  // RFC 3986 定义 scheme 名称为由字母开头，后跟字母、数字、加号、句点或连字符的任意组合的字符序列。
  
  if (typeof url !== 'string') {
    return false;  // 非字符串直接返回 false
  }

  // 正则表达式解释：
  // ^ 字符串开始
  // ([a-z][a-z\d+\-.]*:)? 可选的 scheme 部分：字母开头，后跟字母、数字、+、-、.，然后是冒号
  // \/\/ 双斜杠（协议分隔符）
  // i 不区分大小写
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}
