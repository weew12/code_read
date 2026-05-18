/**
 * 环境检测工具
 * =============
 *
 * 本模块提供浏览器环境检测。
 */

/**
 * 是否在浏览器环境中运行
 */
export const isBrowser = typeof document !== 'undefined'