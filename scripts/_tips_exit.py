import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      const ns = applyChatActions({ world: wAct, viewerId: this._viewerActorId || 'husband', sayText: say });
      if (ns && ns.length) {
        saveState(this.dataDir, wAct);
        reply += '\\n' + ns.map((t) => `【提示】${t}`).join('\\n');
        console.log(`[Actions] ${ns.length} 条提示已并入回复`);
      }"""
new = """      const ns = applyChatActions({ world: wAct, viewerId: this._viewerActorId || 'husband', sayText: say });
      if (ns && ns.length) {
        saveState(this.dataDir, wAct);
        // 不在中途拼正文（会被后面的整段重写吃掉），留到出口统一拼
        this._turnNotices = (this._turnNotices || []).concat(ns);
        console.log(`[Actions] ${ns.length} 条提示已记账，出口统一拼`);
      }"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 延迟拼提示')
old2 = """    // 最后一道：所有后处理改的是 reply，这里同步回 assistantMsg"""
new2 = """    // 出口：把本轮动作的【提示】并进最终正文（这里之后没人再改 reply）
    try {
      const tips = Array.isArray(this._turnNotices) ? this._turnNotices.splice(0, this._turnNotices.length) : [];
      if (tips.length) {
        reply = String(reply || '').trim() + '\\n' + tips.map((t) => `【提示】${t}`).join('\\n');
        if (assistantMsg) assistantMsg.notices = tips.slice();
        console.log(`[Actions] 出口拼入 ${tips.length} 条提示`);
      }
    } catch { /* 忽略 */ }

    // 最后一道：所有后处理改的是 reply，这里同步回 assistantMsg"""
if old2 in s and '出口拼入' not in s:
    s = s.replace(old2, new2, 1)
    print('② 出口拼')
io.open(p, 'w', encoding='utf-8-sig').write(s)
