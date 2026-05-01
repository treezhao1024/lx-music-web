import { HttpsProxyAgent } from 'https-proxy-agent';
import { getProxyUrl } from './useProxy.js';

const eventListeners = {
  requests: [],
  responses: [],
  errors: [],
};

let proxyAgent = null;

function initEventListeners() {
  console.log('[useEventListeners] Initializing event listeners...');

  const proxyUrl = getProxyUrl();
  if (proxyUrl) {
    try {
      proxyAgent = new HttpsProxyAgent(proxyUrl);
      console.log('[useEventListeners] Proxy agent created:', proxyUrl);
    } catch (error) {
      console.error('[useEventListeners] Failed to create proxy agent:', error.message);
    }
  }

  process.on('uncaughtException', (error) => {
    console.error('[useEventListeners] Uncaught Exception:', error);
    eventListeners.errors.forEach(callback => callback({ type: 'uncaughtException', error }));
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[useEventListeners] Unhandled Rejection at:', promise, 'reason:', reason);
    eventListeners.errors.forEach(callback => callback({ type: 'unhandledRejection', reason }));
  });

  console.log('[useEventListeners] Event listeners initialized');

  return {
    on: (event, callback) => {
      if (eventListeners[event]) {
        eventListeners[event].push(callback);
        return () => {
          const index = eventListeners[event].indexOf(callback);
          if (index > -1) {
            eventListeners[event].splice(index, 1);
          }
        };
      }
    },
    getProxyAgent: () => proxyAgent,
  };
}

function emit(event, data) {
  if (eventListeners[event]) {
    eventListeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('[useEventListeners] Error emitting event:', error);
      }
    });
  }
}

export { initEventListeners, emit, eventListeners, proxyAgent };
