import { httpFetch } from './request.js';
import { decryptLyrics } from './lyricDecrypt.js';

const songIdMap = new Map();
const promises = new Map();

const getMusicInfo = async (songmid) => {
  const response = await httpFetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; WOW64; Trident/5.0)',
    },
    body: JSON.stringify({
      comm: { ct: '19', cv: '1859', uin: '0' },
      req: {
        module: 'music.pf_song_detail_svr',
        method: 'get_song_detail_yqq',
        param: { song_type: 0, song_mid: songmid },
      },
    }),
  });

  const { body } = response;
  if (body.code !== 0 || body.req?.code !== 0) {
    throw new Error('Get music info failed');
  }

  const trackInfo = body.req.data.track_info;
  return {
    songId: trackInfo?.id?.toString() || '',
    songmid: trackInfo?.mid || songmid,
  };
};

const getSongId = async (mInfo) => {
  if (mInfo.songId) return mInfo.songId;
  if (songIdMap.has(mInfo.songmid)) return songIdMap.get(mInfo.songmid);
  if (promises.has(mInfo.songmid)) return (await promises.get(mInfo.songmid)).songId;
  
  const promise = getMusicInfo(mInfo.songmid);
  promises.set(mInfo.songmid, promise);
  const info = await promise;
  songIdMap.set(mInfo.songmid, info.songId);
  promises.delete(mInfo.songmid);
  return info.songId;
};

