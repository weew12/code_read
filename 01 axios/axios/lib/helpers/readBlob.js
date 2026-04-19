/**
 * @file Blob数据读取适配器
 * 
 * 功能：提供统一的Blob读取接口，支持多种Blob读取方式（流、ArrayBuffer、异步迭代器）。
 * 这是axios中处理浏览器File/Blob对象的核心工具，确保在不同浏览器和环境中的兼容性。
 * 
 * 读取优先级（从最优到最差）：
 * 1. blob.stream() - 现代浏览器的流式API（内存效率最高）
 * 2. blob.arrayBuffer() - 标准ArrayBuffer读取
 * 3. blob[Symbol.asyncIterator]() - 异步迭代器接口
 * 4. 直接返回blob - 回退方案（兼容旧环境）
 * 
 * 设计目的：抽象不同Blob实现的差异，为上层提供一致的异步迭代器接口。
 */

const { asyncIterator } = Symbol;

/**
 * 异步读取Blob数据的生成器函数
 * 
 * 功能：将Blob对象转换为异步可迭代的二进制数据流。
 * 根据Blob对象支持的方法选择最优读取策略，确保内存效率和兼容性。
 * 
 * @param {Blob} blob - 要读取的Blob对象
 * @yields {ArrayBuffer|Uint8Array|Blob} 二进制数据块
 */
const readBlob = async function* (blob) {
  if (blob.stream) {
    yield* blob.stream();
  } else if (blob.arrayBuffer) {
    yield await blob.arrayBuffer();
  } else if (blob[asyncIterator]) {
    yield* blob[asyncIterator]();
  } else {
    yield blob;
  }
};

export default readBlob;
