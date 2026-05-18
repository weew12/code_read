/**
 * 数据加载器自动导出插件
 *
 * 本模块提供 Vite 插件，自动从页面组件中导出数据加载器。
 *
 * 功能：
 * - 解析页面组件的静态导入
 * - 过滤出数据加载器相关的导入
 * - 自动生成 __loaders 导出数组
 */
import { createFilter } from 'unplugin-utils'
import type { Plugin } from 'vite'
import MagicString from 'magic-string'
import { findStaticImports, parseStaticImport } from 'mlly'
import { resolve } from 'pathe'
import type { StringFilter } from 'unplugin'
import { type UnpluginOptions } from 'unplugin'

/**
 * 从代码中提取需要导出的加载器名称
 */
export function extractLoadersToExport(
  code: string,
  filterPaths: (id: string) => boolean,
  root: string
): string[] {
  const imports = findStaticImports(code)
  const importNames = imports.flatMap(i => {
    const parsed = parseStaticImport(i)

    // since we run post-post, vite will add a leading slash to the specifier
    const specifier = resolve(
      root,
      parsed.specifier.startsWith('/')
        ? parsed.specifier.slice(1)
        : parsed.specifier
    )

    // bail out faster for anything that is not a data loader
    if (!filterPaths(specifier)) return []

    return [
      parsed.defaultImport,
      ...Object.values(parsed.namedImports || {}),
    ].filter((v): v is string => !!v && !v.startsWith('_'))
  })

  return importNames
}

const PLUGIN_NAME = 'vue-router:data-loaders-auto-export'

/**
 * {@link AutoExportLoaders} options.
 */
export interface AutoExportLoadersOptions {
  /**
   * Filter page components to apply the auto-export. Passed to `transform.filter.id`.
   */
  transformFilter: StringFilter

  /**
   * Globs to match the paths of the loaders.
   */
  loadersPathsGlobs: string | string[]

  /**
   * Root of the project. All paths are resolved relatively to this one.
   * @default `process.cwd()`
   */
  root?: string
}

/**
 * Vite Plugin to automatically export loaders from page components.
 * 自动从页面组件导出加载器的 Vite 插件
 *
 * @param options Options
 * @experimental - This API is experimental and can be changed in the future. It's used internally by `experimental.autoExportsDataLoaders`
 */
export function AutoExportLoaders({
  transformFilter,
  loadersPathsGlobs,
  root = process.cwd(),
}: AutoExportLoadersOptions): Plugin {
  const filterPaths = createFilter(loadersPathsGlobs)

  return {
    name: PLUGIN_NAME,
    transform: {
      order: 'post',
      filter: {
        id: transformFilter,
      },

      handler(code) {
        const loadersToExports = extractLoadersToExport(code, filterPaths, root)

        if (loadersToExports.length <= 0) return

        const s = new MagicString(code)
        s.append(
          `\nexport const __loaders = [\n${loadersToExports.join(',\n')}\n];\n`
        )

        return {
          code: s.toString(),
          map: s.generateMap(),
        }
      },
    },
  }
}

/**
 * 创建自动导出插件的 Unplugin 版本
 */
export function createAutoExportPlugin(
  options: AutoExportLoadersOptions
): UnpluginOptions {
  return {
    name: PLUGIN_NAME,
    // Cast needed due to Vite version differences in monorepo
    vite: AutoExportLoaders(options),
  }
}
