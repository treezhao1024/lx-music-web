/**
 * 插件加载器：解析插件头部注解，并在 vm 沙箱中执行插件脚本
 *
 * 注意：vm 只是隔离作用域，不是安全边界。插件脚本拥有宿主网络与加密能力，
 * 只应加载可信来源的插件文件。
 */

import fs from 'fs/promises'
import path from 'path'
import vm from 'vm'
import crypto from 'crypto'
import zlib from 'zlib'
import buffer from 'buffer'
import querystring from 'querystring'
import url from 'url'
import util from 'util'
import events from 'events'
import stream from 'stream'
import PluginRuntime from './pluginRuntime.js'

const HEADER_RE = /^\/\*!([\s\S]*?)\*\//
const FIELD_RE = /@([A-Za-z_][\w-]*)\s+(.+)/g
const SANITIZE_RE = /[\\/:*?"<>|\s]+/g

const ALLOWED_MODULES = new Map([
  ['crypto', crypto],
  ['zlib', zlib],
  ['buffer', buffer],
  ['querystring', querystring],
  ['url', url],
  ['util', util],
  ['events', events],
  ['stream', stream],
])

export function parseScriptHeader(rawScript) {
  const meta = {}
  const comment = HEADER_RE.exec(rawScript)?.[1]
  if (!comment) return meta

  for (const [, key, value] of comment.matchAll(FIELD_RE)) {
    meta[key.toLowerCase()] = value.trim()
  }
  return meta
}

export function pluginIdFromFile(file) {
  return path.basename(file).replace(/\.js$/i, '').replace(SANITIZE_RE, '-')
}

function createRequire(id) {
  return moduleName => {
    const mod = ALLOWED_MODULES.get(moduleName)
    if (!mod) throw new Error(`[${id}] 插件不允许 require('${moduleName}')`)
    return mod
  }
}

function createSandbox(runtime) {
  return {
    lx: runtime.lx,
    console: runtime.console,
    Buffer,
    Uint8Array,
    ArrayBuffer,
    DataView,
    TextEncoder,
    TextDecoder,
    URL,
    URLSearchParams,
    atob,
    btoa,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    require: createRequire(runtime.id),
  }
}

export async function listPluginFiles(dir) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch (err) {
    if (err.code === 'ENOENT') return []
    throw err
  }

  return entries
    .filter(entry => entry.isFile() && /\.js$/i.test(entry.name) && !entry.name.startsWith('.'))
    .map(entry => path.join(dir, entry.name))
    .sort()
}

/**
 * 加载单个插件文件，失败时返回 { runtime: null, error }
 */
export async function loadPluginFile(file, options = {}) {
  const rawScript = await fs.readFile(file, 'utf-8')
  const header = parseScriptHeader(rawScript)
  const id = options.id || pluginIdFromFile(file)

  const runtime = new PluginRuntime({
    id,
    name: header.name || id,
    description: header.description,
    version: header.version,
    author: header.author,
    homepage: header.homepage,
    file,
    meta: header,
    rawScript,
    settings: options.settings,
    enabled: options.enabled,
    priority: options.priority,
    requestTimeout: options.requestTimeout,
  })

  try {
    const context = vm.createContext(createSandbox(runtime))
    vm.runInContext(rawScript, context, {
      filename: file,
      displayErrors: true,
      timeout: 15000,
    })
    if (runtime.status === null) runtime.status = true
    return { runtime, error: null }
  } catch (err) {
    runtime.error = err.message
    runtime.status = false
    return { runtime: null, error: err.message }
  }
}

export default loadPluginFile
