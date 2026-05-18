/**
 * Vue Router RouterLink 组件
 * ============================
 *
 * 本模块提供 RouterLink 组件和 useLink composable。
 *
 * RouterLink 是 Vue Router 的导航链接组件，提供：
 * 1. 自动解析路由到 href
 * 2. active/exactActive 类名控制
 * 3. 防止默认点击行为的处理
 * 4. View Transitions API 支持
 *
 * useLink 是 RouterLink 的逻辑部分，可在自定义组件中复用。
 */

import {
  defineComponent,
  h,
  type PropType,
  inject,
  computed,
  reactive,
  unref,
  type VNode,
  type UnwrapRef,
  type VNodeProps,
  type AllowedComponentProps,
  type ComponentCustomProps,
  getCurrentInstance,
  watchEffect,
  type ComputedRef,
  type MaybeRef,
  type AnchorHTMLAttributes,
} from 'vue'
import { isSameRouteLocationParams, isSameRouteRecord } from './location'
import { routerKey, routeLocationKey } from './injectionSymbols'
import type { RouteRecord } from './matcher/types'
import type { NavigationFailure } from './errors'
import { isArray, isBrowser, noop } from './utils'
import { warn } from './warning'
import { isRouteLocation } from './types'
import type {
  RouteLocation,
  RouteLocationAsPath,
  RouteLocationAsRelativeTyped,
  RouteLocationAsString,
  RouteLocationRaw,
  RouteLocationResolved,
  RouteMap,
} from './typed-routes'

/**
 * RouterLink 选项
 */
export interface RouterLinkOptions {
  /**
   * 目标路由位置
   */
  to: RouteLocationRaw

  /**
   * 是否使用 replace 而非 push
   */
  replace?: boolean
}

/**
 * RouterLink Props
 */
export interface RouterLinkProps extends RouterLinkOptions {
  /**
   * 是否使用自定义渲染（不包裹 a 标签）
   */
  custom?: boolean

  /**
   * 激活时的类名
   */
  activeClass?: string

  /**
   * 精确激活时的类名
   */
  exactActiveClass?: string

  /**
   * 精确激活时 aria-current 的值
   *
   * @defaultValue `'page'`
   */
  ariaCurrentValue?:
    | 'page'
    | 'step'
    | 'location'
    | 'date'
    | 'time'
    | 'true'
    | 'false'

  /**
   * 是否启用 View Transitions API
   */
  viewTransition?: boolean
}

/**
 * DevTools 上下文
 *
 * @internal
 */
export interface UseLinkDevtoolsContext {
  route: RouteLocationResolved
  isActive: boolean
  isExactActive: boolean
  error: string | null
}

/**
 * useLink 选项
 */
export interface UseLinkOptions<Name extends keyof RouteMap = keyof RouteMap> {
  to: MaybeRef<
    | RouteLocationAsString
    | RouteLocationAsRelativeTyped<RouteMap, Name>
    | RouteLocationAsPath
    | RouteLocationRaw
  >

  replace?: MaybeRef<boolean | undefined>

  viewTransition?: boolean
}

/**
 * useLink 返回值
 *
 * @internal
 */
export interface UseLinkReturn<Name extends keyof RouteMap = keyof RouteMap> {
  route: ComputedRef<RouteLocationResolved<Name>>
  href: ComputedRef<string>
  isActive: ComputedRef<boolean>
  isExactActive: ComputedRef<boolean>
  navigate(e?: MouseEvent): Promise<void | NavigationFailure>
}

/**
 * useLink - RouterLink 的逻辑部分
 *
 * @remarks
 * 返回 RouterLink 的核心逻辑，不包含渲染部分。
 * 可用于创建自定义导航组件。
 *
 * @param props - 包含 to 和 replace 选项
 * @returns 路由链接的响应式状态和导航函数
 *
 * @example
 * ```typescript
 * const { route, isActive, navigate } = useLink({ to: '/users' })
 * ```
 */
