/**
 * 兵权与夺城：募兵、军饷、粮道、围城、城破易主。
 *
 * 全部是"条件与代价"，不写结果：
 *   · 募兵要钱要粮，兵多了每天吃粮发饷
 *   · 欠饷会掉士气，士气崩了会逃兵
 *   · 围城看双方战力与城防，谁赢由数字与运气定
 *
 * 唯一写入口：城的归属只在这里改（besiege），别处不许动 ct.owner。
 */

import { factionOf, factionSilver, spendFactionSilver, factionStrength, syncWangjiaToMilitary } from './factions.js';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (v) => Math.round(num(v) * 100) / 100;

/** 一名兵的募兵银与自带粮（石） */
export const RECRUIT_COST = 12;
export const RECRUIT_GRAIN = 0.5;

/** 每兵每日：军饷（两）与口粮（石） */
export const PAY_PER_DAY = 0.05;
export const GRAIN_PER_DAY = 0.02;

/**
 * 募兵
 * @returns {{ok:boolean, error?:string, troops?:number}}
 */
export function recruit(world, fid, count) {
  const f = factionOf(world, fid);
  if (!f) return { ok: false, error: '没有这个势力' };
  const n = Math.max(1, Math.min(500, Math.round(num(count))));
  const cost = round2(n * RECRUIT_COST);
  const needGrain = round2(n * RECRUIT_GRAIN);

  if (num(f.grain) < needGrain) return { ok: false, error: `粮不够：要 ${needGrain} 石，手头 ${round2(f.grain)} 石` };
  if (!spendFactionSilver(world, f, cost)) {
    return { ok: false, error: `银不够：募 ${n} 兵要 ${cost} 两，手头 ${round2(factionSilver(world, f))} 两` };
  }

  f.troops = Math.round(num(f.troops) + n);
  f.grain = round2(num(f.grain) - needGrain);
  f.morale = Math.min(100, Math.round(num(f.morale) + 1));
  if (f.id === 'wangjia') syncWangjiaToMilitary(world);
  return { ok: true, troops: f.troops, cost };
}

/** 征粮：拿银子换粮（市价随城价浮动） */
export function buyGrain(world, fid, shi) {
  const f = factionOf(world, fid);
  if (!f) return { ok: false, error: '没有这个势力' };
  const amount = Math.max(1, Math.min(2000, Math.round(num(shi))));
  const price = 0.6; // 每石作价 0.6 两（地方粮价高时贵，这里取常价）
  const cost = round2(amount * price);
  if (!spendFactionSilver(world, f, cost)) return { ok: false, error: `银不够：买 ${amount} 石要 ${cost} 两` };
  f.grain = round2(num(f.grain) + amount);
  if (f.id === 'wangjia') syncWangjiaToMilitary(world);
  return { ok: true, grain: f.grain, cost };
}

/**
 * 每日军需：发饷、吃粮、欠饷逃兵
 * 由时钟每日调用一次，返回事件列表（供 world 时间线显示）
 */
export function runMilitaryDay(world, events) {
  const out = [];
  for (const f of Object.values(world.factions || {})) {
    if (!f || num(f.troops) <= 0) continue;
    const troops = Math.round(num(f.troops));
    const pay = round2(troops * PAY_PER_DAY);
    const grainNeed = round2(troops * GRAIN_PER_DAY);

    let paid = false;
    let fed = false;
    if (num(f.grain) >= grainNeed) {
      f.grain = round2(num(f.grain) - grainNeed);
      fed = true;
    }
    if (spendFactionSilver(world, f, pay)) paid = true;

    if (paid && fed) {
      f.morale = Math.min(100, Math.round(num(f.morale) + 1));
    } else {
      f.morale = Math.max(0, Math.round(num(f.morale) - (paid ? 3 : 6)));
      if (!fed) {
        allEvent(out, world, { action: 'army_hungry', actor: f.leader, place: null, payload: { text: `${f.name}军中缺粮，士气跌落` } });
      }
      if (!paid) {
        allEvent(out, world, { action: 'army_unpaid', actor: f.leader, place: null, payload: { text: `${f.name}欠饷，营中怨声四起` } });
      }
    }

    // 士气崩 → 逃兵
    if (num(f.morale) < 25 && Math.random() < 0.5) {
      const flee = Math.max(1, Math.round(troops * 0.1));
      f.troops = Math.max(0, troops - flee);
      f.morale = 30;
      allEvent(out, world, { action: 'desert', actor: f.leader, place: null, payload: { text: `${f.name}营中逃兵 ${flee} 人` } });
    }

    if (f.id === 'wangjia') syncWangjiaToMilitary(world);
  }
  return out;
}

