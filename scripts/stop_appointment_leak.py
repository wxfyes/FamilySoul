import io

p = 'src/world/summarize.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 约定与承诺：只让当事人相关的人看见
old = """    const promises = (world.promises || []).filter((p) => p && !p.done && !isBogusMarriage(p.text));"""
new = """    // 只看与自己有关的：在场的、或点了名的
    const sceneNames = (() => {
      const names = [];
      const vId = viewer || 'husband';
      const meV2 = world.actors?.[vId];
      if (meV2?.name) names.push(meV2.name);
      for (const a of Object.values(world.actors || {})) {
        if (a && !a.dead && meV2 && a.location === meV2.location && a.name && a.id !== vId) names.push(a.name);
      }
      return names;
    })();
    const relevant = (text) => {
      const t = String(text || '');
      if (!sceneNames.length) return false;
      if (sceneNames.some((n) => t.includes(n))) return true;
      // 相公自己的家务事，只有相公开口时才提
      if ((viewer || 'husband') === 'husband' && /相公|妾身|府里/.test(t)) return true;
      return false;
    };

    const promises = (world.promises || [])
      .filter((p) => p && !p.done && !isBogusMarriage(p.text))
      .filter((p) => relevant(p.text));"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 承诺按在场者过滤')

# ② 约定：只保留与在场的人有关的
old2 = """      const raw2 = (world.appointments || []).filter((a) => a && Number(a.day) * 24 + Number(a.hour) >= nowHour);"""
new2 = """      const raw2 = (world.appointments || []).filter((a) =>
        a && Number(a.day) * 24 + Number(a.hour) >= nowHour
        && (sceneNames.includes(String(a.name || ''))
            || ((viewer || 'husband') === 'husband' && /相公/.test(String(a.text || '')))),
      );"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 约定只给当事人看')

# ③ 措辞：不许拿别人的约定说事
old3 = """            .join('；')} —— **在场的那一位必须主动提起这件事**"""
new3 = """            .join('；')} —— **只有当事人本人在场时才可提起；旁人一概不知**"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    print('③ 约定措辞收紧')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