export function useLink<Name extends keyof RouteMap = keyof RouteMap>(
  props: UseLinkOptions<Name>
): UseLinkReturn<Name> {
  const router = inject(routerKey)!
  const currentRoute = inject(routeLocationKey)!

  let hasPrevious = false
  let previousTo: unknown = null

  /**
   * 解析后的路由
   */
  const route = computed(() => {
    const to = unref(props.to)

    if (__DEV__ && (!hasPrevious || to !== previousTo)) {
      if (!isRouteLocation(to)) {
        if (hasPrevious) {
          warn(
            `Invalid value for prop "to" in useLink()\n- to:`,
            to,
            `\n- previous to:`,
            previousTo,
            `\n- props:`,
            props
          )
        } else {
          warn(
            `Invalid value for prop "to" in useLink()\n- to:`,
            to,
            `\n- props:`,
            props
          )
        }
      }

      previousTo = to
      hasPrevious = true
    }

    return router.resolve(to)
  })

  /**
   * 匹配路由记录在当前路由中的索引
   *
   * @remarks
   * 用于确定 isActive 和 isExactActive 状态。
   * 需要处理嵌套路由的情况。
   */
  const activeRecordIndex = computed<number>(() => {
    const { matched } = route.value
    const { length } = matched
    const routeMatched: RouteRecord | undefined = matched[length - 1]
    const currentMatched = currentRoute.matched

    if (!routeMatched || !currentMatched.length) return -1

    // 在当前路由中查找匹配的记录
    const index = currentMatched.findIndex(
      isSameRouteRecord.bind(null, routeMatched)
    )

    if (index > -1) return index

    // 处理父记录的情况
    const parentRecordPath = getOriginalPath(
      matched[length - 2] as RouteRecord | undefined
    )

    return (
      // 嵌套路由
      length > 1 &&
      // 父路由和当前匹配路由路径相同，说明是空子路由
      getOriginalPath(routeMatched) === parentRecordPath &&
      // 避免将子路由与父路由比较
      currentMatched[currentMatched.length - 1].path !== parentRecordPath
        ? currentMatched.findIndex(
            isSameRouteRecord.bind(null, matched[length - 2])
          )
        : index
    )
  })

  /**
   * 是否激活（包含当前路由）
   */
  const isActive = computed<boolean>(
    () =>
      activeRecordIndex.value > -1 &&
      includesParams(currentRoute.params, route.value.params)
  )

  /**
   * 是否精确激活（完全匹配当前路由）
   */
  const isExactActive = computed<boolean>(
    () =>
      activeRecordIndex.value > -1 &&
      activeRecordIndex.value === currentRoute.matched.length - 1 &&
      isSameRouteLocationParams(currentRoute.params, route.value.params)
  )

  /**
   * 执行导航
   */
  function navigate(
    e: MouseEvent = {} as MouseEvent
  ): Promise<void | NavigationFailure> {
    if (guardEvent(e)) {
      const p = router[unref(props.replace) ? 'replace' : 'push'](
        unref(props.to)
      ).catch(noop)

      // View Transitions API 支持
      if (
        props.viewTransition &&
        typeof document !== 'undefined' &&
        'startViewTransition' in document
      ) {
        document.startViewTransition(() => p)
      }
      return p
    }
    return Promise.resolve()
  }

  // DevTools 支持
  if ((__DEV__ || __FEATURE_PROD_DEVTOOLS__) && isBrowser) {
    const instance = getCurrentInstance()
    if (instance) {
      const linkContextDevtools: UseLinkDevtoolsContext = {
        route: route.value,
        isActive: isActive.value,
        isExactActive: isExactActive.value,
        error: null,
      }

      // @ts-expect-error: internal
      instance.__vrl_devtools = instance.__vrl_devtools || []
      // @ts-expect-error: internal
      instance.__vrl_devtools.push(linkContextDevtools)

      watchEffect(
        () => {
          linkContextDevtools.route = route.value
          linkContextDevtools.isActive = isActive.value
          linkContextDevtools.isExactActive = isExactActive.value
          linkContextDevtools.error = isRouteLocation(unref(props.to))
            ? null
            : 'Invalid "to" value'
        },
        { flush: 'post' }
      )
    }
  }

  return {
    route,
    href: computed(() => route.value.href),
    isActive,
    isExactActive,
    navigate,
  }
}

/**
 * 优先返回单个 VNode
 */
function preferSingleVNode(vnodes: VNode[]) {
  return vnodes.length === 1 ? vnodes[0] : vnodes
}

/**
 * RouterLink 组件实现
 */
