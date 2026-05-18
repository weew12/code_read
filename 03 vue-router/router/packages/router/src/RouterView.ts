/**
 * Vue Router RouterView 组件
 * ============================
 *
 * 本模块提供 RouterView 组件，用于渲染当前路由匹配的组件。
 *
 * 核心功能：
 * 1. 根据当前路由渲染匹配的组件
 * 2. 处理嵌套路由（通过 provide/inject 传递深度信息）
 * 3. 支持命名视图（通过 name prop）
 * 4. 管理组件实例（复用、卸载）
 * 5. 传递路由 props（params、query 等）
 * 6. 支持 keep-alive 兼容性
 * 7. 触发 beforeRouteEnter 回调
 */

import type {
  PropType,
  ComponentPublicInstance,
  VNodeProps,
  AllowedComponentProps,
  ComponentCustomProps,
  Slot,
  VNode,
  Component,
} from 'vue'
import {
  h,
  inject,
  provide,
  defineComponent,
  ref,
  unref,
  getCurrentInstance,
  computed,
  watch,
} from 'vue'
import type {
  RouteLocationNormalized,
  RouteLocationNormalizedLoaded,
} from './typed-routes'
import type { RouteLocationMatched } from './types'
import {
  matchedRouteKey,
  viewDepthKey,
  routerViewLocationKey,
} from './injectionSymbols'
import { assign, isArray, isBrowser } from './utils'
import { warn } from './warning'
import { isSameRouteRecord } from './location'

/**
 * RouterView Props
 */
export interface RouterViewProps {
  /**
   * 命名视图名称
   */
  name?: string

  /**
   * 可选的路由对象（用于自定义）
   */
  route?: RouteLocationNormalized
}

/**
 * DevTools 上下文
 */
export interface RouterViewDevtoolsContext extends Pick<
  RouteLocationMatched,
  'path' | 'name' | 'meta'
> {
  depth: number
}

/**
 * RouterView 组件实现
 */
