/**
 * lx-music-web-api 插件系统
 * 参考 lx-music-desktop 插件机制实现
 * 
 * 所有 getMusicUrl 请求都通过事件系统统一处理，
 * 调用 https://lxmusicapi.onrender.com 作为统一音源
 */

import EventEmitter from 'events'
import EVENT_NAMES from '../constants/events.js'
import https from 'https'
import http from 'http'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { ProxyAgent } from 'proxy-agent'

// ==================== 全局 lx 对象 ====================
class LxGlobal {
  constructor() {
    this.emitter = new EventEmitter()
    this.pendingRequests = new Map()
    this.requestId = 0
    this.availableSources = {}
  }

// 模拟 request 函数（用于 HTTP 请求）
  request(url, options = { method: 'GET' }, callback) {
    const proxy = process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy
    const agent = proxy ? new ProxyAgent(proxy) : undefined

    const protocol = url.startsWith('https') ? https : http

    const req = protocol.request(url, {
      ...options,
      agent,
      rejectUnauthorized: false
    }, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const jsonResponse = typeof data === 'string' ? JSON.parse(data) : data
          callback(null, {
            statusCode: res.statusCode,
            headers: res.headers,
            body: jsonResponse
          })
        } catch (e) {
          callback(e, null)
        }
      })
    })

    req.on('error', callback)
    req.on('timeout', () => {
      req.destroy(new Error('Request timeout'))
    })

    req.setTimeout(30000)
    req.end()
  }

  // 监听事件
  on(event, listener) {
    this.emitter.on(event, listener)
  }

  // 发送事件
  send(event, data) {
    this.emitter.emit(event, data)
  }

 // 发送请求事件并等待结果
  async sendRequestEvent(action, source, info) {
    return new Promise((resolve, reject) => {
      const requestId = ++this.requestId
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error('Request timeout'))
      }, 30000)

      const handler = (eventData) => {
        if (eventData && eventData.requestId === requestId) {
          clearTimeout(timeout)
          this.emitter.removeListener('lx:request:response', handler)
          this.pendingRequests.delete(requestId)
          
          if (eventData.error) {
            reject(new Error(eventData.error))
          } else {
            resolve(eventData.result)
          }
        }
      }

      this.emitter.on('lx:request:response', handler)
      this.pendingRequests.set(requestId, { action, source, info })

      // 发送请求事件
      this.emitter.emit('lx:request', {
        requestId,
        action,
        source,
        info
      })
    })
  }

  // 获取事件名称
  get EVENT_NAMES() {
    return EVENT_NAMES
  }

  // 获取全局工具
  get utils() {
    return {}
  }

  // 环境类型
  get env() {
    return 'web-api'
  }

  // 版本信息
  get version() {
    return '1.0.0'
  }
}

// ==================== 插件系统类 ====================
class PluginSystem {
  constructor() {
    this.lx = new LxGlobal()
    this.initialized = false
  }

  // 初始化插件系统
  initialize() {
    if (this.initialized) {
      return
    }

    console.log('[PluginSystem] Initializing...')
    
    // 注入全局 lx 对象
    globalThis.lx = this.lx
    
    // 注册统一音乐源插件
    this.registerUnifiedMusicPlugin()
    
    this.initialized = true
    console.log('[PluginSystem] Global lx object injected')
  }

