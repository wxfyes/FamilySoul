/**
 * DeepSeek 官方大模型客户端（OpenAI 兼容协议）
 */
export class LlmClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.DEEPSEEK_API_KEY || '';
    this.baseUrl = (config.baseUrl || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
    this.model = config.model || 'deepseek-chat';
    this.temperature = Number(config.temperature) || 1.0;
    this.maxTokens = Number(config.maxTokens) || 800;
  }

  isReady() {
    return Boolean(this.apiKey && !this.apiKey.includes('your-deepseek-api-key'));
  }

  async complete({ messages = [], system = '', temperature = this.temperature, maxTokens = this.maxTokens, timeoutMs = 60000 }) {
    if (!this.isReady()) {
      throw new Error('未配置有效的 DeepSeek API Key（请在 config.json 或环境变量中配置）');
    }

    const startedAt = Date.now();
    const fullMessages = [];
    if (system) {
      fullMessages.push({ role: 'system', content: String(system) });
    }
    fullMessages.push(...messages);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: fullMessages,
          temperature,
          max_tokens: maxTokens,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`DeepSeek API 请求失败 (${resp.status}): ${errorText.slice(0, 200)}`);
      }

      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('DeepSeek 返回内容为空');
      }

      return {
        text: content,
        model: data.model || this.model,
        usage: data.usage || null,
        elapsedMs: Date.now() - startedAt,
      };
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(`DeepSeek 请求超时 (${timeoutMs}ms)`);
      }
      throw err;
    }
  }
}
