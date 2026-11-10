/**
 * 队伍与同行系统 (Party System)
 *
 * 铁律：
 * 1. 数据结构：world.party = { husband: ['liuwenxia'] } (队长 -> 成员数组，上限 3 人)
 * 2. 状态跨轮持久：只要没脱队，队长去哪，队员默认跟随，无需每轮重复点名
 * 3. 队员独立行动即自动脱队：队员在自己账号走动，自动脱队，队长绝不被拖拽
 */

const LEAVE_PARTY_RE = /(?:你留下|留在这|别跟|看好店|看好铺子|先回铺子|先回去|回你的铺子|回你家|不用陪|别来了|自己去|不用跟着|退下|留步|你先回)/;
const JOIN_PARTY_RE = /(?:带上|跟我|随我|一起|咱们|同去|同行|一道|陪我|走吧)/;

/** 获取队伍成员 ID 列表 */
export function getPartyMembers(world, leader = 'husband') {
  if (!world.party || !Array.isArray(world.party[leader])) {
    return [];
  }
  return world.party[leader].filter((id) => {
    const a = world.actors?.[id];
    return a && !a.dead;
  });
}

/** 将成员加入队伍 (最多 3 人) */
export function addToParty(world, leader = 'husband', memberId) {
  if (!memberId || memberId === leader) return false;
  const a = world.actors?.[memberId];
  if (!a || a.dead) return false;

  world.party = world.party || {};
  world.party[leader] = Array.isArray(world.party[leader]) ? world.party[leader] : [];

  if (!world.party[leader].includes(memberId)) {
    if (world.party[leader].length >= 3) {
      world.party[leader].shift(); // 超额先进先出
    }
    world.party[leader].push(memberId);
    console.log(`[Party] ${a.name} 加入了 ${leader === 'husband' ? '相公' : leader} 的队伍 (当前共 ${world.party[leader].length} 人)`);
    return true;
  }
  return false;
}

/** 移除成员或清空队伍 */
export function removeFromParty(world, leader = 'husband', memberId = null) {
  world.party = world.party || {};
  if (!Array.isArray(world.party[leader])) return false;

  if (memberId) {
    const idx = world.party[leader].indexOf(memberId);
    if (idx !== -1) {
      world.party[leader].splice(idx, 1);
      const aName = world.actors?.[memberId]?.name || memberId;
      console.log(`[Party] ${aName} 脱离了队伍`);
      return true;
    }
  } else {
    // 未指定成员：队伍解散 / 全员脱队
    if (world.party[leader].length > 0) {
      console.log(`[Party] ${leader === 'husband' ? '相公' : leader} 的队伍已解散`);
      world.party[leader] = [];
      return true;
    }
  }
  return false;
}

/** 队员在自己视角主动走动时触发：自动脱队 */
export function onMemberSelfAction(world, memberId) {
  if (!world.party || !memberId) return;
  for (const [leader, members] of Object.entries(world.party)) {
    if (Array.isArray(members) && members.includes(memberId)) {
      removeFromParty(world, leader, memberId);
    }
  }
}

/** 匹配名字或别名 */
function matchActorInText(text, actor, actorId) {
  if (!actor || !actor.name) return false;
  if (text.includes(actor.name)) return true;
  if (actor.name.length > 2 && text.includes(actor.name.slice(-2))) return true;
  if (actorId === 'liuwenxia' && (text.includes('紫嫣') || text.includes('文霞'))) return true;
  if (actorId === 'waner' && text.includes('婉儿')) return true;
  if (actorId === 'yunnia' && text.includes('芸娘')) return true;
  if (actorId === 'xiaocui' && text.includes('小翠')) return true;
  return false;
}

/** 意图解析更新队伍：加队、脱队 */
export function syncPartyIntent(world, text, selfId = 'husband') {
  if (!world || !text || selfId !== 'husband') return;
  const rawText = String(text).trim();
  const husLoc = world.actors?.husband?.location;

  // 1. 脱队逻辑判定
  if (LEAVE_PARTY_RE.test(rawText)) {
    let removedAny = false;
    for (const [aId, a] of Object.entries(world.actors || {})) {
      if (aId === 'husband') continue;
      if (matchActorInText(rawText, a, aId)) {
        removeFromParty(world, 'husband', aId);
        removedAny = true;
      }
    }
    if (!removedAny) {
      // 没点具体人（如“你留下”、“留在这”），解散全队
      removeFromParty(world, 'husband', null);
    }
    return;
  }

  // 2. 显式点名加队：“带紫嫣”、“紫嫣跟我走”、“和婉儿去”（必须指名道姓，严禁模糊集体词盲抓身边内眷）
  for (const [aId, a] of Object.entries(world.actors || {})) {
    if (aId === 'husband' || !a || a.dead) continue;
    if (matchActorInText(rawText, a, aId)) {
      if (/(?:带|跟|随|和|同|一块|一起)/.test(rawText) || JOIN_PARTY_RE.test(rawText)) {
        addToParty(world, 'husband', aId);
      }
    }
  }
}

/** 队伍随队长位移 */
export function movePartyWithLeader(world, leader = 'husband', targetPlaceId) {
  if (!world || !targetPlaceId) return [];
  const members = getPartyMembers(world, leader);
  if (members.length === 0) return [];

  const leaderActor = world.actors?.[leader] || world.actors?.husband;
  const startLoc = leaderActor?.location;
  const plName = world.places?.[targetPlaceId]?.name || targetPlaceId;
  const movedCompanions = [];

  for (const mId of members) {
    const a = world.actors?.[mId];
    if (!a || a.dead) continue;

    // 在场判定：若在出发地同处，同步瞬移
    if (a.location === startLoc) {
      a.location = targetPlaceId;
      a.activity = {
        text: `随${leader === 'husband' ? '相公' : '队长'}移步${plName}`,
        at: world.clock?.hour || 0,
        day: world.clock?.day || 1,
      };
      movedCompanions.push({ id: mId, name: a.name });
    } else {
      // 不在出发地：随后赶来
      a.activity = {
        text: `随后赶往${plName}`,
        at: world.clock?.hour || 0,
        day: world.clock?.day || 1,
      };
      console.log(`[Party] ${a.name} 不在出发地，正在随后赶往 ${plName}`);
    }
  }

  return movedCompanions;
}

