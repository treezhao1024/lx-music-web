/**
 * 插件管理器：加载 plugins 目录下的所有插件，按配置路由请求
 *
 * 路由规则（action + source）：
 *   1. sourceOverrides[source] 指定的插件优先
 *   2. 其次是 active 插件
 *   3. 其余按 priority 从高到低
 *   fallback=true 时依次尝试直到成功，否则只用第一个候选插件
 */

import fs from 'fs/promises'
import path from 'path'
import { listPluginFiles, loadPluginFile, pluginIdFromFile } from './loader.js'
import { readConfig, writeConfig, syncPluginEntries, resolveProxyUrl } from './config.js'
import { configureHttpClient } from './httpClient.js'

class PluginManager {
  constructor() {
    this.plugins = new Map()
    this.loadErrors = new Map()
    this.config = null
    this.dirOverride = null
    this.initializing = null
    this.loaded = false
  }

  async initialize(options = {}) {
    if (this.initializing) return this.initializing
    if (this.loaded && !options.force) return this

    this.initializing = this.load(options)
    try {
      return await this.initializing
    } finally {
      this.initializing = null
    }
  }

  async load(options = {}) {
    if (options.dir) this.dirOverride = path.resolve(options.dir)
    const config = await readConfig(this.dirOverride)
    const before = JSON.stringify(config)
    this.config = config

    configureHttpClient({ tlsVerify: config.tlsVerify, proxyUrl: resolveProxyUrl() })

    await fs.mkdir(config.dir, { recursive: true })
    const files = await listPluginFiles(config.dir)
    syncPluginEntries(config, files.map(pluginIdFromFile))

    this.plugins.clear()
    this.loadErrors.clear()

    for (const file of files) {
      const id = pluginIdFromFile(file)
      const entry = config.plugins[id] ?? {}
      const { runtime, error } = await loadPluginFile(file, {
        id,
        enabled: entry.enabled !== false,
        priority: entry.priority,
        settings: entry.settings ?? {},
        requestTimeout: entry.requestTimeout ?? config.requestTimeout,
      })

      if (!runtime) {
        this.loadErrors.set(id, error)
        console.error(`[PluginManager] 插件加载失败 ${id}: ${error}`)
        continue
      }

      this.plugins.set(id, runtime)
      const sources = Object.keys(runtime.sources)
      console.log(`[PluginManager] 已加载插件 ${runtime.name} (${id}) v${runtime.version || '?'} 音源: ${sources.join(',') || '未声明'}`)
    }

    if (!config.active) {
      config.active = this.getSortedPlugins()[0]?.id ?? ''
    }

    if (JSON.stringify(config) !== before) await writeConfig(config)

    this.loaded = true
    console.log(`[PluginManager] 共 ${this.plugins.size} 个插件可用，当前首选: ${config.active || '（无）'}`)
    return this
  }

  async reload() {
    return this.initialize({ force: true })
  }

  getPlugin(id) {
    return this.plugins.get(id) ?? null
  }

  getSortedPlugins() {
    const activeId = this.config?.active
    return [...this.plugins.values()].sort((a, b) => {
      if (a.id === activeId) return -1
      if (b.id === activeId) return 1
      if (b.priority !== a.priority) return b.priority - a.priority
      return String(a.name).localeCompare(String(b.name))
    })
  }

  resolveCandidates(action, source) {
    const overrideId = source ? this.config?.sourceOverrides?.[source] : null
    const candidates = this.getSortedPlugins().filter(plugin => plugin.enabled && plugin.supports(source, action))

    if (overrideId) {
      const index = candidates.findIndex(plugin => plugin.id === overrideId)
      if (index > 0) candidates.unshift(candidates.splice(index, 1)[0])
    }

    return this.config?.fallback === false ? candidates.slice(0, 1) : candidates
  }

