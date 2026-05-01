import https from 'https';
import { ProxyAgent } from 'proxy-agent';
import { eapi } from './crypto.js';

function httpFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const proxy = process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;
    const agent = proxy ? new ProxyAgent(proxy) : undefined;
    
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'POST',
      agent,
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
        origin: 'https://music.163.com',
        ...options.headers,
      },
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ body: JSON.parse(data), statusCode: res.statusCode, headers: res.headers });
        } catch (e) {
          resolve({ body: data, statusCode: res.statusCode, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

const eapiRequest = (url, data) => {
  const encrypted = eapi(url, data);
  const formData = new URLSearchParams({ params: encrypted.params }).toString();
  // Convert /api/ path to /eapi/ endpoint (matching desktop reference)
  const apiPath = url.replace(/\/api\//, '/eapi/');
  return httpFetch(`https://interface.music.163.com${apiPath}`, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
      origin: 'https://music.163.com',
      'Content-Length': Buffer.byteLength(formData),
    },
  });
};

export { eapiRequest };
