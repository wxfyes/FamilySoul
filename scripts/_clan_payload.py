import io
# 宗族：把"与王家有走动"的判定提成公共函数，负载只给相关的那几族
p = 'src/world/clans.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'export function relatedClanIds' not in s:
    s = s.replace("export function ensureClans(world) {", """/** 与王家真有走动的那几族：本宗、姻亲、商帮 */
export function relatedClanIds(world) {
  const related = new Set();
  const me = world.actors?.husband;
  const mySurname = String(me?.name || '').slice(0, 1);
  if (mySurname) related.add(`clan_${mySurname}`);
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead) continue;
    const isKin = a.household || a.spouse === 'husband' || a.relations?.husband;
    if (!isKin) continue;
    const s2 = String(a.name || '').slice(0, 1);
    if (s2) related.add(`clan_${s2}`);
  }
  if (world.clans?.bang) related.add('bang');
  return related;
}

export function ensureClans(world) {""", 1)
    # 走动函数改用公共判定
    old = """  // 谁跟王家真有走动：本宗（同姓王）、姻亲（妻妾的姓）、商帮
  const related = new Set();
  const mySurname = String(me?.name || '').slice(0, 1);
  if (mySurname) related.add(`clan_${mySurname}`);
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead) continue;
    const isKin = a.household || a.spouse === 'husband' || a.relations?.husband?.trust !== undefined;
    if (!isKin) continue;
    const s2 = String(a.name || '').slice(0, 1);
    if (s2) related.add(`clan_${s2}`);
  }
  if (world.clans.bang) related.add('bang');"""
    if old in s:
        s = s.replace(old, "  const related = relatedClanIds(world);", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 相关宗族判定提成公共函数')

# server：负载只给相关宗族
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { ensureClans, clanBacking } from './world/clans.js';",
              "import { ensureClans, clanBacking, relatedClanIds } from './world/clans.js';")
old_pay = "        clans: Object.values(world.clans || {}).map((c) => ({ id: c.id, name: c.name, relation: c.relation, influence: c.influence })),"
new_pay = """        clans: (() => {
          const rel = relatedClanIds(world);
          return Object.values(world.clans || {})
            .filter((c) => c && rel.has(c.id))
            .map((c) => ({ id: c.id, name: c.name, relation: c.relation, influence: c.influence }));
        })(),"""
if old_pay in t:
    t = t.replace(old_pay, new_pay, 1)
    print('② 负载只给相关宗族')
io.open(p2, 'w', encoding='utf-8-sig').write(t)
