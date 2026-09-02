/**
 * 单个插件的运行时：持有自己的事件表、lx 对象与可用音源声明
 * 每个插件互相隔离，宿主通过 invoke() 派发请求
 */

import EVENT_NAMES from '../constants/events.js'
import pluginUtils, { normalizeError } from './lxUtils.js'
import { request as httpRequest } from './httpClient.js'

export const PLUGIN_API_VERSION = '1.0.0'

const DEFAULT_REQUEST_TIMEOUT = 60000
const DEFAULT_PRIORITY = 50

class PluginRuntime {
  constructor(meta = {}) {
    this.id = meta.id
    this.name = meta.name || meta.id
    this.description = meta.description || ''
    this.version = meta.version || ''
    this.author = meta.author || ''
    this.homepage = meta.homepage || ''
    this.file = meta.file || ''
    this.meta = meta.meta || {}

    this.settings = meta.settings || {}
    this.enabled = meta.enabled !== false
    const priority = Number(meta.priority)
    this.priority = meta.priority == null || Number.isNaN(priority) ? DEFAULT_PRIORITY : priority
    this.requestTimeout = Number(meta.requestTimeout) > 0
      ? Number(meta.requestTimeout)
      : DEFAULT_REQUEST_TIMEOUT

    this.listeners = new Map()
    this.sources = {}
    this.status = null
    this.error = null
    this.requestSeq = 0

    this.lx = this.createLxObject(meta.rawScript || '')
    this.console = this.createConsole()
  }

  createLxObject(rawScript) {
    return {
      EVENT_NAMES,
      request: httpRequest,
      on: (event, handler) => this.on(event, handler),
      off: (event, handler) => this.off(event, handler),
      send: (event, data) => this.send(event, data),
      utils: pluginUtils,
      settings: this.settings,
      env: 'desktop',
      version: PLUGIN_API_VERSION,
      currentScriptInfo: {
        name: this.name,
        description: this.description,
        version: this.version,
        author: this.author,
        homepage: this.homepage,
        rawScript,
      },
    }
  }

  createConsole() {
    const prefix = `[plugin:${this.name}]`
    const forward = level => (...args) => console[level](prefix, ...args)
    return {
      log: forward('log'),
      info: forward('info'),
      warn: forward('warn'),
      error: forward('error'),
      debug: forward('debug'),
      trace: forward('trace'),
      group: (...args) => console.log(prefix, ...args),
      groupEnd: () => {},
      table: forward('log'),
    }
  }

  on(event, handler) {
    if (typeof handler !== 'function') return
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event).add(handler)
  }

  off(event, handler) {
    this.listeners.get(event)?.delete(handler)
  }

  getHandlers(event) {
    return [...(this.listeners.get(event) ?? [])]
  }

  send(event, data) {
    if (event === EVENT_NAMES.inited || event === EVENT_NAMES.updateStatus) {
      this.applyStatus(data)
    }
    for (const handler of this.getHandlers(event)) {
      try {
        handler(data)
      } catch (err) {
        console.error(`[plugin:${this.name}] handler for ${event} threw:`, err.message)
      }
    }
  }

  applyStatus(data) {
    if (!data || typeof data !== 'object') return
    if (data.status !== undefined) this.status = data.status
    if (data.sources && typeof data.sources === 'object') this.sources = data.sources
  }

  supports(source, action) {
    const declared = Object.keys(this.sources)
    if (!declared.length) return true
    if (source && !this.sources[source]) return false
    const actions = this.sources[source]?.actions
    if (action && Array.isArray(actions) && actions.length && !actions.includes(action)) return false
    return true
  }

  getQualitys(source) {
    return this.sources[source]?.qualitys ?? []
  }

  /**
   * 派发一次请求。兼容两种插件写法：
   * 1. handler 直接返回 Promise（lx-music-desktop / 墨澜音源）
   * 2. handler 通过 send(EVENT_NAMES.request + ':response', { requestId, result }) 回传
   */
  invoke(action, source, info) {
    return new Promise((resolve, reject) => {
      const requestId = ++this.requestSeq
      const responseEvent = EVENT_NAMES.requestResponse
      let settled = false

      const settle = (err, result) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        this.off(responseEvent, onResponse)
        if (err) reject(normalizeError(err))
        else resolve(result)
      }

      const onResponse = data => {
        if (!data || data.requestId !== requestId) return
        settle(data.error ? normalizeError(data.error) : null, data.result)
      }

      const timer = setTimeout(
        () => settle(new Error(`[${this.name}] 请求超时（${this.requestTimeout}ms）`)),
        this.requestTimeout,
      )

      this.on(responseEvent, onResponse)

      const handlers = this.getHandlers(EVENT_NAMES.request)
      if (!handlers.length) {
        settle(new Error(`[${this.name}] 插件未注册 ${EVENT_NAMES.request} 处理器`))
        return
      }

      const payload = { requestId, action, source, info }
      const pending = []
      for (const handler of handlers) {
        try {
          const result = handler(payload)
          if (result && typeof result.then === 'function') pending.push(result)
        } catch (err) {
          pending.push(Promise.reject(err))
        }
      }

      if (!pending.length) return

      pending[0].then(result => settle(null, result), err => settle(err))
      pending.slice(1).forEach(promise => promise.catch(() => {}))
    })
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      version: this.version,
      author: this.author,
      homepage: this.homepage,
      file: this.file,
      status: this.status,
      error: this.error,
      requestTimeout: this.requestTimeout,
      settings: this.settings,
      sources: Object.entries(this.sources).map(([id, source]) => ({
        id,
        name: source.name,
        type: source.type,
        actions: source.actions ?? [],
        qualitys: source.qualitys ?? [],
      })),
    }
  }
}

export { PluginRuntime }
export default PluginRuntime
