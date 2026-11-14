/**
 * 位置：全世界只有这里能改人的所在地。
 *
 * 为什么要有这一层：
 *   以前时钟、场景同步、自愈、命令各写各的，玩家会莫名其妙被搬走。
 *   现在所有移动都走 moveActor()，它只认两种理由：
 *     - 'ui'    ：玩家自己在界面上点的（他要去哪儿/叫人过来）
 *     - 'world' ：世界自己在动（作息、自愈、差事）
 *   真人登着的角色（humanBound）只接受 'ui'，其它一律拒绝。
 */

import { isInnerRoom, isChamberRoom } from './privacy.js';
import { isHumanOnline } from './presence.js';

export const MOVE_REASONS = new Set(['ui', 'world']);

function humanBoundSet(world) {
  const s = new Set();
  if (Array.isArray(world?.flags?.humanActors)) for (const id of world.flags.humanActors) s.add(String(id));
  for (const [id, a] of Object.entries(world?.actors || {})) if (a?.humanBound) s.add(id);
  return s;
}

export function isHumanBound(world, actorId) {
  if (actorId === 'husband') return true;
  return humanBoundSet(world).has(String(actorId));
}

/**
 * 夜半自愈：王宅内眷若被错误挪到府外（差事/旧 bug），半夜先请回各自房中。
 * 只动"不在王宅任何内室、且相公不在身边"的人；白天不干预。
 */
const INNER_FAMILY_HOMES = [
  { id: 'waner', home: 'husband_room' },
  { id: 'yunnia', home: 'wang_mansion_west' },
  { name: '崔婉宁', home: 'wang_mansion_east' },
];

export function healInnerFamilyAtNight(world) {
  const hour = Number(world?.clock?.hour);
  if (!Number.isFinite(hour)) return [];
  if (!(hour >= 20 || hour < 6)) return [];
  const hus = world?.actors?.husband;
  const moved = [];
  for (const rule of INNER_FAMILY_HOMES) {
    const a = rule.id
      ? world?.actors?.[rule.id]
      : Object.values(world?.actors || {}).find((x) => x && !x.dead && x.name === rule.name);
    if (!a || a.dead || !world.places?.[rule.home]) continue;
    const loc = String(a.location || '');
    if (loc === rule.home) continue;
    // 已在王宅任一内室（正房/东厢/西厢/暖阁/后院）就算安稳在家，不强行搬
    if (loc.startsWith('wang_mansion_') || loc === 'husband_room' || loc === 'backyard' || loc === 'tea_house') continue;
    // 相公就在身边陪着，不拆散
    if (hus && a.location === hus.location) continue;
    const from = a.location;
    const r = moveActor(world, a.id, rule.home, 'world', '夜半归位');
    if (r?.ok) moved.push({ id: a.id, name: a.name, from, to: rule.home });
  }
  return moved;
}

