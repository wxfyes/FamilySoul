/**
 * 聊天里的“世界动作”：买米、赌、走货、叫人、遣人、去某处。
 *
 * 单一入口：聊天流程调用一次，返回要告诉玩家的【提示】。
 * 模型只管说话，这些都不许模型直接改世界。
 */

import { moveActor } from './position.js';
import { buyRice, sellRice, gamble, bribeOfficials, ensureDen, stockOf } from './goods.js';
import { startTradeRun, startNightMarket, drainBizNotices } from './business.js';

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

  // 叫人来（单人 / 都来）
  const callAll = /(都|你们|大伙|全)[^。]{0,8}(来|过来|到.{0,4}(我|这)|回来)/.test(say);
  const mCall = /(?:让|叫|请|唤)\s*([\u4e00-\u9fa5]{2,4})\s*(?:来|到|过来|上前)/.exec(say);
  if (callAll || mCall) {
    const targets = callAll
      ? Object.values(world.actors || {}).filter((a) => a && !a.dead && a.id !== me.id && isKin(a))
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
  }

  return notices;
}
