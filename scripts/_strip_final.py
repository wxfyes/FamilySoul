import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 抽一个可复用的"剔除真人/不在场者发言"方法
helper = """  /** 把"不该开口的人"的段落剔掉：不在场的人、以及不是本人操控的真人号 */
  _stripIllegalSpeakers(reply) {
    try {
      const w = loadState(this.dataDir);
      const me = this._viewerActorId ? w.actors?.[this._viewerActorId] : w.actors?.husband;
      const here = me?.location;
      const segs = String(reply || '').split(/(?=【[^】\\n]{1,12}】)/).filter(Boolean);
      const kept = [];
      for (const seg of segs) {
        const m = seg.match(/^【([^】\\n]{1,12})】/);
        if (!m) { kept.push(seg); continue; }
        const spk = m[1].trim();
        if (/天道|旁白|众人/.test(spk) || spk === (me?.name || '')) { kept.push(seg); continue; }
        const who = Object.values(w.actors || {}).find((a) => a && !a.dead && a.name && (a.name === spk || spk.includes(a.name) || a.name.includes(spk)));
        if (!who) { kept.push(seg); continue; }
        const rel = me?.relations?.[who.id] || who.relations?.[me?.id] || {};
        const kin = Boolean(me?.spouse === who.id || who.spouse === me?.id
          || (me?.household && who.household)
          || rel.lover || Number(rel.desire) >= 40 || Number(rel.trust) >= 55);
        const isRealUser = /^usr_/.test(String(who.id)) || isHumanBound(w, who.id);
        if (isRealUser && !kin) {
          console.log(`[Presence] 剔除非本人操控的真人发言：${spk}`);
          continue;
        }
        if (who.location !== here && !(isRealUser && kin)) {
          console.log(`[Presence] 剔除非在场发言：${spk}`);
          continue;
        }
        kept.push(seg);
      }
      const merged = kept.join('').trim();
      return merged || '';
    } catch {
      return String(reply || '');
    }
  }

"""
anchor = "  async chat({ text = '', modality = 'text', profileKey = 'husband', roleName = null, isVideoCall = false, actorId = null } = {}) {"
if '_stripIllegalSpeakers' not in s:
    s = s.replace(anchor, helper + anchor, 1)
    print('① 抽出统一过滤方法')

# ② 在成文前再过滤一次（挡住后段追加的旁人）
old2 = """    const assistantMsg = { id: `a-${now}`, role: 'assistant', text: reply, at: now };"""
new2 = """    // 成文前最后一道：把不该开口的人再剔一次（后段追加的旁人也会被挡住）
    try {
      const cleaned = this._stripIllegalSpeakers(reply);
      if (cleaned) reply = cleaned;
    } catch { /* 忽略 */ }
    const assistantMsg = { id: `a-${now}`, role: 'assistant', text: reply, at: now };"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 成文前二次过滤')
io.open(p, 'w', encoding='utf-8-sig').write(s)
