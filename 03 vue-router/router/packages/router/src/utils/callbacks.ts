/**
 * 回调管理器
 * ===========
 *
 * 本模块创建一个可添加、移除和重置的回调列表。
 * 用于管理导航守卫（beforeEach、beforeResolve、afterEach）。
 */

export function useCallbacks<T>() {
  /** 回调处理器列表 */
  let handlers: T[] = []

  /**
   * 添加回调
   *
   * @returns 移除该回调的函数
   */
  function add(handler: T): () => void {
    handlers.push(handler)
    return () => {
      const i = handlers.indexOf(handler)
      if (i > -1) handlers.splice(i, 1)
    }
  }

  /** 重置列表 */
  function reset() {
    handlers = []
  }

  return {
    add,
    list: () => handlers.slice(),
    reset,
  }
}