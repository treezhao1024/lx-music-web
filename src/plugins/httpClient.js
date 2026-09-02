/**
 * 插件运行时使用的 HTTP 客户端
 * 对外暴露 lx-music 风格的 request(url, options, callback)
 */

import axios from 'axios'
import https from 'https'
import { ProxyAgent } from 'proxy-agent'

const DEFAULT_TIMEOUT = 30000

const clientOptions = {
  tlsVerify: false,
  proxyUrl: null,
}

const agentCache = new Map()

export function configureHttpClient(next = {}) {
  Object.assign(clientOptions, next)
}

function getAgents() {
  const { proxyUrl, tlsVerify } = clientOptions
  const cacheKey = `${proxyUrl || ''}|${tlsVerify}`
  let agents = agentCache.get(cacheKey)
  if (agents) return agents

  if (proxyUrl) {
    const proxyOptions = parseProxy(proxyUrl)
    const agent = proxyOptions.protocol
      ? new ProxyAgent({ ...proxyOptions, rejectUnauthorized: tlsVerify })
      : new ProxyAgent(proxyUrl)
    agents = { httpAgent: agent, httpsAgent: agent }
  } else {
    const agent = new https.Agent({ rejectUnauthorized: tlsVerify, keepAlive: true })
    agents = { httpAgent: agent, httpsAgent: agent }
  }

  agentCache.set(cacheKey, agents)
  return agents
}

function parseProxy(proxyUrl) {
  try {
    const url = new URL(proxyUrl)
    return {
      protocol: url.protocol,
      host: url.hostname,
      port: Number(url.port) || (url.protocol === 'https:' ? 443 : 80),
      ...(url.username ? { auth: `${url.username}:${url.password}` } : {}),
    }
  } catch {
    return {}
  }
}

function hasHeader(headers, name) {
  return Object.keys(headers).some(key => key.toLowerCase() === name)
}

function buildRequestBody(options) {
  const headers = { ...(options.headers || {}) }
  let data

  if (options.form && typeof options.form === 'object') {
    data = new URLSearchParams(options.form).toString()
    if (!hasHeader(headers, 'content-type')) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
    }
  } else if (options.body !== undefined && options.body !== null) {
    if (typeof options.body === 'string' || Buffer.isBuffer(options.body)) {
      data = options.body
    } else {
      data = JSON.stringify(options.body)
      if (!hasHeader(headers, 'content-type')) {
        headers['Content-Type'] = 'application/json'
      }
    }
  }

  return { headers, data }
}

function parseResponseBody(response, options) {
  const raw = response.data

  if (options.binary) {
    return Buffer.isBuffer(raw) ? raw : Buffer.from(raw ?? '')
  }

  const text = Buffer.isBuffer(raw) ? raw.toString('utf-8') : raw
  if (typeof text !== 'string') return text

  const contentType = String(response.headers?.['content-type'] ?? '')
  const trimmed = text.trim()
  if (contentType.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return text
    }
  }
  return text
}

async function doRequest(url, options) {
  const { headers, data } = buildRequestBody(options)
  const timeout = Number(options.timeout) > 0 ? Number(options.timeout) : DEFAULT_TIMEOUT

  try {
    const response = await axios.request({
      url,
      method: (options.method || 'GET').toUpperCase(),
      headers,
      data,
      timeout,
      responseType: options.binary ? 'arraybuffer' : 'text',
      transformResponse: [],
      maxRedirects: options.maxRedirects === undefined ? 5 : Number(options.maxRedirects),
      decompress: true,
      validateStatus: () => true,
      proxy: false,
      ...getAgents(),
    })

    return {
      statusCode: response.status,
      headers: response.headers ?? {},
      body: parseResponseBody(response, options),
    }
  } catch (err) {
    if (err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message ?? '')) {
      throw new Error(`Request timeout: ${url}`)
    }
    throw new Error(err?.message ?? String(err))
  }
}

export function request(url, options = {}, callback) {
  const promise = doRequest(url, options)
  if (typeof callback !== 'function') return promise
  promise.then(
    resp => callback(null, resp),
    err => callback(err, null),
  )
}

export default request
