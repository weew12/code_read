# Vue Router 源码深度解析

## 概述

本文档从源码分析角度，系统解读 Vue Router 5.0.4 的设计与实现。Vue Router 是 Vue 3 官方路由管理器，以其声明式路由配置、强大的导航守卫、嵌套路由支持而广受欢迎。

### 核心特性

- **声明式路由**：基于配置的路由系统
- **嵌套路由**：多层级路由嵌套支持
- **导航守卫**：完整的路由生命周期控制
- **历史记录管理**：HTML5 / Hash / Memory 三种模式
- **类型安全**：完整的 TypeScript 类型推导
- **自动路由**：通过 unplugin 支持文件系统路由
- **DevTools 集成**：开发时路由可视化

### 版本信息

- 当前分析版本：5.0.4
- 源码位置：`./router/packages/router/src/`
- 分析范围：核心源代码（非测试代码）

---

## 架构设计

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     入口层 (index.ts)                       │
│           统一导出 ES Module / CommonJS API                  │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Router (router.ts)                        │
│        路由实例管理、导航控制、守卫调度 (~1088行)              │
└─────────────────────────────────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   RouterMatcher   │ │   RouterHistory   │ │   NavigationGuards │
│    (matcher/)     │ │   (history/)      │ │                    │
│                  │ │                   │ │                    │
│ - addRoute       │ │ - HTML5 History   │ │ - beforeEach      │
│ - resolve        │ │ - Hash History    │ │ - beforeResolve    │
│ - path ranking   │ │ - Memory History  │ │ - afterEach       │
└──────────────────┘ └──────────────────┘ └──────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│    RouteRecord   │ │   Location        │ │   RouteComponent  │
│  (pathMatcher)   │ │   (URL parse)    │ │   (lazy loading)  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

### 设计原则

1. **分层架构**：清晰的职责分离，每层只关注特定功能
2. **适配器模式**：统一接口，多种历史记录实现
3. **守卫模式**：可插拔的导航生命周期
4. **响应式设计**：Vue 3 Composition API 深度集成
5. **类型安全**：完整的 TypeScript 类型推导
6. **渐进增强**：从基础路由到高级特性的平滑过渡

### 核心设计模式

- **工厂模式**：`createRouter` 函数创建可配置的路由实例
- **适配器模式**：`RouterHistory` 接口隐藏环境差异
- **发布-订阅模式**：`useCallbacks` 管理回调列表
- **策略模式**：`tokensToParser` 路径解析与排名
- **装饰器模式**：组件守卫提取装饰路由记录

---

## 目录结构详解

### 项目根目录

```
vue-router/
└── packages/
    └── router/                    # 主包
        ├── src/                   # 核心源代码
        │   ├── index.ts           # 主入口，导出所有公共 API
        │   ├── router.ts          # Router 类实现 (~1088行)
        │   ├── location.ts        # 位置标准化与 URL 解析
        │   ├── query.ts           # 查询参数解析与序列化
        │   ├── encoding.ts        # URL 编解码工具
        │   ├── errors.ts          # 导航错误类型定义
        │   ├── warning.ts         # 警告信息工具
        │   ├── config.ts          # 全局配置 (TypesConfig)
        │   ├── devtools.ts        # Vue DevTools 集成
        │   ├── scrollBehavior.ts   # 滚动行为控制
        │   ├── injectionSymbols.ts # Vue 注入符号
        │   │
        │   ├── history/           # 历史记录管理
        │   │   ├── common.ts      # RouterHistory 接口定义
        │   │   ├── html5.ts        # HTML5 History 实现
        │   │   ├── hash.ts         # Hash History 实现
        │   │   └── memory.ts       # Memory History 实现
        │   │
        │   ├── matcher/           # 路由匹配系统
        │   │   ├── index.ts        # RouterMatcher 接口与创建函数
        │   │   ├── types.ts        # 路由记录类型定义
        │   │   ├── pathMatcher.ts  # 路径匹配器实现
        │   │   ├── pathParserRanker.ts  # 路径解析与排名
        │   │   └── pathTokenizer.ts    # 路径分词器
        │   │
        │   ├── components/        # 路由组件
        │   │   ├── RouterLink.ts   # RouterLink 组件
        │   │   └── RouterView.ts   # RouterView 组件
        │   │
        │   ├── navigationGuards.ts # 导航守卫核心逻辑
        │   │
        │   ├── typed-routes/      # 类型安全的路由 API
        │   │   ├── index.ts       # 主类型导出
        │   │   ├── route-records.ts  # 路由记录类型
        │   │   ├── route-location.ts # 路由位置类型
        │   │   ├── route-map.ts   # 路由地图类型
        │   │   ├── params.ts      # 参数类型
        │   │   └── navigation-guards.ts # 导航守卫类型
        │   │
        │   ├── types/             # 核心类型定义
        │   │   ├── index.ts       # 主类型导出
        │   │   ├── utils.ts       # 类型工具函数
        │   │   └── typeGuards.ts  # 类型守卫
        │   │
        │   ├── useApi.ts          # Composition API 入口
        │   │
        │   ├── experimental/      # 实验性功能
        │   │   ├── router.ts      # 实验性 Router 扩展
        │   │   ├── runtime.ts     # 运行时支持
        │   │   └── route-resolver/ # 路由解析器
        │   │
        │   ├── unplugin/          # 自动路由插件
        │   │   ├── index.ts        # 主入口
        │   │   ├── vite.ts         # Vite 插件
        │   │   ├── webpack.ts      # Webpack 插件
        │   │   ├── core/           # 核心逻辑
        │   │   │   ├── definePage.ts
        │   │   │   ├── extendRoutes.ts
        │   │   │   ├── tree.ts
        │   │   │   └── ...
        │   │   └── codegen/        # 代码生成
        │   │
        │   ├── utils/             # 通用工具函数
        │   │   ├── index.ts       # 工具导出
        │   │   ├── env.ts         # 环境检测
        │   │   └── callbacks.ts   # 回调工具
        │   │
        │   └── tests/             # 测试数据与工具
        │
        ├── __tests__/             # 单元测试
        ├── e2e/                   # 端到端测试
        └── package.json
```

