import fs from 'fs/promises';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'downloads', 'songs_db.json');

export async function initDatabase() {
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify({ songs: [] }, null, 2));
  }
}

export async function getSongById(songId) {
  const data = await readDb();
  const found = data.songs.find(s => {
    const match = s.songId == songId || String(s.songId) === String(songId);
    return match;
  });
  return found;
}

export async function getAllLovedSongs() {
  const data = await readDb();
  return data.songs;
}

export async function saveSong(songData) {
  const data = await readDb();
  const index = data.songs.findIndex(s => s.songId == songData.songId || String(s.songId) === String(songData.songId));
  
  if (index !== -1) {
    data.songs[index] = { ...data.songs[index], ...songData };
  } else {
    data.songs.push(songData);
  }
  
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

export async function deleteSong(songId) {
  const data = await readDb();
  const index = data.songs.findIndex(s => s.songId == songId || String(s.songId) === String(songId));
  
  if (index === -1) {
    return false;
  }
  
  const removedSong = data.songs.splice(index, 1)[0];
  
  if (removedSong && removedSong.musicFilename) {
    try {
      const musicFilePath = path.join(process.cwd(), 'downloads', removedSong.musicFilename);
      await fs.unlink(musicFilePath);
    } catch (err) {
      console.warn(`[Database] Failed to delete music file: ${removedSong.musicFilename}`, err.message);
    }
  }
  
  if (removedSong && removedSong.lyricFilename) {
    try {
      const lyricFilePath = path.join(process.cwd(), 'downloads', removedSong.lyricFilename);
      await fs.unlink(lyricFilePath);
    } catch (err) {
      console.warn(`[Database] Failed to delete lyric file: ${removedSong.lyricFilename}`, err.message);
    }
  }
  
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
  return true;
}

async function readDb() {
  try {
    const content = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return { songs: [] };
  }
}
