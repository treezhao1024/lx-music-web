import { appSetting, setAppSetting } from './useConfig.js';
import { initProxy } from './useProxy.js';
import { initEventListeners } from './useEventListeners.js';
import { initMusicService } from './useMusicService.js';
import { startOpenAPI } from './useOpenAPI.js';

export default async function useApp() {
  console.log('[useApp] Initializing...');

  const config = {
    PORT: process.env.PORT || 3100,
    API_SOURCE: process.env.API_SOURCE || 'kg',
    PROXY_ENABLE: process.env.PROXY_ENABLE === 'true',
    PROXY_HOST: process.env.PROXY_HOST || '',
    PROXY_PORT: process.env.PROXY_PORT || '',
  };

  setAppSetting({
    'network.proxy.enable': config.PROXY_ENABLE,
    'network.proxy.host': config.PROXY_HOST,
    'network.proxy.port': config.PROXY_PORT,
    'common.apiSource': config.API_SOURCE,
  });

  console.log('[useApp] Config:', {
    PORT: config.PORT,
    API_SOURCE: config.API_SOURCE,
    PROXY_ENABLE: config.PROXY_ENABLE,
  });

  await initProxy();
  initEventListeners();
  await initMusicService();

  const openAPI = await startOpenAPI(config.PORT);

  console.log('[useApp] Initialization complete');

  return {
    appSetting,
    config,
    openAPI,
  };
}
