#!/usr/bin/env node
/**
 * 世界体检（只读）
 *
 * 只做三件事：看、算、报。不写状态、不改数据、不调用天道。
 *
 * 用法：
 *   node scripts/healthcheck.mjs --url http://192.168.1.254:3088 --token <相公令牌>
 *   node scripts/healthcheck.mjs --url ... --token ... --verbose
 *
 * 退出码：0 全绿 / 1 有 WARN / 2 有 FAIL
 */

const args = process.argv.slice(2);
const getArg = (k, d = '') => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] || d : d;
};
const BASE = (getArg('url', 'http://192.168.1.254:3088')).replace(/\/+$/, '');
const TOKEN = getArg('token', process.env.FS_TOKEN || '');
const VERBOSE = args.includes('--verbose');

if (!TOKEN) {
  console.error('缺 --token（相公令牌）');
  process.exit(2);
}

const out = { pass: [], warn: [], fail: [] };
const pass = (m) => out.pass.push(m);
const warn = (m) => out.warn.push(m);
const fail = (m) => out.fail.push(m);

async function api(pathname) {
  const url = `${BASE}${pathname}${pathname.includes('?') ? '&' : '?'}token=${encodeURIComponent(TOKEN)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${pathname} → HTTP ${r.status}`);
  return r.json();
}

const sim = (a, b) => {
  const norm = (t) => String(t || '').replace(/[，。、！？；：""''（）\s]/g, '');
  const grams = (t) => {
    const s = new Set();
    const n = norm(t);
    for (let i = 0; i < n.length - 1; i += 1) s.add(n.slice(i, i + 2));
    return s;
  };
  const A = grams(a); const B = grams(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const x of A) if (B.has(x)) hit += 1;
  return hit / Math.min(A.size, B.size);
};

const LOOK = /查账|对账|核账|账目|账册|流水|清账|盘账/;

