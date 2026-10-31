import http from 'node:http';
import https from 'node:https';

export class VisionGeminiService {
  constructor(config = {}) {
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'gemini-3.5-flash';
    this.proxy = config.proxy || '';
    this.enabled = config.enabled !== false;
  }

  isReady() {
    return Boolean(this.enabled && this.apiKey);
  }

  async analyzeVisualFrame({ imageBase64, mimeType = 'image/jpeg' }) {
    if (!this.isReady() || !imageBase64) return null;

    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const modelsToTry = [this.model, 'gemini-3.6-flash', 'gemini-3.7-flash'];

    const promptText =
      '这是视频通话中对方（相公）的一帧画面。请用1-2句话客观描述相公的面部神态（如是否微笑、眼神、表情）、发型穿搭（衣服颜色与款式）、当前动作或手中拿的物品，以及身后的房间环境。只输出简明真实事实，切勿添加客套话，供伴侣回应参考。';

    const payload = JSON.stringify({
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64.trim(),
              },
            },
            {
              text: promptText,
            },
          ],
        },
      ],
    });

    for (const model of modelsToTry) {
      try {
        let respData = '';
        if (this.proxy) {
          respData = await this._requestViaProxy({
            proxyUrl: this.proxy,
            targetHost: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/${model}:generateContent`,
            body: payload,
          });
        } else {
          respData = await this._requestDirect({
            targetHost: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/${model}:generateContent`,
            body: payload,
          });
        }

        const data = JSON.parse(respData);
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text;
      } catch (_) {
        // 尝试下一个模型
      }
    }

    return null;
  }

  _requestDirect({ targetHost, path: reqPath, body, timeoutMs = 8000 }) {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          host: targetHost,
          path: reqPath,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': this.apiKey,
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: timeoutMs,
        },
        (res) => {
          let respData = '';
          res.on('data', (c) => (respData += c));
          res.on('end', () => {
            if (res.statusCode === 200) resolve(respData);
            else reject(new Error(`Google API status: ${res.statusCode}`));
          });
        }
      );

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  _requestViaProxy({ proxyUrl, targetHost, targetPort = 443, path: reqPath, body, timeoutMs = 8000 }) {
    return new Promise((resolve, reject) => {
      let proxyHost = '127.0.0.1';
      let proxyPort = 7890;
      try {
        if (proxyUrl) {
          const u = new URL(proxyUrl);
          proxyHost = u.hostname || '127.0.0.1';
          proxyPort = Number(u.port) || 7890;
        }
      } catch (_) {}

      const connectReq = http.request({
        host: proxyHost,
        port: proxyPort,
        method: 'CONNECT',
        path: `${targetHost}:${targetPort}`,
        timeout: timeoutMs,
      });

      let finished = false;
      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          connectReq.destroy();
          reject(new Error(`Proxy CONNECT timeout (${timeoutMs}ms)`));
        }
      }, timeoutMs);

      connectReq.on('connect', (res, socket) => {
        if (res.statusCode !== 200) {
          finished = true;
          clearTimeout(timer);
          socket.destroy();
          return reject(new Error(`Proxy CONNECT failed: ${res.statusCode}`));
        }

        const tlsReq = https.request(
          {
            host: targetHost,
            path: reqPath,
            method: 'POST',
            socket,
            headers: {
              'Content-Type': 'application/json',
              'X-goog-api-key': this.apiKey,
              'Content-Length': Buffer.byteLength(body),
            },
            timeout: timeoutMs,
          },
          (tlsRes) => {
            let respData = '';
            tlsRes.on('data', (c) => (respData += c));
            tlsRes.on('end', () => {
              finished = true;
              clearTimeout(timer);
              if (tlsRes.statusCode === 200) resolve(respData);
              else reject(new Error(`Google API status: ${tlsRes.statusCode}`));
            });
          }
        );

        tlsReq.on('error', (err) => {
          if (!finished) {
            finished = true;
            clearTimeout(timer);
            reject(err);
          }
        });

        tlsReq.write(body);
        tlsReq.end();
      });

      connectReq.on('error', (err) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          reject(err);
        }
      });

      connectReq.end();
    });
  }
}
