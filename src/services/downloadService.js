import axios from 'axios';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { saveSong } from './databaseService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const downloadsBaseDir = path.join(__dirname, '../../downloads');

if (!fs.existsSync(downloadsBaseDir)) {
  fs.mkdirSync(downloadsBaseDir, { recursive: true });
}

function getDownloadDir(source = 'tx') {
  const dir = path.join(downloadsBaseDir, source);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Downloads a file from a URL and saves it to the source-specific directory.
 * @param {string} url The URL to download from.
 * @param {string} filename The filename to save as.
 * @param {string} source The music source ('tx', 'wy', etc.)
 * @param {object} options Additional options like headers.
 * @returns {Promise<{path: string, filename: string}>}
 */
export async function downloadFile(url, filename, source = 'tx', options = {}) {
  console.log('[DownloadFile] ========== START ==========');
  console.log('[DownloadFile] URL:', url);
  console.log('[DownloadFile] Filename:', filename);
  console.log('[DownloadFile] Source:', source);
  
  const downloadDir = getDownloadDir(source);
  const filePath = path.join(downloadDir, filename);
  
  console.log('[DownloadFile] Download dir:', downloadDir);
  console.log('[DownloadFile] Full file path:', filePath);
  
  const isQQMusic = url.includes('qqmusic.qq.com');
  const headers = {
    ...options.headers,
    ...(isQQMusic ? {
      'Referer': 'https://y.qq.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'audio/*',
      'Origin': 'https://y.qq.com'
    } : {})
  };
  
  console.log('[DownloadFile] Headers:', JSON.stringify(headers, null, 2));
  
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
    timeout: 120000,
    headers: headers,
    validateStatus: (status) => status >= 200 && status < 400
  });

  console.log('[DownloadFile] HTTP Status:', response.status);
  console.log('[DownloadFile] Content-Type:', response.headers['content-type']);
  console.log('[DownloadFile] Content-Length:', response.headers['content-length']);
  
  // For non-streaming responses (e.g., error JSON), check content
  if (!response.headers['content-type'] || !response.headers['content-type'].includes('audio')) {
    console.warn('[DownloadFile] WARNING: Response is not audio content-type:', response.headers['content-type']);
  }

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    
    response.data.pipe(writer);
    
    let error = null;
    let downloadedSize = 0;
    response.data.on('data', (chunk) => {
      downloadedSize += chunk.length;
    });
    response.data.on('error', err => {
      error = err;
      console.error('[DownloadFile] Stream error:', err.message);
      writer.close();
    });

    writer.on('finish', () => {
      console.log('[DownloadFile] Downloaded size:', downloadedSize, 'bytes');
      console.log('[DownloadFile] Saved to:', filePath);
      if (error) reject(error);
      else resolve({ path: filePath, filename: path.join(source, filename) });
    });

    writer.on('error', err => {
      console.error('[DownloadFile] Writer error:', err.message);
      reject(err);
    });
  });
}

/**
 * Downloads music and lyrics, then saves them to the DB.
 */
export async function downloadAndSaveSong(song, musicUrl, lyricUrl = null, source) {
  const musicFilename = `${song.songId}_music.mp3`;
  const lyricFilename = `${song.songId}_lyrics.lrc`;
  
  const musicInfo = await downloadFile(musicUrl, musicFilename, source);
  
  let lyricPath = null;
  if (lyricUrl) {
    try {
      const lyricInfo = await downloadFile(lyricUrl, lyricFilename, source);
      lyricPath = lyricInfo.path;
    } catch (err) {
      console.warn(`Failed to download lyrics for ${song.name}:`, err.message);
    }
  }

  const songData = {
    songId: song.songId,
    name: song.name,
    singer: song.singer,
    albumName: song.albumName,
    img: song.img,
    interval: song.interval,
    source: source,
    strMediaMid: song.strMediaMid,
    songmid: song.songmid,
    musicPath: musicInfo.path,
    lyricPath: lyricPath,
    downloadedAt: new Date().toISOString()
  };

  await saveSong(songData);
  
  return songData;
}

export function getDownloadPath() {
  return downloadsBaseDir;
}

export async function downloadMusic(url, filename, headers = {}) {
  return downloadFile(url, filename, 'tx', headers);
}
