import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  const baseName = String(root.name || '宅').split('·').pop();"""
new = """  // 宅名取"临江·王宅"这一层，不要取到最后那间房名
  const segs = String(root.name || '宅').split('·').map((x) => x.trim()).filter(Boolean);
  const baseName = segs.length >= 2 ? `${segs[0]}·${segs[1]}` : (segs[0] || '宅');"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('宅名取到府邸层')
