import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 补上 _mentionFacts（放在 _recentSnippet 之前，类内）
anchor = "  /** 最近几句对话，供代演/兜底时接住指代"
helper = '''  /** 这一句里提到了谁：给代演的人一句底细（谁、做什么的、此刻在哪） */
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

''' + anchor
if 'this._mentionFacts' in s and '  _mentionFacts(world' not in s:
    s = s.replace(anchor, helper, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 补 _mentionFacts 到类内')

# ② 出口：剔空时保留正文叙述，不留错的发言人
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
old = """        const kept = [];
        for (const seg of segs) {"""
new = """        const kept = [];
        const dropped = [];
        for (const seg of segs) {"""
if old in t and 'const dropped = [];' not in t:
    t = t.replace(old, new, 1)
    t = t.replace("""            console.log(`[Presence:出口] 剔除非在场发言：${spk}`);
            continue;""",
"""            console.log(`[Presence:出口] 剔除非在场发言：${spk}`);
            dropped.push(String(seg).replace(/^【[^】\\n]{1,12}】/, '').trim());
            continue;""", 1)
    t = t.replace("""        const merged = kept.join('').trim();
        if (merged && merged !== txt) result.reply.text = merged;""",
"""        let merged = kept.join('').trim();
        // 全被剔掉：把话留下、把人名去掉，改成旁白，绝不给他挂错名
        if (!merged && dropped.length) merged = dropped.join(' ').replace(/^[：:]+/, '').trim();
        if (merged && merged !== txt) result.reply.text = merged;""", 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 出口剔空时改旁白')
