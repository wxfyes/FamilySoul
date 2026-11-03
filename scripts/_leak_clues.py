import io
p = 'src/world/summarize.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      const cls = (world.clues || []).slice(-4);
      if (cls.length > 0) {
        lines.push(`【线索】${cls.map((c) => String(c.text || '').slice(0, 30)).join('；')}`);
      }"""
new = """      // 线索同样按人过滤：独处时自己全知道；有旁人在场只提与他有关的
      const aloneC = sceneNames.length <= 1;
      const cls = (world.clues || [])
        .filter((c) => {
          const t = String(c?.text || '');
          if (!t) return false;
          if (aloneC) return true;
          return sceneNames.some((n) => t.includes(n));
        })
        .slice(-4);
      if (cls.length > 0) {
        lines.push(`【线索】${cls.map((c) => String(c.text || '').slice(0, 30)).join('；')}`);
      }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('线索已按在场者过滤')
else:
    print('WARN: 线索段没找到')
