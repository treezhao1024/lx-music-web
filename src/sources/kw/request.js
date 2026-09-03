import http from 'http';
import https from 'https';
import { ProxyAgent } from 'proxy-agent';

// 歌词接口返回二进制，只在内容确实像 JSON 时才解析，避免把压缩数据转成乱码字符串
function parseBody(raw) {
  const text = raw.toString('utf8');
  const head = text.trimStart();
  if (!head.startsWith('{') && !head.startsWith('[')) return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * 酷我的歌词接口返回二进制（zlib 压缩 + XOR 加密），因此这里保留 raw Buffer，
 * 不能像其它音源那样只返回解析后的字符串。
 */
function httpFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const proxy = process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;
    const agent = proxy ? new ProxyAgent(proxy) : undefined;

    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const req = protocol.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...options.headers,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          raw,
          body: parseBody(raw),
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(options.timeout || 15000, () => {
      req.destroy(new Error('Request timeout'));
    });
    if (options.body) req.write(options.body);
    req.end();
  });
}

export { httpFetch };
