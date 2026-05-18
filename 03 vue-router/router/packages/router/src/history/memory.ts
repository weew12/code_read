/**
 * Vue Router Memory History 实现
 * ================================
 *
 * 本模块实现基于内存的路由历史记录管理。
 * 主要用于 SSR（服务端渲染）环境。
 *
 * 特点：
 * 1. 不依赖浏览器 API，纯内存实现
 * 2. 初始位置为空（START），需要手动导航到真实位置
 * 3. 支持队列式的历史记录管理
 */

import type {
  RouterHistory,
  NavigationCallback,
  HistoryState,
  NavigationInformation,
  HistoryLocation,
} from './common'
import {
  START,
  NavigationType,
  NavigationDirection,
  normalizeBase,
  createHref,
} from './common'

/**
 * 创建 Memory History
 *
 * @remarks
 * 用于 SSR 环境，不依赖浏览器 URL。
 * 初始时队列只有一个空位置，用户需通过 push/replace 替换。
 *
 * @param base - 基础路径，默认 '/'
 */
export function createMemoryHistory(base: string = ''): RouterHistory {
  let listeners: NavigationCallback[] = []
  let queue: [url: HistoryLocation, state: HistoryState][] = [[START, {}]]
  let position: number = 0

  base = normalizeBase(base)

  /**
   * 设置位置
   *
   * @remarks
   * 如果在队列中间添加，会截断后面的历史。
   */
  function setLocation(location: HistoryLocation, state: HistoryState = {}) {
    position++
    if (position !== queue.length) {
      queue.splice(position)
    }
    queue.push([location, state])
  }

  /**
   * 触发监听器
   */
  function triggerListeners(
    to: HistoryLocation,
    from: HistoryLocation,
    { direction, delta }: Pick<NavigationInformation, 'direction' | 'delta'>
  ): void {
    const info: NavigationInformation = {
      direction,
      delta,
      type: NavigationType.pop,
    }
    for (const callback of listeners) {
      callback(to, from, info)
    }
  }

  const routerHistory: RouterHistory = {
    location: START,
    state: {},
    base,
    createHref: createHref.bind(null, base),

    replace(to, state?: HistoryState) {
      queue.splice(position--, 1)
      setLocation(to, state)
    },

    push(to, state?: HistoryState) {
      setLocation(to, state)
    },

    listen(callback) {
      listeners.push(callback)
      return () => {
        const index = listeners.indexOf(callback)
        if (index > -1) listeners.splice(index, 1)
      }
    },

    destroy() {
      listeners = []
      queue = [[START, {}]]
      position = 0
    },

    go(delta, shouldTrigger = true) {
      const from = this.location
      const direction: NavigationDirection =
        delta < 0 ? NavigationDirection.back : NavigationDirection.forward

      position = Math.max(0, Math.min(position + delta, queue.length - 1))

      if (shouldTrigger) {
        triggerListeners(this.location, from, {
          direction,
          delta,
        })
      }
    },
  }

  // 使用 defineProperty 使 location 和 state 成为 getter
  Object.defineProperty(routerHistory, 'location', {
    enumerable: true,
    get: () => queue[position][0],
  })

  Object.defineProperty(routerHistory, 'state', {
    enumerable: true,
    get: () => queue[position][1],
  })

  // 测试用 API
  if (__TEST__) {
    // @ts-expect-error: only for tests
    routerHistory.changeURL = function (url: string, state: HistoryState = {}) {
      const from = this.location
      queue.splice(position++ + 1, queue.length, [url, state])
      triggerListeners(this.location, from, {
        direction: NavigationDirection.unknown,
        delta: 0,
      })
    }
  }

  return routerHistory
}