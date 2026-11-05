import io
p = 'src/world/couples.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  const linked = [];

  const pair = (a, b) => {"""
new = """  const linked = [];
  const idSet = new Set(actors.map((a) => a.id));

  // 先修：配偶指向不存在的人（旧数据里的"战静"之类），先清空再重新配
  for (const a of actors) {
    if (a.spouse && !idSet.has(a.spouse)) {
      a.spouse = null;
    }
  }

  const pair = (a, b) => {"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 悬空配偶先清空')