### 核心目录功能说明

#### 1. `src/router.ts` - 路由核心

- **`createRouter`**：工厂函数，创建路由实例
- **`Router` 类**：管理路由、导航、守卫
- **`push/replace`**：导航方法
- **`beforeEach/beforeResolve/afterEach`**：全局守卫

#### 2. `src/matcher/` - 路由匹配系统

- **`createRouterMatcher`**：创建匹配器
- **`createRouteRecordMatcher`**：创建路由记录匹配器
- **`tokensToParser`**：将路径 token 转为解析器
- **`comparePathParserScore`**：路径排名比较

#### 3. `src/history/` - 历史记录管理

- **`RouterHistory`** 接口：统一的历史记录操作
- **`createWebHistory`**：HTML5 History API
- **`createWebHashHistory`**：基于 hash 的历史
- **`createMemoryHistory`**：内存历史（SSR）

#### 4. `src/navigationGuards.ts` - 导航守卫

- **`guardToPromiseFn`**：将守卫转为 Promise
- **`extractComponentsGuards`**：提取组件守卫
- **`extractChangingRecords`**：提取变化的路由记录

#### 5. `src/components/` - 路由组件

- **`RouterLink`**：声明式导航链接
- **`RouterView`**：路由视图渲染

---

## 代码执行流程分析

### 1. 初始化阶段

#### 1.1 模块加载

```typescript
// index.ts 主入口
export { createRouter } from './router'
export { createWebHistory, createWebHashHistory, createMemoryHistory } from './history'
export { RouterLink, RouterView } from './components'
// ... 其他导出
```

#### 1.2 路由实例创建

```typescript
// router.ts:130-150
export function createRouter(options: RouterOptions): Router {
  // 1. 创建路由匹配器
  const matcher = createRouterMatcher(options.routes, options)

  // 2. 获取历史记录实例
  const routerHistory = options.history

  // 3. 创建守卫回调管理器
  const beforeGuards = useCallbacks<NavigationGuardWithThis<undefined>>()
  const beforeResolveGuards = useCallbacks<NavigationGuardWithThis<undefined>>()
  const afterGuards = useCallbacks<NavigationHookAfter>()

  // 4. 创建响应式当前路由
  const currentRoute = shallowRef<RouteLocationNormalizedLoaded>(
    START_LOCATION_NORMALIZED
  )

  // 5. 参数编解码函数
  const encodeParams = applyToParams.bind(null, encodeParam)
  const decodeParams = applyToParams.bind(null, decode)

  // ... 返回 router 实例
}
```

#### 1.3 应用安装

```typescript
// router.ts:1012-1076
install(app: App) {
  // 1. 注册全局组件
  app.component('RouterLink', RouterLink)
  app.component('RouterView', RouterView)

  // 2. 注入 $router 和 $route
  app.config.globalProperties.$router = router
  Object.defineProperty(app.config.globalProperties, '$route', {
    get: () => unref(currentRoute),
  })

  // 3. 提供响应式路由信息
  app.provide(routerKey, router)
  app.provide(routeLocationKey, shallowReactive(reactiveRoute))
  app.provide(routerViewLocationKey, currentRoute)

  // 4. 触发首次导航
  if (isBrowser && !started && currentRoute.value === START_LOCATION_NORMALIZED) {
    started = true
    push(routerHistory.location).catch(err => { /* ... */ })
  }
}
```

### 2. 导航发起阶段

