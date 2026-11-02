/**
 * 人物关系网：世界里的每个人彼此之间也有关系，不只是对相公。
 *
 * bonds[actorId][otherId] = { type, score }
 *   type: 夫妻/妻妾/主仆/母女/父子/同僚/街坊/同行/旧识/仇家/亲戚
 *   score: -100 ~ 100（越负越敌对）
 *
 * 目前来源：住在一起、同一衙门、同一条街、同一行当——先由结构推出来，
 * 之后可以交给天道补（认亲、结仇、拜把子），但结构得先立住。
 */

const SPOUSE_WORDS = /正妻|如夫人|妾|妻/;
const SERVANT_WORDS = /丫鬟|小厮|仆|随从|跟班/;
const OFFICIAL_WORDS = /知府|县令|知县|尚书|宰相|天子|巡抚|统领|典吏|书吏|衙役/;
const SHOP_WORDS = /掌柜|东家|老板|伙计|摊|屠|铁匠|郎中|老鸨/;

function placeOf(world, id) {
  return world?.actors?.[id]?.location || null;
}

function addBond(world, a, b, type, score) {
  if (!a || !b || a === b) return;
  world.bonds = world.bonds && typeof world.bonds === 'object' ? world.bonds : {};
  world.bonds[a] = world.bonds[a] || {};
  world.bonds[b] = world.bonds[b] || {};
  const cur = world.bonds[a][b];
  if (cur && Math.abs(cur.score) >= Math.abs(score)) return;
  world.bonds[a][b] = { type, score };
  world.bonds[b][a] = { type, score };
}

/** 按结构推导关系（幂等，可反复跑） */
export function ensureBonds(world) {
  const actors = Object.values(world?.actors || {}).filter((a) => a && !a.dead);
  if (!actors.length) return world;
  world.bonds = world.bonds || {};

  // ① 同一屋檐下：夫妻 / 主仆
  const byHome = {};
  for (const a of actors) {
    const home = a.home || a.location;
    if (!home) continue;
    (byHome[home] = byHome[home] || []).push(a);
  }
  for (const [home, group] of Object.entries(byHome)) {
    const masters = group.filter((a) => a.id !== 'husband' && !SERVANT_WORDS.test(String(a.role || '')));
    const servants = group.filter((a) => SERVANT_WORDS.test(String(a.role || '')));
    // 同一宅里的女主人之间：妻妾
    const ladies = masters.filter((a) => a.gender === 'female' && SPOUSE_WORDS.test(String(a.role || '')));
    for (let i = 0; i < ladies.length; i += 1) {
      for (let j = i + 1; j < ladies.length; j += 1) {
        // 正妻与二房天然有点较劲
        const score = /正妻/.test(String(ladies[i].role || '')) ? -10 : -10;
        addBond(world, ladies[i].id, ladies[j].id, '妻妾', score);
      }
    }
    // 主仆
    for (const s of servants) {
      for (const m of masters) addBond(world, s.id, m.id, '主仆', 35);
    }
  }

  // ② 同一衙门：同僚
  for (const a of actors) {
    for (const b of actors) {
      if (a.id >= b.id) continue;
      if (!OFFICIAL_WORDS.test(String(a.role || '')) || !OFFICIAL_WORDS.test(String(b.role || ''))) continue;
      const samePlace = placeOf(world, a.id) && placeOf(world, a.id) === placeOf(world, b.id);
      addBond(world, a.id, b.id, '同僚', samePlace ? 25 : 10);
    }
  }

  // ③ 同一条街上的生意人：街坊/同行
  for (const a of actors) {
    for (const b of actors) {
      if (a.id >= b.id) continue;
      if (!SHOP_WORDS.test(String(a.role || '')) || !SHOP_WORDS.test(String(b.role || ''))) continue;
      if (placeOf(world, a.id) !== placeOf(world, b.id)) continue;
      const sameTrade = String(a.role || '') === String(b.role || '');
      addBond(world, a.id, b.id, sameTrade ? '同行' : '街坊', sameTrade ? -15 : 15);
    }
  }

  return world;
}

/** 关系变动向亲近的人传导：她怨相公，她的亲人也会跟着冷几分 */
export function propagateMood(world, actorId, delta) {
  const mine = world.bonds?.[actorId];
  if (!mine || !delta) return;
  for (const [otherId, bond] of Object.entries(mine)) {
    if (!bond || Math.abs(bond.score) < 20) continue; // 关系一般的不传
    const other = world.actors?.[otherId];
    if (!other || other.dead) continue;
    other.relations = other.relations || {};
    const rel = other.relations.husband || { trust: 30, desire: 0, fear: 0, grievance: 0 };
    const share = Math.round(delta * (bond.score > 0 ? 0.3 : -0.2) * 10) / 10;
    rel.grievance = Math.max(0, Math.min(100, (Number(rel.grievance) || 0) + share));
    other.relations.husband = rel;
  }
}

/** 给上下文用：在场的人彼此是什么关系 */
export function describeBonds(world, ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const bond = world.bonds?.[ids[i]]?.[ids[j]];
      if (!bond) continue;
      const a = world.actors?.[ids[i]]?.name;
      const b = world.actors?.[ids[j]]?.name;
      if (!a || !b) continue;
      out.push(`${a}与${b}：${bond.type}（${bond.score > 0 ? '亲近' : bond.score < 0 ? '不对付' : '平平'}）`);
    }
  }
  return out;
}
