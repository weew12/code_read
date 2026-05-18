/**
 * Vue Router 滚动行为模块
 * ==========================
 *
 * 本模块负责管理路由导航时的页面滚动位置。
 *
 * 功能：
 * 1. 计算当前滚动位置
 * 2. 保存滚动位置到历史记录
 * 3. 恢复滚动位置
 * 4. 执行滚动到指定位置
 *
 * 滚动位置类型：
 * - ScrollPositionCoordinates: { left, top, behavior }
 * - ScrollPositionElement: { el, offset }
 */

import type {
  RouteLocationNormalized,
  RouteLocationNormalizedLoaded,
} from './typed-routes'
import { warn } from './warning'

/**
 * 滚动位置坐标
 *
 * @remarks
 * 类似于 Web API ScrollToOptions。
 * 注意：并非所有浏览器都支持 behavior 参数。
 */
export type ScrollPositionCoordinates = {
  behavior?: ScrollOptions['behavior']
  left?: number
  top?: number
}

/**
 * 标准化后的滚动位置
 *
 * @remarks
 * 内部类型，始终包含 left 和 top 坐标。
 * 必须是一个类型，以便赋值给 HistoryStateValue。
 *
 * @internal
 */
export type _ScrollPositionNormalized = {
  behavior?: ScrollOptions['behavior']
  left: number
  top: number
}

/**
 * scrollBehavior 选项的类型
 *
 * @remarks
 * 这是一个函数类型，在每次路由导航时调用。
 *
 * @param to - 目标路由位置
 * @param from - 来源路由位置
 * @param savedPosition - 保存的位置（浏览器后退时）
 */
export interface RouterScrollBehavior {
  (
    to: RouteLocationNormalized,
    from: RouteLocationNormalizedLoaded,
    savedPosition: _ScrollPositionNormalized | null
  ): Awaitable<ScrollPosition | false | void>
}

/**
 * 元素滚动位置
 *
 * @remarks
 * 通过 CSS 选择器指定要滚动到的元素。
 *
 * @example
 * ```typescript
 * { el: '#section-id' }
 * { el: '.class-name' }
 * { el: document.querySelector('#id') }
 * ```
 */
export interface ScrollPositionElement extends ScrollToOptions {
  /**
   * CSS 选择器或 Element
   *
   * @remarks
   * ID 选择器中的特殊字符需要转义：
   * - `#1-thing` → `#\\31 -thing`
   * - `#with~symbols` → `#with\\\\~symbols`
   */
  el: string | Element
}

/**
 * 滚动位置联合类型
 */
export type ScrollPosition = ScrollPositionCoordinates | ScrollPositionElement

type Awaitable<T> = T | PromiseLike<T>

/**
 * 滚动行为处理器接口
 *
 * @internal
 */
export interface ScrollBehaviorHandler<T> {
  (
    to: RouteLocationNormalized,
    from: RouteLocationNormalizedLoaded,
    savedPosition: T | void
  ): Awaitable<ScrollPosition | false | void>
}

/**
 * 计算元素相对于文档的绝对位置
 *
 * @param el - DOM 元素
 * @param offset - 偏移量
 * @returns 绝对滚动位置
 */
function getElementPosition(
  el: Element,
  offset: ScrollPositionCoordinates
): _ScrollPositionNormalized {
  const docRect = document.documentElement.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()

  return {
    behavior: offset.behavior,
    left: elRect.left - docRect.left - (offset.left || 0),
    top: elRect.top - docRect.top - (offset.top || 0),
  }
}

/**
 * 获取当前滚动位置
 *
 * @returns 当前滚动位置
 */
export const computeScrollPosition = (): _ScrollPositionNormalized => ({
  left: window.scrollX,
  top: window.scrollY,
})

/**
 * 滚动到指定位置
 *
 * @remarks
 * 支持两种位置指定方式：
 * 1. 直接坐标：{ left, top, behavior }
 * 2. 元素选择器：{ el, offset }
 *
 * ID 选择器需要特殊处理转义字符。
 */
export function scrollToPosition(position: ScrollPosition): void {
  let scrollToOptions: ScrollPositionCoordinates

  if ('el' in position) {
    const positionEl = position.el
    const isIdSelector =
      typeof positionEl === 'string' && positionEl.startsWith('#')

    /**
     * ID 选择器的转义说明
     *
     * ID 可以包含几乎任何字符，包括 CSS 选择器组合符如 > 或 ~。
     * 使用 document.getElementById('~') 可以获取元素，
     * 但使用 document.querySelector('#\\~') 时需要转义。
     *
     * 需要转义的例子：
     * - `#1-thing` → `#\\31 -thing`
     * - `#with~symbols` → `#with\\~symbols`
     */
    if (__DEV__ && typeof position.el === 'string') {
      if (!isIdSelector || !document.getElementById(position.el.slice(1))) {
        try {
          const foundEl = document.querySelector(position.el)
          if (isIdSelector && foundEl) {
            warn(
              `The selector "${position.el}" should be passed as "el: document.querySelector('${position.el}')" because it starts with "#".`
            )
            return
          }
        } catch {
          warn(
            `The selector "${position.el}" is invalid. If you are using an id selector, make sure to escape it. You can find more information at https://mathiasbynens.be/notes/css-escapes or use CSS.escape.`
          )
          return
        }
      }
    }

    const el =
      typeof positionEl === 'string'
        ? isIdSelector
          ? document.getElementById(positionEl.slice(1))
          : document.querySelector(positionEl)
        : positionEl

    if (!el) {
      __DEV__ &&
        warn(
          `Couldn't find element using selector "${position.el}" returned by scrollBehavior.`
        )
      return
    }
    scrollToOptions = getElementPosition(el, position)
  } else {
    scrollToOptions = position
  }

  // 检查浏览器是否支持 scrollBehavior
  if ('scrollBehavior' in document.documentElement.style)
    window.scrollTo(scrollToOptions)
  else {
    // 回退到不支持 behavior 的浏览器
    window.scrollTo(
      scrollToOptions.left != null ? scrollToOptions.left : window.scrollX,
      scrollToOptions.top != null ? scrollToOptions.top : window.scrollY
    )
  }
}

/**
 * 生成滚动键
 *
 * @remarks
 * 用于在历史状态中存储和检索滚动位置。
 *
 * @param path - 路由路径
 * @param delta - 步长
 */
export function getScrollKey(path: string, delta: number): string {
  const position: number = history.state ? history.state.position - delta : -1
  return position + path
}

/**
 * 存储滚动位置的 Map
 *
 * @internal
 */
export const scrollPositions = new Map<string, _ScrollPositionNormalized>()

/**
 * 保存滚动位置
 *
 * @param key - 滚动键
 * @param scrollPosition - 滚动位置
 */
export function saveScrollPosition(
  key: string,
  scrollPosition: _ScrollPositionNormalized
) {
  scrollPositions.set(key, scrollPosition)
}

/**
 * 获取并清除保存的滚动位置
 *
 * @remarks
 * 获取后会从 Map 中删除，避免重复使用。
 *
 * @param key - 滚动键
 */
export function getSavedScrollPosition(key: string) {
  const scroll = scrollPositions.get(key)
  scrollPositions.delete(key)
  return scroll
}