#### 2.1 导航调用链

```typescript
// 用户调用
router.push('/users/123')
router.replace({ name: 'User', params: { id: 123 } })

// 实际执行流程：
// 1. push(to) → pushWithRedirect(to)
// 2. resolve(to) 解析目标位置
// 3. handleRedirectRecord() 处理重定向
// 4. navigate(toLocation, from) 执行导航守卫
// 5. finalizeNavigation() 完成导航
```

#### 2.2 路由解析

```typescript
// router.ts:202-342
function resolve(rawLocation, currentLocation) {
  // 字符串路径解析
  if (typeof rawLocation === 'string') {
    const locationNormalized = parseURL(parseQuery, rawLocation, currentLocation.path)
    const matchedRoute = matcher.resolve({ path: locationNormalized.path }, currentLocation)
    return assign(locationNormalized, matchedRoute, { params: decodeParams(...) })
  }

  // 对象路径解析
  let matcherLocation
  if (rawLocation.path != null) {
    matcherLocation = assign({}, rawLocation, {
      path: parseURL(parseQuery, rawLocation.path, currentLocation.path).path,
    })
  } else {
    matcherLocation = assign({}, rawLocation, {
      params: encodeParams(rawLocation.params),
    })
  }

  const matchedRoute = matcher.resolve(matcherLocation, currentLocation)
  // ... 组合返回完整位置信息
}
```

### 3. 守卫执行阶段

#### 3.1 守卫队列执行

```typescript
// router.ts:580-698
function navigate(to, from): Promise<any> {
  // 1. 提取变化的路由记录
  const [leavingRecords, updatingRecords, enteringRecords] = extractChangingRecords(to, from)

  // 2. 执行离开守卫 (beforeRouteLeave)
  guards = extractComponentsGuards(leavingRecords.reverse(), 'beforeRouteLeave', to, from)
  // ... 添加 record.leaveGuards

  // 3. 执行全局 beforeEach
  for (const guard of beforeGuards.list()) {
    guards.push(guardToPromiseFn(guard, to, from))
  }

  // 4. 执行更新守卫 (beforeRouteUpdate)
  guards = extractComponentsGuards(updatingRecords, 'beforeRouteUpdate', to, from)
  // ... 添加 record.updateGuards

  // 5. 执行路由 beforeEnter
  for (const record of enteringRecords) {
    if (record.beforeEnter) {
      if (isArray(record.beforeEnter)) {
        for (const beforeEnter of record.beforeEnter)
          guards.push(guardToPromiseFn(beforeEnter, to, from))
      } else {
        guards.push(guardToPromiseFn(record.beforeEnter, to, from))
      }
    }
  }

  // 6. 执行组件 beforeRouteEnter
  guards = extractComponentsGuards(enteringRecords, 'beforeRouteEnter', to, from, runWithContext)

  // 7. 执行全局 beforeResolve
  for (const guard of beforeResolveGuards.list()) {
    guards.push(guardToPromiseFn(guard, to, from))
  }

  // 8. 守卫队列执行
  return runGuardQueue(guards)
}
```

#### 3.2 守卫转 Promise

```typescript
// navigationGuards.ts:134-226
function guardToPromiseFn(
  guard: NavigationGuard,
  to: RouteLocationNormalized,
  from: RouteLocationNormalizedLoaded,
  record?: RouteRecordNormalized,
  name?: string,
  runWithContext: <T>(fn: () => T) => T = fn => fn()
): () => Promise<void> {
  return () =>
    new Promise((resolve, reject) => {
      const next: NavigationGuardNext = (valid?) => {
        if (valid === false) {
          // 中断导航
          reject(createRouterError<NavigationFailure>(ErrorTypes.NAVIGATION_ABORTED, {...}))
        } else if (valid instanceof Error) {
          // 导航出错
          reject(valid)
        } else if (isRouteLocation(valid)) {
          // 重定向
          reject(createRouterError<NavigationRedirectError>(ErrorTypes.NAVIGATION_GUARD_REDIRECT, {...}))
        } else {
          // 继续导航
          resolve()
        }
      }

      // 在 Vue 上下文执行守卫
      const guardReturn = runWithContext(() =>
        guard.call(record?.instances[name!], to, from, next)
      )

      let guardCall = Promise.resolve(guardReturn)

      // 自动调用 next（无第三个参数时）
      if (guard.length < 3) guardCall = guardCall.then(next)

      guardCall.catch(err => reject(err))
    })
}
```

#### 3.3 守卫队列累积执行

```typescript
// router.ts:1080-1085
function runGuardQueue(guards: Lazy<any>[]): Promise<any> {
  return guards.reduce(
    (promise, guard) => promise.then(() => runWithContext(guard)),
    Promise.resolve()
  )
}
```

### 4. 导航完成阶段

#### 4.1 最终化导航

