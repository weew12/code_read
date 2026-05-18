/**
 * 类型配置接口
 *
 * @remarks
 * 用于扩展全局类型：$router、$route、组件守卫等。
 * 仅供内部使用。
 *
 * @example
 * ```typescript
 * declare module 'vue-router' {
 *   interface TypesConfig {
 *     $router: typeof myRouter
 *   }
 * }
 * ```
 */
export interface TypesConfig {}
