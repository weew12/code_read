/**
 * Vue Router 类型定义模块
 * ========================
 *
 * 本模块定义 Vue Router 的核心类型。
 *
 * 主要类型分类：
 * 1. 路由记录类型（RouteRecord*）
 * 2. 路由位置类型（RouteLocation*）
 * 3. 参数类型（RouteParams*）
 * 4. 匹配器类型（MatcherLocation*）
 */

import type { LocationQuery, LocationQueryRaw } from '../query'
import type { PathParserOptions } from '../matcher'
import type { Ref, Component, DefineComponent } from 'vue'
import type { RouteRecord, RouteRecordNormalized } from '../matcher/types'
import type { HistoryState } from '../history/common'
import type {
  NavigationGuardWithThis,
  RouteLocation,
  RouteRecordRedirectOption,
  _RouteRecordProps,
  RouteRecordNameGeneric,
} from '../typed-routes'
import type { _Awaitable } from './utils'

/** 懒加载组件类型 */
export type Lazy<T> = () => Promise<T>

/** 类型覆盖工具 */
export type Override<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U

/** 不可变类型 */
export type Immutable<T> = {
  readonly [P in keyof T]: Immutable<T[P]>
}

/** VueUse 选项类型（支持 Ref 或普通值） */
export type VueUseOptions<T> = {
  [k in keyof T]: Ref<T[k]> | T[k]
}

export type TODO = any

/** 路由参数值类型 */
export type RouteParamValue = string

/** 原始路由参数值类型 */
export type RouteParamValueRaw = RouteParamValue | number | null | undefined

/** 路由参数字典 */
export type RouteParamsGeneric = Record<
  string,
  RouteParamValue | RouteParamValue[]
>

/** 原始路由参数字典 */
export type RouteParamsRawGeneric = Record<
  string,
  RouteParamValueRaw | Exclude<RouteParamValueRaw, null | undefined>[]
>

/** 查询参数和 hash */
export interface RouteQueryAndHash {
  query?: LocationQueryRaw
  hash?: string
}

/** 按路径匹配的路由位置 */
export interface MatcherLocationAsPath {
  path: string
}

/** 按名称匹配的路由位置 */
export interface MatcherLocationAsName {
  name: RouteRecordNameGeneric
  path?: undefined
  params?: RouteParamsGeneric
}

/** 相对路由位置 */
export interface MatcherLocationAsRelative {
  path?: undefined
  params?: RouteParamsGeneric
}

/** 相对路由位置（原始） */
export interface LocationAsRelativeRaw {
  name?: RouteRecordNameGeneric
  path?: undefined
  params?: RouteParamsRawGeneric
}

/**
 * 导航选项
 */
export interface RouteLocationOptions {
  /** 在历史记录中替换而非添加新条目 */
  replace?: boolean

  /** 强制触发导航，即使位置相同 */
  force?: boolean

  /** 使用 History API 保存的状态 */
  state?: HistoryState
}

/** 按名称解析的路由位置 */
export interface RouteLocationNamedRaw
  extends RouteQueryAndHash, LocationAsRelativeRaw, RouteLocationOptions {}

/** 按路径解析的路由位置 */
export interface RouteLocationPathRaw
  extends RouteQueryAndHash, MatcherLocationAsPath, RouteLocationOptions {}

/** 匹配的路由位置 */
export interface RouteLocationMatched extends RouteRecordNormalized {
  components: Record<string, RouteComponent> | null | undefined
}

/** 标准化路由位置的基础属性 */
export interface _RouteLocationBase extends Pick<
  MatcherLocation,
  'name' | 'path' | 'params' | 'meta'
> {
  /** 完整路径（包含 search 和 hash，已编码） */
  fullPath: string

  /** 查询参数对象 */
  query: LocationQuery

  /** hash 值，以 # 开头 */
  hash: string

  /** 重定向来源 */
  redirectedFrom: RouteLocation | undefined
}

/** 路由组件类型 */
export type RouteComponent = Component | DefineComponent

/** 用户提供的路由组件类型 */
export type RawRouteComponent = RouteComponent | Lazy<RouteComponent>

/**
 * 路由记录基类
 *
 * @remarks
 * 所有路由记录类型的公共接口。
 */
export interface _RouteRecordBase extends PathParserOptions {
  /** 路径（以 / 开头） */
  path: string

  /** 重定向目标 */
  redirect?: RouteRecordRedirectOption

  /** 别名 */
  alias?: string | string[]

  /** 路由名称（唯一） */
  name?: RouteRecordNameGeneric

  /** 路由独享守卫 */
  beforeEnter?:
    | NavigationGuardWithThis<undefined>
    | NavigationGuardWithThis<undefined>[]

  /** 自定义元数据 */
  meta?: RouteMeta

  /** 子路由数组 */
  children?: RouteRecordRaw[]

  /** 是否将参数作为 props 传递 */
  props?: _RouteRecordProps | Record<string, _RouteRecordProps>
}

/**
 * 路由记录元数据类型
 *
 * @remarks
 * 用于扩展路由记录的 meta 字段类型。
 *
 * @example
 * ```typescript
 * declare module 'vue-router' {
 *   interface RouteMeta {
 *     requiresAuth?: boolean
 *   }
 * }
 * ```
 */
export interface RouteMeta extends Record<PropertyKey, unknown> {}

/** 单视图路由记录 */
export interface RouteRecordSingleView extends _RouteRecordBase {
  component: RawRouteComponent
  components?: never
  children?: never
  redirect?: never
  props?: _RouteRecordProps
}

/** 带子路由的单视图路由记录 */
export interface RouteRecordSingleViewWithChildren extends _RouteRecordBase {
  component?: RawRouteComponent | null | undefined
  components?: never
  children: RouteRecordRaw[]
  props?: _RouteRecordProps
}

/** 多视图路由记录 */
export interface RouteRecordMultipleViews extends _RouteRecordBase {
  components: Record<string, RawRouteComponent>
  component?: never
  children?: never
  redirect?: never
  props?: Record<string, _RouteRecordProps> | boolean
}

/** 带子路由的多视图路由记录 */
export interface RouteRecordMultipleViewsWithChildren extends _RouteRecordBase {
  components?: Record<string, RawRouteComponent> | null | undefined
  component?: never
  children: RouteRecordRaw[]
  props?: Record<string, _RouteRecordProps> | boolean
}

/** 重定向路由记录 */
export interface RouteRecordRedirect extends _RouteRecordBase {
  redirect: RouteRecordRedirectOption
  component?: never
  components?: never
  props?: never
}

/** 路由记录联合类型 */
export type RouteRecordRaw =
  | RouteRecordSingleView
  | RouteRecordSingleViewWithChildren
  | RouteRecordMultipleViews
  | RouteRecordMultipleViewsWithChildren
  | RouteRecordRedirect

/**
 * 传递给匹配器的路由位置
 */
export type MatcherLocationRaw =
  | MatcherLocationAsPath
  | MatcherLocationAsName
  | MatcherLocationAsRelative

/**
 * 匹配器返回的标准化路由位置
 */
export interface MatcherLocation {
  /** 匹配的路由名称 */
  name: RouteRecordNameGeneric | null | undefined

  /** URL 路径（已编码） */
  path: string

  /** 解码后的参数 */
  params: RouteParamsGeneric

  /** 合并后的 meta */
  meta: RouteMeta

  /** 匹配的路由记录数组 */
  matched: RouteRecord[]
}

export * from './typeGuards'

/** 可变类型（移除 readonly） */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P]
}