import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

function probePort(host, port, timeoutMs = 250) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

export class VisionGeminiService {
  constructor(config = {}) {
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'gemini-3.5-flash';
    this.proxy = config.proxy || '';
    this.useProxy = config.useProxy !== false && Boolean(config.proxy);
    this.enabled = config.enabled !== false;
    this.detectedProxy = null;
  }

  isReady() {
    return Boolean(this.enabled && this.apiKey);
  }

  async resolveCandidateProxies() {
    const candidates = [];
    if (this.useProxy && this.proxy) {
      const raw = String(this.proxy).trim();
      candidates.push(raw.includes('://') ? raw : `http://${raw}`);
    }
    const lanAndLocalTargets = [
      ['192.168.1.112', 27890],
      ['192.168.1.213', 27890],
      ['127.0.0.1', 7890],
      ['127.0.0.1', 27890],
      ['127.0.0.1', 10808],
      ['127.0.0.1', 1082],
    ];
    for (const [host, port] of lanAndLocalTargets) {
      const url = `http://${host}:${port}`;
      if (!candidates.includes(url)) {
        const open = await probePort(host, port, 180);
        if (open) candidates.push(url);
      }
    }
    return candidates;
  }

  async resolveEffectiveProxy() {
    const list = await this.resolveCandidateProxies();
    return list[0] || '';
  }

  /** 测试指定代理是否能连通 Google Gemini */
  async testProxy(proxyUrl = '') {
    let targetProxy = String(proxyUrl || this.proxy || '').trim();
    if (!targetProxy) {
      return { ok: false, error: '未提供代理地址，例如: http://192.168.1.112:27890' };
    }
    if (!targetProxy.includes('://')) {
      targetProxy = `http://${targetProxy}`;
    }
    const startTime = Date.now();
    try {
      const res = await this._requestViaProxy({
        proxyUrl: targetProxy,
        targetHost: 'generativelanguage.googleapis.com',
        path: `/v1beta/models?key=${encodeURIComponent(this.apiKey || 'test')}`,
        method: 'GET',
        headers: {},
        body: '',
        timeoutMs: 6000,
      });
      const latencyMs = Date.now() - startTime;
      const status = typeof res === 'object' && res.statusCode ? res.statusCode : 200;

      if (status === 200) {
        return { ok: true, latencyMs, message: `⚡ 代理握手成功！成功直达 Google 官方服务器（延迟: ${latencyMs}ms），API 密钥完全有效！` };
      }
      if (status === 400 || status === 403) {
        return { ok: true, latencyMs, message: `⚡ 代理链路 100% 畅通！（已成功直达 Google 官方服务器，延迟: ${latencyMs}ms）。下方填入正式 Gemini API 密钥即可！` };
      }
      return { ok: true, latencyMs, message: `⚡ 代理握手成功！Google 官方服务器响应状态: ${status}（延迟: ${latencyMs}ms）` };
    } catch (err) {
      return { ok: false, error: `代理连接失败: ${err.message}。请检查局域网 IP 与端口，并确认代理软件已勾选【允许来自局域网的连接】。` };
    }
  }

  async analyzeVisualFrame({ imageBase64, mimeType = 'image/jpeg' }) {
    if (!this.isReady() || !imageBase64) return null;

    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const modelsToTry = Array.from(new Set([
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-flash-lite-latest',
      this.model,
      'gemini-3.5-flash',
    ]));

    const promptText =
      '请仔细观察这张图片或视频画面，用2-3句话客观、准确、具体地描述画面中的真实内容：如果是人物，请描述人物的性别年龄、面部表情与气色、是否戴眼镜、发型与穿搭（衣服颜色与款式）、手部动作及身后环境；如果是物品、美食、风景、宠物或手机截图文字，请准确描述图中具体的物体名称、画面细节与文字内容。只输出客观真实的视觉事实，绝不臆造，切勿添加客套话。';

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

    const candidateProxies = await this.resolveCandidateProxies();
    const routes = candidateProxies.length > 0 ? [...candidateProxies, ''] : [''];

    for (const proxy of routes) {
      for (const model of modelsToTry) {
        try {
          let respData = '';
          if (proxy) {
            respData = await this._requestViaProxy({
              proxyUrl: proxy,
              targetHost: 'generativelanguage.googleapis.com',
              path: `/v1beta/models/${model}:generateContent`,
              body: payload,
              timeoutMs: 5500,
            });
          } else {
            respData = await this._requestDirect({
              targetHost: 'generativelanguage.googleapis.com',
              path: `/v1beta/models/${model}:generateContent`,
              body: payload,
              timeoutMs: 3500,
            });
          }

          const data = JSON.parse(respData);
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) return text;
        } catch (err) {
          console.warn(`[Vision] 路由(${proxy || '直连'}) 模型 ${model} 感知尝试中断:`, err.message);
        }
      }
    }

