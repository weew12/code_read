/**
 * Vue Router 工具函数模块
 * ========================
 *
 * 本模块导出常用的工具函数，供其他模块使用。
 */

import type {
  RouteParamsGeneric,
  RouteComponent,
  RouteParamsRawGeneric,
  RawRouteComponent,
} from '../types'

/**
 * 恒等函数，返回值原样输出
 */
export const identityFn = <T>(v: T) => v

export * from './env'

/**
 * 检查是否为有效的路由组件
 *
 * @remarks
 * 用于区分普通组件与函数式组件、懒加载组件。
 * 符合以下任一条件的视为路由组件：
 * - 对象类型（非函数）
 * - 有 displayName 属性
 * - 有 props 属性
 * - 有 __vccOpts 属性（vue-class-component）
 */
export function isRouteComponent(
  component: RawRouteComponent
): component is RouteComponent {
  return (
    typeof component === 'object' ||
    'displayName' in component ||
    'props' in component ||
    '__vccOpts' in component
  )
}

/**
 * 检查是否为 ES 模块
 *
 * @remarks
 * 用于处理动态导入的模块。
 * ES 模块通常有 default 导出。
 */
export function isESModule(obj: any): obj is { default: RouteComponent } {
  return (
    obj.__esModule ||
    obj[Symbol.toStringTag] === 'Module' ||
    (obj.default && isRouteComponent(obj.default))
  )
}

export const assign = Object.assign

/**
 * 对参数对象应用函数
 *
 * @remarks
 * 遍历参数对象，对每个值应用提供的函数。
 * 如果值是数组，对数组中每个元素应用函数。
 *
 * @param fn - 要应用的函数
 * @param params - 参数对象
 * @returns 处理后的新参数对象
 */
export function applyToParams(
  fn: (v: string | number | null | undefined) => string,
  params: RouteParamsRawGeneric | undefined
): RouteParamsGeneric {
  const newParams: RouteParamsGeneric = {}

  for (const key in params) {
    const value = params[key]
    newParams[key] = isArray(value) ? value.map(fn) : fn(value)
  }

  return newParams
}

/**
 * 空函数
 */
export const noop = () => {}

/**
 * 类型安全的 Array.isArray 替代
 *
 * @remarks
 * TypeScript 4.9+ 推荐使用此类型守卫。
 */
export const isArray: (
  arg: ArrayLike<any> | unknown
) => arg is ReadonlyArray<any> = Array.isArray

/**
 * 合并选项对象
 *
 * @remarks
 * 将默认值和部分选项合并。
 * 如果部分选项中有值，使用部分选项的值；否则使用默认值。
 *
 * @param defaults - 默认选项
 * @param partialOptions - 部分选项
 * @returns 合并后的选项
 */
export function mergeOptions<T extends object>(
  defaults: T,
  partialOptions: Partial<T>
): T {
  const options = {} as T
  for (const key in defaults) {
    options[key] = key in partialOptions ? partialOptions[key]! : defaults[key]
  }

  return options
}