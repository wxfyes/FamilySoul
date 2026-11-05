/**
 * 她那一侧的身份卡 —— 只有核心事实，别的一概不给
 *
 * 产业事实与场景事实统一走 state.js 的 placeFacts(world, placeId)，
 * 绝不在本文件中特判地点、绝不硬编码人名、绝不替天道下台词。
 */
import { loadState, worldDate, placeFacts } from './state.js';
import { arcStepText } from './arcs.js';
import { personFacts } from './person-facts.js';
import { getPlaceDisplayName } from './naming.js';

function selfLine(world, actorId, me) {
  const props = (world.assets?.properties || []).filter((p) => p && p.owner === actorId);
  const ownerText = props.length ? `你是${props.map((p) => p.name).join('、')}的东家` : '';
  return `【你是谁】${me.name}，${me.role || '无官职'}${ownerText ? '（' + ownerText + '）' : ''}。`;
}

function moneyLine(world, actorId) {
  const wallet = Number(world.wallets?.[actorId]) || 0;
  const props = (world.assets?.properties || []).filter((p) => p && p.keeper === actorId);
  const daily = props.reduce((s, p) => s + (Number(p.incomePerDay) || 0), 0);
  const names = props.map((p) => `${p.name}(${Number(p.incomePerDay) || 0}两)`).join('、');
  return `【你的钱】现银${wallet.toFixed(2)}两，日入${daily.toFixed(2)}两${names ? '（' + names + '）' : ''}。`;
}

function hereLine(world, actorId, me) {
  const locId = me.location;
  const locName = getPlaceDisplayName(world, locId);
  const here = Object.values(world.actors || {})
    .filter((a) => a && !a.dead && a.id !== actorId && a.location === locId)
    .map((a) => `${a.name}（${a.role || '在场'}）`);
  return `【此刻】${worldDate(world)?.iso || ''} 第${world.clock?.day || 1}日${world.clock?.hour || 0}时 · 在「${locName}」 · 眼前：${here.length ? here.join('、') : '没人'}。`;
}

function arcLine(world, actorId) {
  const arc = world.arcs?.[actorId];
  if (!arc) return null;
  if (arc.done) return `【你的难关】${arc.title}——已了结：${arc.outcome || ''}`;
  const step = arc.lastStep || arcStepText(actorId, arc);
  const left = arc.atEdge
    ? 3 - ((Number(world.clock?.day) || 1) - Math.max(Number(arc.atEdgeDay) || 0, Number(arc.lastActiveDay) || 0))
    : null;
  return `【你的难关】${arc.title}——${step}${left !== null && left > 0 ? `（再不动，${left}天后由不得你）` : ''}`;
}

function husbandLine(world, actorId) {
  const hus = world.actors?.husband;
  if (!hus) return null;
  const me = world.actors?.[actorId];
  // 只有他的妻妾、府内人、亲生子女，才与王甯有婚配/亲缘关系
  const isKin = Boolean(me && (me.household || me.spouse === 'husband' || (Array.isArray(me.parents) && me.parents.includes('husband'))));
  const where = hus.location === me?.location
    ? '此刻就在你跟前'
    : `此刻在「${getPlaceDisplayName(world, hus.location)}」，不在这儿`;
  if (isKin) {
    return `【王甯】你的丈夫（临江茶坊东家），${where}（他本人不在线，由你代演他）。`;
  }
  return `【王甯】临江茶坊东家王掌柜，与你并无婚配、也无亲缘，只是个城里的东家；${where}（他本人不在线，由你代演他）。绝不许把他说成你的相公，也不许自称王家人。`;
}

/**
 * @returns {string} 独立视角身份卡
 */
export function buildMemberCard(dataDir, actorId) {
  const world = loadState(dataDir);
  const me = world.actors?.[actorId];
  if (!me) return '（这个人不在世界里）';
  const lines = [selfLine(world, actorId, me), hereLine(world, actorId, me)];
  // 统一单一事实源：调用全局一致的地点产业事实（与谁问完全无关）
  const placeFact = placeFacts(world, me.location);
  if (placeFact) lines.push(placeFact);
  lines.push(moneyLine(world, actorId));
  const mine = personFacts(world, actorId);
  if (mine) lines.push(mine);
  const arc = arcLine(world, actorId);
  if (arc) lines.push(arc);
  const hus = husbandLine(world, actorId);
  if (hus) lines.push(hus);
  lines.push(`【规矩】只认以上事实。名单外的人不存在；不在场的人不许说成在场；你自己不替自己说话。王甯在场时，你找他他就得自己开口，不许让伙计挡驾。这屋里没有楼上楼下之分，在场的人都在这同一间。若有人问及当前所在铺子/酒楼/产业是谁家的、东家是谁，在场掌柜伙计必须按【此处产业事实】如实回答东家，绝对严禁虚构胡编其他主家！`);
  return lines.join('\n');
}
