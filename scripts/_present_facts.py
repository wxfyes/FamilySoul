import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

if 'person-facts.js' not in s:
    first = s.find('\n', s.find('import '))
    s = s[:first+1] + "import { personFacts } from './world/person-facts.js';\n" + s[first+1:]
    print('引入 personFacts')

anchor = "    // 用人事实：谁在相公哪家店做事（免得雇工装作不认识东家）"
block = """    // 在场者的底细：他有没有成婚、住哪、在哪当差——谁问都得对得上
    try {
      const wPF = loadState(this.dataDir);
      const mePF = this._viewerActorId ? wPF.actors?.[this._viewerActorId] : wPF.actors?.husband;
      const others = Object.values(wPF.actors || {})
        .filter((a) => a && !a.dead && a.name && a.id !== (mePF?.id || 'husband') && a.location === mePF?.location)
        .slice(0, 4);
      const facts = others
        .map((a) => {
          const t = personFacts(wPF, a.id);
          return t ? `${a.name}：${t.replace('【你的底细】', '')}` : '';
        })
        .filter(Boolean);
      if (facts.length) contextHintEarly += `（【在场者底细】${facts.join(' ／ ')}）\\n`;
    } catch { /* 忽略 */ }

""" + anchor
if '【在场者底细】' not in s:
    s = s.replace(anchor, block, 1)
    print('① 注入在场者底细')
io.open(p, 'w', encoding='utf-8-sig').write(s)
