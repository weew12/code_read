import type { TypesConfig } from '../../config'

/**
 * The default error type used for data loaders. Can be customized via {@link TypesConfig}.
 * 数据加载器使用的默认错误类型，可通过 TypesConfig 自定义
 *
 * @example
 * ```ts
 * // types-extension.d.ts
 * import 'vue-router/experimental'
 * export {}
 * declare module 'vue-router/experimental' {
 *   interface TypesConfig {
 *     Error: MyCustomError
 *   }
 * }
 * ```
 *
 * @internal
 */
export type ErrorDefault =
  TypesConfig extends Record<'Error', infer E> ? E : Error
