/**
 * 全局编译时常量
 *
 * 这些常量在构建时被注入，用于条件编译：
 * - __DEV__: 开发环境
 * - __TEST__: 测试环境
 * - __FEATURE_PROD_DEVTOOLS__: 生产环境 DevTools
 * - __STRIP_DEVTOOLS__: 移除 DevTools（IIFE 构建）
 * - __BROWSER__: 浏览器环境
 */

declare var __DEV__: boolean
declare var __TEST__: boolean
declare var __FEATURE_PROD_DEVTOOLS__: boolean
declare var __STRIP_DEVTOOLS__: boolean
declare var __BROWSER__: boolean
