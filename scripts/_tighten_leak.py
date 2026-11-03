import io
p = 'src/world/summarize.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      if (sceneNames.some((n) => t.includes(n))) return true;
      // 相公自己的家务事，只有相公开口时才提
      if ((viewer || 'husband') === 'husband' && /相公|妾身|府里/.test(t)) return true;
      return false;"""
new = """      // 只有点了在场者名字的，才算这几个人知道的事
      return sceneNames.some((n) => t.includes(n));"""
if old in s:
    s = s.replace(old, new, 1)
    print('收紧：去掉"相公"兜底')
old2 = """        && (sceneNames.includes(String(a.name || ''))
            || ((viewer || 'husband') === 'husband' && /相公/.test(String(a.text || '')))),"""
new2 = """        && sceneNames.includes(String(a.name || '')),"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('收紧：约定只按名字')
io.open(p, 'w', encoding='utf-8').write(s)
