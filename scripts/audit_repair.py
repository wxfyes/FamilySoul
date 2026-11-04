import io

p = 'src/world/audit.js'
s = io.open(p, encoding='utf-8-sig').read()

add = '''
/* ── 结构体检 + 天道修账（每日一次） ───────────────────────
 * 引擎只找"不成立"的事实，怎么修由天道定；它没修的，引擎按最保守办法兜底。
 */

export function inspectStructure(world) {
  const issues = [];
  const places = world.places || {};
  const actors = world.actors || {};

  for (const [id, a] of Object.entries(actors)) {
    if (!a || !a.name) continue;
    if (a.location && !places[a.location]) {
      issues.push({ kind: 'pos', who: a.name, id, detail: `站在不存在的地方(${a.location})` });
    }
    if (a.dead && a.location) {
      issues.push({ kind: 'dead', who: a.name, id, detail: '已故却仍有行踪' });
    }
    if (typeof a.money === 'number' && a.money < 0) {
      issues.push({ kind: 'money', who: a.name, id, detail: `私房钱为负(${a.money})` });
    }
    if (a.pregnancy && !a.pregnancy.born && Number(a.age) > 48) {
      issues.push({ kind: 'preg', who: a.name, id, detail: `${a.age}岁仍有身孕` });
    }
  }

  if (Number(world.assets?.silver) < 0) {
    issues.push({ kind: 'silver', detail: `公账为负(${world.assets.silver})` });
  }

  const seen = new Map();
  for (const [id, pl] of Object.entries(places)) {
    if (!pl?.name) { issues.push({ kind: 'place', id, detail: '地点没有名字' }); continue; }
    if (seen.has(pl.name)) issues.push({ kind: 'place', id, detail: `与${seen.get(pl.name)}重名：${pl.name}` });
    else seen.set(pl.name, id);
    const ex = Array.isArray(pl.exits) ? pl.exits.filter((x) => places[x]) : [];
    if (!ex.length && id !== 'street') issues.push({ kind: 'place', id, detail: `「${pl.name}」没有出处` });
  }

  for (const ap of world.appointments || []) {
    if (ap && ap.place && !places[ap.place]) {
      issues.push({ kind: 'apt', detail: `约定指向不存在的地点(${ap.place})` });
    }
  }

  return issues;
}

export function buildRepairPrompt(world, issues) {
  const lines = issues.slice(0, 24).map((i) => `- [${i.kind}] ${i.who || i.id || ''}：${i.detail}`);
  const system = [
    '你是这个世界的天道。人间出了这些不成立的事，需要你定夺。',
    '只输出 JSON：',
    '{"fixes":[{"kind":"pos","who":"人名","place":"送到哪个现成地点名（可空）","note":"一句话交代"}]}',
    '规矩：能用现成地点就用现成的；人必须有个落脚处；钱不许是负的；死人不许再走动。',
    '拿不准的可以跳过，宁缺毋滥。',
  ].join('\\n');
  const user = [
    `第${world.clock?.day || 1}日 ${world.clock?.hour || 0}时，人间自检：`,
    ...lines,
    '',
    '现成地点：' + Object.values(world.places || {}).filter((p) => p?.name).slice(0, 80).map((p) => p.name).join('、'),
    '请给修法，输出 JSON。',
  ].join('\\n');
  return { system, user };
}

export function applyRepairs(world, text) {
  const raw = String(text || '');
  const m = raw.match(/\\{[\\s\\S]*\\}/);
  let fixes = [];
  if (m) {
    try {
      const data = JSON.parse(m[0]);
      fixes = Array.isArray(data?.fixes) ? data.fixes : [];
    } catch { /* 忽略 */ }
  }
  const nameToPlace = new Map();
  for (const [id, pl] of Object.entries(world.places || {})) if (pl?.name) nameToPlace.set(String(pl.name), id);

  let fixed = 0;
  for (const f of fixes) {
    const who = String(f?.who || '');
    const target = f?.place ? nameToPlace.get(String(f.place)) : null;
    const actor = world.actors?.[who] || Object.values(world.actors || {}).find((a) => a?.name === who);
    if (actor) {
      if (f?.kind === 'pos' || f?.kind === 'dead') {
        if (actor.dead) delete actor.location;
        else actor.location = target || 'street';
        fixed += 1;
      } else if (f?.kind === 'money') {
        actor.money = Math.max(0, Number(actor.money) || 0);
        fixed += 1;
      } else if (f?.kind === 'preg') {
        delete actor.pregnancy;
        fixed += 1;
      }
      continue;
    }
    if (f?.kind === 'place' && world.places?.[who]) {
      const ex = Object.keys(world.places).find((k) => k !== who);
      if (ex) { world.places[who].exits = [ex]; fixed += 1; }
    }
  }

  // 天道没修的硬错，按最保守办法兜底
  for (const [id, a] of Object.entries(world.actors || {})) {
    if (!a || !a.name) continue;
    if (a.location && !world.places?.[a.location]) { a.location = 'street'; fixed += 1; }
    if (typeof a.money === 'number' && a.money < 0) { a.money = 0; fixed += 1; }
    if (Number(a.age) > 48 && a.pregnancy && !a.pregnancy.born) { delete a.pregnancy; fixed += 1; }
  }
  if (Number(world.assets?.silver) < 0) { world.assets.silver = 0; fixed += 1; }

  return { fixed, fromDm: fixes.length };
}
'''

if 'inspectStructure' not in s:
    s = s + add
    io.open(p, 'w', encoding='utf-8').write(s)
    print('已追加结构体检与修账')
else:
    print('已存在，跳过')