function allEvent(out, world, ev) {
  out.push(ev);
  eventSink?.(world, ev);
}

// 由 clock 注册：把战斗/军需事件写进世界事件流
let eventSink = null;
export function setWarEventSink(fn) {
  eventSink = fn;
}

/**
 * 围城：攻方带兵若干，打一座城。
 * 城防 = 城的 defense + 守军（owner 所属势力的兵按城均摊）
 */
export function besiege(world, { attacker, cityName, troops }) {
  const f = factionOf(world, attacker);
  if (!f) return { ok: false, error: '没有这个势力' };
  const ct = world.cities?.[cityName];
  if (!ct) return { ok: false, error: '没有这座城' };
  if (String(ct.owner || 'court') === attacker) return { ok: false, error: '这是你自己的城' };

  const send = Math.max(1, Math.min(Math.round(num(troops)), Math.round(num(f.troops))));
  if (send < 1) return { ok: false, error: '你没有兵' };

  const defenderId = String(ct.owner || 'court');
  const defender = factionOf(world, defenderId);
  const defense = Math.round((num(ct.defense) || 10) + (num(ct.garrison) || 0) * 1.2);
  const attackPower = Math.round(factionStrength(world, f) * (send / Math.max(1, num(f.troops))));
  const roll = 0.8 + Math.random() * 0.5;          // 战场运气
  const win = attackPower * roll > defense;

  f.troops = Math.max(0, round2(num(f.troops) - send));
  // 兵死了就死了，不论胜负
  f.troops = Math.max(0, Math.round(num(f.troops) + (win ? Math.round(send * 0.75) : 0)));

  if (win) {
    ct.owner = attacker;
    ct.defense = Math.max(5, Math.round(defense * 0.6));
    ct.unrest = Math.min(100, (num(ct.unrest) || 0) + 10);
    f.morale = Math.min(100, Math.round(num(f.morale) + 5));
    f.cities = Array.isArray(f.cities) ? f.cities : [];
    if (!f.cities.includes(cityName)) f.cities.push(cityName);
    if (defender) defender.cities = (defender.cities || []).filter((c) => c !== cityName);
    if (f.id === 'wangjia') syncWangjiaToMilitary(world);
    return {
      ok: true, win: true, attackPower, defense,
      text: `${f.name}破${cityName}，城易主`,
    };
  }

  ct.defense = Math.min(80, Math.round(defense * 0.85));
  f.morale = Math.max(0, Math.round(num(f.morale) - 8));
  if (f.id === 'wangjia') syncWangjiaToMilitary(world);
  return {
    ok: true, win: false, attackPower, defense,
    text: `${f.name}攻${cityName}不下，折兵而退`,
  };
}

/** 守城：给自己名下的城建防（花银子） */
export function fortify(world, fid, cityName, amount = 200) {
  const f = factionOf(world, fid);
  const ct = world.cities?.[cityName];
  if (!f || !ct) return { ok: false, error: '没有这个势力或这座城' };
  if (String(ct.owner || 'court') !== fid) return { ok: false, error: '不是你的城' };
  const cost = Math.round(num(amount));
  if (!spendFactionSilver(world, f, cost)) return { ok: false, error: `银不够：修城要 ${cost} 两` };
  ct.defense = Math.min(90, Math.round((num(ct.defense) || 10) + 6));
  return { ok: true, defense: ct.defense, cost };
}

/** 招降：城里有守军时，花钱买通守将（失败则守军更警觉） */
export function bribeCity(world, fid, cityName, amount = 300) {
  const f = factionOf(world, fid);
  const ct = world.cities?.[cityName];
  if (!f || !ct) return { ok: false, error: '没有这个势力或这座城' };
  if (String(ct.owner || 'court') === fid) return { ok: false, error: '这是你自己的城' };
  const cost = Math.round(num(amount));
  if (!spendFactionSilver(world, f, cost)) return { ok: false, error: `银不够：疏通要 ${cost} 两` };
  const success = Math.random() < 0.45;
  if (success) {
    ct.owner = fid;
    ct.unrest = Math.min(100, (num(ct.unrest) || 0) + 4);
    f.cities = Array.isArray(f.cities) ? f.cities : [];
    if (!f.cities.includes(cityName)) f.cities.push(cityName);
    return { ok: true, win: true, text: `${cityName}守将纳款开城，归${f.name}` };
  }
  ct.defense = Math.min(90, Math.round((num(ct.defense) || 10) + 3));
  return { ok: true, win: false, text: `${cityName}守将收了银子却不认账，城防更严` };
}
