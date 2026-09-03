export const formatSinger = (rawData) => String(rawData ?? '').replace(/&/g, '、');

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

// 桌面端用 DOMParser 解码 HTML 实体，Node 环境下手动处理常见实体即可
export const decodeName = (str = '') => {
  if (!str) return '';
  return String(str).replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (match, entity) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' || entity[1] === 'X'
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
};

export const lrcTools = {
  rxps: {
    wordLine: /^(\[\d{1,2}:.*\d{1,4}\])\s*(\S+(?:\s+\S+)*)?\s*/,
    tagLine: /\[(ver|ti|ar|al|offset|by|kuwo):\s*(\S+(?:\s+\S+)*)\s*\]/,
    wordTimeAll: /<(-?\d+),(-?\d+)(?:,-?\d+)?>/g,
    wordTime: /<(-?\d+),(-?\d+)(?:,-?\d+)?>/,
  },
  offset: 1,
  offset2: 1,
  isOK: false,
  lines: [],
  tags: [],
  getWordInfo(str, str2, prevWord) {
    const offset = parseInt(str);
    const offset2 = parseInt(str2);
    const startTime = Math.abs((offset + offset2) / (this.offset * 2));
    const endTime = Math.abs((offset - offset2) / (this.offset2 * 2)) + startTime;
    if (prevWord && startTime < prevWord.endTime) {
      prevWord.endTime = startTime;
      if (prevWord.startTime > prevWord.endTime) prevWord.startTime = prevWord.endTime;
      prevWord.newTimeStr = `<${prevWord.startTime},${prevWord.endTime - prevWord.startTime}>`;
    }
    return { startTime, endTime, timeStr: `<${startTime},${endTime - startTime}>` };
  },
  parseLine(line) {
    if (line.length < 6) return;
    let result = this.rxps.wordLine.exec(line);
    if (result) {
      const time = result[1];
      let words = result[2] ?? '';
      const wordTimes = words.match(this.rxps.wordTimeAll);
      if (!wordTimes) return;
      let preTimeInfo;
      for (const timeStr of wordTimes) {
        const res = this.rxps.wordTime.exec(timeStr);
        const wordInfo = this.getWordInfo(res[1], res[2], preTimeInfo);
        words = words.replace(timeStr, wordInfo.timeStr);
        if (preTimeInfo?.newTimeStr) words = words.replace(preTimeInfo.timeStr, preTimeInfo.newTimeStr);
        preTimeInfo = wordInfo;
      }
      this.lines.push(time + words);
      return;
    }
    result = this.rxps.tagLine.exec(line);
    if (!result) return;
    if (result[1] === 'kuwo') {
      let content = result[2];
      if (content != null && content.includes('][')) content = content.substring(0, content.indexOf(']['));
      const valueOf = parseInt(content, 8);
      this.offset = Math.trunc(valueOf / 10);
      this.offset2 = Math.trunc(valueOf % 10);
      if (!this.offset || Number.isNaN(this.offset) || !this.offset2 || Number.isNaN(this.offset2)) {
        this.isOK = false;
      }
    } else {
      this.tags.push(line);
    }
  },
  parse(lrc) {
    const lines = lrc.split(/\r\n|\r|\n/);
    const tools = Object.create(this);
    tools.isOK = true;
    tools.offset = 1;
    tools.offset2 = 1;
    tools.lines = [];
    tools.tags = [];

    for (const line of lines) {
      if (!tools.isOK) throw new Error('failed');
      tools.parseLine(line);
    }
    if (!tools.lines.length) return '';
    const lrcs = tools.lines.join('\n');
    return tools.tags.length ? `${tools.tags.join('\n')}\n${lrcs}` : lrcs;
  },
};
