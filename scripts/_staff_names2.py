import io
p = 'src/world/warfare.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    let name = fallbackName(world, 'male') || '';
    if (!name) {
      const used = new Set(Object.values(world.actors || {}).map((a) => a && a.name).filter(Boolean));
      const SURNAME = ['周', '吴', '郑', '王', '李', '陈', '张', '刘', '赵', '孙'];
      const GIVEN = ['阿福', '阿顺', '阿贵', '阿全', '阿安', '阿平', '阿庆', '阿寿', '阿泰', '阿和'];
      for (let t = 0; t < 30; t++) {
        const cand = SURNAME[Math.floor(Math.random() * SURNAME.length)] + GIVEN[Math.floor(Math.random() * GIVEN.length)];
        if (!used.has(cand)) { name = cand; break; }
      }
    }
    if (!name) continue;"""
new = """    // 只用世界姓名池；池子给不出名字就不硬造（宁可少一个人，也不编假名）
    const name = fallbackName(world, 'male');
    if (!name) { console.log('[Staff] 姓名池暂无可用的名字，少立一人'); continue; }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('删掉自拟姓名兜底')
