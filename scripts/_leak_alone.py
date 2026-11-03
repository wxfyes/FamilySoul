import io
p = 'src/world/summarize.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      // 只有点了在场者名字的，才算这几个人知道的事
      return sceneNames.some((n) => t.includes(n));"""
new = """      // 独处（身边没别人）时，相公的旧账自己都得记得
      if (sceneNames.length <= 1) return true;
      // 有旁人在场：只有点了在场者名字的才算他们知道的事
      return sceneNames.some((n) => t.includes(n));"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('已加：独处时全记得')
