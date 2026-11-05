import io
p = 'src/world/apply.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "        const found = Object.entries(world.places).find(([k, p]) => k === targetPlaceName || p?.name === targetPlaceName || p?.name?.includes(targetPlaceName));"
new = """        // 精确名 → 以该名结尾（如"临江·王宅·正房" ← "正房"）→ 才轮到包含；
        // 绝不做"柳婶家 匹配到 刘婶家"这种串门
        const exact = Object.entries(world.places).find(([k, p]) => k === targetPlaceName || p?.name === targetPlaceName);
        const suffix = exact ? null : Object.entries(world.places).find(([, p]) => {
          const n = String(p?.name || '');
          return n.endsWith(`·${targetPlaceName}`) || n.endsWith(targetPlaceName);
        });
        const found = exact || suffix;"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 地点名匹配收紧')
