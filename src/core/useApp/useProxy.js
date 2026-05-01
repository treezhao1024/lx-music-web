import { getAppSetting, updateSetting } from './useConfig.js';

const proxy = {
  enable: false,
  host: '',
  port: '',
  envProxy: null,
};

function initProxy() {
  const settings = getAppSetting();
  
  // DISABLE PROXY FOR TESTING
  proxy.enable = false;
  proxy.host = '';
  proxy.port = '';
  console.log('[useProxy] Proxy disabled for testing');
  return proxy;
  
  const httpProxy = process.env.http_proxy || process.env.HTTP_PROXY;
  const httpsProxy = process.env.https_proxy || process.env.HTTPS_PROXY;
  const proxyUrl = httpsProxy || httpProxy;
  
  if (proxyUrl) {
    try {
      const urlObj = new URL(proxyUrl);
      proxy.host = urlObj.hostname;
      proxy.port = urlObj.port;
      proxy.enable = true;
      proxy.envProxy = proxyUrl;
      
      console.log('[useProxy] Proxy initialized from env:', {
        enable: true,
        host: proxy.host,
        port: proxy.port,
        source: 'environment',
      });
      
      return proxy;
    } catch (error) {
      console.warn('[useProxy] Invalid proxy URL in environment:', proxyUrl);
    }
  }
  
  proxy.enable = settings['network.proxy.enable'] || false;
  proxy.host = settings['network.proxy.host'] || '';
  proxy.port = settings['network.proxy.port'] || '';

  console.log('[useProxy] Proxy initialized:', {
    enable: proxy.enable,
    host: proxy.host,
    port: proxy.port,
    source: proxy.enable ? 'settings' : 'none',
  });

  return proxy;
}

function updateProxy(newSettings) {
  proxy.enable = newSettings.enable !== undefined ? newSettings.enable : proxy.enable;
  proxy.host = newSettings.host !== undefined ? newSettings.host : proxy.host;
  proxy.port = newSettings.port !== undefined ? newSettings.port : proxy.port;

  updateSetting('network.proxy.enable', proxy.enable);
  updateSetting('network.proxy.host', proxy.host);
  updateSetting('network.proxy.port', proxy.port);

  console.log('[useProxy] Proxy updated:', proxy);

  return proxy;
}

function getProxyUrl() {
  if (proxy.envProxy) {
    return proxy.envProxy;
  }
  
  if (!proxy.enable || !proxy.host || !proxy.port) {
    return null;
  }

  const protocol = proxy.host.includes('://') ? '' : 'http://';
  return `${protocol}${proxy.host}:${proxy.port}`;
}

export { proxy, initProxy, updateProxy, getProxyUrl };