export function moveActor(world, actorId, placeId, reason = 'world', note = '') {
  if (!MOVE_REASONS.has(reason)) return { ok: false, error: '未知的移动理由' };
  const a = world?.actors?.[actorId];
  if (!a || a.dead) return { ok: false, error: '没有这个人' };
  if (!placeId || !world.places?.[placeId]) return { ok: false, error: '没有这个地点' };

  // 最高军规铁律：相公（husband）乃天命第一男主角，任何后台世界逻辑 ('world') 绝对严禁搬动相公，只能由用户在界面显式操作 ('ui')！
  if (actorId === 'husband' && reason !== 'ui') {
    return { ok: false, error: '相公真人角色绝不接受世界自动位移' };
  }

  // 单一入口铁律：私密寝室（正房/东跨院/西厢房）仅限相公与内宅妻妾；外人与下人（伙计/家丁/护院）无相公特召一律阻断或引至门房/茶坊
  try {
    const destPlace = world.places[placeId];
    const role = String(a.role || '');
    const isMasterFamily = actorId === 'husband'
      || Boolean(a.household)
      || a.spouse === 'husband'
      || ['waner', 'yunnia', 'xiaocui', 'yangzhenhua'].includes(actorId)
      || /正妻|正室|平妻|大娘子|二房|如夫人|侧室|侍妾|通房/.test(role);
    if (!isMasterFamily && isChamberRoom(destPlace) && !/特召|叫到跟前|相公召见|提审|安置居所|恩旨|分房|安歇|听召|召唤|奉召|传唤|叫来|带上来|相公宣召|随相公/.test(String(note || ''))) {
      if (/伙计|跑堂/.test(role)) {
        placeId = world.places?.tea_house ? 'tea_house' : 'street';
      } else {
        const gate = Object.keys(world.places || {}).find((id) => /朱漆大门|门房|外院|门头|大门/.test(String(world.places[id]?.name || '')));
        placeId = gate || (world.places?.tea_house ? 'tea_house' : 'street');
      }
    }

    const outerStaff = /家丁|护院|门房|小厮|马夫|车夫|脚夫/.test(role);
    // 回自己家（住处本身、或住处所在的宅子）不算"闯别家内室"
    const homeId = String(a.home || '');
    const goingHome = Boolean(homeId) && (
      String(placeId) === homeId
      || String(world.places?.[homeId]?.parent || '') === String(placeId)
      || String(destPlace?.parent || '') === homeId
    );
    if (outerStaff && !goingHome && isInnerRoom(destPlace) && !/当值|值房|通禀允入/.test(String(note || ''))) {
      if (/离场|送客|退下|去忙|散了/.test(String(note || ''))) {
        const gate = Object.keys(world.places || {}).find((id) => /朱漆大门|门房|外院|门头|大门/.test(String(world.places[id]?.name || '')));
        if (gate) placeId = gate;
      } else {
        const hall = Object.keys(world.places || {}).find((id) => /议事厅/.test(String(world.places[id]?.name || '')));
        if (hall) placeId = hall;
      }
    }
  } catch { /* 忽略 */ }
  if (a.location === placeId) return { ok: true, moved: false };

  // 真人登着的角色：在线时只有本人点界面才动；离线时 AI 可代演、可听命回家/送客
  const selfMove = /办自己的事|自己走动|送客|听命离场|回家|回房|退下|通禀允入/.test(String(note || ''));
  if (isHumanBound(world, actorId) && reason !== 'ui') {
    const offline = !isHumanOnline(actorId);
    const selfAllowed = selfMove && offline;
    // 真人离线时：允许相公召见、叫到跟前、神识代演、随行同行入住；在线或未经许可跨场所一律拒绝
    const proxyMove = offline && /随行|领路|同行|跟随|暗号|相公召见|神识代演|叫到跟前|同行入住|开房入住/.test(String(note || ''));
    if (!selfAllowed && !proxyMove) return { ok: false, error: '真人角色不接受世界移动（在线只能本人动；离线可由相公召见代演或回家）' };
  }

  // 刚被主人请走的人：几个时辰内不许自己回来（送客本人除外）
  try {
    const aw = a.awayUntil;
    const summonBypass = /叫到跟前|厅上候令|听命往某处|都到议事厅|随行|领路|同行/.test(String(note || ''));
    if (aw && !String(note || '').includes('送客') && !summonBypass) {
      const day = Number(world.clock?.day) || 1;
      const hour = Number(world.clock?.hour) || 0;
      const until = Number(aw.day) === day ? Number(aw.hour) : (Number(aw.day) > day ? 99 : hour);
      if (until > hour) return { ok: false, error: '刚被请走，暂不回来' };
      delete a.awayUntil;
    }
  } catch { /* 忽略 */ }

  // 在押犯人：服刑期间严禁常规走动与作息闲逛，只能在狱中或提审
  if (a.jailed && !/(jail|牢|大牢)/.test(placeId) && !String(note || '').startsWith('刑满') && reason !== 'admin') {
    return { ok: false, error: '在押犯人不可自由移出监牢' };
  }

  const from = a.location || null;
  a.location = placeId;
  a.lastMove = { from, to: placeId, by: reason, note: String(note || '').slice(0, 30), day: world.clock?.day || 1, hour: world.clock?.hour || 0 };
  return { ok: true, moved: true, from, to: placeId };
}

/**
 * 权威同堂同室在场判定（单一真相源）
 * 彻底解决大宅/大酒楼父地点与默认大堂/中堂在场判定割裂的顽疾
 */
export function isSameLocation(loc1, loc2) {
  if (!loc1 || !loc2) return false;
  if (loc1 === loc2) return true;
  // 1. 王宅正房与主寝
  if (['husband_room', 'husband_room__main'].includes(loc1) && ['husband_room', 'husband_room__main'].includes(loc2)) return true;
  // 2. 杨府与杨府中堂大厅（中堂即杨府正厅主客大堂，同处即在场）
  if (['yang_mansion', 'yang_mansion__hall'].includes(loc1) && ['yang_mansion', 'yang_mansion__hall'].includes(loc2)) return true;
  // 3. 运河大酒楼与一层大堂
  if (['place_44', 'place_44__f1'].includes(loc1) && ['place_44', 'place_44__f1'].includes(loc2)) return true;
  // 4. 父子主大堂判定：若一者为父地点，另一者为该父地点的默认大堂（如 X 与 X__hall 或 X__main 或 X__f1）
  if (loc1.startsWith(loc2 + '__') && /hall|main|f1/.test(loc1)) return true;
  if (loc2.startsWith(loc1 + '__') && /hall|main|f1/.test(loc2)) return true;
  return false;
}
