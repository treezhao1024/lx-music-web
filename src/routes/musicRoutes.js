import express from 'express';
import musicService from '../services/musicService.js';
import pluginManager from '../plugins/index.js';
import { downloadFile, downloadAndSaveSong } from '../services/downloadService.js';
import { getLyric } from '../services/lyricService.js';
import { getAllLovedSongs, getSongById, saveSong, deleteSong } from '../services/databaseService.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const downloadsDir = path.join(__dirname, '../../downloads');

const router = express.Router();

router.get('/search', async (req, res) => {
  try {
    const { q, page, limit, source } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    console.log('[Search] ========== START ==========');
    console.log('[Search] Query:', { q, page, limit, source });
    console.log('[Search] Calling musicService.search with source:', source || 'tx');

    const searchResult = await musicService.search(
      q, 
      parseInt(page) || 1, 
      parseInt(limit) || 30,
      0,
      source || 'tx'
    );
    
    console.log('[Search] Search result:', JSON.stringify({
      total: searchResult.total,
      allPage: searchResult.allPage,
      limit: searchResult.limit,
      source: searchResult.source,
      listLength: searchResult.list?.length || 0,
      firstSong: searchResult.list?.[0] ? {
        name: searchResult.list[0].name,
        singer: searchResult.list[0].singer,
        songmid: searchResult.list[0].songmid,
        types: searchResult.list[0].types
      } : null
    }, null, 2));
    console.log('[Search] ========== END ==========');
    
    res.json(searchResult);
  } catch (error) {
    console.error('[Search] Error:', error.message);
    console.error('[Search] Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

router.get('/url', async (req, res) => {
  try {
    const { songId, strMediaMid, songmid, source, quality } = req.query;
    
    await pluginManager.initialize();
    const availableSources = pluginManager.getAvailableSources();
    if (source && !availableSources[source]) {
      return res.status(400).json({ 
        error: `Source "${source}" is not supported. Available sources: ${Object.keys(availableSources).join(', ')}` 
      });
    }

    const dbSong = await getSongById(songId);
    
    if (dbSong && dbSong.musicFilename) {
      try {
        const filePath = path.join(downloadsDir, dbSong.musicFilename);
        await fs.access(filePath);
        console.log('[URL] Using cached music:', dbSong.musicFilename);
        return res.json(`/downloads/${dbSong.musicFilename}`);
      } catch (err) {
        console.warn('[URL] Cached music file not found, downloading:', dbSong.musicFilename);
      }
    }

    const songInfo = { 
      songId, 
      strMediaMid, 
      songmid,
      source: source || 'tx',
      quality: quality || '320k'
    };

    const musicUrl = await musicService.getMusicUrl(songInfo, songInfo.quality);
    
    res.json(musicUrl);
  } catch (error) {
    console.error('Get Music URL Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/sources', async (req, res) => {
  try {
    await pluginManager.initialize();
    const sources = pluginManager.getAvailableSources();
    res.json({
      success: true,
      sources: Object.entries(sources).map(([id, source]) => ({
        id,
        name: source.name,
        type: source.type,
        actions: source.actions,
        qualitys: source.qualitys,
        pluginId: source.pluginId
      }))
    });
  } catch (error) {
    console.error('Get Sources Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/download', async (req, res) => {
  try {
    const { songId, strMediaMid, songmid, source, quality, name, singer } = req.query;
    
    console.log('[Download] ========== START ==========');
    console.log('[Download] Query params:', { songId, strMediaMid, songmid, source, quality, name, singer });
    
    if (!songId && !strMediaMid && !songmid) {
      return res.status(400).json({ error: 'Missing song identification parameters' });
    }

    const src = source || 'tx';
    const songInfo = { 
      songId, strMediaMid, songmid, source: src, quality: quality || '320k'
    };
    
    console.log('[Download] Song info:', JSON.stringify(songInfo));
    console.log('[Download] Step 1: Getting music URL for source:', src);

    const musicUrl = await musicService.getMusicUrl(songInfo, songInfo.quality);
    
    console.log('[Download] Step 2: Music URL result:', typeof musicUrl === 'string' ? musicUrl : JSON.stringify(musicUrl));
    
    const url = typeof musicUrl === 'string' ? musicUrl : (musicUrl.url || musicUrl);
    
    if (!url) {
      console.error('[Download] Failed to extract URL from musicUrl response');
      return res.status(400).json({ error: 'Failed to get music URL', response: musicUrl });
    }
    
    console.log('[Download] Step 3: Downloading file from URL...');

    const safeName = (name || 'unknown').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    const safeSinger = (singer || 'unknown').replace(/\//g, '_').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    const filename = `${safeSinger} - ${safeName}.mp3`;
    
    console.log('[Download] Step 4: Saving as filename:', filename);
    
    const result = await downloadFile(url, filename, src);
    
    console.log('[Download] Step 5: Download result:', result);
    console.log('[Download] ========== END ==========');
    
    res.json({
      success: true,
      path: result.path,
      filename: result.filename,
      url: `/downloads/${result.filename}`
    });
  } catch (error) {
    console.error('[Download] Error:', error.message);
    console.error('[Download] Stack:', error.stack);
    console.log('[Download] ========== END (ERROR) ==========');
    res.status(500).json({ error: error.message });
  }
});

router.get('/lyric', async (req, res) => {
  try {
    const { songId, strMediaMid, songmid, source, name, singer } = req.query;
    
    if (!songId && !strMediaMid && !songmid) {
      return res.status(400).json({ error: 'Missing song identification parameters' });
    }

    const src = source || 'tx';
    const dbSong = await getSongById(songId);
    
    if (dbSong && dbSong.lyricFilename) {
      try {
        const filePath = path.join(downloadsDir, dbSong.lyricFilename);
        await fs.access(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        
        console.log('[Lyric] Using cached lyric:', dbSong.lyricFilename);
        
        return res.json({
          success: true,
          lyricPath: filePath,
          lyricFilename: dbSong.lyricFilename,
          lyric: content
        });
      } catch (err) {
        console.warn('[Lyric] Cached lyric file not found, downloading:', dbSong.lyricFilename);
      }
    }

    const lyrics = await getLyric(songId, strMediaMid, songmid, src);
    
    if (!lyrics || !lyrics.lyric) {
      return res.json({
        success: false,
        error: 'No lyrics available'
      });
    }

    const safeName = (name || 'unknown').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    const safeSinger = (singer || 'unknown').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    const filename = `${safeSinger} - ${safeName}.lrc`;
    const filePath = path.join(downloadsDir, src, filename);
    
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, lyrics.lyric, 'utf-8');
    
    res.json({
      success: true,
      lyricPath: filePath,
      lyricFilename: path.join(src, filename),
      lyrics: lyrics
    });
  } catch (error) {
    console.error('[Lyric] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/love', async (req, res) => {
  try {
    const { song, source } = req.body;
    
    if (!song) {
      return res.status(400).json({ error: 'Missing song data' });
    }
    
    const src = source || song.source || 'tx';
    const existingSong = await getSongById(song.songId);
    
    if (existingSong) {
      const songData = {
        ...existingSong,
        ...song,
        source: src
      };
      await saveSong(songData);
      
      let musicUrl = existingSong.musicUrl;
      let lyricUrl = existingSong.lyricUrl;
      
      if (existingSong.musicFilename) {
        try {
          const filePath = path.join(downloadsDir, existingSong.musicFilename);
          await fs.access(filePath);
          musicUrl = `/downloads/${existingSong.musicFilename}`;
        } catch (err) {
          console.warn('[Love] Music file not found:', existingSong.musicFilename, err.message);
        }
      }
      
      if (existingSong.lyricFilename) {
        try {
          const filePath = path.join(downloadsDir, existingSong.lyricFilename);
          await fs.access(filePath);
          lyricUrl = `/downloads/${existingSong.lyricFilename}`;
        } catch (err) {
          console.warn('[Love] Lyric file not found:', existingSong.lyricFilename, err.message);
        }
      }
      
      const savedSong = {
        ...songData,
        musicUrl,
        lyricUrl
      };
      
      return res.json({
        success: true,
        song: savedSong,
        fromCache: true
      });
    }
    
    const songData = {
      ...song,
      source: src,
      musicFilename: null,
      lyricFilename: null,
      downloadedAt: new Date().toISOString()
    };
    
    await saveSong(songData);
    
    let musicFilename = null;
    let lyricFilename = null;
    
    const downloadOptions = {
      songId: song.songId || '',
      strMediaMid: song.strMediaMid || '',
      songmid: song.songmid || '',
      source: src,
      quality: '320k',
      name: song.name || 'unknown',
      singer: song.singer || 'unknown'
    };
    
    const lyricOptions = {
      songId: song.songId || '',
      strMediaMid: song.strMediaMid || '',
      songmid: song.songmid || '',
      source: src,
      name: song.name || 'unknown',
      singer: song.singer || 'unknown'
    };
    
    try {
      const musicUrl = await musicService.getMusicUrl(downloadOptions, downloadOptions.quality);
      const url = typeof musicUrl === 'string' ? musicUrl : (musicUrl.url || musicUrl);
      if (url) {
        const safeSinger = (downloadOptions.singer || 'unknown').replace(/\//g, '_').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
        const safeName = (downloadOptions.name || 'unknown').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
        const musicFilename_ = `${safeSinger} - ${safeName}.mp3`;
        const result = await downloadFile(url, musicFilename_, src);
        musicFilename = result.filename;
        songData.musicFilename = musicFilename;
        songData.musicPath = result.path;
        console.log('[Love] Music downloaded:', musicFilename);
      }
    } catch (error) {
      console.error('Download music error:', error.message);
    }
    
    try {
      const lyrics = await getLyric(lyricOptions.songId, lyricOptions.strMediaMid, lyricOptions.songmid, lyricOptions.source);
      if (lyrics && lyrics.lyric) {
        const safeName = (lyricOptions.name || 'unknown').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
        const safeSinger = (lyricOptions.singer || 'unknown').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
        const lyrFilename = `${safeSinger} - ${safeName}.lrc`;
        const filePath = path.join(downloadsDir, src, lyrFilename);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, lyrics.lyric, 'utf-8');
        lyricFilename = path.join(src, lyrFilename);
        songData.lyricFilename = lyricFilename;
        songData.lyricPath = filePath;
        console.log('[Love] Lyric downloaded:', lyricFilename);
      }
    } catch (error) {
      console.error('Download lyric error:', error.message);
    }
    
    await saveSong(songData);
    
    const musicUrl = musicFilename ? `/downloads/${musicFilename}` : null;
    const lyricUrl = lyricFilename ? `/downloads/${lyricFilename}` : null;
    const savedSong = {
      ...songData,
      musicUrl,
      lyricUrl
    };
    
    res.json({
      success: true,
      song: savedSong,
      fromCache: false,
      downloading: false
    });
  } catch (error) {
    console.error('[Love] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/loved/:songId', async (req, res) => {
  try {
    const { songId } = req.params;
    const result = await deleteSong(songId);
    
    if (!result) {
      return res.status(404).json({ error: 'Song not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Delete Loved] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/loved', async (req, res) => {
  try {
    const lovedSongs = await getAllLovedSongs();
    const songsWithUrls = await Promise.all(lovedSongs.map(async (song) => {
      let musicUrl = song.musicUrl;
      let lyricUrl = song.lyricUrl;
      
      if (song.musicFilename) {
        try {
          const filePath = path.join(downloadsDir, song.musicFilename);
          await fs.access(filePath);
          musicUrl = `/downloads/${song.musicFilename}`;
        } catch (err) {
          console.warn(`Music file not found for song ${song.songId}`);
        }
      }
      
      if (song.lyricFilename) {
        try {
          const filePath = path.join(downloadsDir, song.lyricFilename);
          await fs.access(filePath);
          lyricUrl = `/downloads/${song.lyricFilename}`;
        } catch (err) {
          console.warn(`Lyric file not found for song ${song.songId}`);
        }
      }
      
      return {
        ...song,
        musicUrl,
        lyricUrl
      };
    }));
    
    res.json({
      success: true,
      songs: songsWithUrls
    });
  } catch (error) {
    console.error('[Get Loved] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/song/:songId', async (req, res) => {
  try {
    const { songId } = req.params;
    const song = await getSongById(songId);
    
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }
    
    res.json(song);
  } catch (error) {
    console.error('[Get Song] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(downloadsDir, filename);
    
    await fs.access(filePath);
    res.sendFile(filePath);
  } catch (error) {
    console.error('[Download File] Error:', error.message);
    res.status(404).json({ error: 'File not found' });
  }
});

export default router;