```typescript
// router.ts:718-756
function finalizeNavigation(
  toLocation: RouteLocationNormalizedLoaded,
  from: RouteLocationNormalizedLoaded,
  isPush: boolean,
  replace?: boolean,
  data?: HistoryState
): NavigationFailure | void {
  // 1. 检查导航是否被取消
  const error = checkCanceledNavigation(toLocation, from)
  if (error) return error

  // 2. 判断是否是首次导航
  const isFirstNavigation = from === START_LOCATION_NORMALIZED

  // 3. 更新 URL（仅在 push/replace 时）
  if (isPush) {
    if (replace || isFirstNavigation) {
      routerHistory.replace(toLocation.fullPath, assign({ scroll: isFirstNavigation && state?.scroll }, data))
    } else {
      routerHistory.push(toLocation.fullPath, data)
    }
  }

  // 4. 更新当前路由（响应式）
  currentRoute.value = toLocation

  // 5. 处理滚动行为
  handleScroll(toLocation, from, isPush, isFirstNavigation)

  // 6. 标记路由就绪
  markAsReady()
}
```

#### 4.2 后置守卫执行

```typescript
// router.ts:701-711
function triggerAfterEach(
  to: RouteLocationNormalizedLoaded,
  from: RouteLocationNormalizedLoaded,
  failure?: NavigationFailure | void
): void {
  afterGuards.list().forEach(guard => runWithContext(() => guard(to, from, failure)))
}
```

### 5. 完整执行流程图

```
用户调用 router.push('/users/123')
    │
    ▼
┌──────────────────────────────────────┐
│ pushWithRedirect(to)                 │
│ - resolve(to) 解析目标位置            │
│ - handleRedirectRecord() 处理重定向   │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│ navigate(toLocation, from)           │
│                                      │
│ 1. beforeRouteLeave 守卫             │
│ 2. 全局 beforeEach                   │
│ 3. beforeRouteUpdate 守卫            │
│ 4. beforeEnter 守卫                  │
│ 5. beforeRouteEnter 守卫             │
│ 6. 全局 beforeResolve                │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│ finalizeNavigation()                 │
│ - 更新 URL (push/replace)            │
│ - 更新 currentRoute                  │
│ - 处理滚动行为                        │
│ - 标记就绪                            │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│ triggerAfterEach()                   │
│ - 执行全局 afterEach                 │
└──────────────────────────────────────┘
    │
    ▼
DOM 更新 / RouterView 渲染
```

---

## 关键模块深度分析

### 1. 路由匹配系统（RouterMatcher）

#### 1.1 设计原理

RouterMatcher 负责：
- 管理所有路由记录
- 路径解析与参数提取
- 路由排名（优先级处理）

#### 1.2 实现代码分析

```typescript
// matcher/index.ts:62-100
export function createRouterMatcher(
  routes: Readonly<RouteRecordRaw[]>,
  globalOptions: PathParserOptions
): RouterMatcher {
  const matchers: RouteRecordMatcher[] = []
  const matcherMap = new Map<RouteRecordName, RouteRecordMatcher>()

  function addRoute(
    record: RouteRecordRaw,
    parent?: RouteRecordMatcher,
    originalRecord?: RouteRecordMatcher
  ) {
    // 标准化路由记录
    const mainNormalizedRecord = normalizeRouteRecord(record)

    // 处理别名
    if ('alias' in record) {
      const aliases = typeof record.alias === 'string' ? [record.alias] : record.alias!
      for (const alias of aliases) {
        // ... 为每个别名创建记录
      }
    }

    // 创建匹配器
    const matcher = createRouteRecordMatcher(mainNormalizedRecord, parent, options)
    matchers.push(matcher)
    if (matcher.record.name) {
      matcherMap.set(matcher.record.name, matcher)
    }
  }

  function resolve(location, currentLocation): MatcherLocation {
    // 路径匹配并提取参数
    const matched = []
    let matcher: RouteRecordMatcher | undefined

    // 遍历匹配（考虑嵌套路由）
    for (const record of matchers) {
      if (match(record, location, currentLocation)) {
        matched.push(record)
      }
    }

    return { matched, params: extractParams(matched, location.path) }
  }

  return { addRoute, removeRoute, clearRoutes, getRoutes, getRecordMatcher, resolve }
}
```

#### 1.3 路径解析器（tokensToParser）

