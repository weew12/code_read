/**
 * 数据加载器上下文和工具函数
 *
 * 本模块提供数据加载器的运行时上下文管理和通用工具函数。
 */
import type { LocationQuery } from '../../query'
import type { Router } from '../../router'
import type { RouteLocationNormalizedLoaded } from '../../typed-routes'
import type { DataLoaderEntryBase, UseDataLoader } from './createDataLoader'
import { IS_USE_DATA_LOADER_KEY } from './meta-extensions'

/**
 * Check if a value is a `DataLoader`.
 * 检查对象是否为数据加载器（通过 IS_USE_DATA_LOADER_KEY 标识）
 *
 * @param loader - the object to check
 */
export function isDataLoader(loader: any): loader is UseDataLoader {
  return loader && loader[IS_USE_DATA_LOADER_KEY]
}

/**
 * @internal: data loaders authoring only. Use `getCurrentContext` instead.
 * 当前数据加载器执行上下文
 */
export let currentContext:
  | readonly [
      entry: DataLoaderEntryBase,
      router: Router,
      route: RouteLocationNormalizedLoaded,
    ]
  | undefined
  | null

export function getCurrentContext() {
  // an empty array allows destructuring without checking if it's undefined
  return currentContext || ([] as const)
}

// TODO: rename parentContext
/**
 * Sets the current context for data loaders. This allows for nested loaders to be aware of their parent context.
 * 设置当前上下文，用于嵌套加载器感知父级上下文
 * INTERNAL ONLY.
 *
 * @param context - the context to set
 * @internal
 */
export function setCurrentContext(
  context?: typeof currentContext | readonly []
) {
  currentContext = context ? (context.length ? context : null) : null
}

/**
 * Restore the current context after a promise is resolved.
 * 在 Promise 完成后恢复上下文
 * @param promise - promise to wrap
 */
export function withLoaderContext<P extends Promise<unknown>>(promise: P): P {
  const context = currentContext
  return promise.finally(() => (currentContext = context)) as P
}

/**
 * Object and promise of the object itself. Used when we can await some of the properties of an object to be loaded.
 * 对象与其 Promise 的合并类型，用于等待对象的部分属性加载完成
 * @internal
 */
export type _PromiseMerged<PromiseType, RawType = PromiseType> = RawType &
  Promise<PromiseType>

export const assign = Object.assign

/**
 * Track the reads of a route and its properties
 * 追踪路由及其属性的读取操作，用于数据加载依赖收集
 * @internal
 * @param route - route to track
 */
export function trackRoute(route: RouteLocationNormalizedLoaded) {
  const [params, paramReads] = trackObjectReads(route.params)
  const [query, queryReads] = trackObjectReads(route.query)
  let hash: { v: string | null } = { v: null }
  return [
    {
      ...route,
      // track the hash
      get hash() {
        return (hash.v = route.hash)
      },
      params,
      query,
    },
    paramReads,
    queryReads,
    hash,
  ] as const
}

/**
 *  Track the reads of an object (that doesn't change) and add the read properties to an object
 * 使用 Proxy 追踪对象的属性读取
 * @internal
 * @param obj - object to track
 */
function trackObjectReads<T extends Record<string, unknown>>(obj: T) {
  const reads: Partial<T> = {}
  return [
    new Proxy(obj, {
      get(target, p: Extract<keyof T, string>, receiver) {
        const value = Reflect.get(target, p, receiver)
        reads[p] = value
        return value
      },
    }),
    reads,
  ] as const
}

/**
 * Returns `true` if `inner` is a subset of `outer`. Used to check if a tr
 * 检查 inner 的参数集合是否为 outer 的子集，用于判断路由参数变化是否需要重新加载
 *
 * @internal
 * @param outer - the bigger params
 * @param inner - the smaller params
 */
export function isSubsetOf(
  inner: Partial<LocationQuery>,
  outer: LocationQuery
): boolean {
  for (const key in inner) {
    const innerValue = inner[key]
    const outerValue = outer[key]
    if (typeof innerValue === 'string') {
      if (innerValue !== outerValue) return false
    } else if (!innerValue || !outerValue) {
      // if one of them is undefined, we need to check if the other is undefined too
      if (innerValue !== outerValue) return false
    } else {
      if (
        !Array.isArray(outerValue) ||
        outerValue.length !== innerValue.length ||
        innerValue.some((value, i) => value !== outerValue[i])
      )
        return false
    }
  }

  return true
}
