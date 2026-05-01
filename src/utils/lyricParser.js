export function parseLyric(lyricText) {
  if (!lyricText) return [];
  
  const lines = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;
  let match;
  
  while ((match = regex.exec(lyricText)) !== null) {
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const milliseconds = parseInt(match[3].padEnd(3, '0'), 10);
    const time = minutes * 60 + seconds + milliseconds / 1000;
    const text = match[4].trim();
    
    if (text) {
      lines.push({ time, text });
    }
  }
  
  return lines;
}