```typescript
// matcher/pathParserRanker.ts:129-200
export function tokensToParser(segments, extraOptions?): PathParser {
  const options = assign({}, BASE_PATH_PARSER_OPTIONS, extraOptions)
  const score: Array<number[]> = []
  let pattern = options.start ? '^' : ''
  const keys: PathParserParamKey[] = []

  for (const segment of segments) {
    // 根路径处理
    if (!segment.length) {
      score.push([PathScore.Root])
    }

    for (const token of segment) {
      // 静态路径：精确匹配
      if (token.type === TokenType_STATIC) {
        pattern += '/' + token.value.replace(REGEX_CHARS_RE, '\\$&')
        score.push([PathScore.Static])
      }
      // 动态路径：参数
      else if (token.type === TokenType.VARIABLE) {
        const { name, repeatable, optional, regexp } = token
        const re = regexp ? regexp : BASE_PARAM_PATTERN
        pattern += '(?:/(?' + (keys.length + 1) + ')(' + re + '))?'

        if (optional) pattern += '?'
        if (repeatable) pattern += '*'

        keys.push({ name, repeatable, optional })
        score.push([optional ? PathScore.BonusOptional : PathScore.Dynamic])
      }
    }
  }

  return {
    re: new RegExp(pattern + (options.end ? '$' : ''), options.sensitive ? '' : 'i'),
    score,
    keys,
    parse(path) { /* ... */ },
    stringify(params) { /* ... */ }
  }
}
```

#### 1.4 路由排名算法

```typescript
// matcher/pathParserRanker.ts:103-117
const enum PathScore {
  _multiplier = 10,
  Root = 9 * _multiplier,          // /
  Segment = 4 * _multiplier,        // /segment
  SubSegment = 3 * _multiplier,     // /:a-:b
  Static = 4 * _multiplier,         // /static
  Dynamic = 2 * _multiplier,        // /:id
  BonusCustomRegExp = 1 * _multiplier,  // /:id(\\d+)
  BonusWildcard = -4 * _multiplier,     // /:wildcard(.*)
  BonusRepeatable = -2 * _multiplier,    // /:id* or /:id+
  BonusOptional = -0.8 * _multiplier,    // /:id? or /:id*
  BonusStrict = 0.07 * _multiplier,      // strict: true
  BonusCaseSensitive = 0.025 * _multiplier, // sensitive: true
}

export function comparePathParserScore(a, b): number {
  // 分数高的优先
  // 相同分数按定义顺序
}
```

### 2. 历史记录系统（RouterHistory）

#### 2.1 接口定义

```typescript
// history/common.ts:74-100
export interface RouterHistory {
  readonly base: string
  readonly location: HistoryLocation
  readonly state: HistoryState

  push(to: HistoryLocation, data?: HistoryState): void
  replace(to: HistoryLocation, data?: HistoryState): void
  go(delta: number): void
  back(): void
  forward(): void

  listen(callback: NavigationCallback): () => void
  createHref(location: HistoryLocation): string
  getCurrentLocation(): HistoryLocation
}
```

#### 2.2 HTML5 History 实现

```typescript
// history/html5.ts:58-110
function useHistoryListeners(base, historyState, currentLocation, replace) {
  const listeners: NavigationCallback[] = []
  const popStateHandler = (event: PopStateEvent) => {
    const to = createCurrentLocation(base, location)
    const from = currentLocation.value
    const fromState = historyState.value
    let delta = 0

    if (event.state) {
      currentLocation.value = to
      historyState.value = event.state
      delta = fromState ? event.state.position - fromState.position : 0
    } else {
      replace(to)
    }

    // 通知所有监听器
    listeners.forEach(listener => {
      listener(to, from, {
        delta,
        type: NavigationType.pop,
        direction: delta > 0 ? NavigationDirection.forward : NavigationDirection.back
      })
    })
  }

  window.addEventListener('popstate', popStateHandler)

  return {
    listen(callback) {
      listeners.push(callback)
      return () => {
        const index = listeners.indexOf(callback)
        if (index > -1) listeners.splice(index, 1)
      }
    },
    // ...
  }
}
```

#### 2.3 Hash History 实现

```typescript
// history/hash.ts
// 使用 location.hash 获取路由
// 监听 hashchange 事件
// 自动处理 IE6/7 刷新问题
```

#### 2.4 Memory History 实现

```typescript
// history/memory.ts
// 不依赖 URL
// 适用于 SSR 环境
// 维护内部堆栈
```

### 3. 导航守卫系统

#### 3.1 守卫类型

```typescript
// typed-routes/navigation-guards.ts
type NavigationGuard = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
) => Awaitable<void | NavigationGuardReturn>

type NavigationGuardNextCallback = (to?: RouteLocationRaw) => void

// 守卫返回值
type NavigationGuardReturn =
  | void
  | false
  | Error
  | RouteLocationRaw
  | NavigationRedirectError
```

#### 3.2 守卫执行顺序

