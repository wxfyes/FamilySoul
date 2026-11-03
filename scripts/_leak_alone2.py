import io
p = 'src/world/summarize.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      const raw2 = (world.appointments || []).filter((a) =>
        a && Number(a.day) * 24 + Number(a.hour) >= nowHour
        && sceneNames.includes(String(a.name || '')),
      );"""
new = """      const alone = sceneNames.length <= 1;
      const raw2 = (world.appointments || []).filter((a) =>
        a && Number(a.day) * 24 + Number(a.hour) >= nowHour
        && (alone || sceneNames.includes(String(a.name || ''))),
      );"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('已修：独处时自己的约定可见')
