import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import musicRouter from './routes/musicRoutes.js';
import pluginRouter from './routes/pluginRoutes.js';
import pluginManager from './plugins/index.js';
import { initMusicService } from './core/useApp/useMusicService.js';
import { startOpenAPI } from './core/useApp/useOpenAPI.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLyric } from './services/lyricService.js';
import { initDatabase } from './services/databaseService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const PORT = process.env.PORT || process.env.TEST_PORT || 3100;

async function startServer() {
  await initDatabase();
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/api/music', musicRouter);
  app.use('/api/plugins', pluginRouter);
  app.use('/downloads', express.static(path.join(__dirname, '../downloads')));
  app.use(express.static(path.join(__dirname, '../dist')));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/lyrics', async (req, res) => {
    try {
      const { songId, songmid } = req.query;
      if (!songId && !songmid) {
        return res.status(400).json({ error: 'songId or songmid required' });
      }
      const lyrics = await getLyric(songId, null, songmid);
      res.json(lyrics);
    } catch (error) {
      console.error('Lyrics error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist', 'index.html'));
  });

  try {
    await pluginManager.initialize();
  } catch (error) {
    console.error('Failed to initialize plugins:', error.message);
  }

  try {
    await initMusicService();
    await startOpenAPI(app, PORT);
    console.log('Services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
  }

  const server = app.listen(PORT, () => {
    console.log(`LX Music Web API is running on port ${PORT}`);
  });

  return { app, server };
}

export { startServer };

// Only start server if this is the main module
if (import.meta.main) {
  startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
