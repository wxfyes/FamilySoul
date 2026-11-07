/**
 * 聊天里的“世界动作”：买米、赌、走货、叫人、遣人、去某处。
 *
 * 单一入口：聊天流程调用一次，返回要告诉玩家的【提示】。
 * 模型只管说话，这些都不许模型直接改世界。
 */

import { moveActor } from './position.js';
import { buyRice, sellRice, gamble, bribeOfficials, ensureDen, stockOf } from './goods.js';
import { startTradeRun, startNightMarket, drainBizNotices } from './business.js';
import { ensureItems, itemsOf, findItem, giveItem } from './items.js';
import { hireStaff } from './employment.js';
import { fallbackName } from './migration.js';
import { detachmentStrength } from './factions.js';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const cn2num = (raw) => {
  const t = String(raw || '').trim();
  if (/^\d+$/.test(t)) return Number(t);
  const d = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  let total = 0; let cur = 0;
  for (const ch of t) {
    if (d[ch] != null) cur = d[ch];
    else if (ch === '十') { total += (cur || 1) * 10; cur = 0; }
    else if (ch === '百') { total += (cur || 1) * 100; cur = 0; }
  }
  return total + cur;
};

const NUM = '[\\d一二两三四五六七八九十百千]+';

const hallOf = (world) => Object.keys(world.places || {}).find((id) => /议事厅/.test(String(world.places[id]?.name || '')))
  || Object.keys(world.places || {}).find((id) => /中堂|大厅|门厅/.test(String(world.places[id]?.name || '')));

const findByName = (world, name) => {
  const said = String(name || '').trim();
  if (!said) return null;
  return Object.values(world.actors || {}).find((a) => a && !a.dead && a.name
    && (a.name === said || a.name.endsWith(said) || (said.length > 2 && said.endsWith(a.name))));
};

const isOuterStaff = (a) => /家丁|护院|门房|小厮|马夫|车夫|脚夫/.test(String(a?.role || ''));
const isKin = (a) => String(a?.spouse || '') === 'husband' || /正妻|如夫人|二房|侧室|妾|通房|丫鬟|婆子|嬷嬷/.test(String(a?.role || ''));
const homeOf = (a) => a?.home || a?.quarters || null;

/**
 * @returns {string[]} 提示行（不含【提示】前缀）
 */
