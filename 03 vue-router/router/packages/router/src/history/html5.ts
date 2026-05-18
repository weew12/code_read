/**
 * Vue Router HTML5 History 实现
 * ==============================
 *
 * 本模块实现基于 HTML5 History API 的路由历史记录管理。
 * 使用 history.pushState/replaceState 实现 URL 变化而不触发页面刷新。
 *
 * 核心功能：
 * 1. 状态管理：维护 history.state 包含位置、滚动信息
 * 2. 监听 popstate 事件：处理浏览器前进/后退
 * 3. 滚动位置保存：在页面隐藏时保存滚动位置
 *
 * 状态对象 (StateEntry) 包含：
 * - current: 当前路径
 * - back: 上一个路径
 * - forward: 下一个路径
 * - position: 历史堆栈位置
 * - replaced: 是否被替换
 * - scroll: 滚动位置
 */

import type {
  RouterHistory,
  NavigationCallback,
  HistoryState,
  ValueContainer,
  HistoryLocation,
} from './common'
import {
  NavigationType,
  NavigationDirection,
  normalizeBase,
  createHref,
} from './common'
import type { _ScrollPositionNormalized } from '../scrollBehavior'
import { computeScrollPosition } from '../scrollBehavior'
import { warn } from '../warning'
import { stripBase } from '../location'
import { assign } from '../utils'

type PopStateListener = (this: Window, ev: PopStateEvent) => any

let createBaseLocation = () => location.protocol + '//' + location.host

/**
 * 历史状态条目
 *
 * @remarks
 * 存储在 history.state 中的状态对象。
 */
interface StateEntry extends HistoryState {
  back: HistoryLocation | null
  current: HistoryLocation
  forward: HistoryLocation | null
  position: number
  replaced: boolean
  scroll: _ScrollPositionNormalized | null | false
}

/**
 * 从 window.location 创建标准化路径
 *
 * @param base - 基础路径
 * @param location - window.location 对象
 * @returns 标准化后的路径
 */
function createCurrentLocation(
  base: string,
  location: Location
): HistoryLocation {
  const { pathname, search, hash } = location

  // 处理 hash 基础路径
  const hashPos = base.indexOf('#')
  if (hashPos > -1) {
    let slicePos = hash.includes(base.slice(hashPos))
      ? base.slice(hashPos).length
      : 1
    let pathFromHash = hash.slice(slicePos)
    if (pathFromHash[0] !== '/') pathFromHash = '/' + pathFromHash
    return stripBase(pathFromHash, '')
  }

  const path = stripBase(pathname, base)
  return path + search + hash
}

/**
 * 使用历史记录监听器
 *
 * @remarks
 * 管理 popstate 事件监听和历史状态。
 */
function useHistoryListeners(
  base: string,
  historyState: ValueContainer<StateEntry>,
  currentLocation: ValueContainer<HistoryLocation>,
  replace: RouterHistory['replace']
) {
  let listeners: NavigationCallback[] = []
  let teardowns: Array<() => void> = []

  /** 暂停状态（用于防止某些导航触发监听器） */
  let pauseState: HistoryLocation | null = null

  /**
   * popstate 事件处理
   *
   * @remarks
   * 当用户点击前进/后退按钮时触发。
   */
  const popStateHandler: PopStateListener = ({
    state,
  }: {
    state: StateEntry | null
  }) => {
    const to = createCurrentLocation(base, location)
    const from: HistoryLocation = currentLocation.value
    const fromState: StateEntry = historyState.value
    let delta = 0

    if (state) {
      currentLocation.value = to
      historyState.value = state

      // 忽略暂停状态的导航
      if (pauseState && pauseState === from) {
        pauseState = null
        return
      }

      delta = fromState ? state.position - fromState.position : 0
    } else {
      // 无 state 时（直接访问 URL），执行 replace
      replace(to)
    }

    // 触发所有监听器
    listeners.forEach(listener => {
      listener(currentLocation.value, from, {
        delta,
        type: NavigationType.pop,
        direction: delta
          ? delta > 0
            ? NavigationDirection.forward
            : NavigationDirection.back
          : NavigationDirection.unknown,
      })
    })
  }

  function pauseListeners() {
    pauseState = currentLocation.value
  }

  function listen(callback: NavigationCallback) {
    listeners.push(callback)

    const teardown = () => {
      const index = listeners.indexOf(callback)
      if (index > -1) listeners.splice(index, 1)
    }

    teardowns.push(teardown)
    return teardown
  }

  /**
   * 页面隐藏时保存滚动位置
   *
   * @remarks
   * 使用 pagehide 和 visibilitychange 事件替代 beforeunload
   *（iOS Safari 不触发 beforeunload）
   */
  function beforeUnloadListener() {
    if (document.visibilityState === 'hidden') {
      const { history } = window
      if (!history.state) return
      history.replaceState(
        assign({}, history.state, { scroll: computeScrollPosition() }),
        ''
      )
    }
  }

  function destroy() {
    for (const teardown of teardowns) teardown()
    teardowns = []
    window.removeEventListener('popstate', popStateHandler)
    window.removeEventListener('pagehide', beforeUnloadListener)
    document.removeEventListener('visibilitychange', beforeUnloadListener)
  }

  // 设置监听器
  window.addEventListener('popstate', popStateHandler)
  window.addEventListener('pagehide', beforeUnloadListener)
  document.addEventListener('visibilitychange', beforeUnloadListener)

  return {
    pauseListeners,
    listen,
    destroy,
  }
}

