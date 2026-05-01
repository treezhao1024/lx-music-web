/**
 * HTTP Fetcher utility for lx-music-web-api
 * Replaces needle with native https + https-proxy-agent
 */

import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * Get proxy URL from environment or config
 * @returns {string|null} Proxy URL or null
 */
export const getProxyUrl = () => {
  // In a real app, this would read from config
  return process.env.https_proxy || process.env.http_proxy || null;
};

/**
 * HTTP Fetch function that mimics needle behavior
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {string} options.method - HTTP method (default: 'GET')
 * @param {Object} options.headers - Request headers
 * @param {Object} options.body - Request body (will be stringified)
 * @returns {Promise<Object>} Response with body and statusCode
 */
export const httpFetch = async (url, options = {}) => {
  const proxy = getProxyUrl();
  
  const agent = proxy ? new HttpsProxyAgent(proxy) : undefined;
  
  const requestOptions = {
    method: options.method || 'GET',
    headers: options.headers || {},
    agent: agent,
    timeout: 10000,
    rejectUnauthorized: false,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(url, requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (!res || res.statusCode === undefined) {
          reject(new Error('HTTP Error: Undefined Status.'));
          return;
        }

        if (res.statusCode >= 400) {
          reject(new Error(`HTTP Error: ${res.statusCode}`));
          return;
        }

        let parsedBody = data;
        // Try to parse JSON
        try {
          if (data.trim().startsWith('{') || data.trim().startsWith('[')) {
            parsedBody = JSON.parse(data);
          }
        } catch (e) {
          // Keep raw string if not JSON
        }

        resolve({
          body: parsedBody,
          statusCode: res.statusCode,
        });
      });
    });

    if (options.body) {
      // Set Content-Type if not already set
      if (!requestOptions.headers['Content-Type'] && !requestOptions.headers['content-type']) {
        requestOptions.headers['Content-Type'] = 'application/json';
      }
      const bodyData = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      req.write(bodyData);
    }

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('HTTP Error: Request Timeout'));
    });

    req.end();
  });
};

export default httpFetch;
