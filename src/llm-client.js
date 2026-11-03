import http from 'node:http';
import https from 'node:https';
/**
 * 多模型智能双通道容灾客户端（OpenAI 兼容协议）
 * 
 * 架构：
 * 1. 主通道：DeepSeek 官方（成本低，带上下文缓存）
 * 2. 备用通道：阿里百炼通义千问（qwen-plus，超稳无503，国内极速直连）
 * 3. 运行模式（llmMode）：
 *    - 'auto': 自适应智能容灾（推荐，DeepSeek 主力，遇到 503/超时 0 秒无缝切通义千问）
 *    - 'deepseek': 强制锁定 DeepSeek 官方
 *    - 'qwen': 强制锁定 阿里通义千问
 */

const DEFAULT_ALI_KEY = 'sk-ws-H.YLYIHYI.H9tm.MEUCIQDs397_NkoVhAW6M1g8T0iNRkKMpuIdCQEWQBcvbUZDEAIgLegR5m4SrL7vNmRI4RxrcSvFB1RWTvCq13eyEw3U1o8';
const DEFAULT_ALI_URL = 'https://ws-5ov9z4mrw5xcq2fp.cn-beijing.maas.aliyuncs.com/compatible-mode/v1';
const DEFAULT_ALI_MODEL = 'qwen-plus';

export class LlmClient {
  constructor(config = {}) {
    this.updateConfig(config);
  }

