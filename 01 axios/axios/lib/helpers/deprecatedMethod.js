'use strict';

/**
 * @file 方法弃用警告工具
 * 
 * 功能：向开发者发出警告，提示他们正在使用已弃用的方法。
 * 这是axios的API演化管理工具，用于平滑过渡到新API，避免破坏性变更。
 * 
 * 实现特点：
 * 1. 使用console.warn输出可读的警告信息
 * 2. 提供替代方法建议和文档链接
 * 3. 错误安全：在console不可用或出错时静默失败
 * 4. 无依赖：纯函数，不依赖外部状态
 */

/*eslint no-console:0*/

/**
 * 向开发者发出方法弃用警告
 *
 * 功能：在控制台输出警告信息，提示用户某个方法已弃用，并提供替代方法和文档链接。
 * 警告信息包括：弃用方法名称、替代方法建议（如有）、弃用说明和文档链接（如有）。
 * 
 * 设计目的：帮助开发者平滑迁移到新API，减少升级时的困惑和错误。
 *
 * @param {string} method - 已弃用方法的名称
 * @param {string} [instead] - 可用的替代方法（如果有）
 * @param {string} [docs] - 获取更多详细信息的文档URL
 *
 * @returns {void}
 */
export default function deprecatedMethod(method, instead, docs) {
  try {
    console.warn(
      'DEPRECATED method `' +
        method +
        '`.' +
        (instead ? ' Use `' + instead + '` instead.' : '') +
        ' This method will be removed in a future release.'
    );

    if (docs) {
      console.warn('For more information about usage see ' + docs);
    }
  } catch (e) {
    /* Ignore */
  }
}
