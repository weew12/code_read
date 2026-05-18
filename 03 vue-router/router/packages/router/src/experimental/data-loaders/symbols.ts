/**
 * 数据加载器内部 Symbol 符号
 *
 * 这些 Symbol 用于在 Vue Router 内部存储和传递数据加载器相关的状态。
 * 每个 Symbol 对应一个特定的功能，如加载器集合、待处理位置等。
 */

/**
 * Retrieves the internal version of loaders.
 * 在路由记录的 meta 上存储该路由的加载器集合
 * @internal
 */
export const LOADER_SET_KEY = Symbol('loaders')

/**
 * Retrieves the internal version of loader entries.
 * 在 router 实例上存储加载器条目（WeakMap）
 * @internal
 */
export const LOADER_ENTRIES_KEY = Symbol('loaderEntries')

/**
 * Added to the loaders returned by `defineLoader()` to identify them.
 * Allows to extract exported useData() from a component.
 * 标记 defineLoader() 返回的加载器，用于从组件中提取 useData()
 * @internal
 */
export const IS_USE_DATA_LOADER_KEY = Symbol()

/**
 * Symbol used to save the pending location on the router.
 * 在 router 上存储当前正在导航的目标位置
 * @internal
 */
export const PENDING_LOCATION_KEY = Symbol()

/**
 * Symbol used to know there is no value staged for the loader and that commit should be skipped.
 * 标记加载器没有值需要提交，应跳过 commit 阶段
 * @internal
 */
export const STAGED_NO_VALUE = Symbol()

/**
 * Gives access to the current app and it's `runWithContext` method.
 * 提供对当前 app 及其 runWithContext 方法的访问
 * @internal
 */
export const APP_KEY = Symbol()

/**
 * Gives access to an AbortController that aborts when the navigation is canceled.
 * 提供 AbortController，导航取消时自动 abort
 * @internal
 */
export const ABORT_CONTROLLER_KEY = Symbol()

/**
 * Symbol used to save the initial data on the router.
 * 标记当前是否为 SSR 模式
 * @internal
 */
export const IS_SSR_KEY = Symbol()

/**
 * Symbol used to get the effect scope used for data loaders.
 * 获取数据加载器使用的 EffectScope
 * @internal
 */
export const DATA_LOADERS_EFFECT_SCOPE_KEY = Symbol()