async function main() {
  const [world, menu] = await Promise.all([api('/api/admin/world'), api('/api/world/menu')]);
  const actors = world.actors || [];
  const byId = new Map(actors.map((a) => [a.id, a]));
  const placeNames = new Set((menu.places || []).map((p) => p.name));
  const clock = world.clock || {};
  const props = world.assets?.properties || [];

  console.log(`\n世界体检 · 第${clock.day}日 ${clock.hour}时 · ${BASE}`);
  console.log('='.repeat(56));

  // ── 1. 总览 ──
  console.log('\n【1】总览');
  console.log(`  人数 ${actors.length} · 产业 ${props.length} · 承诺 ${(world.promises || []).length} · 线索 ${(world.clues || []).length} · 约定 ${(world.appointments || []).length}`);
  console.log(`  国库 ${Number(world.assets?.silver || 0).toFixed(2)} 两 · 粮 ${world.grain?.stock ?? '?'} 石`);
  pass('总览可读');

  // ── 2. 查账过载（你最烦的）──
  const promises = (world.promises || []).filter((p) => p && !p.done);
  const lookPromises = promises.filter((p) => LOOK.test(String(p.text || '')));
  const lookRatio = promises.length ? lookPromises.length / promises.length : 0;
  console.log('\n【2】查账过载');
  console.log(`  未了承诺 ${promises.length} 条，其中查账类 ${lookPromises.length} 条（${(lookRatio * 100).toFixed(0)}%）`);
  if (promises.length > 20) fail(`承诺堆积 ${promises.length} 条（>20，世界在被待办拖着走）`);
  else if (promises.length > 12) warn(`承诺 ${promises.length} 条（偏多，注意别再堆）`);
  else pass(`承诺数量正常（${promises.length}）`);

  if (lookRatio > 0.6 && promises.length >= 5) fail('六成以上未了承诺都是查账——世界只剩这一件事');
  else if (lookRatio > 0.4 && promises.length >= 5) warn('查账类承诺占比偏高');
  else pass('查账类占比正常');

  // 同一天 + 高相似 → 重复
  const dupes = [];
  for (let i = 0; i < promises.length; i += 1) {
    for (let j = i + 1; j < promises.length; j += 1) {
      const a = promises[i]; const b = promises[j];
      if (String(a.due ?? '') !== String(b.due ?? '')) continue;
      if (sim(a.text, b.text) >= 0.6) dupes.push([a, b]);
    }
  }
  if (dupes.length) warn(`发现 ${dupes.length} 组重复承诺（同一天且内容六成重合）`);
  else pass('没有重复承诺');

  if ((LOOK.test(JSON.stringify(lookPromises)) && lookPromises.length) || VERBOSE) {
    if (lookPromises.length) {
      console.log('  查账类明细：');
      for (const p of lookPromises.slice(0, 8)) console.log(`    · 第${p.due}日 ${String(p.text).slice(0, 40)}`);
    }
  }

  // ── 3. 结构问题（引擎自检）──
  console.log('\n【3】结构问题');
  try {
    const audit = await api('/api/admin/audit');
    const list = audit.structure || [];
    console.log(`  自检报告 ${list.length} 处`);
    for (const it of list.slice(0, 12)) console.log(`    [${it.kind}] ${it.who || ''} ${it.detail || ''}`);
    if (list.length > 8) fail(`结构问题 ${list.length} 处（偏多）`);
    else if (list.length) warn(`结构问题 ${list.length} 处`);
    else pass('结构无异常');
  } catch (e) {
    warn(`自检接口不可用（${e.message}）`);
  }

  // ── 4. 产业归属 ──
  console.log('\n【4】产业归属');
  let propBad = 0;
  for (const p of props) {
    const owner = p.owner ? byId.get(p.owner) : null;
    const keeper = p.keeper ? byId.get(p.keeper) : null;
    const staff = Array.isArray(p.staffIds) ? p.staffIds : [];
    const staffAlive = staff.filter((id) => byId.get(id) && !byId.get(id).dead);
    const onDuty = staffAlive.filter((id) => byId.get(id).place === (placeNames.has(p.name) ? p.name : byId.get(id).place));
    const line = `  ${p.name}｜东家 ${owner?.name || p.owner || '无'}｜在册 ${staffAlive.length}｜在岗 ${onDuty.length}`;
    if (!p.owner) { propBad += 1; fail(`${p.name} 没有东家（会被"确权"逻辑吞给王甯）`); }
    else if (!staffAlive.length && p.status === '已开张') { propBad += 1; warn(`${p.name} 开着却没在册人手`); }
    else pass(`${p.name} 归属与在岗正常`);
    if (VERBOSE) console.log(line);
  }
  if (!propBad) pass('产业归属全部有主');

  // ── 5. 婚姻与住处（新角色最容易编的两件事）──
  console.log('\n【5】婚姻与住处');
  const players = actors.filter((a) => String(a.id).startsWith('usr_'));
  console.log(`  注册玩家 ${players.length} 人`);
  let noResidence = 0;
  for (const a of players) {
    const hasSpouseField = Object.prototype.hasOwnProperty.call(a, 'spouse');
    // 有没有"自己的住处"看 home/residence，而不是此刻站在哪
    const hasRes = Boolean(a.residence && a.residence.placeId) || (a.home && a.home !== 'inn');
    if (!hasRes) noResidence += 1;
    if (VERBOSE) console.log(`    ${a.name}｜在 ${a.place}｜spouse 字段 ${hasSpouseField ? '有' : '无'}`);
  }
  if (players.length && noResidence === players.length) warn('所有注册玩家都住在客栈（没有自己的住处）');
  else if (noResidence) warn(`${noResidence} 位注册玩家没有自己的住处`);
  else pass('注册玩家住处正常');

  // ── 6. 位置与死人 ──
  console.log('\n【6】位置与生死');
  let posBad = 0; let deadBad = 0;
  for (const a of actors) {
    if (a.dead && a.place) { deadBad += 1; if (VERBOSE) console.log(`    已故仍有行踪：${a.name}`); }
    // 位置写成英文 id 才是真问题（中文地名可能只是没进公共名册，比如正房）
    if (a.place && /[a-zA-Z_]/.test(String(a.place))) {
      posBad += 1;
      console.log(`    位置是 id 不是地名：${a.name} @ ${a.place}`);
    }
  }
  if (deadBad) fail(`已故却仍有行踪 ${deadBad} 人`);
  else pass('没有"死人还在走动"');
  if (!posBad) pass('位置没有写成英文 id');

  // ── 7. 线索来源 ──
  console.log('\n【7】线索来源');
  const clues = world.clues || [];
  const bySource = {};
  for (const c of clues) bySource[c.source || '未标'] = (bySource[c.source || '未标'] || 0) + 1;
  console.log(`  共 ${clues.length} 条：` + Object.entries(bySource).map(([k, v]) => `${k}×${v}`).join(' '));
  if (clues.length < 3) warn('线索偏少（情报来源不足，攻略只能靠猜）');
  else pass('线索数量正常');

  // ── 汇总 ──
  console.log('\n' + '='.repeat(56));
  console.log(`PASS ${out.pass.length} ｜ WARN ${out.warn.length} ｜ FAIL ${out.fail.length}`);
  if (out.warn.length) {
    console.log('\n需要留意：');
    for (const m of out.warn) console.log(`  ⚠ ${m}`);
  }
  if (out.fail.length) {
    console.log('\n需要处理：');
    for (const m of out.fail) console.log(`  ✗ ${m}`);
  }
  console.log('');

  if (out.fail.length) process.exit(2);
  if (out.warn.length) process.exit(1);
}

main().catch((e) => {
  console.error('体检失败：', e.message);
  process.exit(2);
});
