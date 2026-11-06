import io
# ① 阶级起名保证全服唯一
p = 'src/world/city.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    const given = (g) => {
      const male = ['文远', '景行', '子昂', '怀瑾', '承泽', '彦之'];
      const female = ['婉宁', '清欢', '知微', '若兰', '云舒', '含章'];
      const pool = g === 'female' ? female : male;
      return surname + pool[Math.floor(Math.random() * pool.length)];
    };"""
new = """    const taken = () => new Set(Object.values(world.actors || {}).map((a) => a && a.name).filter(Boolean));
    const given = (g) => {
      const male = ['文远', '景行', '怀瑾', '承泽', '彦之', '守拙', '明远', '子墨'];
      const female = ['婉宁', '清欢', '知微', '若兰', '云舒', '含章', '静姝', '月娥'];
      const pool = g === 'female' ? female : male;
      const used = taken();
      for (let i = 0; i < 40; i += 1) {
        const cand = surname + pool[Math.floor(Math.random() * pool.length)];
        if (!used.has(cand)) return cand;
      }
      return fallbackName(world, g) || '';
    };"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 阶级名字唯一')
