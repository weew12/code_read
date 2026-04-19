/**
 * @file Data URI解码后字节数估算器
 * 
 * 功能：在不分配大缓冲区的情况下估算data: URI解码后的字节长度。
 * 这是axios中处理大文件上传前预检查的关键优化模块，避免在内存中实际解码数据。
 * 
 * 算法特点：
 * 1. base64编码：精确计算解码大小，考虑填充字符和URL编码（%XX）的影响
 * 2. 非base64编码：使用UTF-8字节长度作为安全上限
 * 3. 零分配计算：在字符级别处理%XX编码，避免字符串分配
 */

/**
 * 估算Data URI解码后的字节长度（零分配算法）
 * 
 * 核心算法：
 * - base64编码：根据字符数计算，考虑填充（'='）和URL编码（%3D表示'='）
 *   公式：bytes = floor(effectiveLen / 4) * 3 - pad
 *   其中effectiveLen是排除%XX编码后的实际字符数
 * 
 * - 非base64编码：直接使用Buffer.byteLength获取UTF-8字节数
 * 
 * 设计目的：在不知道实际解码大小时预先估计内存需求，避免处理超大URI导致内存溢出。
 *
 * @param {string} url - Data URI字符串
 * @returns {number} 估算的解码后字节数（无效输入返回0）
 */
export default function estimateDataURLDecodedBytes(url) {
  if (!url || typeof url !== 'string') return 0;
  if (!url.startsWith('data:')) return 0;

  const comma = url.indexOf(',');
  if (comma < 0) return 0;

  const meta = url.slice(5, comma);
  const body = url.slice(comma + 1);
  const isBase64 = /;base64/i.test(meta);

  if (isBase64) {
    let effectiveLen = body.length;
    const len = body.length; // cache length

    for (let i = 0; i < len; i++) {
      if (body.charCodeAt(i) === 37 /* '%' */ && i + 2 < len) {
        const a = body.charCodeAt(i + 1);
        const b = body.charCodeAt(i + 2);
        const isHex =
          ((a >= 48 && a <= 57) || (a >= 65 && a <= 70) || (a >= 97 && a <= 102)) &&
          ((b >= 48 && b <= 57) || (b >= 65 && b <= 70) || (b >= 97 && b <= 102));

        if (isHex) {
          effectiveLen -= 2;
          i += 2;
        }
      }
    }

    let pad = 0;
    let idx = len - 1;

    const tailIsPct3D = (j) =>
      j >= 2 &&
      body.charCodeAt(j - 2) === 37 && // '%'
      body.charCodeAt(j - 1) === 51 && // '3'
      (body.charCodeAt(j) === 68 || body.charCodeAt(j) === 100); // 'D' or 'd'

    if (idx >= 0) {
      if (body.charCodeAt(idx) === 61 /* '=' */) {
        pad++;
        idx--;
      } else if (tailIsPct3D(idx)) {
        pad++;
        idx -= 3;
      }
    }

    if (pad === 1 && idx >= 0) {
      if (body.charCodeAt(idx) === 61 /* '=' */) {
        pad++;
      } else if (tailIsPct3D(idx)) {
        pad++;
      }
    }

    const groups = Math.floor(effectiveLen / 4);
    const bytes = groups * 3 - (pad || 0);
    return bytes > 0 ? bytes : 0;
  }

  return Buffer.byteLength(body, 'utf8');
}
