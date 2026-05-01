import https from 'https';
import { ProxyAgent } from 'proxy-agent';

function httpFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const proxy = process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;
    const agent = proxy ? new ProxyAgent(proxy) : undefined;
    
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      agent,
      rejectUnauthorized: false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; WOW64; Trident/5.0)',
        ...options.headers,
      },
    };

    const protocol = parsedUrl.protocol === 'https:' ? https : require('http');
    const req = protocol.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ body: JSON.parse(data), statusCode: res.statusCode, headers: res.headers, rawBody: data });
        } catch (e) {
          resolve({ body: data, statusCode: res.statusCode, headers: res.headers, rawBody: data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000);
    if (options.body) req.write(options.body);
    req.end();
  });
}

export { httpFetch };
