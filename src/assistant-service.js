import fs from 'node:fs';
import path from 'node:path';

/**
 * 现代全能 AI 助手服务（物理级与虚拟世界解耦）
 * 
 * 铁律：
 * 1. 绝对不 import 任何 src/world/* 模块；
 * 2. 绝对不读取、不修改世界账本或 NPC 状态；
 * 3. 独立存储：data/assistant/<memberKey>.json；
 * 4. 纯净知性现代问答助手设定，专门用于查资料、写文章、翻译、分析。
 */

const DEFAULT_SYSTEM_PROMPT = `你是用户的专属全能现代 AI 智能助手。
你知性、严谨、博学且贴心，具备强大的逻辑分析、文案撰写、代码审查、多语言翻译及百科知识解答能力。
请用条理清晰、通俗易懂、富有条理的现代中文回答用户的所有问题。
注意：你是一个纯粹实用的现代 AI 问答助手，不要扮演古代角色，不要输出分角色括号标头，专心为用户提供最高质量的知识与解答。`;

export class AssistantService {
  constructor({ dataDir = './data', llmClient = null } = {}) {
    this.dataDir = dataDir;
    this.llmClient = llmClient;
    this.assistantDir = path.join(this.dataDir, 'assistant');
    if (!fs.existsSync(this.assistantDir)) {
      try {
        fs.mkdirSync(this.assistantDir, { recursive: true });
      } catch (_) {}
    }
  }

  _getFilePath(memberKey = 'husband') {
    const safeKey = String(memberKey || 'husband').replace(/[^a-zA-Z0-9_\-]/g, '_');
    return path.join(this.assistantDir, `${safeKey}.json`);
  }

  loadHistory(memberKey = 'husband') {
    const file = this._getFilePath(memberKey);
    try {
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.messages)) return data.messages;
      }
    } catch (err) {
      console.warn(`[Assistant] 加载历史失败 (${memberKey}):`, err.message);
    }
    return [];
  }

  saveHistory(memberKey = 'husband', messages = []) {
    const file = this._getFilePath(memberKey);
    try {
      const data = {
        member: memberKey,
        updatedAt: Date.now(),
        messages: messages.slice(-40), // 保留最近 40 条
      };
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.warn(`[Assistant] 保存历史失败 (${memberKey}):`, err.message);
    }
  }

  getHistory(memberKey = 'husband', limit = 30) {
    const all = this.loadHistory(memberKey);
    return all.slice(-limit);
  }

  clearHistory(memberKey = 'husband') {
    this.saveHistory(memberKey, []);
    return true;
  }

  async chat(memberKey = 'husband', text = '', { newSession = false } = {}) {
    const input = String(text || '').trim();
    if (!input) throw new Error('输入内容不能为空');
    if (!this.llmClient || !this.llmClient.isReady()) {
      throw new Error('大模型通道尚未就绪');
    }

    let history = newSession ? [] : this.loadHistory(memberKey);
    const contextMsgs = history.slice(-16).map(m => ({
      role: m.role,
      content: m.content || m.text,
    }));

    contextMsgs.push({ role: 'user', content: input });

    const completion = await this.llmClient.complete({
      messages: contextMsgs,
      system: DEFAULT_SYSTEM_PROMPT,
      temperature: 0.7,
      maxTokens: 1200,
    });

    const reply = String(completion.text || completion.content || '').trim();

    // 追加记录并持久化
    history.push({ role: 'user', content: input, at: Date.now() });
    history.push({ role: 'assistant', content: reply, at: Date.now() });
    this.saveHistory(memberKey, history);

    return {
      ok: true,
      reply,
      elapsedMs: completion.elapsedMs,
      channel: completion.channel,
    };
  }
}
