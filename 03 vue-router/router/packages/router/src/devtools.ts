/**
 * Vue Router DevTools 集成
 * ==========================
 *
 * 本模块负责 Vue DevTools 的路由面板集成。
 *
 * DevTools 功能：
 * 1. 组件状态显示 $route
 * 2. 路由树查看器（inspector）
 * 3. 导航时间线（timeline）
 * 4. RouterLink/RouterView 组件标签
 */

import { setupDevtoolsPlugin } from '@vue/devtools-api'
import type {
  CustomInspectorNode,
  InspectorNodeTag,
  CustomInspectorState,
  TimelineEvent,
} from '@vue/devtools-kit'
import { type App, watch } from 'vue'
import { decode } from './encoding'
import { isSameRouteRecord } from './location'
import type { RouterMatcher } from './matcher'
import type { RouteRecordMatcher } from './matcher/pathMatcher'
import type { PathParser } from './matcher/pathParserRanker'
import type { Router } from './router'
import type { UseLinkDevtoolsContext } from './RouterLink'
import type { RouterViewDevtoolsContext } from './RouterView'
import { assign, isArray } from './utils'
import type { RouteLocationNormalized } from './typed-routes'

/**
 * 格式化路由位置以便在 DevTools 中显示
 *
 * @remarks
 * 移除无法序列化的属性（如 Vue 实例）。
 */
function formatRouteLocation(
  routeLocation: RouteLocationNormalized,
  tooltip?: string
) {
  const copy = assign({}, routeLocation, {
    matched: routeLocation.matched.map(matched =>
      omit(matched, ['instances', 'children', 'aliasOf'])
    ),
  })

  return {
    _custom: {
      type: null,
      readOnly: true,
      display: routeLocation.fullPath,
      tooltip,
      value: copy,
    },
  }
}

function formatDisplay(display: string) {
  return {
    _custom: {
      display,
    },
  }
}

// 支持多个路由实例
let routerId = 0

/**
 * 添加 DevTools 支持
 */
