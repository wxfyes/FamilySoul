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
import { quellBandits } from './bandits.js';
import { callToArms, spawnMaids } from './warfare.js';
import { actorSeniority } from './turn-target.js';
import { materializeRoom } from './residence.js';
import { applyUnifiedIntents } from './intent-router.js';

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
  let say = String(sayText || '');
  const me = world.actors?.[viewerId] || world.actors?.husband;
  if (!me) return notices;
  const day = num(world.clock?.day) || 1;

  // 统一意图入口先拆句：招人/调人/约定提醒先办，办完的句子不再交给旧正则重复执行
  try {
    const routed = applyUnifiedIntents({ world, viewerId, sayText: say });
    if (routed.notices.length) notices.push(...routed.notices);
    if (routed.handled.length) say = routed.remainingText;
  } catch (err) {
    console.warn('[Intent] 统一意图失败：', err.message);
  }

  // 暗号赴约：先说对了暗号，人才会来
  for (const s of world.signals || []) {
    if (!s || s.active === false || !s.signal || !say.includes(String(s.signal))) continue;
    if (s.placeId && me.location !== s.placeId) continue;
    const who = world.actors?.[s.actorId];
    if (!who || who.dead) continue;
    const mv = moveActor(world, who.id, me.location, 'world', '暗号赴约');
    if (mv?.ok) {
      s.active = false;
      s.usedAt = { day, hour: num(world.clock?.hour) };
      notices.push(`（${who.name}听见暗号，从${s.placeName || '后门'}进来了。）`);
    } else {
      notices.push(`（暗号对上了，${who.name}却没能过来。）`);
    }
  }

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

  // 叫护院家丁（当差的）：从门房/宅里提到跟前/议事厅
  const isSummonQuestionOrChat = /(不|别|莫|休|未|否|慢|暂|再议|以后|先不|免|算了吧|用不着|不用|吗|呢|吧|？|\?|听说|问问|怎么|为何|不见|查查)/.test(say);
  const mStaff = /(?:进来|叫|唤|传|提|叫来|唤来|吩咐|命|来)\s*(\d+|[一二两三四五六七八九十]+)?\s*(?:个|位|名)?\s*(护院|家丁|门房|小厮)|(?:护院|家丁|门房|小厮)[^。！？\n]{0,6}(?:进来|过来|上前|上厅|候令|答话)/.exec(say);
  if (!isSummonQuestionOrChat && mStaff) {
    const wantCount = mStaff[1] ? cn2num(mStaff[1]) : 2;
    const isRetainer = /护院/.test(say);
    const targetPlace = me.location;
    const hereName = String(world.places?.[me.location]?.name || '');
    const estate = hereName.includes('·') ? hereName.split('·').slice(0, 2).join('·') : '临江·王宅';

    // 提当值的这一班：按相公吩咐的数量传唤
    const candidates = Object.values(world.actors || {}).filter((a) => {
      if (!a || a.dead || a.id === me.id) return false;
      if (!isOuterStaff(a)) return false;
      if (a.location === targetPlace) return false;
      if (isRetainer && !/护院/.test(String(a.role || ''))) return false;
      const pn = String(world.places?.[a.location]?.name || '');
      const hn = String(world.places?.[a.home]?.name || '');
      return pn.startsWith(estate) || hn.startsWith(estate) || a.location === 'husband_room__gate';
    });
    // 古风尊卑位次：领头人/长者优先被传唤走在最前
    candidates.sort((x, y) => actorSeniority(y) - actorSeniority(x));
    const picked = candidates.slice(0, Math.max(1, Math.min(8, wantCount)));

    const names = [];
    for (const a of picked) {
      const mv = moveActor(world, a.id, targetPlace, 'world', '厅上候令');
      if (mv?.ok) names.push(a.name);
    }
    if (names.length) {
      const pName = world.places?.[targetPlace]?.name || '厅上';
      notices.push(`${names.join('、')}躬身快步进了${pName}候令。`);
    } else {
      notices.push('（门房眼下没有空闲当差的护院家丁。）');
    }
  }

  // 叫人来（单人 / 都来）
  const staffWords = /护院|家丁|当差|当值|门房/.test(say);
  const callAll = !staffWords && /(都|你们|大伙|全)[^。]{0,8}(来|过来|到.{0,4}(我|这)|回来)/.test(say);
  const mCall = /(?:让|叫|请|唤|去叫|去请|去喊|去把|把)\s*([\u4e00-\u9fa5]{2,4})\s*(?:叫来|请来|喊来|来|到|过来|上前)/.exec(say)
    || /([\u4e00-\u9fa5]{2,4})\s*(?:叫来|请来|喊来|过来|上前)/.exec(say)
    || /(?:去|让|叫|请|派)[^，。]{0,8}?(?:叫|请|喊)\s*([\u4e00-\u9fa5]{2,4})/.exec(say);
  const callIsQuestion = /[吗呢]\s*[？?]?\s*$/.test(say.trim());
  if (!callIsQuestion && (callAll || mCall)) {
    const hereName0 = String(world.places?.[me.location]?.name || '');
    const estate0 = hereName0.includes('·') ? hereName0.split('·').slice(0, 2).join('·') : '';
    const isMyKin = (a) => (String(a.spouse || '') === 'husband' && /正妻|如夫人|二房|侧室|妾|通房|丫鬟/.test(String(a.role || '')))
      || (estate0 && String(world.places?.[a.home]?.name || '').startsWith(estate0)
        && /正妻|如夫人|二房|侧室|妾|通房|丫鬟/.test(String(a.role || '')));
    const targets = callAll
      ? Object.values(world.actors || {}).filter((a) => a && !a.dead && a.id !== me.id && isMyKin(a)).slice(0, 8)
      : [findByName(world, mCall?.[1])].filter(Boolean);
    const names = [];
    let triedMove = 0;
    for (const a of targets) {
      if (!a || a.location === me.location) continue;
      const dest = isOuterStaff(a) ? (hallOf(world) || me.location) : me.location;
      if (!dest) continue;
      triedMove += 1;
      const mv = moveActor(world, a.id, dest, 'world', '叫到跟前');
      if (mv?.ok) names.push(isOuterStaff(a) ? `${a.name}（厅上）` : a.name);
    }
    if (names.length) notices.push(`${names.join('、')}都到了跟前。`);
    else if (callAll) notices.push('（内眷已经在跟前了。）');
    else if (triedMove > 0) notices.push('（人没能到跟前；若是真人，只能去找她。）');
  }


  // 领路去私密处：在场的人跟着一起走，绝不只搬相公
  if (/(带我去|领我去|领路|跟我来|随我去|去喝茶|去雅间|清静账房|找个没人的地方|换个地方)/.test(say)) {
    const here = Object.values(world.actors || {}).filter(
      (a) => a && !a.dead && a.id !== me.id && a.location === me.location,
    );
    let partner = here.find((a) => a.name && say.includes(a.name))
      || here.find((a) => (/老板娘/.test(say) && /老板娘/.test(String(a.role || '')))
        || (/掌柜|东家/.test(say) && /掌柜|东家/.test(String(a.role || ''))))
      || here.find((a) => a.household)
      || here.find((a) => !a.servant)
      || here[0];
    if (partner) {
      let target = null;
      let label = '';
      const wantPrivate = /(雅间|清静|没人的地方|私下|单独|包房|暖阁)/.test(say);
      // 出门去某类场所：默认去"大堂/前堂/正厅"，不是卧室/私房
      const publicRoomOf = (pid) => {
        const keys = pid === 'husband_room' ? ['hall', 'council', 'gate'] : ['front', 'f1', 'hall', 'main'];
        for (const key of keys) {
          const rec = world.places?.[pid]?.rooms?.[key];
          if (!rec) continue;
          let id = rec.id;
          if (!world.places?.[id]) {
            try { id = materializeRoom(world, pid, key) || id; } catch { /* 忽略 */ }
          }
          if (world.places?.[id]) return id;
        }
        return null;
      };
      // 货栈后门是暗号约定的落点，必须能一句话走到
      if (!target && /后门/.test(say)
        && (/货栈|翟家/.test(say) || me.location === 'goods_shop')
        && world.places?.['goods_shop__backdoor']) {
        target = 'goods_shop__backdoor';
        label = String(world.places['goods_shop__backdoor'].name || '翟家货栈·后门');
      }
      const venueAliases = [
        [/回家|回府|回宅|王宅/, 'husband_room'],
        [/茶坊|茶楼|茶肆|老店/, 'tea_house'],
        [/酒肆|酒馆/, 'wine_shop'],
        [/大酒楼|酒楼/, world.places?.place_44 ? 'place_44' : 'canal_restaurant'],
        [/客栈/, 'inn'],
      ];
      for (const [re, pid] of venueAliases) {
        if (!re.test(say) || !world.places?.[pid]) continue;
        target = (wantPrivate ? null : publicRoomOf(pid)) || pid;
        label = String(world.places?.[target]?.name || pid);
        break;
      }
      // 1) 先认"带我去某处"里的地名；说得出地名就去那儿，不再自作主张开雅间
      const destMatch = /(?:带我去|领我去|去|到|往)\s*([^，。！？\n]{2,12})/.exec(say);
      const destName = destMatch ? destMatch[1].replace(/(?:吧|啊|呀|嘛|一趟|走走|坐坐)$/g, '').trim() : '';
      if (!target && destName) {
        const hit = Object.entries(world.places || {}).find(([, p]) => p
          && (p.name === destName || (destName.length >= 2 && String(p.name || '').includes(destName))));
        if (hit) {
          target = hit[0];
          label = String(hit[1].name || destName);
        }
      }
      // 2) 没点名地名，才按当前场所找私密房间
      if (!target) {
        if (me.location === 'goods_shop' || partner.location === 'goods_shop') {
          target = 'goods_shop__office';
          label = '翟家货栈·清静账房';
        } else if (me.location === 'place_44' || partner.location === 'place_44') {
          target = 'place_44__f2';
          label = '运河码头三层大酒楼·二层雅阁';
        } else if (/王宅|正房/.test(String(world.places?.[me.location]?.name || ''))) {
          target = 'husband_room__study';
          label = '临江·王宅·书斋';
        } else {
          // 通用场所：任何有院子的铺/栈/宅/店，优先找现成雅间，没有就现开一间
          const cur = world.places?.[me.location];
          const rootId = String(cur?.parent || me.location);
          const root = world.places?.[rootId];
          if (root && /货栈|酒楼|茶坊|客栈|宅|府|院|铺|店|楼/.test(String(root.name || ''))) {
            const child = Object.entries(world.places || {}).find(([id, p]) => p && p.parent === rootId
              && id !== me.location && /雅间|账房|书斋|内室|后堂|暖阁|雅阁/.test(String(p.name || '')));
            target = child ? child[0] : `${rootId}__parlor`;
            label = child ? String(child[1].name) : `${root.name}·雅间`;
            if (!world.places[target]) {
              world.places[target] = {
                id: target, name: label, parent: rootId, use: 'room', access: 'private', exits: [rootId],
              };
            }
          }
        }
      }
      if (target) {
        if (!world.places[target]) {
          world.places[target] = {
            id: target,
            name: label,
            parent: target.startsWith('goods_shop') ? 'goods_shop' : (target.startsWith('place_44') ? 'place_44' : 'husband_room'),
            use: target.startsWith('goods_shop') ? 'office' : 'room',
            access: 'private',
            exits: [target.startsWith('goods_shop') ? 'goods_shop' : (target.startsWith('place_44') ? 'place_44' : 'husband_room')],
          };
        }
        const fromMe = me.location;
        const fromPartner = partner.location;
        const mvMe = moveActor(world, me.id, target, 'world', '领路转场');
        const mvPartner = moveActor(world, partner.id, target, 'world', '随行带路');
        if (mvMe?.ok && mvPartner?.ok) {
          notices.push(`（${partner.name}领相公到了「${label}」。）`);
        } else {
          if (mvMe?.ok && fromMe) moveActor(world, me.id, fromMe, 'world', '领路失败退回');
          if (mvPartner?.ok && fromPartner) moveActor(world, partner.id, fromPartner, 'world', '领路失败退回');
          notices.push(partner.humanBound
            ? `（${partner.name}是真人：在线或跨场所时只能去找她，不能同行。）`
            : '（同行没跟上，仍在原处。）');
        }
      }
    }
  }

  // 雇/添掌柜伙计：东家出钱，直接落到指定产业，不靠模型嘴上答应
  {
    const hireWord = /(雇|请|聘|添|增加|加|补|招|找)/.test(say);
    const roleHit = /(二掌柜|掌柜|伙计|跑堂|账房|厨子|琴娘|舞娘|头牌|花魁|琴师|歌女)/.exec(say);
    const namedCandidate = /(?:雇|请|聘|招)\s*([\u4e00-\u9fa5]{2,4})(?=\s*(?:来|当|做|任|到|去|管|掌|坐柜|看店))/.exec(say)?.[1] || '';
    const namedExists = namedCandidate && Object.values(world.actors || {}).some((a) => a && a.name === namedCandidate);
    if (hireWord && roleHit && !namedExists) {
      // 一段话里说几种人，就分别招：两个琴娘、三个舞娘
      const roleSeq = [...say.matchAll(/(二掌柜|掌柜|伙计|跑堂|账房|厨子|琴娘|舞娘|头牌|花魁|琴师|歌女)/g)].map((m) => m[1]);
      const roles = [...new Set(roleSeq)];
      const roleCounts = roles.map((role) => {
        const m = new RegExp(`(\\d+|[一二两三四五六七八九十]+|几|数)\\s*(?:个|名|位|人)?\\s*${role}`).exec(say)
          || new RegExp(`${role}\\s*(\\d+|[一二两三四五六七八九十]+|几|数)\\s*(?:个|名|位|人)`).exec(say);
        const n = m ? (/几|数/.test(m[1]) ? 2 : Math.max(1, Math.min(10, cn2num(m[1])))) : 1;
        return { role, count: n };
      });
      // 指名请人：请陈敬堂当掌柜 / 雇刘二到粮铺当伙计 → 用这个名字，不再随机起名
      const hiredNamed = /(?:雇|请|聘|招)\s*([\u4e00-\u9fa5]{2,4})(?=\s*(?:来|当|做|任|到|去|管|掌|坐柜|看店))/.exec(say)?.[1] || '';
      const anyNamed = /(?:让|叫|找|用)\s*([\u4e00-\u9fa5]{2,4})(?=\s*(?:来|当|做|任|到|去|管|掌|坐柜|看店))/.exec(say)?.[1] || '';
      const knownNamed = Object.values(world.actors || {}).some((a) => a && a.name === anyNamed);
      const preferredName = hiredNamed || (anyNamed && !knownNamed ? anyNamed : '');
      const properties = Array.isArray(world.assets?.properties) ? world.assets.properties : [];
      const named = properties
        .filter((p) => p && p.name && (
          say.includes(String(p.name))
          || (String(p.name).length > 2 && say.includes(String(p.name).slice(-2)))
        ))
        .sort((a, b) => String(b.name).length - String(a.name).length)[0];
      // 相公就站在这间产业里，“找个掌柜”默认就是这一间
      const herePlace = me.location && world.places?.[me.location];
      const hereRoot = herePlace?.parent || me.location;
      const atHere = properties.find((p) => p && (
        p.placeId === me.location || p.placeId === hereRoot
        || String(world.places?.[p.placeId]?.parent || '') === hereRoot
      ));
      const target = named || atHere || (properties.length === 1 ? properties[0] : null);
      if (!target) {
        notices.push('（请相公说清是哪一间产业，名下铺子不止一处。）');
      } else {
        if (roles.includes('掌柜') && Object.values(world.actors || {}).some((a) => a && !a.dead
          && (a.location === target.placeId || String(world.places?.[a.location]?.parent || '') === target.placeId)
          && /掌柜/.test(String(a.role || '')))) {
          notices.push(`（${target.name}已经有掌柜了。）`);
        }
        const hires = [];
        for (const rc of roleCounts) {
          if (rc.role === '掌柜' && Object.values(world.actors || {}).some((a) => a && !a.dead
            && (a.location === target.placeId || String(world.places?.[a.location]?.parent || '') === target.placeId)
            && /掌柜/.test(String(a.role || '')))) continue;
          for (let i = 0; i < rc.count; i += 1) {
            const usePreferred = preferredName && hires.length === 0 && roles.length === 1
              && !/掌柜|伙计|跑堂|账房/.test(preferredName) && i === 0;
            const nm = usePreferred ? preferredName
              : fallbackName(world, /琴娘|舞娘|歌女|头牌|花魁|厨娘/.test(rc.role) ? 'female' : 'male');
            const r = hireStaff(world, { propName: target.name, name: nm, role: rc.role, hiredBy: me.id });
            if (r?.ok) hires.push({ name: nm, role: rc.role });
          }
        }
        if (hires.length) {
          const cost = Math.round(hires.length * 0.5 * 100) / 100;
          const purse = Number(world.assets?.silver) || 0;
          if (purse < cost) {
            notices.push(`（银不够：这支队伍要 ${cost.toFixed(2)} 两安家银。）`);
          } else {
            world.assets.silver = Math.round((purse - cost) * 100) / 100;
            world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
            const summary = roles.map((role) => `${role}${hires.filter((h) => h.role === role).length}人`).join('、');
            world.ledger.push({
              day, hour: world.clock?.hour || 0, delta: -cost,
              title: `${target.name}添${summary}·安家银`,
              by: 'husband', balance: world.assets.silver, category: '雇工',
            });
            notices.push(`${target.name}添了 ${hires.map((h) => h.name).join('、')}，分任${summary}，安家银共 ${cost.toFixed(2)} 两。`);
          }
        } else {
          notices.push(`（${target.name}没能添上人。）`);
        }
      }
    }
  }

  // 调人：让阿福去粮铺坐柜 / 派刘二到粮铺当伙计 —— 真移动、真入产业名册
  {
    const transferWord = /(让|叫|派|调|安排|请)/.test(say);
    if (transferWord) {
      const properties = Array.isArray(world.assets?.properties) ? world.assets.properties : [];
      const target = properties
        .filter((p) => p && p.name && (
          say.includes(String(p.name))
          || (String(p.name).length > 2 && say.includes(String(p.name).slice(-2)))
        ))
        .sort((a, b) => String(b.name).length - String(a.name).length)[0];
      if (target?.placeId && world.places?.[target.placeId]) {
        const actor = Object.values(world.actors || {}).find((a) => a && !a.dead && a.id !== 'husband'
          && a.name && say.includes(String(a.name)));
        if (actor) {
          const mv = moveActor(world, actor.id, target.placeId, 'world', '调往产业');
          target.staffIds = Array.isArray(target.staffIds) ? target.staffIds : [];
          if (!target.staffIds.includes(actor.id)) target.staffIds.push(actor.id);
          target.staff = target.staffIds.length;
          if (/掌柜|掌事|坐柜/.test(say)) {
            actor.role = '掌柜';
            target.keeper = actor.id;
            target.keeperName = actor.name;
          } else if (/头牌|花魁|琴师|歌女/.test(say)) {
            actor.role = (/头牌/.test(say) ? '头牌' : (/花魁/.test(say) ? '花魁' : (/琴师/.test(say) ? '琴师' : '歌女')));
          } else if (/伙计|跑堂|账房/.test(say)) {
            actor.role = /账房/.test(say) ? '账房' : (/跑堂/.test(say) ? '跑堂' : '伙计');
          }
          actor.employer = target.owner || 'husband';
          actor.workplace = target.name;
          actor.workplaceId = target.placeId;
          actor.hiredBy = actor.hiredBy || me.id;
          actor.hiredDay = actor.hiredDay || day;
          actor.schedule = [];
          actor.activity = { text: `在${target.name}当${actor.role || '差'}`, at: world.clock?.hour || 0, day };
          actor.home = target.placeId;
          actor.quarters = target.placeId;
          actor.duty = { ...(actor.duty || {}), home: target.placeId, place: target.placeId };
          notices.push(`${actor.name}已到${target.name}当差${mv?.ok ? '' : '（本来就在）'}。`);
        }
      }
    }
  }

  // 给东西：给/赏/送 某人 某物（"给我泡茶"是吩咐做事，不是把人名当收件人）
  {
    const mGive = /(?:给|赏|送|递)\s*([\u4e00-\u9fa5]{2,4})\s*(?:一[份张封件])?\s*([\u4e00-\u9fa5]{2,12})/.exec(say);
    const giveRecipient = mGive ? String(mGive[1]) : '';
    const notARecipient = /^(?:我|你|您|他|她|它|咱|俺|我们|你们|他们|咱们)/.test(giveRecipient)
      || /[泡倒斟烧做拿端递洗煮切]/.test(giveRecipient);
    if (mGive && !notARecipient) {
      const who = findByName(world, mGive[1]);
      if (!who) {
        // “给人一种安全感”不是给某个叫“人一种安”的人东西，静默跳过
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

  // 招家丁/护院/丫鬟：聊天里吩咐即真办（严格排除否定与疑问句，且必须有人当面领命）
  const isRecruitDenied = /(不|别|莫|休|未|否|慢|暂|再议|以后|先不|免|算了吧|用不着|不用|吗|呢|？|\?)/.test(say);
  if (!isRecruitDenied && /(招|募|添|雇|买)[^。！？\n]{0,8}(家丁|护院|丫鬟|婢女|人手)/.test(say)
    && !/(掌柜|伙计|跑堂|账房)/.test(say)) {
    const isMaid = /丫鬟|婢女/.test(say);
    const isRetainer = /护院/.test(say);
    const m = say.match(/(\d+|[一二两三四五六七八九十]+)\s*(?:个|人|名)/);
    const want = Math.max(1, Math.min(isMaid ? 12 : 50, m ? cn2num(m[1]) : (isMaid ? 2 : 4)));
    const city = (() => { const seg = String(world.places?.[me.location]?.name || '').split('·')[0]; return /府$|州$|县$/.test(seg) ? seg : '临江府'; })();

    const hereActors = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.location === me.location);
    const hasWife = hereActors.some((a) => a.id === 'waner');
    const hasStaff = hereActors.some((a) => isOuterStaff(a));
    const agentName = hasWife ? '婉儿' : (hasStaff ? '在场管事' : null);

    if (!agentName) {
      notices.push('（相公须在府里当面吩咐大娘子婉儿或厅上管事，方好领银出门采办添置人手。）');
    } else if (isMaid) {
      const cost = Math.round(want * 0.5 * 100) / 100;
      if ((Number(world.assets?.silver) || 0) < cost) {
        notices.push(`（银不够：买 ${want} 个丫鬟要 ${cost} 两。）`);
      } else {
        world.assets.silver = Math.round(((Number(world.assets.silver) || 0) - cost) * 100) / 100;
        world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
        world.ledger.push({ day, hour: world.clock?.hour || 0, delta: -cost, title: `买丫鬟 ${want} 人`, by: 'husband', balance: world.assets.silver, category: '买丫鬟' });
        const made = spawnMaids(world, want);
        notices.push(`${agentName}应声去办：从人市领回 ${made} 个丫鬟，安家银共 ${cost.toFixed(2)} 两。`);
      }
    } else {
      const r = callToArms(world, 'wangjia', { city, max: want, kind: isRetainer ? 'retainer' : 'guard' });
      if (r?.ok) {
        if (Number(r.cost) > 0) {
          world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
          world.ledger.push({
            day, hour: world.clock?.hour || 0, delta: -Number(r.cost),
            title: `招${isRetainer ? '护院' : '家丁'} ${r.came} 人·安家银`,
            by: 'husband', balance: world.assets.silver, category: '招兵',
          });
        }
        notices.push(`${agentName}应声去办：一呼百应，${isRetainer ? '护院' : '家丁'}来投 ${r.came} 人，安家银 ${r.cost} 两，本次月饷共 ${r.camePay} 两/月（全军月饷 ${r.armyMonthlyPay ?? r.monthlyPay} 两/月）。`);
      }
      else notices.push(`（${r?.error || '没招成'}）`);
    }
  }

  // 剿匪：与界面「出兵」走同一个权威入口，战果/缴获/降卒/升迁/事件全部一致
  if (/(剿匪|打匪|清剿|平匪)/.test(say)) {
    const city = (() => { const seg = String(world.places?.[me.location]?.name || '').split('·')[0]; return /府$|州$|县$/.test(seg) ? seg : '临江府'; })();
    const bt = world.bandits?.[city] || Object.values(world.bandits || {}).find((x) => x && (
      x.city === city || x.homeCity === city || String(x.id || '').includes(city)
    ) && Number(x.strength) > 0);
    if (!bt) {
      notices.push(`（${city}眼下没有成股的匪患。）`);
    } else {
      const troops = Number(world.factions?.wangjia?.troops) || 0;
      const res = quellBandits(world, bt.id, troops, city);
      if (res?.ok) notices.push(res.text);
      else notices.push(`（${res?.error || '剿匪未成'}）`);
    }
  }

  return notices;
}
