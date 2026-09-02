/**
 * 插件配置：plugins/config.json + 环境变量覆盖
 *
 * config.json 结构：
 * {
 *   "dir": "plugins",                  // 插件目录（相对项目根或绝对路径）
 *   "active": "墨澜音乐源v2.3.0",       // 首选插件 id
 *   "fallback": true,                  // 首选插件失败时是否按优先级回退
 *   "requestTimeout": 60000,           // 单次插件请求超时（ms）
 *   "sourceOverrides": { "kw": "id" }, // 指定某个音源固定使用的插件
 *   "plugins": {
 *     "<id>": { "enabled": true, "priority": 100, "requestTimeout": 60000, "settings": {} }
 *   }
 * }
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '../..')

export const DEFAULT_PLUGIN_DIR = 'plugins'

const DEFAULT_CONFIG = {
  dir: DEFAULT_PLUGIN_DIR,
  active: '',
  fallback: true,
  requestTimeout: 60000,
  tlsVerify: false,
  sourceOverrides: {},
  plugins: {},
}

const CONFIG_FILE_NAME = 'config.json'

function toBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value
  return !['0', 'false', 'no', 'off'].includes(String(value).toLowerCase())
}

export function resolvePluginDir(config = {}) {
  const dir = process.env.PLUGIN_DIR || config.dir || DEFAULT_PLUGIN_DIR
  return path.isAbsolute(dir) ? dir : path.resolve(PROJECT_ROOT, dir)
}

export function configFilePath(dir) {
  return path.join(dir, CONFIG_FILE_NAME)
}

function applyEnvOverrides(config) {
  if (process.env.PLUGIN_ACTIVE) config.active = process.env.PLUGIN_ACTIVE
  if (process.env.PLUGIN_FALLBACK !== undefined) {
    config.fallback = toBoolean(process.env.PLUGIN_FALLBACK, config.fallback)
  }
  if (process.env.PLUGIN_REQUEST_TIMEOUT) {
    config.requestTimeout = Number(process.env.PLUGIN_REQUEST_TIMEOUT) || config.requestTimeout
  }
  if (process.env.PLUGIN_TLS_VERIFY !== undefined) {
    config.tlsVerify = toBoolean(process.env.PLUGIN_TLS_VERIFY, config.tlsVerify)
  }
  return config
}

function normalize(raw = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    sourceOverrides: { ...(raw.sourceOverrides || {}) },
    plugins: { ...(raw.plugins || {}) },
  }
}

export async function readConfig(dir) {
  const targetDir = dir ? path.resolve(dir) : resolvePluginDir(DEFAULT_CONFIG)
  const file = configFilePath(targetDir)

  let raw = {}
  try {
    raw = JSON.parse(await fs.readFile(file, 'utf-8'))
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`[PluginConfig] 解析 ${file} 失败，使用默认配置:`, err.message)
    }
  }

  const config = applyEnvOverrides(normalize(raw))
  config.dir = dir ? targetDir : resolvePluginDir(config)
  return config
}

export async function writeConfig(config) {
  await fs.mkdir(path.dirname(configFilePath(config.dir)), { recursive: true })
  const { dir, active, fallback, requestTimeout, tlsVerify, sourceOverrides, plugins } = config
  const payload = { dir: path.relative(PROJECT_ROOT, dir) || DEFAULT_PLUGIN_DIR, active, fallback, requestTimeout, tlsVerify, sourceOverrides, plugins }
  await fs.writeFile(configFilePath(dir), JSON.stringify(payload, null, 2), 'utf-8')
  return config
}

/**
 * 用磁盘上实际存在的插件同步配置：新插件补默认项，已删除的插件移除
 */
export function syncPluginEntries(config, discovered) {
  const plugins = { ...config.plugins }

  for (const id of discovered) {
    if (!plugins[id]) plugins[id] = { enabled: true, priority: 50 }
  }
  for (const id of Object.keys(plugins)) {
    if (!discovered.includes(id)) delete plugins[id]
  }

  config.plugins = plugins

  for (const [source, id] of Object.entries(config.sourceOverrides)) {
    if (!discovered.includes(id)) delete config.sourceOverrides[source]
  }

  if (config.active && !discovered.includes(config.active)) config.active = ''

  return config
}

export function resolveProxyUrl() {
  return process.env.PLUGIN_HTTP_PROXY
    || process.env.HTTPS_PROXY
    || process.env.https_proxy
    || process.env.HTTP_PROXY
    || process.env.http_proxy
    || null
}

export default readConfig