export function addDevtools(app: App, router: Router, matcher: RouterMatcher) {
  if ((router as any).__hasDevtools) return
  ;(router as any).__hasDevtools = true

  const id = routerId++
  setupDevtoolsPlugin(
    {
      id: 'org.vuejs.router' + (id ? '.' + id : ''),
      label: 'Vue Router',
      packageName: 'vue-router',
      homepage: 'https://router.vuejs.org',
      logo: 'https://router.vuejs.org/logo.png',
      componentStateTypes: ['Routing'],
      app,
    },
    api => {
      // 在组件中显示 $route
      api.on.inspectComponent(payload => {
        if (payload.instanceData) {
          payload.instanceData.state.push({
            type: 'Routing',
            key: '$route',
            editable: false,
            value: formatRouteLocation(
              router.currentRoute.value,
              'Current Route'
            ),
          })
        }
      })

      // RouterView/RouterLink 组件树标签
      api.on.visitComponentTree(({ treeNode: node, componentInstance }) => {
        if (componentInstance.__vrv_devtools) {
          const info =
            componentInstance.__vrv_devtools as RouterViewDevtoolsContext

          node.tags.push({
            label: (info.name ? `${info.name.toString()}: ` : '') + info.path,
            textColor: 0,
            tooltip: 'This component is rendered by <router-view>',
            backgroundColor: PINK_500,
          })
        }

        if (isArray(componentInstance.__vrl_devtools)) {
          componentInstance.__devtoolsApi = api
          ;(
            componentInstance.__vrl_devtools as UseLinkDevtoolsContext[]
          ).forEach(devtoolsData => {
            let label = devtoolsData.route.path
            let backgroundColor = ORANGE_400
            let tooltip: string = ''
            let textColor = 0

            if (devtoolsData.error) {
              label = devtoolsData.error
              backgroundColor = RED_100
              textColor = RED_700
            } else if (devtoolsData.isExactActive) {
              backgroundColor = LIME_500
              tooltip = 'This is exactly active'
            } else if (devtoolsData.isActive) {
              backgroundColor = BLUE_600
              tooltip = 'This link is active'
            }

            node.tags.push({
              label,
              textColor,
              tooltip,
              backgroundColor,
            })
          })
        }
      })

      // 监听路由变化
      watch(router.currentRoute, () => {
        refreshRoutesView()
        api.notifyComponentUpdate()
        api.sendInspectorTree(routerInspectorId)
        api.sendInspectorState(routerInspectorId)
      })

      const navigationsLayerId = 'router:navigations:' + id

      // 导航时间线层
      api.addTimelineLayer({
        id: navigationsLayerId,
        label: `Router${id ? ' ' + id : ''} Navigations`,
        color: 0x40a8c4,
      })

      // 错误处理
      router.onError((error, to) => {
        api.addTimelineEvent({
          layerId: navigationsLayerId,
          event: {
            title: 'Error during Navigation',
            subtitle: to.fullPath,
            logType: 'error',
            time: api.now(),
            data: { error },
            groupId: (to.meta as any).__navigationId,
          },
        })
      })

      let navigationId = 0

      // beforeEach 时间线事件
      router.beforeEach((to, from) => {
        const data: TimelineEvent<any, any>['data'] = {
          guard: formatDisplay('beforeEach'),
          from: formatRouteLocation(
            from,
            'Current Location during this navigation'
          ),
          to: formatRouteLocation(to, 'Target location'),
        }

        Object.defineProperty(to.meta, '__navigationId', {
          value: navigationId++,
        })

        api.addTimelineEvent({
          layerId: navigationsLayerId,
          event: {
            time: api.now(),
            title: 'Start of navigation',
            subtitle: to.fullPath,
            data,
            groupId: (to.meta as any).__navigationId,
          },
        })
      })

      // afterEach 时间线事件
      router.afterEach((to, from, failure) => {
        const data: TimelineEvent<any, any>['data'] = {
          guard: formatDisplay('afterEach'),
        }

        if (failure) {
          data.failure = {
            _custom: {
              type: Error,
              readOnly: true,
              display: failure ? failure.message : '',
              tooltip: 'Navigation Failure',
              value: failure,
            },
          }
          data.status = formatDisplay('❌')
        } else {
          data.status = formatDisplay('✅')
        }

        data.from = formatRouteLocation(
          from,
          'Current Location during this navigation'
        )
        data.to = formatRouteLocation(to, 'Target location')

        api.addTimelineEvent({
          layerId: navigationsLayerId,
          event: {
            title: 'End of navigation',
            subtitle: to.fullPath,
            time: api.now(),
            data,
            logType: failure ? 'warning' : 'default',
            groupId: (to.meta as any).__navigationId,
          },
        })
      })

      // 路由检查器
      const routerInspectorId = 'router-inspector:' + id

      api.addInspector({
        id: routerInspectorId,
        label: 'Routes' + (id ? ' ' + id : ''),
        icon: 'book',
        treeFilterPlaceholder: 'Search routes',
      })

      function refreshRoutesView() {
        if (!activeRoutesPayload) return
        const payload = activeRoutesPayload

        let routes = matcher.getRoutes().filter(
          route =>
            !route.parent ||
            !route.parent.record.components
        )

        routes.forEach(resetMatchStateOnRouteRecord)

        if (payload.filter) {
          routes = routes.filter(route =>
            isRouteMatching(route, payload.filter.toLowerCase())
          )
        }

        routes.forEach(route =>
          markRouteRecordActive(route, router.currentRoute.value)
        )
        payload.rootNodes = routes.map(formatRouteRecordForInspector)
      }

      type GetInspectorTreePayload = Parameters<
        Parameters<typeof api.on.getInspectorTree>[0]
      >[0]

      let activeRoutesPayload: GetInspectorTreePayload | undefined
      api.on.getInspectorTree(payload => {
        activeRoutesPayload = payload
        if (payload.app === app && payload.inspectorId === routerInspectorId) {
          refreshRoutesView()
        }
      })

      // 选中路由记录时显示状态
      api.on.getInspectorState(payload => {
        if (payload.app === app && payload.inspectorId === routerInspectorId) {
          const routes = matcher.getRoutes()
          const route = routes.find(
            route => (route.record as any).__vd_id === payload.nodeId
          )

          if (route) {
            payload.state = {
              options: formatRouteRecordMatcherForStateInspector(route),
            }
          }
        }
      })

      api.sendInspectorTree(routerInspectorId)
      api.sendInspectorState(routerInspectorId)
    }
  )
}

/**
 * 获取参数键的修饰符
 */
function modifierForKey(key: PathParser['keys'][number]) {
  if (key.optional) {
    return key.repeatable ? '*' : '?'
  } else {
    return key.repeatable ? '+' : ''
  }
}

/**
 * 格式化路由记录状态
 */
function formatRouteRecordMatcherForStateInspector(
  route: RouteRecordMatcher
): CustomInspectorState[string] {
  const { record } = route
  const fields: CustomInspectorState[string] = [
    { editable: false, key: 'path', value: record.path },
  ]

  if (record.name != null) {
    fields.push({
      editable: false,
      key: 'name',
      value: record.name,
    })
  }

  fields.push({ editable: false, key: 'regexp', value: route.re })

  if (route.keys.length) {
    fields.push({
      editable: false,
      key: 'keys',
      value: {
        _custom: {
          type: null,
          readOnly: true,
          display: route.keys
            .map(key => `${key.name}${modifierForKey(key)}`)
            .join(' '),
          tooltip: 'Param keys',
          value: route.keys,
        },
      },
    })
  }

  if (record.redirect != null) {
    fields.push({
      editable: false,
      key: 'redirect',
      value: record.redirect,
    })
  }

  if (route.alias.length) {
    fields.push({
      editable: false,
      key: 'aliases',
      value: route.alias.map(alias => alias.record.path),
    })
  }

  if (Object.keys(route.record.meta).length) {
    fields.push({
      editable: false,
      key: 'meta',
      value: route.record.meta,
    })
  }

  fields.push({
    key: 'score',
    editable: false,
    value: {
      _custom: {
        type: null,
        readOnly: true,
        display: route.score.map(score => score.join(', ')).join(' | '),
        tooltip: 'Score used to sort routes',
        value: route.score,
      },
    },
  })

  return fields
}