export const RouterLinkImpl = /*#__PURE__*/ defineComponent({
  name: 'RouterLink',
  compatConfig: { MODE: 3 },
  props: {
    to: {
      type: [String, Object] as PropType<RouteLocationRaw>,
      required: true,
    },
    replace: Boolean,
    activeClass: String,
    exactActiveClass: String,
    custom: Boolean,
    ariaCurrentValue: {
      type: String as PropType<RouterLinkProps['ariaCurrentValue']>,
      default: 'page',
    },
    viewTransition: Boolean,
  },

  useLink,

  setup(props, { slots }) {
    const link = reactive(useLink(props))
    const { options } = inject(routerKey)!

    /**
     * 计算类名
     */
    const elClass = computed(() => ({
      [getLinkClass(
        props.activeClass,
        options.linkActiveClass,
        'router-link-active'
      )]: link.isActive,
      [getLinkClass(
        props.exactActiveClass,
        options.linkExactActiveClass,
        'router-link-exact-active'
      )]: link.isExactActive,
    }))

    return () => {
      const children = slots.default && preferSingleVNode(slots.default(link))
      return props.custom
        ? children
        : h(
            'a',
            {
              'aria-current': link.isExactActive
                ? props.ariaCurrentValue
                : null,
              href: link.href,
              onClick: link.navigate,
              class: elClass.value,
            },
            children
          )
    }
  },
})

export const RouterLink: _RouterLinkI = RouterLinkImpl as any

type _RouterLinkPropsTypedBase = AllowedComponentProps &
  ComponentCustomProps &
  VNodeProps &
  RouterLinkProps

type RouterLinkPropsTyped<Custom extends boolean | undefined> =
  Custom extends true
    ? _RouterLinkPropsTypedBase & { custom: true }
    : _RouterLinkPropsTypedBase & { custom?: false | undefined } & Omit<
          AnchorHTMLAttributes,
          'href'
        >

export interface _RouterLinkI {
  new <Custom extends boolean | undefined = boolean | undefined>(): {
    $props: RouterLinkPropsTyped<Custom>

    $slots: {
      default?: ({
        route,
        href,
        isActive,
        isExactActive,
        navigate,
      }: UnwrapRef<UseLinkReturn>) => VNode[]
    }
  }

  useLink: typeof useLink
}

/**
 * 检查点击事件是否可以触发导航
 *
 * @remarks
 * 排除以下情况：
 * - Ctrl/Alt/Meta/Shift 组合键点击
 * - 阻止默认行为的点击
 * - 右键点击
 * - target="_blank" 的链接
 *
 * @param e - 鼠标事件
 */
function guardEvent(e: MouseEvent) {
  // 排除组合键
  if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return
  // 排除已阻止默认的点击
  if (e.defaultPrevented) return
  // 排除右键
  if (e.button !== undefined && e.button !== 0) return
  // 排除 target="_blank"
  if (e.currentTarget && e.currentTarget.getAttribute) {
    const target = e.currentTarget.getAttribute('target')
    if (/\b_blank\b/i.test(target)) return
  }
  // 阻止默认行为
  if (e.preventDefault) e.preventDefault()

  return true
}

/**
 * 检查内部参数是否包含在外部参数中
 *
 * @param outer - 外部参数（当前路由）
 * @param inner - 内部参数（目标路由）
 */
function includesParams(
  outer: RouteLocation['params'],
  inner: RouteLocation['params']
): boolean {
  for (const key in inner) {
    const innerValue = inner[key]
    const outerValue = outer[key]
    if (typeof innerValue === 'string') {
      if (innerValue !== outerValue) return false
    } else {
      if (
        !isArray(outerValue) ||
        outerValue.length !== innerValue.length ||
        innerValue.some(
          (value, i) => value.valueOf() !== outerValue[i].valueOf()
        )
      )
        return false
    }
  }

  return true
}

/**
 * 获取路由记录的原始路径
 *
 * @param record - 路由记录
 * @returns 原始路径（如果是别名则跟随 aliasOf）
 */
function getOriginalPath(record: RouteRecord | undefined): string {
  return record ? (record.aliasOf ? record.aliasOf.path : record.path) : ''
}

/**
 * 获取链接类名
 *
 * @remarks
 * 优先级：propClass > globalClass > defaultClass
 */
const getLinkClass = (
  propClass: string | undefined,
  globalClass: string | undefined,
  defaultClass: string
): string =>
  propClass != null
    ? propClass
    : globalClass != null
      ? globalClass
      : defaultClass