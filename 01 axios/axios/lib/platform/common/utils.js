/**
 * @file 平台环境检测工具（跨平台兼容性）
 * 
 * 功能：检测当前JavaScript运行环境，区分浏览器、Web Worker、React Native、Node.js等。
 * 这是axios跨平台兼容性的基础，确保在不同环境中使用正确的API和适配器。
 * 
 * 环境检测策略：
 * 1. 浏览器环境：存在window和document对象
 * 2. Web Worker环境：存在WorkerGlobalScope且self是其实例
 * 3. React Native环境：navigator.product === 'ReactNative'
 * 4. NativeScript环境：navigator.product === 'NativeScript' 或 'NS'
 * 5. Node.js环境：以上都不满足，且存在process对象
 * 
 * 设计目的：根据环境选择正确的适配器（xhr/fetch/http）和API实现。
 */

/**
 * 检测是否在浏览器环境中运行
 * 标准浏览器环境特征：存在window和document全局对象
 * 注意：Web Worker中没有window和document，因此返回false
 */
const hasBrowserEnv = typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * 安全的navigator对象引用
 * 使用短路运算确保在非浏览器环境中返回undefined而不是抛出错误
 */
const _navigator = (typeof navigator === 'object' && navigator) || undefined;

/**
 * Determine if we're running in a standard browser environment
 *
 * This allows axios to run in a web worker, and react-native.
 * Both environments support XMLHttpRequest, but not fully standard globals.
 *
 * web workers:
 *  typeof window -> undefined
 *  typeof document -> undefined
 *
 * react-native:
 *  navigator.product -> 'ReactNative'
 * nativescript
 *  navigator.product -> 'NativeScript' or 'NS'
 *
 * 功能：检测是否在标准浏览器环境中运行
 * 标准浏览器环境排除以下情况：
 * 1. Web Worker（无window/document）
 * 2. React Native（navigator.product === 'ReactNative'）
 * 3. NativeScript（navigator.product === 'NativeScript' 或 'NS'）
 * 
 * 设计目的：某些浏览器API（如FormData、Blob）在非标准环境中的行为可能不同，
 * 需要特殊处理或使用polyfill。
 *
 * @returns {boolean}
 */
const hasStandardBrowserEnv =
  hasBrowserEnv &&
  (!_navigator || ['ReactNative', 'NativeScript', 'NS'].indexOf(_navigator.product) < 0);

/**
 * Determine if we're running in a standard browser webWorker environment
 *
 * Although the `isStandardBrowserEnv` method indicates that
 * `allows axios to run in a web worker`, the WebWorker will still be
 * filtered out due to its judgment standard
 * `typeof window !== 'undefined' && typeof document !== 'undefined'`.
 * This leads to a problem when axios post `FormData` in webWorker
 * 
 * 功能：专门检测Web Worker环境
 * Web Worker特征：
 * 1. 存在WorkerGlobalScope全局对象
 * 2. self是WorkerGlobalScope的实例
 * 3. 存在self.importScripts函数（专用Worker API）
 * 
 * 检测必要性：hasStandardBrowserEnv无法检测Web Worker，因为Web Worker没有window/document。
 * 但Web Worker仍支持XMLHttpRequest和Fetch API，需要特殊的环境判断。
 * 
 * 设计目的：确保axios在Web Worker中能正确使用FormData等API。
 */
const hasStandardBrowserWebWorkerEnv = (() => {
  return (
    typeof WorkerGlobalScope !== 'undefined' &&
    // eslint-disable-next-line no-undef
    self instanceof WorkerGlobalScope &&
    typeof self.importScripts === 'function'
  );
})();

/**
 * 当前环境的origin（协议+主机+端口）
 * 
 * 用途：在构建完整URL时作为基础URL，或在跨域检测中使用。
 * 默认值策略：
 * - 在浏览器环境中：使用window.location.href（当前页面URL）
 * - 在非浏览器环境中：使用'http://localhost'作为默认值
 * 
 * 注意：在Node.js或Web Worker中，没有window对象，因此需要默认值。
 * 'http://localhost'是一个安全的默认值，避免URL解析错误。
 */
const origin = (hasBrowserEnv && window.location.href) || 'http://localhost';

export {
  hasBrowserEnv,
  hasStandardBrowserWebWorkerEnv,
  hasStandardBrowserEnv,
  _navigator as navigator,
  origin,
};
