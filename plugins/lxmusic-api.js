/*!
 * @name LX Music API 音源
 * @description 通过远程 lxmusicapi 接口获取播放链接与歌词，接口地址与 Key 在 plugins/config.json 的 settings 中配置
 * @version 1.0.0
 * @author lx-music-web
 * @homepage https://github.com/lx-music/lx-music-web-api
 */

const { EVENT_NAMES, request, on, send, env, version, settings } = globalThis.lx

const API_URL = String(settings.apiUrl || 'https://lxmusicapi.onrender.com').replace(/\/+$/, '')
const API_KEY = settings.apiKey || 'share-v3'
const MUSIC_QUALITY = settings.qualitys || {
  tx: ['128k', '320k'],
  wy: ['128k', '320k'],
}
const MUSIC_SOURCE = Object.keys(MUSIC_QUALITY)

const httpFetch = (url, options = { method: 'GET' }) => new Promise((resolve, reject) => {
  request(url, options, (err, resp) => {
    if (err) return reject(err)
    resolve(resp)
  })
})

const buildHeaders = () => ({
  'Content-Type': 'application/json',
  'User-Agent': `lx-music-${env}/${version}`,
  'X-Request-Key': API_KEY,
})

const getSongId = (musicInfo = {}) =>
  musicInfo.hash ?? musicInfo.songmid ?? musicInfo.songId ?? musicInfo.strMediaMid ?? musicInfo.id

const assertResponseOk = (body, failedMessage) => {
  if (!body || isNaN(Number(body.code))) throw new Error('unknow error')
  switch (Number(body.code)) {
    case 0:
      return
    case 1:
      throw new Error('block ip')
    case 2:
      throw new Error(failedMessage)
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

const handleGetMusicUrl = async (source, musicInfo, quality) => {
  const songId = getSongId(musicInfo)
  if (!songId) throw new Error('无法获取歌曲ID')

  const { body } = await httpFetch(`${API_URL}/url/${source}/${songId}/${quality}`, {
    method: 'GET',
    headers: buildHeaders(),
  })
  assertResponseOk(body, 'get music url failed')
  return body.url
}

const handleGetLyric = async (source, musicInfo) => {
  const songId = getSongId(musicInfo)
  if (!songId) throw new Error('无法获取歌曲ID')

  const { body } = await httpFetch(`${API_URL}/lyric/${source}/${songId}`, {
    method: 'GET',
    headers: buildHeaders(),
  })
  assertResponseOk(body, 'get lyric failed')
  return {
    lyric: body.lyric || '',
    tlyric: body.tlyric || '',
    rlyric: body.rlyric || '',
  }
}

on(EVENT_NAMES.request, ({ action, source, info }) => {
  switch (action) {
    case 'musicUrl':
      console.log(`musicUrl ${source} ${info.type} ${getSongId(info.musicInfo)}`)
      return handleGetMusicUrl(source, info.musicInfo, info.type)
    case 'getLyric':
      console.log(`getLyric ${source} ${getSongId(info.musicInfo)}`)
      return handleGetLyric(source, info.musicInfo)
    default:
      return Promise.reject(new Error(`action(${action}) not support`))
  }
})

const musicSources = {}
MUSIC_SOURCE.forEach(item => {
  musicSources[item] = {
    name: item,
    type: 'music',
    actions: ['musicUrl', 'getLyric'],
    qualitys: MUSIC_QUALITY[item],
  }
})

send(EVENT_NAMES.inited, { status: true, openDevTools: false, sources: musicSources })

console.log(`已加载，接口: ${API_URL}，音源: ${MUSIC_SOURCE.join(',')}`)
