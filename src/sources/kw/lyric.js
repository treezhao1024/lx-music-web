import { inflate } from 'zlib';
import { httpFetch } from './request.js';
import { lrcTools, decodeName } from './util.js';

const buf_key = Buffer.from('yeelion');
const buf_key_len = buf_key.length;

const timeExp = /^\[([\d:.]*)\]/;
const existTimeExp = /\[\d{1,2}:.*\d{1,4}\]/;

const buildParams = (id, isGetLyricx) => {
  let params = `user=12345,web,web,web&requester=localhost&req=1&rid=MUSIC_${id}`;
  if (isGetLyricx) params += '&lrcx=1';
  const buf_str = Buffer.from(params);
  const buf_str_len = buf_str.length;
  const output = new Uint16Array(buf_str_len);
  let i = 0;
  while (i < buf_str_len) {
    let j = 0;
    while (j < buf_key_len && i < buf_str_len) {
      output[i] = buf_key[j] ^ buf_str[i];
      i++;
      j++;
    }
  }
  return Buffer.from(output).toString('base64');
};

const xorDecode = (buf) => {
  const output = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) {
    output[i] = buf[i] ^ buf_key[i % buf_key_len];
  }
  return output;
};

/**
 * 响应体为 `tp=content` 头部 + zlib 压缩数据；lrcx=1 时解压结果还是 base64，
 * 需再做一次 yeelion XOR 才是 gb18030 编码的歌词文本。
 */
const decodeLyric = async (buf, isGetLyricx) => {
  if (buf.toString('utf8', 0, 10) !== 'tp=content') return '';
  const lrcData = await new Promise((resolve, reject) => {
    inflate(buf.subarray(buf.indexOf('\r\n\r\n') + 4), (err, result) => (err ? reject(err) : resolve(result)));
  });

  const decoder = new TextDecoder('gb18030');
  if (!isGetLyricx) return decoder.decode(lrcData);
  return decoder.decode(xorDecode(Buffer.from(lrcData.toString(), 'base64')));
};

const kwLyric = {
  sortLrcArr(arr) {
    const lrcSet = new Set();
    const lrc = [];
    const lrcT = [];
    const lyricxTag = /^<-?\d+,-?\d+>/;

    let isLyricx = false;
    for (const item of arr) {
      if (lrcSet.has(item.time)) {
        if (lrc.length < 2) continue;
        const tItem = lrc.pop();
        tItem.time = lrc[lrc.length - 1].time;
        lrcT.push(tItem);
        lrc.push(item);
      } else {
        lrc.push(item);
        lrcSet.add(item.time);
      }
      if (!isLyricx && lyricxTag.test(item.text)) isLyricx = true;
    }

    if (!isLyricx && lrcT.length > lrc.length * 0.3 && lrc.length - lrcT.length > 6) {
      throw new Error('failed');
    }

    return { lrc, lrcT };
  },

  transformLrc(tags, lrclist) {
    const body = lrclist ? lrclist.map(l => `[${l.time}]${l.text}\n`).join('') : '暂无歌词';
    return `${tags.join('\n')}\n${body}`;
  },

  parseLrc(lrc) {
    const lines = lrc.split(/\r\n|\r|\n/);
    const tags = [];
    const lrcArr = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      const result = timeExp.exec(line);
      if (result) {
        let time = result[1];
        if (/\.\d\d$/.test(time)) time += '0';
        lrcArr.push({ time, text: line.replace(timeExp, '').trim() });
      } else if (lrcTools.rxps.tagLine.test(line)) {
        tags.push(line);
      }
    }

    const lrcInfo = this.sortLrcArr(lrcArr);
    return {
      lyric: decodeName(this.transformLrc(tags, lrcInfo.lrc)),
      tlyric: lrcInfo.lrcT.length ? decodeName(this.transformLrc(tags, lrcInfo.lrcT)) : '',
    };
  },

  async getLyric(musicInfo, isGetLyricx = true) {
    const songmid = musicInfo.songmid || musicInfo.songId || musicInfo.strMediaMid || '';
    if (!songmid) throw new Error('Invalid song info');

    const { statusCode, body, raw } = await httpFetch(
      `http://newlyric.kuwo.cn/newlyric.lrc?${buildParams(songmid, isGetLyricx)}`,
    );
    if (statusCode !== 200) throw new Error(JSON.stringify(body));

    let lrcInfo;
    try {
      lrcInfo = this.parseLrc(await decodeLyric(raw, isGetLyricx));
    } catch {
      throw new Error('Get lyric failed');
    }

    if (lrcInfo.tlyric) lrcInfo.tlyric = lrcInfo.tlyric.replace(lrcTools.rxps.wordTimeAll, '');
    try {
      lrcInfo.lxlyric = lrcTools.parse(lrcInfo.lyric);
    } catch {
      lrcInfo.lxlyric = '';
    }
    lrcInfo.lyric = lrcInfo.lyric.replace(lrcTools.rxps.wordTimeAll, '');
    lrcInfo.rlyric = '';

    if (!existTimeExp.test(lrcInfo.lyric)) throw new Error('Get lyric failed');
    return lrcInfo;
  },
};

export default { getLyric: (songInfo) => kwLyric.getLyric(songInfo) };