export const RouterViewImpl = /*#__PURE__*/ defineComponent({
  name: 'RouterView',
  inheritAttrs: false,
  props: {
    name: {
      type: String as PropType<string>,
      default: 'default',
    },
    route: Object as PropType<RouteLocationNormalizedLoaded>,
  },

  compatConfig: { MODE: 3 },

  setup(props, { attrs, slots }) {
    __DEV__ && warnDeprecatedUsage()

    // 注入当前路由
    const injectedRoute = inject(routerViewLocationKey)!
    const routeToDisplay = computed<RouteLocationNormalizedLoaded>(
      () => props.route || injectedRoute.value
    )

    // 注入深度（用于嵌套路由）
    const injectedDepth = inject(viewDepthKey, 0)

    /**
     * 计算当前视图深度
     *
     * @remarks
     * 深度表示当前 RouterView 在嵌套路由中的层级。
     * 跳过没有组件的路由记录（用于路径重用的场景）。
     */
    const depth = computed<number>(() => {
      let initialDepth = unref(injectedDepth)
      const { matched } = routeToDisplay.value
      let matchedRoute: RouteLocationMatched | undefined

      while (
        (matchedRoute = matched[initialDepth]) &&
        !matchedRoute.components
      ) {
        initialDepth++
      }

      return initialDepth
    })

    // 当前匹配的路由记录
    const matchedRouteRef = computed<RouteLocationMatched | undefined>(
      () => routeToDisplay.value.matched[depth.value]
    )

    // 提供给子组件的深度（递增）
    provide(
      viewDepthKey,
      computed(() => depth.value + 1)
    )

    // 提供当前匹配路由记录
    provide(matchedRouteKey, matchedRouteRef)

    // 提供路由对象
    provide(routerViewLocationKey, routeToDisplay)

    // 组件实例引用
    const viewRef = ref<ComponentPublicInstance>()

    /**
     * 监听变化
     *
     * @remarks
     * 同时监听三组变化：
     * 1. viewRef - 组件实例
     * 2. matchedRouteRef - 路由记录
     * 3. props.name - 视图名称
     *
     * 执行以下操作：
     * - 更新 instances 引用
     * - 复制守卫（复用组件时）
     * - 触发 beforeRouteEnter 回调
     */
    watch(
      () => [viewRef.value, matchedRouteRef.value, props.name] as const,
      ([instance, to, name], [oldInstance, from, _oldName]) => {
        if (to) {
          // 更新实例引用
          to.instances[name] = instance

          /**
           * 复制守卫到新路由记录
           *
           * @remarks
           * 当组件被复用但路由记录改变时（如动态路由参数变化），
           * 需要将守卫从旧记录复制到新记录。
           * 这在异步 setup 时尤为重要。
           */
          if (from && from !== to && instance && instance === oldInstance) {
            if (!to.leaveGuards.size) {
              to.leaveGuards = from.leaveGuards
            }
            if (!to.updateGuards.size) {
              to.updateGuards = from.updateGuards
            }
          }
        }

        // 触发 beforeRouteEnter 回调
        if (
          instance &&
          to &&
          // 确保不是首次访问
          (!from || !isSameRouteRecord(to, from) || !oldInstance)
        ) {
          ;(to.enterCallbacks[name] || []).forEach(callback =>
            callback(instance)
          )
        }
      },
      { flush: 'post' }
    )

    return () => {
      const route = routeToDisplay.value
      const currentName = props.name
      const matchedRoute = matchedRouteRef.value

      // 获取要渲染的组件
      const ViewComponent =
        matchedRoute && matchedRoute.components![currentName]

      if (!ViewComponent) {
        return normalizeSlot(slots.default, { Component: ViewComponent, route })
      }

      /**
       * 计算路由 props
       *
       * @remarks
       * 根据路由配置中的 props 选项，决定如何传递数据给组件：
       * - true: 传递 route.params
       * - 函数: 调用函数获取 props
       * - 对象: 直接使用对象
       */
      const routePropsOption = matchedRoute.props[currentName]
      const routeProps = routePropsOption
        ? routePropsOption === true
          ? route.params
          : typeof routePropsOption === 'function'
            ? routePropsOption(route)
            : routePropsOption
        : null

      /**
       * 卸载时清理实例引用
       */
      const onVnodeUnmounted: VNodeProps['onVnodeUnmounted'] = vnode => {
        if (vnode.component!.isUnmounted) {
          matchedRoute.instances[currentName] = null
        }
      }

      // 渲染组件
      const component = h(
        ViewComponent,
        assign({}, routeProps, attrs, {
          onVnodeUnmounted,
          ref: viewRef,
        })
      )

      // DevTools 支持
      if (
        (__DEV__ || __FEATURE_PROD_DEVTOOLS__) &&
        isBrowser &&
        component.ref
      ) {
        const info: RouterViewDevtoolsContext = {
          depth: depth.value,
          name: matchedRoute.name,
          path: matchedRoute.path,
          meta: matchedRoute.meta,
        }

        const internalInstances = isArray(component.ref)
          ? component.ref.map(r => r.i)
          : [component.ref.i]

        internalInstances.forEach(instance => {
          // @ts-expect-error
          instance.__vrv_devtools = info
        })
      }

      return (
        normalizeSlot(slots.default, { Component: component, route }) ||
        component
      )
    }
  },
})

/**
 * 规范化插槽
 *
 * @remarks
 * 如果插槽只有一个元素，直接返回；否则返回数组。
 */
function normalizeSlot(slot: Slot | undefined, data: any) {
  if (!slot) return null
  const slotContent = slot(data)
  return slotContent.length === 1 ? slotContent[0] : slotContent
}

export const RouterView = RouterViewImpl as unknown as {
  new (): {
    $props: AllowedComponentProps &
      ComponentCustomProps &
      VNodeProps &
      RouterViewProps

    $slots: {
      default?: ({
        Component,
        route,
      }: {
        Component: VNode
        route: RouteLocationNormalizedLoaded
      }) => VNode[]
    }
  }
}

/**
 * 警告废弃用法
 *
 * @remarks
 * RouterView 不能直接在 <transition> 或 <keep-alive> 内使用。
 * 需要使用插槽 props 方式。
 */
function warnDeprecatedUsage() {
  const instance = getCurrentInstance()!
  const parentName = instance.parent && instance.parent.type.name
  const parentSubTreeType =
    instance.parent && instance.parent.subTree && instance.parent.subTree.type

  if (
    parentName &&
    (parentName === 'KeepAlive' || parentName.includes('Transition')) &&
    typeof parentSubTreeType === 'object' &&
    (parentSubTreeType as Component).name === 'RouterView'
  ) {
    const comp = parentName === 'KeepAlive' ? 'keep-alive' : 'transition'
    warn(
      `<router-view> can no longer be used directly inside <transition> or <keep-alive>.\n` +
        `Use slot props instead:\n\n` +
        `<router-view v-slot="{ Component }">\n` +
        `  <${comp}>\n` +
        `    <component :is="Component" />\n` +
        `  </${comp}>\n` +
        `</router-view>`
    )
  }
}