 // 注册统一音乐源插件
   registerUnifiedMusicPlugin() {
    const { EVENT_NAMES: evtNames, utils, env, version } = globalThis.lx
    const lxHttp = this.lx.request.bind(this.lx)
    const lxOn = this.lx.on.bind(this.lx)
    const lxSend = this.lx.send.bind(this.lx)

    // HTTP 请求封装
    const httpFetch = (url, options = { method: 'GET' }) => {
      return new Promise((resolve, reject) => {
        lxHttp(url, options, (err, resp) => {
          if (err) return reject(err)
          resolve(resp)
        })
      })
    }

    const API_URL = 'https://lxmusicapi.onrender.com'
    const API_KEY = 'share-v3'
    const MUSIC_SOURCE = Object.keys(MUSIC_QUALITY)

    // 处理音乐 URL 获取请求
    const handleGetMusicUrl = async (source, musicInfo, quality) => {
      const songId = musicInfo.hash ?? musicInfo.songmid ?? musicInfo.songId ?? musicInfo.strMediaMid
      console.log("handleGetMusic", source)
      const response = await httpFetch(`${API_URL}/url/${source}/${songId}/${quality}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `${env ? `lx-music-${env}/${version}` : `lx-music-request/${version}`}`,
          'X-Request-Key': API_KEY,
        },
      })
      const { body } = response
      if (!body || isNaN(Number(body.code))) throw new Error('unknow error')
      switch (body.code) {
        case 0:
          return body.url
        case 1:
          throw new Error('block ip')
        case 2:
          throw new Error('get music url failed')
        case 4:
          throw new Error('internal server error')
        case 5:
          throw new Error('too many requests')
        case 6:
          throw new Error('param error')
        default:
          throw new Error(body.msg ?? 'unknow error')
      }
    }

   // 处理歌词获取请求
    const handleGetLyric = async (source, musicInfo) => {
      const songId = musicInfo.hash ?? musicInfo.songmid ?? musicInfo.songId ?? musicInfo.strMediaMid

      const response = await httpFetch(`${API_URL}/lyric/${source}/${songId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `${env ? `lx-music-${env}/${version}` : `lx-music-request/${version}`}`,
          'X-Request-Key': API_KEY,
        },
      })
      const { body } = response
      if (!body || isNaN(Number(body.code))) throw new Error('unknow error')
      switch (body.code) {
        case 0:
          return {
            lyric: body.lyric || '',
            tlyric: body.tlyric || '',
            rlyric: body.rlyric || '',
          }
        case 1:
          throw new Error('block ip')
        case 2:
          throw new Error('get lyric failed')
        case 4:
          throw new Error('internal server error')
        case 5:
          throw new Error('too many requests')
        case 6:
          throw new Error('param error')
        default:
          throw new Error(body.msg ?? 'unknow error')
      }
    }

    // 创建音乐源元数据
    const musicSources = {}
    MUSIC_SOURCE.forEach(item => {
      musicSources[item] = {
        name: item,
        type: 'music',
        actions: ['musicUrl', 'getLyric'],
        qualitys: MUSIC_QUALITY[item],
      }
    })

    // 注册事件监听器
    lxOn(evtNames.request, async ({ requestId, action, source, info }) => {
      try {
        switch (action) {
          case 'musicUrl':
            if (env != 'mobile') {
              console.group(`Handle Action(musicUrl)`)
              console.log('source', source)
              console.log('quality', info.type)
              console.log('musicInfo', info.musicInfo)
              console.groupEnd()
            } else {
              console.log(`Handle Action(musicUrl)`)
              console.log('source', source)
              console.log('quality', info.type)
              console.log('musicInfo', info.musicInfo)
            }
            const result = await handleGetMusicUrl(source, info.musicInfo, info.type)
            
            // 返回结果给调用者
            lxSend(evtNames.request + ':response', {
              requestId,
              result
            })
            return result
          case 'getLyric':
            if (env != 'mobile') {
              console.group(`Handle Action(getLyric)`)
              console.log('source', source)
              console.log('musicInfo', info.musicInfo)
              console.groupEnd()
            } else {
              console.log(`Handle Action(getLyric)`)
              console.log('source', source)
              console.log('musicInfo', info.musicInfo)
            }
            const lyricResult = await handleGetLyric(source, info.musicInfo)
            
            // 返回结果给调用者
            lxSend(evtNames.request + ':response', {
              requestId,
              result: lyricResult
            })
            return lyricResult
          default:
            console.error(`action(${action}) not support`)
            lxSend(evtNames.request + ':response', {
              requestId,
              error: 'action not support'
            })
            return Promise.reject('action not support')
        }
      } catch (error) {
        console.error(`Error handling ${action}:`, error)
        lxSend(evtNames.request + ':response', {
          requestId,
          error: error.message
        })
        throw error
      }
    })

    // 设置可用源列表
    this.lx.availableSources = musicSources

    // 发送初始化完成事件
    lxSend(evtNames.inited, { status: true, openDevTools: DEV_ENABLE, sources: musicSources })
    
    console.log('[PluginSystem] Unified music plugin registered')
  }

  // 获取全局 lx 对象
  getLx() {
    return this.lx
  }

  // 获取可用源列表
  getAvailableSources() {
    return this.lx.availableSources
  }

  // 设置可用源列表
  setAvailableSources(sources) {
    this.lx.availableSources = sources
  }
}

// ==================== 插件配置 ====================
const DEV_ENABLE = false
const API_URL = 'https://lxmusicapi.onrender.com'
const API_KEY = 'share-v3'
const MUSIC_QUALITY = {
  tx: ['128k', '320k'],
  wy: ['128k', '320k'],
}
const MUSIC_SOURCE = Object.keys(MUSIC_QUALITY)

// 导出插件系统
export default new PluginSystem()