```
1. 组件离开守卫 (beforeRouteLeave)
   - 来自被离开的路由记录
   - 后进先出执行

2. 全局前置守卫 (beforeEach)
   - 按注册顺序执行

3. 组件更新守卫 (beforeRouteUpdate)
   - 被重用组件的守卫
   - 按匹配顺序执行

4. 路由独享守卫 (beforeEnter)
   - enterRecords 中的记录
   - 按定义顺序执行

5. 组件进入守卫 (beforeRouteEnter)
   - 新路由的组件
   - 按匹配顺序执行

6. 全局解析守卫 (beforeResolve)
   - 所有解析完成后
   - 按注册顺序执行

7. 全局后置守卫 (afterEach)
   - 导航确认后
   - 按注册顺序执行
```

#### 3.3 变化记录提取

```typescript
// navigationGuards.ts:452-482
export function extractChangingRecords(to, from): [
  leavingRecords: RouteRecordNormalized[],
  updatingRecords: RouteRecordNormalized[],
  enteringRecords: RouteRecordNormalized[],
] {
  const leavingRecords: RouteRecordNormalized[] = []
  const updatingRecords: RouteRecordNormalized[] = []
  const enteringRecords: RouteRecordNormalized[] = []

  const len = Math.max(from.matched.length, to.matched.length)
  for (let i = 0; i < len; i++) {
    const recordFrom = from.matched[i]
    if (recordFrom) {
      // 如果 from 中的记录在 to 中仍然存在，则是更新
      if (to.matched.find(record => isSameRouteRecord(record, recordFrom))) {
        updatingRecords.push(recordFrom)
      } else {
        // 否则是离开
        leavingRecords.push(recordFrom)
      }
    }

    const recordTo = to.matched[i]
    if (recordTo) {
      // 如果 to 中的记录不在 from 中，则是进入
      if (!from.matched.find(record => isSameRouteRecord(record, recordTo))) {
        enteringRecords.push(recordTo)
      }
    }
  }

  return [leavingRecords, updatingRecords, enteringRecords]
}
```

### 4. 路由组件系统

#### 4.1 RouterLink

```typescript
// RouterLink.ts
export const RouterLink = defineComponent({
  name: 'RouterLink',
  props: {
    to: { type: [String, Object] as PropType<RouteLocationRaw>, required: true },
    replace: Boolean,
    append: Boolean,
    activeClass: String,
    exactActiveClass: String,
    custom: Boolean,
  },
  setup(props, { slots }) {
    const router = inject(routerKey)!
    const route = inject(routeLocationKey)!

    const isActive = computed(() => /* 路径匹配判断 */)
    const isExactActive = computed(() => /* 完全匹配判断 */)

    const navigate = () => {
      router[props.replace ? 'replace' : 'push'](props.to)
    }

    return () => {
      const Tag = props.custom ? 'a' : 'span'
      return h(Tag, {
        class: { [props.activeClass || '']: isActive.value },
        onClick: navigate,
      }, slots.default?.({ isActive, isExactActive }))
    }
  }
})
```

#### 4.2 RouterView

```typescript
// RouterView.ts
export const RouterView = defineComponent({
  name: 'RouterView',
  setup(_, { attrs, slots }) {
    const route = inject(routerViewLocationKey)!
    const depth = inject(viewDepthKey, 0)
    const matchedRoute = computed(() => route.matched[depth])

    provide(matchedRouteKey, computed(() => matchedRoute.value))
    provide(viewDepthKey, depth + 1)

    return () => {
      const component = matchedRoute.value?.components?.default
      if (!component) return slots.default?.()

      return h(component, attrs)
    }
  }
})
```

### 5. URL 解析系统

#### 5.1 parseURL

```typescript
// location.ts:47-103
export function parseURL(parseQuery, location, currentLocation = '/'): LocationNormalized {
  let path: string | undefined
  let query: LocationQuery = {}
  let searchString = ''
  let hash = ''

  // 查找 hash 和 query 的位置
  const hashPos = location.indexOf('#')
  let searchPos = location.indexOf('?')
  searchPos = (hashPos >= 0 && searchPos > hashPos) ? -1 : searchPos

  // 提取 query
  if (searchPos >= 0) {
    path = location.slice(0, searchPos)
    searchString = location.slice(searchPos, hashPos > 0 ? hashPos : location.length)
    query = parseQuery(searchString.slice(1))
  }

  // 提取 hash
  if (hashPos >= 0) {
    path = path || location.slice(0, hashPos)
    hash = location.slice(hashPos)
  }

  // 处理相对路径
  path = resolveRelativePath(path ?? location, currentLocation)

  return {
    fullPath: path + searchString + hash,
    path,
    query,
    hash: decode(hash),
  }
}
```

#### 5.2 resolveRelativePath

```typescript
// location.ts:150+
function resolveRelativePath(path: string, currentLocation: string): string {
  // 处理以 / 开头的绝对路径
  if (path.startsWith('/')) return path

  // 处理以 ../ 或 ./ 开头的相对路径
  // 向上遍历父路径
  // ...

  // 否则相对于当前路径
  const segments = currentLocation.split('/')
  segments.pop()
  while (path.startsWith('../')) {
    path = path.slice(3)
    segments.pop()
  }
  return segments.join('/') + '/' + path
}
```

