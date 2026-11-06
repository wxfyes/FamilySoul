import io
# ① 阶级人物不再打"household"（那是"相公府里人"的标记）
p = 'src/world/city.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("        household: true, relations: {}, origin: 'city_class', createdDay: day,", "        relations: {}, origin: 'city_class', createdDay: day,", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('① 阶级不打 household')

# ② 迁移：清掉阶级人物的 household
p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
old = "      // 一次性：阶级生成时重名的"
new = """      // 一次性：阶级人物被误标成"相公府里人"，清掉（他们有自己的府）
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

      // 一次性：阶级生成时重名的"""
if old in t and 'classHouseholdFixV1' not in t:
    t = t.replace(old, new, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 迁移清标记')

# ③ 后院只列"真在相公府里的"
p3 = 'src/server.js'
u = io.open(p3, encoding='utf-8-sig').read()
old3 = """        life: (() => {
          const meL = actorId ? world.actors?.[actorId] : world.actors?.husband;
          const house = Object.values(world.actors || {}).filter(
            (a) => a && !a.dead && a.id !== 'husband' && (a.household || (meL?.home && a.home === me""")
new3 = """        life: (() => {
          const meL = actorId ? world.actors?.[actorId] : world.actors?.husband;
          // 后院只算真在相公府里的（住同一处、或是他的妻妾），别人的府不算
          const myEstate = String(world.places?.[meL?.home]?.id || meL?.home || '');
          const inMyHouse = (a) => Boolean(a && (a.spouse === 'husband' || String(a.home || '') === myEstate));
          const house = Object.values(world.actors || {}).filter(
            (a) => a && !a.dead && a.id !== 'husband' && (inMyHouse(a) || (meL?.home && a.home === me"""
if old3 in u:
    u = u.replace(old3, new3, 1)
    io.open(p3, 'w', encoding='utf-8-sig').write(u)
    print('③ 后院过滤收紧')
