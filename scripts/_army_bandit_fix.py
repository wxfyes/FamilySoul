import io
# ① 剿匪：按 homeCity/id 找匪，别只看 city
p = 'src/world/chat-actions.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "    const bt = world.bandits?.[city] || Object.values(world.bandits || {}).find((x) => x && x.city === city);"
new = """    const bt = world.bandits?.[city] || Object.values(world.bandits || {}).find((x) => x && (
      x.city === city || x.homeCity === city || String(x.id || '').includes(city)
    ) && Number(x.strength) > 0);"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 剿匪查找')

# ② 私兵补足 22：名字撞了就加辈字
p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """          for (let i = 0; i < need; i += 1) {
            const nm = fallbackName(world, 'male');
            if (!nm) break;
            const id = `wangjia_soldier_${Date.now()}_${i}`;"""
new2 = """          const usedNames = new Set(Object.values(world.actors || {}).map((a) => a && a.name).filter(Boolean));
          for (let i = 0; i < need; i += 1) {
            let nm = fallbackName(world, 'male');
            if (!nm) {
              const base = (fallbackName(world, 'male') || '王勇');
              nm = `${base}${['二', '三', '四', '五', '六', '七', '八', '九', '十'][i % 9]}`;
            }
            if (usedNames.has(nm)) nm = `${nm}郎`;
            usedNames.add(nm);
            const id = `wangjia_soldier_${Date.now()}_${i}`;"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 私兵补足')
