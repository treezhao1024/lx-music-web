import pluginSystem from './pluginSystem.js';

const SOURCE_MAP = {
  tx: () => import('../sources/tx/musicSearch.js'),
  wy: () => import('../sources/wy/musicSearch.js'),
};

const musicService = {
  limit: 30,
  total: 0,
  page: 0,
  allPage: 1,

  async search(str, page = 1, limit, retryNum = 0, source = 'tx') {
    if (++retryNum > 3) throw new Error('try max num');

    console.log('[MusicService] search() called:', { str, page, limit, retryNum, source });

    const mod = SOURCE_MAP[source];
    if (!mod) {
      throw new Error(`Unknown source: ${source}`);
    }

    const musicSearchMod = await mod();
    console.log('[MusicService] Loaded source module:', Object.keys(musicSearchMod));
    
    const result = await musicSearchMod.default.search(str, page, limit, retryNum);
    
    console.log('[MusicService] search() result received:', {
      listLength: result.list?.length || 0,
      total: result.total,
      allPage: result.allPage,
      source: result.source
    });
    
    return result;
  },

  async getMusicUrl(songInfo, quality = '320k') {
    const source = songInfo.source;
    
    console.log('[MusicService] getMusicUrl() called:', { songInfo, quality, source });
    
    if (!globalThis.lx) {
      throw new Error('Plugin system not initialized. Call pluginSystem.initialize() first.');
    }
    
    console.log('[MusicService] Calling sendRequestEvent("musicUrl",', source, ')...');
    
    const result = await globalThis.lx.sendRequestEvent('musicUrl', source, {
      type: quality,
      musicInfo: songInfo
    });
    
    console.log('[MusicService] getMusicUrl() result:', typeof result === 'string' ? result : JSON.stringify(result));
    
    return result;
  },
};

export default musicService;
