/**
 * Vue Router 历史记录管理基类
 * ==============================
 *
 * 本模块定义路由历史的公共接口和工具函数。
 *
 * 历史记录实现三种模式：
 * 1. HTML5 History - createWebHistory，使用 history.pushState
 * 2. Hash History - createWebHashHistory，使用 location.hash
 * 3. Memory History - createMemoryHistory，用于 SSR/测试环境
 *
 * 核心接口 RouterHistory 提供：
 * - push/replace/go: 导航方法
 * - listen: 监听浏览器前进后退
 * - createHref: 生成链接
 */

import { isBrowser } from '../utils'
import { removeTrailingSlash } from '../location'

/**
 * 历史记录位置类型
 *
 * @remarks
 * 表示 URL 中的路径部分（不含域名和查询字符串）。
 */
export type HistoryLocation = string

/**
 * HTML5 History State 中允许的类型
 *
 * @remarks
 * pushState 只接受可序列化的值：
 * - 不接受 symbols 或 functions
 * - 不接受以 Symbol 为键的对象
 *
 * @internal
 */
export type HistoryStateValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | HistoryState
  | HistoryStateArray

/**
 * History State 对象接口
 *
 * @remarks
 * 用于存储导航历史的状态信息。
 */
export interface HistoryState {
  [x: number]: HistoryStateValue
  [x: string]: HistoryStateValue
}

/**
 * History State 数组接口
 *
 * @internal
 */
export interface HistoryStateArray extends Array<HistoryStateValue> {}

/**
 * 导航类型枚举
 */
export enum NavigationType {
  /** 浏览器前进/后退触发 */
  pop = 'pop',
  /** 程序调用 push 触发 */
  push = 'push',
}

/**
 * 导航方向枚举
 */
export enum NavigationDirection {
  /** 后退 */
  back = 'back',
  /** 前进 */
  forward = 'forward',
  /** 未知方向 */
  unknown = '',
}

/**
 * 导航信息接口
 *
 * @remarks
 * 包含导航的类型、方向和步长。
 */
export interface NavigationInformation {
  /** 导航类型 */
  type: NavigationType
  /** 导航方向 */
  direction: NavigationDirection
  /** 步长（负数表示后退） */
  delta: number
}

/**
 * 导航监听回调函数类型
 *
 * @param to - 目标位置
 * @param from - 起始位置
 * @param information - 导航信息
 */
export interface NavigationCallback {
  (
    to: HistoryLocation,
    from: HistoryLocation,
    information: NavigationInformation
  ): void
}

/**
 * 起始位置
 */
export const START: HistoryLocation = ''

/**
 * 值容器类型
 */
export type ValueContainer<T> = { value: T }

/**
 * 路由历史接口
 *
 * @remarks
 * 这是所有历史记录实现必须实现的接口。
 * 通过依赖注入的方式，router 可以使用不同的历史记录实现。
 *
 * @example
 * ```typescript
 * const history = createWebHistory()
 * const router = createRouter({
 *   history,
 *   routes
 * })
 * ```
 */
export interface RouterHistory {
  /**
   * 基础路径
   *
   * @remarks
   * 预置在每个 URL 之前。
   * 用于在子目录下托管 SPA，如 `example.com/sub-folder`。
   */
  readonly base: string

  /**
   * 当前历史位置
   */
  readonly location: HistoryLocation

  /**
   * 当前历史状态
   */
  readonly state: HistoryState

  /**
   * 导航到新位置
   *
   * @remarks
   * HTML5 History 实现会调用 history.pushState。
   *
   * @param to - 目标位置
   * @param data - 可选的状态数据
   */
  push(to: HistoryLocation, data?: HistoryState): void

  /**
   * 替换当前历史记录
   *
   * @remarks
   * 与 push 类似，但调用 history.replaceState。
   *
   * @param to - 目标位置
   * @param data - 可选的状态数据
   */
  replace(to: HistoryLocation, data?: HistoryState): void

  /**
   * 遍历历史记录
   *
   * @param delta - 步长，负数后退，正数前进
   * @param triggerListeners - 是否触发监听器
   *
   * @example
   * ```typescript
   * history.go(-1)  // 等同于 history.back()
   * history.go(1)   // 等同于 history.forward()
   * ```
   */
  go(delta: number, triggerListeners?: boolean): void

  /**
   * 添加导航监听器
   *
   * @remarks
   * 当浏览器前进/后退按钮触发导航时调用。
   * 或当 back/forward 传入 true 时触发。
   *
   * @param callback - 监听回调
   * @returns 取消监听函数
   */
  listen(callback: NavigationCallback): () => void

  /**
   * 生成锚点 href
   *
   * @param location - 位置
   * @returns href 字符串
   */
  createHref(location: HistoryLocation): string

  /**
   * 销毁历史记录监听
   */
  destroy(): void
}

/**
 * 标准化基础路径
 *
 * @remarks
 * 处理以下情况：
 * 1. 无 base：使用 `<base>` 标签或 `/`
 * 2. 完整 URL：移除域名部分
 * 3. 确保以 `/` 开头
 * 4. 移除尾部斜杠
 *
 * @param base - 原始 base 值
 */
export function normalizeBase(base?: string): string {
  if (!base) {
    if (isBrowser) {
      // 读取 <base> 标签
      const baseEl = document.querySelector('base')
      base = (baseEl && baseEl.getAttribute('href')) || '/'
      // 移除完整 URL 源
      base = base.replace(/^\w+:\/\/[^/]+/, '')
    } else {
      base = '/'
    }
  }

  // 确保以 / 或 # 开头
  if (base[0] !== '/' && base[0] !== '#') base = '/' + base

  // 移除尾部斜杠
  return removeTrailingSlash(base)
}

/**
 * 创建 href
 *
 * @remarks
 * 将 base 和 location 组合成完整的 href。
 * 用于 hash 模式时，base 中的路径部分被替换为 #。
 *
 * @param base - 基础路径
 * @param location - 位置
 * @returns href
 */
const BEFORE_HASH_RE = /^[^#]+#/
export function createHref(base: string, location: HistoryLocation): string {
  return base.replace(BEFORE_HASH_RE, '#') + location
}