    return null;
  }

  async transcribeAudio({ audioBase64, mimeType = 'audio/aac' }) {
    if (!this.isReady() || !audioBase64) return null;

    const cleanBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
    const modelsToTry = [this.model || 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];

    const promptText =
      '请将这段语音内容直接转录为纯中文文字。只输出听写出的文字，切勿输出多余解释或标点，若无说话则输出空。';

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

    const activeProxy = await this.resolveEffectiveProxy();

    for (const model of modelsToTry) {
      try {
        let respData = '';
        if (activeProxy) {
          respData = await this._requestViaProxy({
            proxyUrl: activeProxy,
            targetHost: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/${model}:generateContent`,
            body: payload,
            timeoutMs: 6500,
          });
        } else {
          respData = await this._requestDirect({
            targetHost: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/${model}:generateContent`,
            body: payload,
            timeoutMs: 6500,
          });
        }

        const data = JSON.parse(respData);
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text;
      } catch (err) {
        console.warn(`[ASR] 模型 ${model} 转录中断:`, err.message);
      }
    }

    return null;
  }

  _requestDirect({ targetHost, path: reqPath, body, timeoutMs = 2000 }) {
    return new Promise((resolve, reject) => {
      let finished = false;
      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          req.destroy(new Error(`Direct request timeout (${timeoutMs}ms)`));
          reject(new Error(`Direct request timeout (${timeoutMs}ms)`));
        }
      }, timeoutMs);

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
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            if (res.statusCode === 200) resolve(respData);
            else reject(new Error(`Google API status: ${res.statusCode}`));
          });
        }
      );

      req.on('timeout', () => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          req.destroy(new Error(`Direct socket timeout (${timeoutMs}ms)`));
          reject(new Error(`Direct socket timeout (${timeoutMs}ms)`));
        }
      });

      req.on('error', (err) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          reject(err);
        }
      });

      req.write(body);
      req.end();
    });
  }

  _requestViaProxy({ proxyUrl, targetHost, targetPort = 443, path: reqPath, method = 'POST', headers = {}, body = '', timeoutMs = 2000 }) {
    return new Promise((resolve, reject) => {
      let proxyHost = '127.0.0.1';
      let proxyPort = 7890;
      try {
        if (proxyUrl) {
          const raw = String(proxyUrl).trim();
          const withScheme = raw.includes('://') ? raw : `http://${raw}`;
          const u = new URL(withScheme);
          proxyHost = u.hostname || '127.0.0.1';
          proxyPort = Number(u.port) || 7890;
        }
      } catch (_) {}

      let finished = false;
      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          connectReq.destroy();
          reject(new Error(`Proxy CONNECT timeout (${timeoutMs}ms)`));
        }
      }, timeoutMs);

      const connectReq = http.request({
        host: proxyHost,
        port: proxyPort,
        method: 'CONNECT',
        path: `${targetHost}:${targetPort}`,
        timeout: timeoutMs,
      });

      connectReq.on('timeout', () => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          connectReq.destroy();
          reject(new Error(`Proxy connect socket timeout (${timeoutMs}ms)`));
        }
      });

      connectReq.on('connect', (res, socket) => {
        if (res.statusCode !== 200) {
          finished = true;
          clearTimeout(timer);
          socket.destroy();
          return reject(new Error(`Proxy CONNECT failed: ${res.statusCode}`));
        }

        const reqHeaders = {
          'Content-Type': 'application/json',
          'X-goog-api-key': this.apiKey,
          ...headers,
        };
        if (body && Buffer.byteLength(body) > 0) {
          reqHeaders['Content-Length'] = Buffer.byteLength(body);
        }

        const tlsReq = https.request(
          {
            host: targetHost,
            path: reqPath,
            method,
            socket,
            headers: reqHeaders,
            timeout: timeoutMs,
          },
          (tlsRes) => {
            let respData = '';
            tlsRes.on('data', (c) => (respData += c));
            tlsRes.on('end', () => {
              if (finished) return;
              finished = true;
              clearTimeout(timer);
              if (tlsRes.statusCode === 200 || tlsRes.statusCode === 400 || tlsRes.statusCode === 403) resolve({ respData, statusCode: tlsRes.statusCode });
              else reject(new Error(`Google API status: ${tlsRes.statusCode}`));
            });
          }
        );

        tlsReq.on('timeout', () => {
          if (!finished) {
            finished = true;
            clearTimeout(timer);
            tlsReq.destroy();
            reject(new Error(`TLS proxy socket timeout (${timeoutMs}ms)`));
          }
        });

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

