import musicService from '../../services/musicService.js';
import pluginSystem from '../../services/pluginSystem.js';
import { getAppSetting } from './useConfig.js';
import { emit } from './useEventListeners.js';

let musicServiceInitialized = false;

async function initMusicService() {
  if (musicServiceInitialized) {
    console.log('[useMusicService] Music service already initialized');
    return musicService;
  }

  console.log('[useMusicService] Initializing music service...');
  
  // 初始化插件系统
  pluginSystem.initialize();

  const apiSource = getAppSetting('common.apiSource') || 'tx';
  
  try {
    console.log('[useMusicService] API source:', apiSource);
    
    const testSearch = await musicService.search('test', 1, 10, 0, apiSource);
    
    console.log('[useMusicService] Test search result:', {
      total: testSearch.total,
      listLength: testSearch.list.length,
      source: testSearch.source,
    });

    musicServiceInitialized = true;
    
    emit('musicServiceReady', {
      apiSource,
      initialized: true,
    });

    console.log('[useMusicService] Music service initialized successfully');
    
    return musicService;
  } catch (error) {
    console.error('[useMusicService] Initialization error:', error.message);
    
    emit('musicServiceReady', {
      apiSource,
      initialized: false,
      error: error.message,
    });

    throw error;
  }
}

async function searchMusic(query, page = 1, limit = 30, source = null) {
  if (!musicServiceInitialized) {
    await initMusicService();
  }

  const searchSource = source || getAppSetting('common.apiSource') || 'tx';
  
  try {
    const result = await musicService.search(query, page, limit, 0, searchSource);
    
    emit('musicSearchResult', {
      query,
      page,
      limit,
      source: searchSource,
      result,
    });

    return result;
  } catch (error) {
    console.error('[useMusicService] Search error:', error.message);
    
    emit('musicSearchError', {
      query,
      page,
      limit,
      source: searchSource,
      error: error.message,
    });

    throw error;
  }
}

function getMusicService() {
  return musicService;
}

export { initMusicService, searchMusic, getMusicService };