### 6. 错误处理系统

#### 6.1 错误类型

```typescript
// errors.ts
export enum ErrorTypes {
  NAVIGATION_ABORTED = 2,
  NAVIGATION_CANCELLED = 4,
  NAVIGATION_GUARD_REDIRECT = 8,
  NAVIGATION_DUPLICATED = 16,
  ROUTE_NOT_FOUND = 32,
}

export interface NavigationFailure extends RouteLocationNormalized {
  type: ErrorTypes
  destination: RouteLocationNormalized
  from: RouteLocationNormalized
}

export function createRouterError<T>(type: ErrorTypes, context): T {
  return {
    type,
    ...context,
    message: `Navigation aborted${context.to ? ` from "${context.from.fullPath}" to "${context.to.fullPath}"` : ''}`,
  } as T
}
```

#### 6.2 错误处理流程

```typescript
// router.ts:908-925
function triggerError(error, to, from): Promise<unknown> {
  markAsReady(error)

  // 调用错误监听器
  const list = errorListeners.list()
  if (list.length) {
    list.forEach(handler => handler(error, to, from))
  } else {
    // 无监听器时输出到控制台
    console.error(error)
  }

  return Promise.reject(error)
}
```

---

## 高级特性实现

### 1. 自动路由系统（unplugin）

#### 1.1 插件架构

```typescript
// unplugin/index.ts
export function createPlugin(options: Options) {
  return {
    name: 'vue-router-auto-routes',
    // Vite/Rollup/Webpack 钩子
  }
}
```

#### 1.2 路由扫描与代码生成

```typescript
// unplugin/core/definePage.ts
export function definePage(filePath: string, options: PageOptions): RouteRecordRaw {
  // 从文件路径提取路由配置
  const { path, name } = parseFilePath(filePath)
  return {
    path,
    name,
    component: () => import(filePath),
  }
}
```

```typescript
// unplugin/codegen/generateRouteRecords.ts
export function generateRouteRecords(files: string[]): string {
  return files.map(file => {
    const path = fileToPath(file)
    return `{ path: '${path}', component: () => import('${file}') }`
  }).join(',\n')
}
```

### 2. 滚动行为控制

#### 2.1 滚动位置保存

```typescript
// scrollBehavior.ts
export function saveScrollPosition(key: string, position: _ScrollPositionNormalized) {
  sessionStorage.setItem(key, JSON.stringify(position))
}

export function getSavedScrollPosition(key: string): _ScrollPositionNormalized | null {
  const saved = sessionStorage.getItem(key)
  return saved ? JSON.parse(saved) : null
}
```

#### 2.2 滚动恢复

```typescript
// router.ts:956-977
function handleScroll(to, from, isPush, isFirstNavigation): Promise<unknown> {
  const { scrollBehavior } = options
  if (!isBrowser || !scrollBehavior) return Promise.resolve()

  // 获取保存的滚动位置
  const scrollPosition =
    (!isPush && getSavedScrollPosition(getScrollKey(to.fullPath, 0))) ||
    ((isFirstNavigation || !isPush) && history.state?.scroll) ||
    null

  return nextTick()
    .then(() => scrollBehavior(to, from, scrollPosition))
    .then(position => position && scrollToPosition(position))
    .catch(err => triggerError(err, to, from))
}
```

### 3. 响应式路由

#### 3.1 路由注入

```typescript
// injectionSymbols.ts
export const routerKey = Symbol('router')
export const routeLocationKey = Symbol('route location')
export const routerViewLocationKey = Symbol('router view location')
export const matchedRouteKey = Symbol('matched route')
export const viewDepthKey = Symbol('view depth')
```

#### 3.2 响应式 route

```typescript
// router.ts:1039-1048
const reactiveRoute = {} as RouteLocationNormalizedLoaded
for (const key in START_LOCATION_NORMALIZED) {
  Object.defineProperty(reactiveRoute, key, {
    get: () => currentRoute.value[key as keyof RouteLocationNormalized],
    enumerable: true,
  })
}

app.provide(routeLocationKey, shallowReactive(reactiveRoute))
```

---

## 性能优化策略

### 1. 响应式优化

```typescript
// 使用 shallowRef 避免深度响应式
const currentRoute = shallowRef<RouteLocationNormalizedLoaded>(START_LOCATION_NORMALIZED)

// 使用 shallowReactive 包装 route
app.provide(routeLocationKey, shallowReactive(reactiveRoute))
```

### 2. 守卫执行优化