// Tailwind 调色板颜色
const PINK_500 = 0xec4899
const BLUE_600 = 0x2563eb
const LIME_500 = 0x84cc16
const CYAN_400 = 0x22d3ee
const ORANGE_400 = 0xfb923c
const DARK = 0x666666
const RED_100 = 0xfee2e2
const RED_700 = 0xb91c1c

/**
 * 格式化路由记录以在检查器树中显示
 */
function formatRouteRecordForInspector(
  route: RouteRecordMatcher
): CustomInspectorNode {
  const tags: InspectorNodeTag[] = []
  const { record } = route

  if (record.name != null) {
    tags.push({
      label: String(record.name),
      textColor: 0,
      backgroundColor: CYAN_400,
    })
  }

  if (record.aliasOf) {
    tags.push({
      label: 'alias',
      textColor: 0,
      backgroundColor: ORANGE_400,
    })
  }

  if ((route as any).__vd_match) {
    tags.push({
      label: 'matches',
      textColor: 0,
      backgroundColor: PINK_500,
    })
  }

  if ((route as any).__vd_exactActive) {
    tags.push({
      label: 'exact',
      textColor: 0,
      backgroundColor: LIME_500,
    })
  }

  if ((route as any).__vd_active) {
    tags.push({
      label: 'active',
      textColor: 0,
      backgroundColor: BLUE_600,
    })
  }

  if (record.redirect) {
    tags.push({
      label:
        typeof record.redirect === 'string'
          ? `redirect: ${record.redirect}`
          : 'redirects',
      textColor: 0xffffff,
      backgroundColor: DARK,
    })
  }

  // 添加 ID 以便选择
  let id = (record as any).__vd_id
  if (id == null) {
    id = String(routeRecordId++)
    ;(record as any).__vd_id = id
  }

  return {
    id,
    label: record.path,
    tags,
    children: route.children.map(formatRouteRecordForInspector),
  }
}

let routeRecordId = 0

const EXTRACT_REGEXP_RE = /^\/(.*)\/([a-z]*)$/

/**
 * 标记路由记录为活跃状态
 */
function markRouteRecordActive(
  route: RouteRecordMatcher,
  currentRoute: RouteLocationNormalized
) {
  const isExactActive =
    currentRoute.matched.length &&
    isSameRouteRecord(
      currentRoute.matched[currentRoute.matched.length - 1],
      route.record
    )
  ;(route as any).__vd_exactActive = (route as any).__vd_active = isExactActive

  if (!isExactActive) {
    ;(route as any).__vd_active = currentRoute.matched.some(match =>
      isSameRouteRecord(match, route.record)
    )
  }

  route.children.forEach(childRoute =>
    markRouteRecordActive(childRoute, currentRoute)
  )
}

/**
 * 重置路由记录的匹配状态
 */
function resetMatchStateOnRouteRecord(route: RouteRecordMatcher) {
  ;(route as any).__vd_match = false
  route.children.forEach(resetMatchStateOnRouteRecord)
}

/**
 * 检查路由是否匹配过滤器
 */
function isRouteMatching(route: RouteRecordMatcher, filter: string): boolean {
  const found = String(route.re).match(EXTRACT_REGEXP_RE)
  ;(route as any).__vd_match = false

  if (!found || found.length < 3) {
    return false
  }

  const nonEndingRE = new RegExp(found[1].replace(/\$$/, ''), found[2])
  if (nonEndingRE.test(filter)) {
    route.children.forEach(child => isRouteMatching(child, filter))
    if (route.record.path !== '/' || filter === '/') {
      ;(route as any).__vd_match = route.re.test(filter)
      return true
    }
    return false
  }

  const path = route.record.path.toLowerCase()
  const decodedPath = decode(path)

  if (
    !filter.startsWith('/') &&
    (decodedPath.includes(filter) || path.includes(filter))
  )
    return true
  if (decodedPath.startsWith(filter) || path.startsWith(filter)) return true
  if (route.record.name && String(route.record.name).includes(filter))
    return true

  return route.children.some(child => isRouteMatching(child, filter))
}

/**
 * 对象属性省略工具
 */
function omit<T extends object, K extends [...(keyof T)[]]>(obj: T, keys: K) {
  const ret = {} as {
    [K2 in Exclude<keyof T, K[number]>]: T[K2]
  }

  for (const key in obj) {
    if (!keys.includes(key)) {
      // @ts-expect-error
      ret[key] = obj[key]
    }
  }
  return ret
}