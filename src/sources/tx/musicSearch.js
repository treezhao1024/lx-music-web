import { httpFetch } from './request.js';
import { formatPlayTime, sizeFormate } from '../../utils/shared.js';

const limit = 30;
let total = 0;
let page = 0;
let allPage = 1;

const formatSingerName = (singers) => {
  if (!singers) return '';
  if (typeof singers === 'string') return singers;
  if (Array.isArray(singers)) {
    return singers.map(s => typeof s === 'object' ? s.name : s).join('/');
  }
  return singers;
};

const handleTxResult = (rawList) => {
  const list = [];
  if (!rawList || !Array.isArray(rawList)) return list;

  rawList.forEach((item) => {
    if (!item.mid) return;

    let types = [];
    let _types = {};
    
    if (item.file?.size_128mp3 !== 0) {
      let size = sizeFormate(item.file.size_128mp3);
      types.push({ type: '128k', size });
      _types['128k'] = { size };
    }
    if (item.file?.size_320mp3 !== 0) {
      let size = sizeFormate(item.file.size_320mp3);
      types.push({ type: '320k', size });
      _types['320k'] = { size };
    }
    if (item.file?.size_flac !== 0) {
      let size = sizeFormate(item.file.size_flac);
      types.push({ type: 'flac', size });
      _types.flac = { size };
    }
    if (item.file?.size_hires !== 0) {
      let size = sizeFormate(item.file.size_hires);
      types.push({ type: 'flac24bit', size });
      _types.flac24bit = { size };
    }

    if (types.length === 0 && item.href3) {
      types.push({ type: 'tx', size: '在线播放' });
      _types.tx = { url: item.href3 };
    }

    let albumId = '';
    let albumName = '';
    if (item.album) {
      albumName = item.album.name;
      albumId = item.album.mid;
    }

    list.push({
      singer: formatSingerName(item.singer),
      name: item.name + (item.title_extra ?? ''),
      albumName,
      albumId,
      source: 'tx',
      interval: formatPlayTime(item.interval),
      songId: item.id,
      albumMid: item.album?.mid ?? '',
      strMediaMid: item.file?.media_mid || '',
      songmid: item.mid,
      img: (albumId === '' || albumId === '空')
        ? item.singer?.length ? `https://y.gtimg.cn/music/photo_new/T001R500x500M000${item.singer[0].mid}.jpg` : ''
        : `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumId}.jpg`,
      types,
      _types,
      typeUrl: {},
    });
  });
  return list;
};

const txMusicSearch = async (str, page, limitNum) => {
  const actualLimit = Math.min(limitNum, 30);
  const response = await httpFetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Referer': 'https://y.qq.com',
    },
    body: JSON.stringify({
      comm: { ct: '19', cv: '1859', uin: '0' },
      req_1: {
        module: 'music.search.SearchCgiService',
        method: 'DoSearchForQQMusicDesktop',
        param: {
          num_per_page: actualLimit,
          page_num: page,
          query: str,
          search_type: 0,
        },
      },
    }),
  });
  return response.body;
};

const search = async (str, page = 1, limitNum, retryNum = 0) => {
  if (++retryNum > 3) throw new Error('try max num');
  if (limitNum == null) limitNum = 30;

  const responseBody = await txMusicSearch(str, page, limitNum);
  
  if (responseBody.code !== 0) {
    return {
      list: [], allPage: 0, limit: limitNum, total: 0, source: 'tx',
    };
  }

  const reqObj = responseBody.req_1;
  if (reqObj.code !== 0) {
    return {
      list: [], allPage: 0, limit: limitNum, total: 0, source: 'tx',
    };
  }

  const dataObj = reqObj.data;
  const songList = dataObj?.body?.song?.list || [];
  const list = handleTxResult(songList);

  total = dataObj?.meta?.sum || list.length;
  page = page;
  allPage = Math.ceil(total / limitNum);

  return {
    list,
    allPage,
    limit: limitNum,
    total,
    source: 'tx',
  };
};

export default {
  limit,
  total,
  page,
  allPage,
  search,
};
