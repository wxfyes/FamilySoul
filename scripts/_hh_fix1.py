import io
p = 'src/world/city.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("        household: true, relations: {}, origin: 'city_class', createdDay: day,", "        relations: {}, origin: 'city_class', createdDay: day,", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('city ok')

p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
anchor = "      // 一次性：阶级生成时重名的"
add = """      // 一次性：阶级人物被误标成"相公府里人"，清掉（他们有自己的府）
      try {
        if (!world.flags?.classHouseholdFixV1) {
          let n = 0;
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.origin !== 'city_class') continue;
            if (!a.household) continue;
            delete a.household;
            n += 1;
          }
          world.flags = world.flags || {};
          world.flags.classHouseholdFixV1 = { at: Date.now(), cleared: n };
          if (n) console.log(`[Class] 清掉误标府内人：${n} 人`);
        }
      } catch { /* 忽略 */ }

"""
if 'classHouseholdFixV1' not in t and anchor in t:
    t = t.replace(anchor, add + anchor, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('state ok')
