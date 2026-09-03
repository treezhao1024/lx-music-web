import { parseLyric as parseLyricText } from '../utils/lyricParser.js';

const SOURCE_LYRIC_MAP = {
  tx: () => import('../sources/tx/lyric.js'),
  wy: () => import('../sources/wy/lyric.js'),
  kw: () => import('../sources/kw/lyric.js'),
};

export async function getLyric(songId, strMediaMid, songmid, source = 'tx') {
  try {
    const mod = SOURCE_LYRIC_MAP[source];
    if (!mod) {
      throw new Error(`Lyric not supported for source: ${source}`);
    }

    const lyricMod = await mod();
    
    const songInfo = { songId: songId || '', strMediaMid: strMediaMid || '', songmid: songmid || '' };
    return lyricMod.default.getLyric(songInfo);
  } catch (error) {
    console.error('[Lyric] Error getting lyric:', error);
    throw error;
  }
}

export function parseLyric(lyricText) {
  return parseLyricText(lyricText);
}

export function findCurrentLine(lines, currentTime) {
  let currentLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= currentTime) {
      currentLine = i;
    } else {
      break;
    }
  }
  return currentLine;
}