const parseTools = {
  rxps: {
    info: /^{"/,
    lineTime: /^\[(\d+),\d+\]/,
    lineTime2: /^\[([\d:.]+)\]/,
    wordTime: /\(\d+,\d+\)/,
    wordTimeAll: /(\(\d+,\d+\))/g,
    timeLabelFixRxp: /(?:\.0+|0+)$/,
  },
  msFormat(timeMs) {
    if (Number.isNaN(timeMs)) return '';
    let ms = timeMs % 1000;
    timeMs /= 1000;
    let m = parseInt(timeMs / 60).toString().padStart(2, '0');
    timeMs %= 60;
    let s = parseInt(timeMs).toString().padStart(2, '0');
    return `[${m}:${s}.${String(ms).padStart(3, '0')}]`;
  },
  parseLyric(lrc) {
    lrc = lrc.trim().replace(/\r/g, '');
    if (!lrc) return { lyric: '', lxlyric: '' };
    const lines = lrc.split('\n');
    const lxlrcLines = [];
    const lrcLines = [];

    for (let line of lines) {
      line = line.trim();
      let result = this.rxps.lineTime.exec(line);
      if (!result) {
        if (line.startsWith('[offset')) { lxlrcLines.push(line); lrcLines.push(line); }
        if (this.rxps.lineTime2.test(line)) lrcLines.push(line);
        continue;
      }

      const startMsTime = parseInt(result[1]);
      const startTimeStr = this.msFormat(startMsTime);
      if (!startTimeStr) continue;

      let words = line.replace(this.rxps.lineTime, '');
      lrcLines.push(`${startTimeStr}${words.replace(this.rxps.wordTimeAll, '')}`);

      let times = words.match(this.rxps.wordTimeAll);
      if (!times) continue;
      times = times.map(time => {
        const res = /\((\d+),(\d+)\)/.exec(time);
        return `<${Math.max(parseInt(res[1]) - startMsTime, 0)},${res[2]}>`;
      });
      const wordArr = words.split(this.rxps.wordTime);
      const newWords = times.map((time, index) => `${time}${wordArr[index]}`).join('');
      lxlrcLines.push(`${startTimeStr}${newWords}`);
    }
    return { lyric: lrcLines.join('\n'), lxlyric: lxlrcLines.join('\n') };
  },
  parseRlyric(lrc) {
    lrc = lrc.trim().replace(/\r/g, '');
    if (!lrc) return '';
    const lines = lrc.split('\n');
    const lrcLines = [];
    for (let line of lines) {
      line = line.trim();
      let result = this.rxps.lineTime.exec(line);
      if (!result) continue;
      const startMsTime = parseInt(result[1]);
      const startTimeStr = this.msFormat(startMsTime);
      if (!startTimeStr) continue;
      let words = line.replace(this.rxps.lineTime, '');
      lrcLines.push(`${startTimeStr}${words.replace(this.rxps.wordTimeAll, '')}`);
    }
    return lrcLines.join('\n');
  },
  removeTag(str) {
    return str.replace(/^[\S\s]*?LyricContent="/, '').replace(/"\/>[\S\s]*?$/, '');
  },
  getIntv(interval) {
    if (!interval) return 0;
    if (!interval.includes('.')) interval += '.0';
    let arr = interval.split(/:|\./);
    while (arr.length < 3) arr.unshift('0');
    const [m, s, ms] = arr;
    return parseInt(m) * 3600000 + parseInt(s) * 1000 + parseInt(ms);
  },
  fixRlrcTimeTag(rlrc, lrc) {
    const rlrcLines = rlrc.split('\n');
    let lrcLines = lrc.split('\n');
    let newLrc = [];
    rlrcLines.forEach((line) => {
      const result = this.rxps.lineTime2.exec(line);
      if (!result) return;
      const words = line.replace(this.rxps.lineTime2, '');
      if (!words.trim()) return;
      const t1 = this.getIntv(result[1]);
      while (lrcLines.length) {
        const lrcLine = lrcLines.shift();
        const lrcLineResult = this.rxps.lineTime2.exec(lrcLine);
        if (!lrcLineResult) continue;
        const t2 = this.getIntv(lrcLineResult[1]);
        if (Math.abs(t1 - t2) < 100) {
          newLrc.push(line.replace(this.rxps.lineTime2, lrcLineResult[0]));
          break;
        }
      }
    });
    return newLrc.join('\n');
  },
  fixTlrcTimeTag(tlrc, lrc) {
    const tlrcLines = tlrc.split('\n');
    let lrcLines = lrc.split('\n');
    let newLrc = [];
    tlrcLines.forEach((line) => {
      const result = this.rxps.lineTime2.exec(line);
      if (!result) return;
      const words = line.replace(this.rxps.lineTime2, '');
      if (!words.trim()) return;
      let time = result[1];
      if (time.includes('.')) {
        time += ''.padStart(3 - time.split('.')[1].length, '0');
      }
      const t1 = this.getIntv(time);
      while (lrcLines.length) {
        const lrcLine = lrcLines.shift();
        const lrcLineResult = this.rxps.lineTime2.exec(lrcLine);
        if (!lrcLineResult) continue;
        const t2 = this.getIntv(lrcLineResult[1]);
        if (Math.abs(t1 - t2) < 100) {
          newLrc.push(line.replace(this.rxps.lineTime2, lrcLineResult[0]));
          break;
        }
      }
    });
    return newLrc.join('\n');
  },
  parse(lrc, tlrc, rlrc) {
    const info = { lyric: '', tlyric: '', rlyric: '', lxlyric: '' };
    if (lrc) {
      let { lyric, lxlyric } = this.parseLyric(this.removeTag(lrc));
      info.lyric = lyric;
      info.lxlyric = lxlyric;
    }
    if (rlrc) info.rlyric = this.fixRlrcTimeTag(this.parseRlyric(this.removeTag(rlrc)), info.lyric);
    if (tlrc) info.tlyric = this.fixTlrcTimeTag(tlrc, info.lyric);
    return info;
  },
};

const decodeLyric = async (str) => {
  if (!str) return '';
  try {
    return decryptLyrics(str);
  } catch (err) {
    console.error('[Lyric] Decryption failed:', err);
    return str;
  }
};

const txLyricModule = {
  successCode: 0,
  
  async parseLyric(lrc, tlrc, rlrc) {
    try {
      const [decodedLrc, decodedTlrc, decodedRlrc] = await Promise.all([
        decodeLyric(lrc),
        decodeLyric(tlrc),
        decodeLyric(rlrc),
      ]);
      return parseTools.parse(decodedLrc, decodedTlrc, decodedRlrc);
    } catch (err) {
      console.error('[Lyric] Error parsing lyrics:', err);
      return { lyric: '', tlyric: '', rlyric: '', lxlyric: '' };
    }
  },
  
  async getLyricNew(mInfo) {
    const httpFetch = (await import('./request.js')).httpFetch;
    
    const response = await httpFetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://y.qq.com/',
        'User-Agent': 'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; WOW64; Trident/5.0)',
      },
      body: JSON.stringify({
        req_1: {
          module: 'music.musichallSong.PlayLyricInfo',
          method: 'GetPlayLyricInfo',
          param: {
            songID: parseInt(mInfo.songId),
            crypt: 1,
            trans: 1,
            roma: 1,
          },
        },
        comm: { ct: '19', cv: '1859', uin: '0' },
      }),
    });
    
    if (response.body.code !== 0) {
      throw new Error('New API failed: ' + response.body.code);
    }
    
    const data = response.body.req_1.data;
    return this.parseLyric(data?.lyric, data?.trans, data?.roma);
  },
  
  async getLyric(mInfo) {
    const songId = await getSongId(mInfo);
    try {
      const result = await this.getLyricNew({ ...mInfo, songId });
      return result;
    } catch (err) {
      console.log('[Lyric] New API failed, trying old API...');
      return this.getLyricOld(mInfo);
    }
  },
  
  async getLyricOld(mInfo) {
    const httpFetch = (await import('./request.js')).httpFetch;
    const songmid = mInfo.songmid;
    
    const response = await httpFetch('https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg', {
      method: 'GET',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36',
      },
      query: {
        songmid, g_tkan: 5381, loginUin: 0, hostUin: 0, format: 'json',
        inCharset: 'utf8', outCharset: 'utf-8', platform: 'yqq',
      },
    });
    
    let data = response.body;
    if (typeof response.body === 'string') {
      if (response.body.startsWith('MusicJsonCallback')) {
        const match = response.body.match(/MusicJsonCallback\((.+)\)/);
        if (match) data = JSON.parse(match[1]);
      } else {
        data = JSON.parse(response.body);
      }
    }
    
    if (data.retcode !== 0 && data.code !== 0) {
      return { lyric: '', tlyric: '', rlyric: '', lxlyric: '' };
    }
    if (!data.lyric) {
      return { lyric: '', tlyric: '', rlyric: '', lxlyric: '' };
    }
    
    const decodeName = (str) => str.replace(/^[\S\s]*?LyricContent="/, '').replace(/"\/>[\S\s]*?$/, '');
    const lyric = decodeName(data.lyric);
    const tlyric = data.trans ? decodeName(data.trans) : '';
    return this.parseLyric(lyric, tlyric, '');
  },
};

const getLyric = async (songInfo) => {
  const mInfo = {
    songId: songInfo.songId || '',
    songmid: songInfo.songmid || songInfo.strMediaMid || '',
  };

  if (!mInfo.songId && !mInfo.songmid) {
    throw new Error('Invalid song info');
  }

  return txLyricModule.getLyric(mInfo);
};

export default { getLyric };
