import io

# ============ ① factions.js：外交关系 + 驻地表初始化 ============
p = 'src/world/factions.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    if (!f.stance) f.stance = fid === 'wangjia' ? 'defend' : 'status_quo';"""
new = """    if (!f.stance) f.stance = fid === 'wangjia' ? 'defend' : 'status_quo';
    // 外交关系：谁跟谁亲（-100 死敌 ~ 100 盟友），默认 0
    f.relations = f.relations && typeof f.relations === 'object' ? f.relations : {};
    // 驻地表：兵必须站在某座城里（f.stationed = { 城名: 兵数 }）
    if (!f.stationed || typeof f.stationed !== 'object') {
      f.stationed = {};
      const own = Array.isArray(f.cities) && f.cities.length ? f.cities[0] : (fid === 'wangjia' ? '临江府' : null);
      const n = Number(f.troops) || 0;
      if (own && n > 0) f.stationed[own] = n;
    }"""
if old in s and 'f.stationed' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 势力加 relations 与 stationed')

# ============ ② strategy.js：外交避让 + 行军 + 枭雄自生 ============
p2 = 'src/world/strategy.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { recruit, besiege, bribeCity, buyGrain } from './warfare.js';",
              "import { recruit, besiege, bribeCity, buyGrain, march, troopsAt, totalTroops } from './warfare.js';\nimport { canReach } from './geography.js';")
old2 = """    const targets = Object.entries(world.cities || {})
      .filter(([, ct]) => ct && String(ct.owner || 'court') !== f.id)
      .sort((a, b) => num(a[1].defense) - num(b[1].defense));
    const target = targets[0];
    if (!target) continue;"""
