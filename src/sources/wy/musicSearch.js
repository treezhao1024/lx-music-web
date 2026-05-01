import { eapiRequest } from './request.js';
import { formatPlayTime, sizeFormate } from '../../utils/shared.js';

const limit = 30;
let total = 0;
let page = 0;
let allPage = 1;

const getSinger = (singers) => {
  return singers.map(s => s.name).join('、');
};

const handleResult = (rawList) => {
  if (!rawList || !Array.isArray(rawList)) return [];
  return rawList.map(item => {
    item = item.baseInfo.simpleSongData;
    const types = [];
    const _types = {};
    let size;

    if (item.privilege.maxBrLevel === 'hires') {
      size = item.hr ? sizeFormate(item.hr.size) : null;
      types.push({ type: 'flac24bit', size });
      _types.flac24bit = { size };
    }

    switch (item.privilege.maxbr) {
      case 999000:
        size = item.sq ? sizeFormate(item.sq.size) : null;
        types.push({ type: 'flac', size });
        _types.flac = { size };
      case 320000:
        size = item.h ? sizeFormate(item.h.size) : null;
        types.push({ type: '320k', size });
        _types['320k'] = { size };
      case 192000:
      case 128000:
        size = item.l ? sizeFormate(item.l.size) : null;
        types.push({ type: '128k', size });
        _types['128k'] = { size };
    }

    types.reverse();

    return {
      singer: getSinger(item.ar),
      name: item.name,
      albumName: item.al.name,
      albumId: item.al.id,
      source: 'wy',
      interval: formatPlayTime(item.dt / 1000),
      songId: item.id,
      songmid: item.id,
      img: item.al.picUrl,
      types,
      _types,
      typeUrl: {},
    };
  });
};

const search = async (str, pageNum = 1, limitNum = null, retryNum = 0, self) => {
  if (++retryNum > 3) throw new Error('try max num');
  if (limitNum == null) limitNum = 30;

  console.log('[wy/search] ========== START ==========');
  console.log('[wy/search] keyword:', str, 'pageNum:', pageNum, 'limitNum:', limitNum, 'retryNum:', retryNum);

  const eapiParams = {
    keyword: str,
    needCorrect: '1',
    channel: 'typing',
    offset: limitNum * (pageNum - 1),
    scene: 'normal',
    total: pageNum == 1,
    limit: limitNum,
  };
  console.log('[wy/search] eapiRequest params:', JSON.stringify(eapiParams));

  const result = await eapiRequest('/api/search/song/list/page', eapiParams);

  console.log('[wy/search] eapiRequest raw response:', JSON.stringify({
    statusCode: result.statusCode,
    bodyCode: result.body?.code,
    bodyErrorMsg: result.body?.errorMsg,
    rawBodyKeys: result.body ? Object.keys(result.body) : null,
  }, null, 2));

  // Log full raw response body for debugging (first 2000 chars)
  const rawBodyStr = JSON.stringify(result.body);
  if (rawBodyStr.length > 2000) {
    console.log('[wy/search] Raw body (truncated):', rawBodyStr.substring(0, 2000) + '...');
  } else {
    console.log('[wy/search] Raw body:', rawBodyStr);
  }

  const body = result.body;
  if (!body || body.code !== 200) {
    console.warn('[wy/search] API returned non-200 code:', body?.code, 'retrying...');
    return search(str, pageNum, limitNum, retryNum, self);
  }

  const rawResources = body.data.resources || [];
  console.log('[wy/search] body.data keys:', body.data ? Object.keys(body.data) : 'N/A');
  console.log('[wy/search] body.data.totalCount:', body.data?.totalCount);
  console.log('[wy/search] rawResources count:', rawResources.length);
  
  // Log each raw resource summary
  rawResources.forEach((res, i) => {
    const baseInfo = res?.baseInfo?.simpleSongData;
    console.log(`[wy/search] resource[${i}]: name=${baseInfo?.name}, artist=${baseInfo?.ar?.map(a=>a.name).join(',')}, id=${baseInfo?.id}, privilege.maxbr=${baseInfo?.privilege?.maxbr}, has_hr=${!!baseInfo?.hr}, has_sq=${!!baseInfo?.sq}, has_h=${!!baseInfo?.h}, has_l=${!!baseInfo?.l}`);
  });

  let list = handleResult(rawResources);

  console.log('[wy/search] handleResult returned list length:', list.length);
  list.forEach((song, i) => {
    console.log(`[wy/search] list[${i}]: name=${song.name}, singer=${song.singer}, songmid=${song.songmid}, types=${JSON.stringify(song.types)}`);
  });

  if (!list || list.length === 0) {
    console.warn('[wy/search] Result list is empty, retrying...');
    return search(str, pageNum, limitNum, retryNum, self);
  }

  total = body.data.totalCount || 0;
  page = pageNum;
  allPage = Math.ceil(total / limitNum);

  console.log('[wy/search] ========== END ==========');

  return {
    list,
    allPage,
    limit: limitNum,
    total,
    source: 'wy',
  };
};

export default {
  limit,
  total,
  page,
  allPage,
  search: async function(...args) {
    return search(...args, this);
  },
};