  updateConfig(config = {}) {
    // 运行模式：'auto' | 'deepseek' | 'qwen'
    this.llmMode = config.llmMode || 'deepseek';

    // 代理配置（坚决只管国外模型，DeepSeek与国内模型100%纯直连铁律）
    this.proxy = config.proxy || config.gemini?.proxy || '';
    this.useProxy = Boolean(config.useProxy ?? config.gemini?.useProxy);

    // 主通道（DeepSeek）
    this.apiKey = config.apiKey || config.deepseek?.apiKey || process.env.DEEPSEEK_API_KEY || '';
    this.baseUrl = (config.baseUrl || config.deepseek?.baseUrl || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
    this.model = config.model || config.deepseek?.model || 'deepseek-chat';
    this.temperature = Number(config.temperature ?? config.deepseek?.temperature) || 1.0;
    this.maxTokens = Number(config.maxTokens ?? config.deepseek?.maxTokens) || 800;

    // 备用通道（阿里通义千问 / 百炼）
    const fb = config.fallback || config.qwen || {};
    this.fallback = {
      apiKey: fb.apiKey || config.qwenApiKey || DEFAULT_ALI_KEY,
      baseUrl: (fb.baseUrl || config.qwenBaseUrl || DEFAULT_ALI_URL).replace(/\/+$/, ''),
      model: fb.model || config.qwenModel || DEFAULT_ALI_MODEL,
    };

    // 熔断状态记录
    this._primaryBrokenUntil = 0; // 熔断解除的时间戳
  }


  /**
   * 仅用于海外大模型（如 Groq / OpenAI）的 HTTP CONNECT 代理管道
   */
  _requestViaProxy({ proxyUrl, targetUrl, method, headers, body, timeoutMs }) {
    return new Promise((resolve, reject) => {
      let proxyHost = '127.0.0.1';
      let proxyPort = 1082;
      try {
        const pUrl = proxyUrl.includes('://') ? proxyUrl : `http://${proxyUrl}`;
        const pu = new URL(pUrl);
        proxyHost = pu.hostname || '127.0.0.1';
        proxyPort = Number(pu.port) || 1082;
      } catch (_) {}

      const u = new URL(targetUrl);
      const targetHost = u.hostname;
      const targetPort = Number(u.port) || (u.protocol === 'https:' ? 443 : 80);
      const reqPath = u.pathname + u.search;

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

        const tlsReq = https.request(
          {
            host: targetHost,
            port: targetPort,
            path: reqPath,
            method,
            socket,
            headers,
            timeout: timeoutMs,
          },
          (tlsRes) => {
            let respData = '';
            tlsRes.on('data', (c) => (respData += c));
            tlsRes.on('end', () => {
              if (finished) return;
              finished = true;
              clearTimeout(timer);
              resolve({
                ok: tlsRes.statusCode >= 200 && tlsRes.statusCode < 300,
                status: tlsRes.statusCode,
                text: async () => respData,
                json: async () => JSON.parse(respData),
              });
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

        if (body) tlsReq.write(body);
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

  isReady() {
    const hasPrimary = Boolean(this.apiKey && !this.apiKey.includes('your-deepseek-api-key'));
    const hasFallback = Boolean(this.fallback?.apiKey);
    return hasPrimary || hasFallback;
  }

  async _callEndpoint({ name, baseUrl, apiKey, model, messages, temperature, maxTokens, timeoutMs }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let resp;
      const targetUrl = `${baseUrl}/chat/completions`;
      const u = new URL(targetUrl);
      const hostname = u.hostname.toLowerCase();

      // 🛡️ 最高铁律名单：DeepSeek 及国内大模型 100% 强制国内纯直连！严禁走代理！
      const DOMESTIC_DOMAINS = [
        'deepseek.com',
        'aliyuncs.com',
        'siliconflow.cn',
        'moonshot.cn',
        'baichuan-ai.com',
        'zhipuai.cn',
        'volces.com',
        'xfyun.cn',
        '127.0.0.1',
        'localhost',
      ];

      const isDomestic = DOMESTIC_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
      const useProxyForThis = !isDomestic && Boolean(this.proxy && this.useProxy);

      const reqHeaders = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Authorization': `Bearer ${apiKey}`,
      };
      const reqBodyStr = JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      });

      if (isDomestic) {
        // DeepSeek / 阿里 / 硅基流动：100% 纯国内直连
      } else if (useProxyForThis) {
        console.log(`[LLM] 🌐 【海外模型: ${name}】(${hostname}) 检测到海外接口，借道专属端口 [${this.proxy}] 极速穿透`);
      }

      try {
        if (useProxyForThis) {
          resp = await this._requestViaProxy({
            proxyUrl: this.proxy,
            targetUrl,
            method: 'POST',
            headers: reqHeaders,
            body: reqBodyStr,
            timeoutMs,
          });
        } else {
          // 国内纯直连（DeepSeek 等）
          resp = await fetch(targetUrl, {
            method: 'POST',
            headers: reqHeaders,
            body: reqBodyStr,
            signal: controller.signal,
          });
        }
      } catch (netErr) {
        // 如果专属地址连接失败且还有通用地址，尝试阿里云通用地址
        if (baseUrl.includes('maas.aliyuncs.com')) {
          const publicUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
          console.warn(`[LLM] 阿里专属域名连接异常 (${netErr.message})，快速切换阿里通用公网地址重试...`);
          resp = await fetch(`${publicUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages,
              temperature,
              max_tokens: maxTokens,
              stream: false,
            }),
            signal: controller.signal,
          });
        } else {
          throw netErr;
        }
      }

      clearTimeout(timer);

      if (!resp.ok) {
        const errText = await resp.text();
        const err = new Error(`【${name}】API 失败 (${resp.status}): ${errText.slice(0, 150)}`);
        err.status = resp.status;
        err.isBusy = resp.status === 503 || resp.status === 429 || errText.includes('Service is too busy');
        throw err;
      }

      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error(`【${name}】返回内容为空`);
      }

      return {
        text: content,
        model: data.model || model,
        usage: data.usage || null,
      };
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error(`【${name}】请求超时 (${timeoutMs}ms)`);
        timeoutErr.isTimeout = true;
        throw timeoutErr;
      }
      throw err;
    }
  }

  async complete({ messages = [], system = '', temperature = this.temperature, maxTokens = this.maxTokens, timeoutMs = 35000 }) {
    if (!this.isReady()) {
      throw new Error('未配置有效的 API Key（DeepSeek 或 阿里通义均未配置）');
    }

    const startedAt = Date.now();
    const fullMessages = [];
    if (system) {
      fullMessages.push({ role: 'system', content: String(system) });
    }
    fullMessages.push(...messages);

    const now = Date.now();
    const isPrimaryBroken = now < this._primaryBrokenUntil;

    const primaryCh = {
      name: 'DeepSeek官方',
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      model: this.model,
      timeoutMs: timeoutMs,
    };
    let fallbackName = '自定义备用通道';
    const fbUrl = String(this.fallback?.baseUrl || '').toLowerCase();
    if (fbUrl.includes('groq.com')) fallbackName = 'Groq极速通道';
    else if (fbUrl.includes('siliconflow')) fallbackName = '硅基流动(SiliconFlow)';
    else if (fbUrl.includes('aliyuncs.com')) fallbackName = '阿里通义千问';
    else if (fbUrl.includes('openrouter')) fallbackName = 'OpenRouter';
    else if (fbUrl.includes('together')) fallbackName = 'Together.ai';
    else if (fbUrl.includes('deepbrick') || fbUrl.includes('oneapi')) fallbackName = 'OneAPI中转';

    const fallbackCh = {
      name: fallbackName,
      baseUrl: this.fallback.baseUrl,
      apiKey: this.fallback.apiKey,
      model: this.fallback.model,
      timeoutMs: Math.max(timeoutMs, 35000),
    };

    const hasPrimary = Boolean(this.apiKey && !this.apiKey.includes('your-deepseek-api-key'));
    const hasFallback = Boolean(this.fallback?.apiKey);

    // 构建执行队列
    const channels = [];
    if (this.llmMode === 'deepseek') {
      if (hasPrimary) channels.push(primaryCh);
      else throw new Error('当前强制锁定 DeepSeek 模式，但未配置有效的 DeepSeek API Key');
    } else if (this.llmMode === 'qwen') {
      if (hasFallback) channels.push(fallbackCh);
      else throw new Error('当前强制锁定 阿里通义 模式，但未配置有效的通义千问 API Key');
    } else {
      // 默认 'auto' 自适应模式
      if (hasPrimary && !isPrimaryBroken) {
        channels.push(primaryCh);
        if (hasFallback) channels.push(fallbackCh);
      } else {
        if (isPrimaryBroken) {
          console.log(`[LLM] ⚠ DeepSeek 仍在熔断期（剩余 ${Math.round((this._primaryBrokenUntil - now) / 1000)}s），优先走【阿里通义千问】`);
        }
        if (hasFallback) channels.push(fallbackCh);
        if (hasPrimary) channels.push(primaryCh);
      }
    }

    let lastError = null;
    for (const ch of channels) {
      try {
        console.log(`[LLM] 正在请求【${ch.name}】(模式: ${this.llmMode}, 模型: ${ch.model})...`);
        const result = await this._callEndpoint({
          name: ch.name,
          baseUrl: ch.baseUrl,
          apiKey: ch.apiKey,
          model: ch.model,
          messages: fullMessages,
          temperature,
          maxTokens,
          timeoutMs: ch.timeoutMs,
        });

        // 成功响应
        if (ch.name === 'DeepSeek官方') {
          this._primaryBrokenUntil = 0; // 重置熔断
        }
        console.log(`[LLM] ✅ 【${ch.name}】响应成功（耗时 ${Date.now() - startedAt}ms）`);
        return {
          ...result,
          elapsedMs: Date.now() - startedAt,
          channel: ch.name,
          llmMode: this.llmMode,
        };
      } catch (err) {
        lastError = err;
        console.warn(`[LLM] ❌ 【${ch.name}】调用失败: ${err.message}`);
        
        // 若主通道遇到 503 繁忙或超时，触发熔断 3 分钟，后续请求直接走通义
        if (ch.name === 'DeepSeek官方' && (err.isBusy || err.isTimeout)) {
          this._primaryBrokenUntil = Date.now() + 3 * 60 * 1000;
          console.warn(`[LLM] ⚡ DeepSeek 官方拥堵/超时，已激活自动熔断保护 3 分钟，立即热切换至备用通道！`);
        }
      }
    }

    throw lastError;
  }
}
