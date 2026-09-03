import { httpFetch } from './request.js';
import { formatPlayTime } from '../../utils/shared.js';
import { formatSinger, decodeName } from './util.js';

const PIC_URL_PREFIX = 'http://img1.kwcdn.kuwo.cn/star/albumcover/';

const regExps = {
  mInfo: /level:(\w+),bitrate:(\d+),format:(\w+),size:([\w.]+)/,
};

const limit = 30;
let total = 0;
let page = 0;
let allPage = 1;

const getPic = (item) => {
  const short = item.web_albumpic_short;
  if (!short) return '';
  return PIC_URL_PREFIX + String(short).replace(/^\d+\//, '500/');
};

const handleResult = (rawList) => {
  const list = [];
  if (!rawList || !Array.isArray(rawList)) return list;

  for (const info of rawList) {
    if (!info.MUSICRID) continue;
    if (!info.N_MINFO) return null;

    const types = [];
    const _types = {};

    for (let mInfo of info.N_MINFO.split(';')) {
      mInfo = mInfo.match(regExps.mInfo);
      if (!mInfo) continue;
      switch (mInfo[2]) {
        case '4000':
          types.push({ type: 'flac24bit', size: mInfo[4] });
          _types.flac24bit = { size: mInfo[4].toLocaleUpperCase() };
          break;
        case '2000':
          types.push({ type: 'flac', size: mInfo[4] });
          _types.flac = { size: mInfo[4].toLocaleUpperCase() };
          break;
        case '320':
          types.push({ type: '320k', size: mInfo[4] });
          _types['320k'] = { size: mInfo[4].toLocaleUpperCase() };
          break;
        case '128':
          types.push({ type: '128k', size: mInfo[4] });
          _types['128k'] = { size: mInfo[4].toLocaleUpperCase() };
          break;
      }
    }
    types.reverse();

    const songId = info.MUSICRID.replace('MUSIC_', '');
    const interval = parseInt(info.DURATION);

    list.push({
      name: decodeName(info.SONGNAME),
      singer: formatSinger(decodeName(info.ARTIST)),
      source: 'kw',
      songId,
      songmid: songId,
      albumId: decodeName(info.ALBUMID || ''),
      albumName: info.ALBUM ? decodeName(info.ALBUM) : '',
      interval: Number.isNaN(interval) ? 0 : formatPlayTime(interval),
      img: getPic(info),
      types,
      _types,
      typeUrl: {},
    });
  }

  return list;
};

const kwMusicSearch = (str, page, limit) => httpFetch(
  `http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(str)}&pn=${page - 1}&rn=${limit}`
  + '&uid=794762570&ver=kwplayer_ar_9.2.2.1&vipver=1&show_copyright_off=1&newver=1&ft=music'
  + '&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&mobi=1&issubtitle=1',
);

const search = async (str, pageNum = 1, limitNum, retryNum = 0) => {
  if (++retryNum > 3) throw new Error('try max num');
  if (limitNum == null) limitNum = limit;

  const { body: result } = await kwMusicSearch(str, pageNum, limitNum);

  if (!result || typeof result === 'string') return search(str, pageNum, limitNum, retryNum);
  if (result.TOTAL !== '0' && result.SHOW === '0') return search(str, pageNum, limitNum, retryNum);

  const list = handleResult(result.abslist);
  if (list == null) return search(str, pageNum, limitNum, retryNum);

  total = parseInt(result.TOTAL) || 0;
  page = pageNum;
  allPage = Math.ceil(total / limitNum);

  return {
    list,
    allPage,
    limit: limitNum,
    total,
    source: 'kw',
  };
};

export default {
  limit,
  total,
  page,
  allPage,
  search,
};
