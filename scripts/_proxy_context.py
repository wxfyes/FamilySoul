import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 加一个"最近几句"的工具函数（代理/兜底都用它，避免"他"没有指代）
anchor = "  async chat({ text = '', modality = 'text', profileKey = 'husband', roleName = null, isVideoCall = false, actorId = null } = {}) {"
helper = """  /** 最近几句对话，供代演/兜底时接住指代（"他""那个人"） */
  _recentSnippet(profileKey, n = 4) {
    try {
      const h = this.readHistory(profileKey).messages || [];
      return h.slice(-n).map((m) => `${m.role === 'user' ? '客' : '答'}：${String(m.text || '').slice(0, 60)}`).join('\\n');
    } catch { return ''; }
  }

""" + anchor
if '_recentSnippet' not in s:
    s = s.replace(anchor, helper, 1)
    print('① 加 _recentSnippet')

# ② 兜底代演带上最近几句
old2 = """          const pp2 = buildProxyPrompt({
            actor: presentOne,
            hearer: mePres,
            memories: [],
            facts: [personFacts(wPres, presentOne.id)].filter(Boolean),
            hearerName: mePres?.name || '客人',
            hearerPlace: String(wPres.places?.[hereLoc]?.name || ''),
            said: String(say || '').slice(0, 200),
            recent: '',
          });"""
new2 = """          const pp2 = buildProxyPrompt({
            actor: presentOne,
            hearer: mePres,
            memories: [],
            facts: [personFacts(wPres, presentOne.id)].filter(Boolean),
            hearerName: mePres?.name || '客人',
            hearerPlace: String(wPres.places?.[hereLoc]?.name || ''),
            said: String(say || '').slice(0, 200),
            recent: this._recentSnippet(profileKey, 4),
          });"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 兜底带上下文')

# ③ 常规代演也带上下文
old3 = """              said: String(say || '').slice(0, 200),
              recent: '',
            });
            const npRes = await this.llmClient.complete({"""
new3 = """              said: String(say || '').slice(0, 200),
              recent: this._recentSnippet(profileKey, 4),
            });
            const npRes = await this.llmClient.complete({"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    print('③ 代演带上下文')
io.open(p, 'w', encoding='utf-8-sig').write(s)
