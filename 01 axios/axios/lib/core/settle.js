'use strict';

// settle 函数：根据响应状态决定是 resolve 还是 reject Promise
import AxiosError from './AxiosError.js';

/**
 * Resolve or reject a Promise based on response status.
 * 根据响应状态决定是解决（resolve）还是拒绝（reject）Promise
 *
 * @param {Function} resolve A function that resolves the promise. - 解决 Promise 的函数
 * @param {Function} reject A function that rejects the promise. - 拒绝 Promise 的函数
 * @param {object} response The response. - 响应对象
 *
 * @returns {object} The response. - 响应对象
 */
export default function settle(resolve, reject, response) {
  const validateStatus = response.config.validateStatus;  // 获取状态验证函数
  // 如果没有状态码、没有验证函数或验证通过，则 resolve
  if (!response.status || !validateStatus || validateStatus(response.status)) {
    resolve(response);
  } else {
    // 否则 reject，创建适当的错误对象
    reject(
      new AxiosError(
        'Request failed with status code ' + response.status,  // 错误消息
        // 根据状态码范围选择错误代码：4xx 使用 ERR_BAD_REQUEST，5xx 使用 ERR_BAD_RESPONSE
        [AxiosError.ERR_BAD_REQUEST, AxiosError.ERR_BAD_RESPONSE][
          Math.floor(response.status / 100) - 4  // 4xx -> 0, 5xx -> 1
        ],
        response.config,    // 请求配置
        response.request,   // 请求对象
        response            // 响应对象
      )
    );
  }
}
