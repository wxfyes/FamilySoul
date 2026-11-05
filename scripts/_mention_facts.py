import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# 代演时把"被问到的那个人"的底细也给它，别一问三不知
helper = '''  /** 这一句里提到了谁：给他一句底细（谁、做什么的、此刻在哪） */
  _mentionFacts(world, text, exceptId) {
    try {
      const out = [];
      for (const a of Object.values(world?.actors || {})) {
        if (!a || a.dead || !a.name || a.id === exceptId) continue;
        if (!String(text || '').includes(a.name)) continue;
        const where = world.places?.[a.location]?.name || '别处';
        const rel = a.id === 'husband' ? '临江茶坊东家' : (a.role || '城中人');
        out.push(`${a.name}：${rel}，此刻在${where}`);
        if (out.length >= 3) break;
      }
      return out;
    } catch { return []; }
  }

'''
anchor = "  /// 最近几句对话，供代演/兜底时接住指代（\"他\"\"那个人\"）"
if '_mentionFacts' not in s:
    s = s.replace(anchor, helper + anchor, 1)
    print('① 加 _mentionFacts')

# 常规代演：facts 里补上被提到的人
old = """              facts: npcFacts.concat([
                herePlaceFact,
                personFacts(wPost, npc.id),"""
new = """              facts: npcFacts.concat(this._mentionFacts(wPost, say, npc.id)).concat([
                herePlaceFact,
                personFacts(wPost, npc.id),"""
if old in s and '_mentionFacts(wPost' not in s:
    s = s.replace(old, new, 1)
    print('② 代演带被提到者底细')

# 兜底代演：同样补
old2 = """            facts: [personFacts(wPres, presentOne.id)].filter(Boolean),"""
new2 = """            facts: [personFacts(wPres, presentOne.id)].concat(this._mentionFacts(wPres, say, presentOne.id)).filter(Boolean),"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('③ 兜底也带被提到者底细')
io.open(p, 'w', encoding='utf-8-sig').write(s)