export function applyChatActions({ world, viewerId = 'husband', sayText = '' }) {
  const notices = [];
  const say = String(sayText || '');
  const me = world.actors?.[viewerId] || world.actors?.husband;
  if (!me) return notices;
  const day = num(world.clock?.day) || 1;

  // 买米 / 卖米
  const mBuy = new RegExp(`买\\s*(${NUM})\\s*([斗石])`).exec(say);
  if (mBuy) {
    const qty = cn2num(mBuy[1]) * (mBuy[2] === '石' ? 10 : 1);
    const r = buyRice(world, me.id, qty);
    notices.push(String(r.line || '').replace(/^（|）$/g, ''));
  }
  const mSell = new RegExp(`卖\\s*(${NUM})`).exec(say);
  if (mSell && stockOf(world, me.id) > 0) {
    const r = sellRice(world, me.id, cn2num(mSell[1]));
    notices.push(String(r.line || '').replace(/^（|）$/g, ''));
  }

  // 赌 / 打点
  const mGamble = new RegExp(`(?:赌|押)\\s*(?:一把)?\\s*(${NUM})\\s*两`).exec(say);
  if (mGamble) {
    const city = (() => { const seg = String(world.places?.[me.location]?.name || '').split('·')[0]; return /府$|州$|县$/.test(seg) ? seg : '临江府'; })();
    ensureDen(world, city);
    const r = gamble(world, me.id, cn2num(mGamble[1]));
    notices.push(String(r.line || '').replace(/^（|）$/g, ''));
  }
  if (/打点(官府|衙门)/.test(say)) {
    const mB = new RegExp(`(${NUM})\\s*两`).exec(say);
    const r = bribeOfficials(world, me.id, mB ? cn2num(mB[1]) : 10);
    notices.push(String(r.line || '').replace(/^（|）$/g, ''));
  }

  // 走货 / 夜市
  if (/(走货|押一船|进一批茶|发一船货)/.test(say)) {
    const mCap = new RegExp(`(${NUM})\\s*两`).exec(say);
    const r = startTradeRun(world, me.id, mCap ? cn2num(mCap[1]) : 50);
    notices.push(String(r.line || '').replace(/^（|）$/g, ''));
  }
  if (/夜市|夜场|开夜/.test(say)) {
    const r = startNightMarket(world, me.id, 8);
    notices.push(String(r.line || '').replace(/^（|）$/g, ''));
  }
  for (const n of drainBizNotices(world)) notices.push(n.text);

  // 都到议事厅
  if (/(都|全|所有人|你们)[^。]{0,6}(到|去)[^。]{0,4}(议事厅|厅上|前厅)/.test(say)) {
    const hall = hallOf(world);
    const names = [];
    if (hall) {
      for (const a of Object.values(world.actors || {})) {
        if (!a || a.dead || a.id === me.id || a.location !== me.location) continue;
        if (!isOuterStaff(a)) continue;
        const mv = moveActor(world, a.id, hall, 'world', '厅上候令');
        if (mv?.ok) names.push(a.name);
      }
    }
    if (names.length) notices.push(`${names.join('、')}都到议事厅去了。`);
    else notices.push('（厅上此刻没有当差的人。）');
  }

  // 都出去，某某留下 / 清场
  const clearAll = /(都|你们)[^。]{0,4}(出去|退下|散了|回房|回去)/.test(say) || /都出去/.test(say);
  const keepM = /留下\s*([\u4e00-\u9fa5]{2,4})|([\u4e00-\u9fa5]{2,4})\s*留下/.exec(say);
  const keepActor = keepM ? findByName(world, keepM[1] || keepM[2]) : null;
  if (clearAll) {
    const names = [];
    for (const a of Object.values(world.actors || {})) {
      if (!a || a.dead || a.id === me.id || a.location !== me.location) continue;
      if (keepActor && a.id === keepActor.id) continue;
      const back = isKin(a) ? (homeOf(a) || a.location) : (a.home || a.quarters || hallOf(world));
      if (!back || !world.places?.[back] || back === a.location) continue;
      const mv = moveActor(world, a.id, back, 'world', '送客离场');
      if (mv?.ok) names.push(a.name);
    }
    if (names.length) notices.push(`${names.join('、')}起身告辞，退了出去。`);
  }

  // 让/叫 某人 出去/回房/回去
  const mDismiss = /(?:让|叫|请|命|打发)\s*([\u4e00-\u9fa5]{2,4})\s*(?:先)?\s*(?:出去|退下|回房|回屋|回去|走吧)/.exec(say);
  if (mDismiss) {
    const who = findByName(world, mDismiss[1]);
    if (who && who.location === me.location) {
      const back = homeOf(who) || who.location;
      if (back && world.places?.[back] && back !== who.location) {
        const mv = moveActor(world, who.id, back, 'world', '送客离场');
        if (mv?.ok) notices.push(`${who.name}起身告辞，回${world.places[back].name}去了。`);
      }
    }
  }

  // 让某人去某处
  const mSend = /(?:让|叫|命|打发|请)\s*([\u4e00-\u9fa5]{2,4})\s*(?:先)?\s*(?:去|到|往|回)\s*([\u4e00-\u9fa5]{2,8})/.exec(say);
  if (mSend) {
    const who = findByName(world, mSend[1]);
    if (who) {
      const hint = mSend[2];
      const dest = Object.keys(world.places || {}).find((id) => String(world.places[id]?.name || '').includes(hint));
      const target = /议事厅|厅上/.test(hint) ? (hallOf(world) || dest) : dest;
      if (target && target !== who.location) {
        const mv = moveActor(world, who.id, target, 'world', '听命往某处');
        if (mv?.ok) notices.push(`${who.name}去了${world.places[target].name}。`);
      }
    }
  }

  // 叫护院家丁（当差的）：从宅里各处提到议事厅
  if (/(护院|家丁|当差|当值|门房)/.test(say) && /(叫|来|进来|传|提|人呢)/.test(say)) {
    const hall = hallOf(world);
    const hereName = String(world.places?.[me.location]?.name || '');
    const estate = hereName.includes('·') ? hereName.split('·').slice(0, 2).join('·') : '';
    // 只提当值的这一班：最多 8 人，其余照旧守各处
    const candidates = Object.values(world.actors || {}).filter((a) => {
      if (!a || a.dead || a.id === me.id) return false;
      if (!isOuterStaff(a)) return false;
      if (a.location === hall) return false;
      const pn = String(world.places?.[a.location]?.name || '');
      const hn = String(world.places?.[a.home]?.name || '');
      return pn.startsWith(estate) || hn.startsWith(estate);
    }).slice(0, 8);
    const names = [];
    for (const a of candidates) {
      const mv = hall ? moveActor(world, a.id, hall, 'world', '厅上候令') : { ok: false };
      if (mv?.ok) names.push(a.name);
    }
    notices.push(names.length
      ? `${names.join('、')}共 ${names.length} 人到了议事厅候令（其余照旧守各处）。`
      : '（宅里此刻没有当差的护院家丁。）');
  }

  // 叫人来（单人 / 都来）
  const staffWords = /护院|家丁|当差|当值|门房/.test(say);
  const callAll = !staffWords && /(都|你们|大伙|全)[^。]{0,8}(来|过来|到.{0,4}(我|这)|回来)/.test(say);
  const mCall = /(?:让|叫|请|唤)\s*([\u4e00-\u9fa5]{2,4})\s*(?:来|到|过来|上前)/.exec(say);
  if (callAll || mCall) {
    const hereName0 = String(world.places?.[me.location]?.name || '');
    const estate0 = hereName0.includes('·') ? hereName0.split('·').slice(0, 2).join('·') : '';
    const isMyKin = (a) => (String(a.spouse || '') === 'husband' && /正妻|如夫人|二房|侧室|妾|通房|丫鬟/.test(String(a.role || '')))
      || (estate0 && String(world.places?.[a.home]?.name || '').startsWith(estate0)
        && /正妻|如夫人|二房|侧室|妾|通房|丫鬟/.test(String(a.role || '')));
    const targets = callAll
      ? Object.values(world.actors || {}).filter((a) => a && !a.dead && a.id !== me.id && isMyKin(a)).slice(0, 8)
      : [findByName(world, mCall?.[1])].filter(Boolean);
    const names = [];
    for (const a of targets) {
      if (!a || a.location === me.location) continue;
      const dest = isOuterStaff(a) ? (hallOf(world) || me.location) : me.location;
      if (!dest) continue;
      const mv = moveActor(world, a.id, dest, 'world', '叫到跟前');
      if (mv?.ok) names.push(isOuterStaff(a) ? `${a.name}（厅上）` : a.name);
    }
    if (names.length) notices.push(`${names.join('、')}都到了跟前。`);
    else if (callAll) notices.push('（内眷已经在跟前了。）');
  }


  // 雇掌柜/伙计：东家出钱，掌柜管店
  if (/(雇|请|聘)(一个|个|一名|位)?\s*(掌柜|二掌柜|伙计|跑堂|账房)/.test(say)) {
    const want = /账房/.test(say) ? '账房' : (/掌柜/.test(say) ? '掌柜' : (/跑堂/.test(say) ? '跑堂' : '伙计'));
    const prop = (world.assets?.properties || []).find((p) => p && String(p.name || '').includes(String(say).replace(/.*(?:雇|请|聘)/, '').trim().slice(0, 2)));
    const target = prop || (world.assets?.properties || [])[0];
    if (!target) {
      notices.push('（名下没有铺子，雇了人也无处安。）');
    } else if (want === '掌柜' && Object.values(world.actors || {}).some((a) => a && !a.dead && a.location === target.place && /掌柜/.test(String(a.role || '')))) {
      notices.push(`（${target.name}已经有掌柜了。）`);
    } else {
      const nm = fallbackName(world, 'male');
      const r = hireStaff(world, { propName: target.name, name: nm, role: want, hiredBy: me.id });
      if (r?.ok) {
        const staffActor = Object.values(world.actors || {}).find((a) => a && a.name === nm);
        if (staffActor) staffActor.location = target.place || staffActor.location;
        target.staff = (Number(target.staff) || 0) + 1;
        notices.push(`请了 ${nm} 到 ${target.name} 当${want}。`);
        world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
        world.ledger.push({ day, hour: world.clock?.hour || 0, delta: -0.5, title: `雇佣${want}`, by: 'husband', balance: (Number(world.assets?.silver) || 0) });
        world.assets.silver = Math.round(((Number(world.assets.silver) || 0) - 0.5) * 100) / 100;
      } else {
        notices.push(`（${r?.error || '没雇成'}。）`);
      }
    }
  }

  // 给东西：给/赏/送 某人 某物
  {
    const mGive = /(?:给|赏|送|递)\s*([\u4e00-\u9fa5]{2,4})\s*(?:一[份张封件])?\s*([\u4e00-\u9fa5]{2,12})/.exec(say);
    if (mGive) {
      const who = findByName(world, mGive[1]);
      if (!who) {
        notices.push(`（没找到「${mGive[1]}」这个人。）`);
      } else if (who.location !== me.location) {
        notices.push(`（${who.name}不在跟前，东西递不过去。）`);
      } else {
        const it = findItem(world, me.id, mGive[2]) || itemsOf(world, me.id).find((x) => mGive[2].includes(x.name.slice(-2)));
        if (it) {
          const r = giveItem(world, me.id, who.id, it.id);
          if (r.ok) notices.push(r.line.replace(/^（|）$/g, ''));
        } else {
          notices.push(`（你手里没有「${mGive[2]}」这件东西。）`);
        }
      }
    }
  }

  // 要东西：向/问 某人 要 某物
  {
    const mAsk = /(?:向|问|跟)\s*([\u4e00-\u9fa5]{2,4})\s*(?:要|讨|索取)\s*([\u4e00-\u9fa5]{2,12})/.exec(say);
    if (mAsk) {
      const who = findByName(world, mAsk[1]);
      if (who) {
        const it = findItem(world, who.id, mAsk[2]);
        if (!it) {
          notices.push(`（${who.name}手里没有「${mAsk[2]}」。）`);
        } else {
          const trust = Number(who.relations?.[me.id]?.trust ?? who.relations?.husband?.trust ?? 0);
          const willing = trust >= 20 || String(who.spouse || '') === me.id || /正妻|如夫人|侧室|丫鬟/.test(String(who.role || ''));
          if (!willing) {
            notices.push(`（${who.name}没应声，把那件东西往身后收了收。）`);
          } else {
            const r = giveItem(world, who.id, me.id, it.id);
            if (r.ok) notices.push(`（${who.name}把《${it.name}》递了过来。）`);
          }
        }
      }
    }
  }

  // 开房住店：真开一间上房（地点），把人挪进去
  if (/(开|要|住)(一间|间|个)?(上房|房间|房)|住店/.test(say)) {
    const curName = String(world.places?.[me.location]?.name || '');
    const innId = Object.keys(world.places || {}).find((id) => {
      const n = String(world.places[id]?.name || '');
      return /客栈/.test(n) && (curName.startsWith(n) || n.startsWith(curName.split('·')[0]));
    });
    const innName = String(world.places?.[innId]?.name || '客栈');
    const fee = 0.1;
    const purse = Number(world.assets?.silver) || 0;
    if (purse < fee) {
      notices.push(`（上房一晚 ${fee.toFixed(2)} 两，手头不够。）`);
    } else {
      let roomId = Object.keys(world.places || {}).find((id) => String(world.places[id]?.name || '') === `${innName}·上房`);
      if (!roomId) {
        world.flags = world.flags || {};
        world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;
        roomId = `place_${world.flags.placeSeq}`;
        world.places[roomId] = { id: roomId, name: `${innName}·上房`, exits: innId ? [innId] : ['street'], parent: innId || null, use: 'room', dynamic: true };
        if (innId && world.places[innId]) {
          world.places[innId].exits = Array.isArray(world.places[innId].exits) ? world.places[innId].exits : [];
          if (!world.places[innId].exits.includes(roomId)) world.places[innId].exits.push(roomId);
        }
      }
      world.assets.silver = Math.round((purse - fee) * 100) / 100;
      world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
      world.ledger.push({ day, hour: world.clock?.hour || 0, delta: -fee, title: '客栈上房', by: 'husband', balance: world.assets.silver });
      world.flags = world.flags || {};
      world.flags.lodging = { place: roomId, day };
      moveActor(world, me.id, roomId, 'world', '开房入住');
      notices.push(`上房开好了：${world.places[roomId].name}，一晚 ${fee.toFixed(2)} 两，今夜就在此处歇下。`);
    }
  }

  // 带护院出门：最多 4 人随行
  if (/(带|领|点)\s*([\d一二两三四五六七八九十]+\s*个?|几名|几个)?\s*(护院|家丁)|(护院|家丁)\s*(随我|随行|跟我)/.test(say)) {
    const hereName0 = String(world.places?.[me.location]?.name || '');
    const estate0 = hereName0.includes('·') ? hereName0.split('·').slice(0, 2).join('·') : '';
    const guards = Object.values(world.actors || {}).filter((a) => a && !a.dead
      && /护院|家丁/.test(String(a.role || ''))
      && (String(world.places?.[a.location]?.name || '').startsWith(estate0) || a.following === me.id));
    const names = [];
    for (const g of guards.slice(0, 4)) {
      g.following = me.id;
      const mv = moveActor(world, g.id, me.location, 'world', '随主出门');
      if (mv?.ok || g.location === me.location) names.push(g.name);
    }
    notices.push(names.length ? `${names.join('、')}随行在侧。` : '（府里没有可带的护院。）');
  }

  // 护院回府
  if (/(护院|家丁)[^。]{0,4}(回府|回去|回宅|散了)/.test(say) || /让他们回府/.test(say)) {
    const names = [];
    for (const g of Object.values(world.actors || {})) {
      if (!g || g.dead || g.following !== me.id) continue;
      g.following = null;
      const back = g.home || hallOf(world) || g.location;
      const mv = back && world.places?.[back] ? moveActor(world, g.id, back, 'world', '回府守宅') : { ok: false };
      if (mv?.ok) names.push(g.name);
    }
    if (names.length) notices.push(`${names.join('、')}回府去了。`);
  }

  // 剿匪：带出来的人 + 私兵一起打
  if (/(剿匪|打匪|清剿|平匪)/.test(say)) {
    const city = (() => { const seg = String(world.places?.[me.location]?.name || '').split('·')[0]; return /府$|州$|县$/.test(seg) ? seg : '临江府'; })();
    const bt = world.bandits?.[city] || Object.values(world.bandits || {}).find((x) => x && (
      x.city === city || x.homeCity === city || String(x.id || '').includes(city)
    ) && Number(x.strength) > 0);
    const strength = Number(bt?.strength || bt?.power || 0);
    const followers = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.following === me.id && /护院|家丁/.test(String(a.role || '')));
    const troops = Number(world.factions?.wangjia?.troops) || 0;
    if (!bt || strength <= 0) {
      notices.push(`（${city}眼下没有成股的匪患。）`);
    } else {
      // 与界面"出兵"同一把尺：按势力战力折算，随行护院另算
      const fw = world.factions?.wangjia;
      const total = Object.values(fw?.stationed || {}).reduce((s2, x) => s2 + (Number(x) || 0), 0);
      const send = Math.min(total, Math.max(1, Number(troops) || total));
      const power = detachmentStrength(world, fw, send) + followers.length * 3;
      const foe = strength * (bt.tier >= 3 ? 1.3 : bt.tier === 2 ? 1.1 : 1);
      const win = power * (0.85 + Math.random() * 0.4) > foe;
      if (win) {
        bt.strength = Math.max(0, Math.round(strength * (0.2 + Math.random() * 0.3)));
        const loot = Math.round((2 + Math.random() * 8) * 100) / 100;
        world.assets.silver = Math.round(((Number(world.assets.silver) || 0) + loot) * 100) / 100;
        world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
        world.ledger.push({ day, hour: world.clock?.hour || 0, delta: loot, title: '剿匪缴获', by: 'husband', balance: world.assets.silver });
        notices.push(`匪众被打散，缴获 ${loot.toFixed(2)} 两；带出去的 ${followers.length} 人俱在。`);
      } else {
        const hurt = followers.filter(() => Math.random() < 0.5);
        const died = hurt.filter(() => Math.random() < 0.25);
        for (const d of died) { d.dead = true; d.deathDay = day; d.deathCause = '剿匪阵亡'; d.following = null; }
        for (const h of hurt) { if (!h.dead) { h.woundedUntil = { day: day + 3 }; h.following = null; } }
        notices.push(`匪势凶悍，这趟没讨到好：${hurt.map((x) => x.name).join('、') || '随行'}受伤${died.length ? `，${died.map((x) => x.name).join('、')}没能回来` : ''}。`);
      }
    }
  }

  return notices;
}