/**
 * 创建状态对象
 */
function buildState(
  back: HistoryLocation | null,
  current: HistoryLocation,
  forward: HistoryLocation | null,
  replaced: boolean = false,
  computeScroll: boolean = false
): StateEntry {
  return {
    back,
    current,
    forward,
    replaced,
    position: window.history.length,
    scroll: computeScroll ? computeScrollPosition() : null,
  }
}

/**
 * 历史状态导航
 *
 * @remarks
 * 管理 pushState/replaceState 调用。
 */
function useHistoryStateNavigation(base: string) {
  const { history, location } = window

  const currentLocation: ValueContainer<HistoryLocation> = {
    value: createCurrentLocation(base, location),
  }
  const historyState: ValueContainer<StateEntry> = { value: history.state }

  // 首次导航时创建历史状态
  if (!historyState.value) {
    changeLocation(
      currentLocation.value,
      {
        back: null,
        current: currentLocation.value,
        forward: null,
        position: history.length - 1,
        replaced: true,
        scroll: null,
      },
      true
    )
  }

  /**
   * 更改 URL
   *
   * @remarks
   * 处理 base 标签和 hash 路由的特殊情况。
   */
  function changeLocation(
    to: HistoryLocation,
    state: StateEntry,
    replace: boolean
  ): void {
    const hashIndex = base.indexOf('#')
    const url =
      hashIndex > -1
        ? (location.host && document.querySelector('base')
            ? base
            : base.slice(hashIndex)) + to
        : createBaseLocation() + base + to

    try {
      history[replace ? 'replaceState' : 'pushState'](state, '', url)
      historyState.value = state
    } catch (err) {
      if (__DEV__) {
        warn('Error with push/replace State', err)
      } else {
        console.error(err)
      }
      // 降级使用 location.assign/replace
      location[replace ? 'replace' : 'assign'](url)
    }
  }

  function replace(to: HistoryLocation, data?: HistoryState) {
    const state: StateEntry = assign(
      {},
      history.state,
      buildState(
        historyState.value.back,
        to,
        historyState.value.forward,
        true
      ),
      data,
      { position: historyState.value.position }
    )

    changeLocation(to, state, true)
    currentLocation.value = to
  }

  function push(to: HistoryLocation, data?: HistoryState) {
    // 保存当前位置到 forward
    const currentState = assign(
      {},
      history.state as Partial<StateEntry> | null,
      {
        forward: to,
        scroll: computeScrollPosition(),
      }
    )

    if (__DEV__ && !history.state) {
      warn(
        `history.state seems to have been manually replaced without preserving the necessary values.`
      )
    }

    changeLocation(currentState.current, currentState, true)

    const state: StateEntry = assign(
      {},
      buildState(currentLocation.value, to, null),
      { position: currentState.position + 1 },
      data
    )

    changeLocation(to, state, false)
    currentLocation.value = to
  }

  return {
    location: currentLocation,
    state: historyState,

    push,
    replace,
  }
}

/**
 * 创建 HTML5 History
 *
 * @remarks
 * 最常用的历史记录实现，适用于单页面应用。
 *
 * @param base - 基础路径，默认为 normalizeBase() 返回值
 */
export function createWebHistory(base?: string): RouterHistory {
  base = normalizeBase(base)

  const historyNavigation = useHistoryStateNavigation(base)
  const historyListeners = useHistoryListeners(
    base,
    historyNavigation.state,
    historyNavigation.location,
    historyNavigation.replace
  )

  function go(delta: number, triggerListeners = true) {
    if (!triggerListeners) historyListeners.pauseListeners()
    history.go(delta)
  }

  const routerHistory: RouterHistory = assign(
    {
      location: '',
      base,
      go,
      createHref: createHref.bind(null, base),
    },

    historyNavigation,
    historyListeners
  )

  // 使用 defineProperty 使 location 和 state 成为 getter
  Object.defineProperty(routerHistory, 'location', {
    enumerable: true,
    get: () => historyNavigation.location.value,
  })

  Object.defineProperty(routerHistory, 'state', {
    enumerable: true,
    get: () => historyNavigation.state.value,
  })

  return routerHistory
}