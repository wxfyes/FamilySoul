/**
 * 世界自愈 —— 不靠人管，账本坏了它自己修
 *
 * 原则：
 *  1. 只修「确定是错」的东西（越界、失效、堆积、重名），**不猜剧情**；
 *  2. 每处修复都返回一句人话，写进日志，方便回查；
 *  3. 幂等：健康的账本调用它什么都不会变。
 */

const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n) || 0));

const HOME_FALLBACK = 'backyard';

/**
 * @param {object} world 会被就地修改
 * @returns {string[]} 修复记录（空数组 = 本来就没病）
 */
export function healWorld(world) {
  const fixes = [];
  if (!world || typeof world !== 'object') return fixes;

  // ① 现银不能为负
  if (!(Number(world.assets?.silver) >= 0)) {
    fixes.push(`现银 ${world.assets?.silver} → 0`);
    world.assets = world.assets || {};
    world.assets.silver = 0;
  }

  // ② 产业收入不能为负、不能是 NaN
  for (const p of world.assets?.properties || []) {
    if (!(Number(p?.incomePerDay) >= 0)) {
      fixes.push(`${p.name} 日入 ${p.incomePerDay} → 0`);
      p.incomePerDay = 0;
    }
  }

  // ③ 关系数值夹紧到 0~100
  for (const a of Object.values(world.actors || {})) {
    const rel = a?.relations?.husband;
    if (!rel) continue;
    for (const f of ['trust', 'desire', 'fear', 'grievance']) {
      if (typeof rel[f] !== 'number' || !Number.isFinite(rel[f])) {
        fixes.push(`${a.name}.${f} 非法 → 0`);
        rel[f] = 0;
      } else if (rel[f] < 0 || rel[f] > 100) {
        const before = rel[f];
        rel[f] = clamp(rel[f], 0, 100);
        fixes.push(`${a.name}.${f} ${before} → ${rel[f]}`);
      }
    }
  }

  // ④ 人物位置失效 → 送回住处
  for (const a of Object.values(world.actors || {})) {
    if (!a?.location) continue;
    if (world.places?.[a.location]) continue;
    const home = a.home && world.places?.[a.home] ? a.home : HOME_FALLBACK;
    if (world.places?.[home]) {
      fixes.push(`${a.name} 位置失效(${a.location}) → ${world.places[home].name}`);
      a.location = home;
    } else {
      const first = Object.keys(world.places || {})[0];
      if (first) {
        fixes.push(`${a.name} 无家可归 → ${world.places[first].name}`);
        a.location = first;
      }
    }
  }

  // ⑤ 重名地点合并
  const byName = new Map();
  for (const [id, p] of Object.entries(world.places || {})) {
    const nm = String(p?.name || '');
    if (!nm) continue;
    if (!byName.has(nm)) {
      byName.set(nm, id);
      continue;
    }
    const keep = byName.get(nm);
    for (const a of Object.values(world.actors || {})) {
      if (a?.location === id) a.location = keep;
    }
    delete world.places[id];
    fixes.push(`重名地点「${nm}」合并`);
  }

  // ⑤.5 非法/口语误伤地点清理（如"就行"、"不行"、"什么铺"等）
  const junkPlaceRe = /^(?:院中|院子里|庭院|院里|院|屋里|屋中|房中|屋内|屋里头|厅上|堂中|门口|门外|就行|不行|可行|成行|得行|行不行|过去|过去看|过去坐|应付|对付|应付过去|看看|看一下|商量一下|知会一声)$/;
  for (const [id, pl] of Object.entries(world.places || {})) {
    if (!pl) continue;
    const nm = String(pl.name || '').trim();
    if (junkPlaceRe.test(nm)) {
      delete world.places[id];
      fixes.push(`清理垃圾地点「${nm}」(${id})`);
      for (const a of Object.values(world.actors || {})) {
        if (a && a.location === id) {
          a.location = a.id === 'husband' ? 'husband_room' : 'tea_house';
        }
      }
    }
  }

  // ⑥ 数组上限
  const trim = (key, max, label) => {
    if (Array.isArray(world[key]) && world[key].length > max) {
      const over = world[key].length - max;
      world[key] = world[key].slice(-max);
      fixes.push(`${label}超出上限，丢弃最旧 ${over} 条`);
    }
  };
  trim('pending', 8, '暗涌');
  trim('proactive', 8, '推送');
  trim('memories', 120, '记忆');
  trim('clues', 60, '线索');
  trim('appointments', 20, '约定');

  // ⑦ 陈旧约定（逾期超过两天）→ 当作失约处理，别永远挂着
  const nowHour = (Number(world.clock?.day) || 1) * 24 + (Number(world.clock?.hour) || 0);
  const stale = (world.appointments || []).filter(
    (a) => a && Number(a.day) * 24 + Number(a.hour) < nowHour - 48,
  );
  if (stale.length > 0) {
    world.appointments = (world.appointments || []).filter((a) => !stale.includes(a));
    fixes.push(`清理 ${stale.length} 条逾期两天以上的旧约定`);
  }

  // ⑦.5 承诺/暗涌的日期不能离谱（曾出现「还有 118 天」这种）
  const today = Number(world.clock?.day) || 1;
  for (const pr of world.promises || []) {
    const d = Number(pr.due);
    if (!Number.isFinite(d) || d < 0 || d > today + 30) {
      fixes.push(`承诺日期 ${pr.due} → ${today + 3}（${String(pr.text || '').slice(0, 10)}）`);
      pr.due = today + 3;
    }
  }
  for (const pd of world.pending || []) {
    const d = Number(pd.due);
    if (!Number.isFinite(d) || d < 0 || d > today + 30) {
      fixes.push(`暗涌日期 ${pd.due} → ${today + 7}`);
      pd.due = today + 7;
    }
  }

  // ⑧ 记忆里空文本
  if (Array.isArray(world.memories)) {
    const before = world.memories.length;
    world.memories = world.memories.filter((m) => m && String(m.text || '').trim());
    if (world.memories.length !== before) fixes.push(`清理 ${before - world.memories.length} 条空记忆`);
  }

  return fixes;
}