new2 = """    const allyOk = (ownerId) => {
      if (!ownerId || ownerId === f.id) return false;
      const rel = num(f.relations?.[ownerId]);
      return rel >= 40;          // 盟友不打
    };
    const targets = Object.entries(world.cities || {})
      .filter(([, ct]) => ct && String(ct.owner || 'court') !== f.id && !allyOk(String(ct.owner || 'court')))
      .sort((a, b) => num(a[1].defense) - num(b[1].defense));
    const target = targets[0];
    if (!target) continue;"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    print('② 推演不打盟友')

old3 = """    const [cityName] = target;
    // 只派一半兵出去，留一半守家
    const send = Math.max(1, Math.round(num(f.troops) * 0.5));
    if (factionStrength(world, f) < num(target[1].defense) * 0.8) continue;

    const r = besiege(world, { attacker: f.id, cityName, troops: send });
    if (r.ok) {
      results.push(r.text);
      if (sink) sink(world, { action: r.win ? 'city_taken' : 'siege_failed', actor: f.leader, place: cityName, payload: { text: r.text } });
    }"""
new3 = """    const [cityName] = target;
    // 兵必须先在目标城：不在就派兵过去（按路走，几天到）
    const have = troopsAt(world, f, cityName);
    if (have < 1) {
      const from = Object.keys(f.stationed || {})[0];
      if (!from) continue;
      const send = Math.max(1, Math.round(troopsAt(world, f, from) * 0.6));
      const road = canReach(world, from, cityName, f.id);
      if (!road.ok) { results.push(`${f.name}欲取${cityName}，但${road.reason}`); continue; }
      const mv = march(world, f.id, from, cityName, send);
      if (mv.ok) results.push(`${f.name}自${from}发兵 ${mv.troops}，${mv.days}日可至${cityName}`);
      continue;
    }

    const send = Math.max(1, Math.round(have * 0.8));
    if (factionStrength(world, f) < num(target[1].defense) * 0.8) continue;

    const r = besiege(world, { attacker: f.id, cityName, troops: send });
    if (r.ok) {
      results.push(r.text);
      if (sink) sink(world, { action: r.win ? 'city_taken' : 'siege_failed', actor: f.leader, place: cityName, payload: { text: r.text } });
    }"""
if old3 in t:
    t = t.replace(old3, new3, 1)
    print('③ 推演改为先行军再围城')

# 枭雄自生：每 30 日，高民怨的朝廷城可能自立
if 'proclaimWarlord' not in t:
    t = t.rstrip() + '''

/** 枭雄自生：无人煽动，也会有人趁乱竖旗（规则，不写剧本） */
export function maybeSpawnWarlord(world, sink) {
  const day = num(world.clock?.day);
  if (day % 30 !== 0) return null;
  const candidates = Object.entries(world.cities || {})
    .filter(([, ct]) => ct && String(ct.owner || 'court') === 'court' && num(ct.unrest) >= 55)
    .sort((a, b) => num(b[1].unrest) - num(a[1].unrest));
  if (!candidates.length) return null;
  if (Math.random() > 0.5) return null;

  const [cityName, ct] = candidates[0];
  const fid = `warlord_${cityName}_${day}`;
  if (world.factions[fid]) return null;
  const troops = Math.max(20, Math.round(num(ct.defense) * 3));
  world.factions[fid] = {
    id: fid,
    name: `${cityName}义军`,
    kind: 'warlord',
    leader: null,
    cities: [cityName],
    troops,
    stationed: { [cityName]: troops },
    grain: Math.round(troops * 2),
    morale: 55,
    ambition: 85,
    stance: 'expand',
    relations: { court: -60 },
    createdDay: day,
  };
  ct.owner = fid;
  ct.unrest = Math.max(0, num(ct.unrest) - 10);
  const text = `${cityName}民怨沸腾，有人竖旗自立，号「${cityName}义军」`;
  if (sink) sink(world, { action: 'warlord_spawn', actor: null, place: cityName, payload: { text } });
  return text;
}
'''
    print('④ 加枭雄自生规则')

io.open(p2, 'w', encoding='utf-8-sig').write(t)

# ============ ③ clock.js：粮食产出 + 大事件转谣言 + 枭雄自生调用 ============
p3 = 'src/world/clock.js'
c = io.open(p3, encoding='utf-8-sig').read()
c = c.replace("import { npcStrategyTurn } from './strategy.js';",
              "import { npcStrategyTurn, maybeSpawnWarlord } from './strategy.js';")
old4 = """    if (day % 7 === 0) {
      npcStrategyTurn(world, events, (w, ev) => {"""
new4 = """    if (day % 7 === 0) {
      npcStrategyTurn(world, events, (w, ev) => {"""
c = c.replace(old4, new4, 1)

# 在军需之后、推演之前插：枭雄自生 + 产业产粮
old5 = """  // 每 7 日：无人指挥的势力自己动（有 LLM 时由 server 侧接管，这里兜底）"""
new5 = """  // 枭雄自生：民怨高的城会有人竖旗（规则触发，不写剧本）
  try {
    const wl = maybeSpawnWarlord(world, (w, ev) => {
      try { events.push(nextEvent(w, ev)); } catch { /* 忽略 */ }
    });
    if (wl) console.log('[Warlord]', wl);
  } catch (err) {
    console.warn('[Warlord] 枭雄自生失败：', err.message);
  }

  // 产业产粮：米粮/粮栈类产业每天攒粮，可调去军仓
  try {
    for (const p of (world.assets?.properties || [])) {
      if (!p || !/粮|米|栈/.test(String(p.name || ''))) continue;
      if (!/正常营业|已开张/.test(String(p.status || ''))) continue;
      p.grainStock = Math.round((Number(p.grainStock) || 0) + (Number(p.incomePerDay) || 0) * 2 * 10) / 10;
    }
  } catch { /* 忽略 */ }

  // 每 7 日：无人指挥的势力自己动（有 LLM 时由 server 侧接管，这里兜底）"""
if old5 in c and '枭雄自生' not in c:
    c = c.replace(old5, new5, 1)
    print('⑤ 时钟接枭雄自生与产粮')
io.open(p3, 'w', encoding='utf-8-sig').write(c)