```typescript
// 守卫队列使用 reduce 累积执行
function runGuardQueue(guards: Lazy<any>[]): Promise<any> {
  return guards.reduce(
    (promise, guard) => promise.then(() => runWithContext(guard)),
    Promise.resolve()
  )
}

// 提前短路检查
if (!force && isSameRouteLocation(stringifyQuery, from, targetLocation)) {
  // 相同路由不执行导航
  return Promise.resolve(failure)
}
```

### 3. 路径匹配优化

```typescript
// 预编译正则表达式
const pattern = '^' + segments.map(segment => {
  // 静态路径直接转义
  // 动态路径用预定义正则
}).join('') + '$'

return {
  re: new RegExp(pattern, options.sensitive ? '' : 'i'),
  // ...
}
```

---

## 调试与学习建议

### 1. 源码阅读路径

#### 入门级（理解基本流程）

1. `index.ts` → `router.ts` → `createRouter`
2. 关注 `push` / `replace` 导航方法
3. 理解 `navigate` 守卫执行流程
4. 理解 `RouterLink` / `RouterView` 组件

#### 进阶级（深入核心模块）

1. `matcher/` 目录下的所有文件
2. `history/` 目录下的三种历史实现
3. `navigationGuards.ts` 守卫转换逻辑
4. `location.ts` URL 解析逻辑

#### 专家级（研究高级特性）

1. `unplugin/` 自动路由系统
2. `typed-routes/` 类型安全 API
3. `experimental/` 实验性功能

### 2. 调试技巧

#### 2.1 路由调试

```typescript
// 添加导航守卫调试
router.beforeEach((to, from, next) => {
  console.log('导航到:', to.fullPath)
  console.log('导航前:', from.fullPath)
  next()
})

// 监听路由变化
router.afterEach((to, from) => {
  console.log('导航完成:', to.fullPath)
})
```

#### 2.2 守卫调试

```typescript
// 在组件中调试守卫
export default {
  beforeRouteEnter(to, from, next) {
    console.log('组件即将进入:', to.path)
    next(vm => {
      console.log('组件实例已创建:', vm.$route.path)
    })
  }
}
```

#### 2.3 DevTools 调试

```typescript
// 启用 Vue DevTools
// 可以看到路由变化历史、守卫执行状态等
```

### 3. 常见问题排查

#### 3.1 导航不触发

1. 检查 `router-link` 的 `to` 属性是否正确
2. 验证路由配置是否正确注册
3. 查看浏览器控制台是否有错误

#### 3.2 守卫不执行

1. 确认守卫在正确的组件中定义
2. 检查守卫是否正确返回（或调用 next）
3. 查看是否有其他守卫阻止了执行

#### 3.3 路由参数丢失

1. 检查路径定义是否正确（如 `/users/:id`）
2. 验证参数传递方式（name vs path）
3. 查看 `parseQuery` / `stringifyQuery` 配置

### 4. 学习资源

#### 4.1 官方资源

- [Vue Router 官方文档](https://router.vuejs.org/)
- [GitHub 仓库](https://github.com/vuejs/router)
- [变更日志](https://github.com/vuejs/router/blob/main/packages/router/CHANGELOG.md)

#### 4.2 相关技术

- [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API)
- [Vue 3 Composition API](https://vuejs.org/api/composition-api-setup.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)

#### 4.3 进阶学习

- 阅读 `__tests__` 目录下的测试用例
- 查看 GitHub Issues 了解常见问题
- 参与贡献，理解代码审查流程

---

## 总结

### 设计亮点

1. **架构清晰**：分层设计，职责明确，便于维护和扩展
2. **类型安全**：完整的 TypeScript 类型支持，强大的类型推导
3. **守卫系统**：灵活的导航守卫，支持组件、路由、全局多级
4. **适配器模式**：统一的历史记录接口，支持多种部署环境
5. **响应式设计**：深度集成 Vue 3 Composition API
6. **自动路由**：unplugin 支持文件系统路由

### 可改进点

1. **文档完善**：部分高级功能文档可以更详细
2. **错误处理**：某些边界情况的错误信息可以更友好
3. **性能监控**：可以增加运行时性能监控能力

### 学习价值

Vue Router 源码具有多重学习价值：

1. **工程实践**：模块化、测试、构建、类型系统等完整工程化实践
2. **设计模式**：适配器、发布-订阅、策略、装饰器等多种设计模式应用
3. **响应式编程**：Vue 3 响应式系统的深度应用
4. **路由算法**：路径解析、参数提取、优先级排名等算法实现
5. **类型安全**：TypeScript 在复杂业务场景中的类型设计

通过深入分析 Vue Router 源码，不仅可以理解一个路由管理器的实现原理，更能学习到 Vue 3 生态系统的设计思想和工程实践，对于提升软件架构能力具有重要价值。

---

## 相关文档

- [源码结构文档.md](./源码结构文档.md) - 项目结构、目录组织、快速参考