  async request(action, source, info = {}) {
    await this.initialize()

    const candidates = this.resolveCandidates(action, source)
    if (!candidates.length) {
      const known = [...this.plugins.keys()].join(', ') || '（插件目录为空）'
      throw new Error(`没有插件可处理 ${source ?? '?'}/${action}，已加载插件: ${known}`)
    }

    const errors = []
    for (const plugin of candidates) {
      try {
        const result = await plugin.invoke(action, source, info)
        if (result === undefined || result === null || result === '') {
          throw new Error('插件返回空结果')
        }
        return result
      } catch (err) {
        errors.push(`${plugin.name}: ${err.message}`)
        console.warn(`[PluginManager] ${plugin.name} 处理 ${action}(${source}) 失败: ${err.message}`)
      }
    }

    throw new Error(`所有插件均失败（${candidates.length} 个）\n${errors.join('\n')}`)
  }

  async getMusicUrl(songInfo, quality = '320k') {
    const source = songInfo?.source ?? 'tx'
    return this.request('musicUrl', source, { type: quality, musicInfo: songInfo })
  }

  async getLyric(songInfo) {
    const source = songInfo?.source ?? 'tx'
    return this.request('getLyric', source, { musicInfo: songInfo })
  }

  getAvailableSources() {
    const sources = {}
    for (const plugin of this.getSortedPlugins()) {
      if (!plugin.enabled) continue
      for (const [id, source] of Object.entries(plugin.sources)) {
        if (sources[id]) continue
        sources[id] = { ...source, pluginId: plugin.id, pluginName: plugin.name }
      }
    }
    return sources
  }

  listPlugins() {
    const plugins = this.getSortedPlugins().map(plugin => ({
      ...plugin.toJSON(),
      enabled: plugin.enabled,
      priority: plugin.priority,
      active: plugin.id === this.config?.active,
    }))

    for (const [id, error] of this.loadErrors) {
      plugins.push({ id, name: id, error, enabled: false, priority: 0, active: false, sources: [] })
    }

    return plugins
  }

  getConfig() {
    if (!this.config) return null
    return {
      dir: this.config.dir,
      active: this.config.active,
      fallback: this.config.fallback,
      requestTimeout: this.config.requestTimeout,
      sourceOverrides: this.config.sourceOverrides,
    }
  }

  async setActivePlugin(id) {
    await this.initialize()
    if (id && !this.plugins.has(id)) {
      throw new Error(`插件不存在: ${id}，可用: ${[...this.plugins.keys()].join(', ')}`)
    }
    this.config.active = id || ''
    await writeConfig(this.config)
    return this.listPlugins()
  }

  async updatePlugin(id, patch = {}) {
    await this.initialize()
    const plugin = this.plugins.get(id)
    if (!plugin) throw new Error(`插件不存在: ${id}`)

    const entry = { ...(this.config.plugins[id] ?? {}) }
    if (patch.enabled !== undefined) {
      entry.enabled = !!patch.enabled
      plugin.enabled = entry.enabled
    }
    if (patch.priority !== undefined) {
      entry.priority = Number(patch.priority) || 0
      plugin.priority = entry.priority
    }
    this.config.plugins[id] = entry

    await writeConfig(this.config)
    return this.listPlugins()
  }

  async setSourceOverride(source, pluginId) {
    await this.initialize()
    if (pluginId && !this.plugins.has(pluginId)) throw new Error(`插件不存在: ${pluginId}`)

    if (pluginId) this.config.sourceOverrides[source] = pluginId
    else delete this.config.sourceOverrides[source]

    await writeConfig(this.config)
    return { sourceOverrides: this.config.sourceOverrides, plugins: this.listPlugins() }
  }

  async setFallback(fallback) {
    await this.initialize()
    this.config.fallback = !!fallback
    await writeConfig(this.config)
    return this.getConfig()
  }

  /**
   * 更新插件设置（如音源 API 地址、卡密、cookie），随后重载插件生效
   */
  async updateSettings(id, settings = {}) {
    await this.initialize()
    if (!this.plugins.has(id)) throw new Error(`插件不存在: ${id}`)

    const entry = { ...(this.config.plugins[id] ?? {}) }
    entry.settings = { ...(entry.settings ?? {}), ...settings }
    this.config.plugins[id] = entry

    await writeConfig(this.config)
    await this.reload()
    return this.listPlugins()
  }
}

const pluginManager = new PluginManager()

export { PluginManager, pluginManager }
export default pluginManager
