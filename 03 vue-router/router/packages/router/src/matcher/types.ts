/**
 * 路由记录标准化类型
 * ======================
 *
 * 用户定义的路由配置经标准化后得到的内部类型。
 * 包含组件实例、守卫、别名等运行时信息。
 */

import type {
  NavigationGuard,
  NavigationGuardNextCallback,
  _RouteRecordProps,
} from '../typed-routes'
import type {
  RouteRecordMultipleViews,
  _RouteRecordBase,
  RouteRecordRaw,
} from '../types'
import type { ComponentPublicInstance } from 'vue'

/**
 * 标准化的路由记录
 *
 * @remarks
 * 与用户定义的 RouteRecordRaw 不同，RouteRecordNormalized 是内部使用的类型，
 * 包含运行时信息和标准化后的数据。
 */
export interface RouteRecordNormalized {
  path: _RouteRecordBase['path']
  redirect: _RouteRecordBase['redirect'] | undefined
  name: _RouteRecordBase['name']
  components: RouteRecordMultipleViews['components'] | null | undefined

  /**
   * 懒加载组件的原始模块
   */
  mods: Record<string, unknown>

  children: RouteRecordRaw[]
  meta: Exclude<_RouteRecordBase['meta'], void>
  props: Record<string, _RouteRecordProps>
  beforeEnter: _RouteRecordBase['beforeEnter']

  /**
   * 离开守卫
   */
  leaveGuards: Set<NavigationGuard>

  /**
   * 更新守卫
   */
  updateGuards: Set<NavigationGuard>

  /**
   * beforeRouteEnter 的回调
   */
  enterCallbacks: Record<string, NavigationGuardNextCallback[]>

  /**
   * 挂载的组件实例
   */
  instances: Record<string, ComponentPublicInstance | undefined | null>

  /**
   * 是否为别名记录
   */
  aliasOf: RouteRecordNormalized | undefined
}

/**
 * 路由记录类型
 */
export type RouteRecord = RouteRecordNormalized
