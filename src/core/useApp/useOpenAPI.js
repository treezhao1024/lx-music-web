import express from 'express';
import { getAppSetting, updateSetting } from './useConfig.js';

let openAPIExpress = null;
let openAPIPort = null;
let openAPIServer = null;

async function startOpenAPI(app, port) {
  if (openAPIExpress) {
    console.log('[useOpenAPI] OpenAPI routes already registered');
    return { express: openAPIExpress, port: openAPIPort };
  }

  console.log('[useOpenAPI] Registering OpenAPI routes on port', port);

  app.use(express.json());

  app.get('/api/settings', (req, res) => {
    res.json({
      success: true,
      data: getAppSetting(),
    });
  });

  app.post('/api/settings', (req, res) => {
    const settings = req.body;
    updateSetting(settings);
    
    res.json({
      success: true,
      data: getAppSetting(),
    });
  });

  app.get('/api/config', (req, res) => {
    res.json({
      success: true,
      config: {
        apiSource: getAppSetting('common.apiSource'),
        proxy: {
          enable: getAppSetting('network.proxy.enable'),
          host: getAppSetting('network.proxy.host'),
          port: getAppSetting('network.proxy.port'),
        },
      },
    });
  });

  app.post('/api/search', async (req, res) => {
    try {
      const { query, page = 1, limit = 30, source } = req.body;
      
      if (!query) {
        return res.json({
          success: false,
          error: 'Query is required',
        });
      }

      const { searchMusic } = await import('./useMusicService.js');
      const result = await searchMusic(query, page, limit, source);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.json({
        success: false,
        error: error.message,
      });
    }
  });

  openAPIExpress = app;
  openAPIPort = port;

  console.log(`[useOpenAPI] OpenAPI routes registered on port ${port}`);

  return {
    express: app,
    port: port,
  };
}

function stopOpenAPI() {
  if (openAPIServer) {
    openAPIServer.close(() => {
      console.log('[useOpenAPI] OpenAPI server stopped');
      openAPIServer = null;
      openAPIExpress = null;
      openAPIPort = null;
    });
    return true;
  }
  return false;
}

function getOpenAPI() {
  return {
    express: openAPIExpress,
    port: openAPIPort,
    server: openAPIServer,
  };
}

export { startOpenAPI, stopOpenAPI, getOpenAPI };
