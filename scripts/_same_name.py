import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        const who = Object.values(w.actors || {}).find((a) => a && !a.dead && a.name && (a.name === spk || spk.includes(a.name) || a.name.includes(spk)));
        if (!who) { kept.push(seg); continue; }"""
new = """        const who = Object.values(w.actors || {}).find((a) => a && !a.dead && a.name && (a.name === spk || spk.includes(a.name) || a.name.includes(spk)));
        if (!who) { kept.push(seg); continue; }
        // 同名可能既有 NPC 又有真人号：只要这个名字底下有真人号，就不许 AI 替他说话
        const sameNameReal = Object.values(w.actors || {}).some(
          (a) => a && !a.dead && a.name === who.name && (/^usr_/.test(String(a.id)) || isHumanBound(w, a.id)),
        );"""
if old in s:
    s = s.replace(old, new, 1)
    old2 = """        const isRealUser = /^usr_/.test(String(who.id)) || isHumanBound(w, who.id);"""
    new2 = """        const isRealUser = /^usr_/.test(String(who.id)) || isHumanBound(w, who.id) || sameNameReal;"""
    s = s.replace(old2, new2, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 同名真人号也拦')
