/**
 * 她那一侧的身份卡 —— 只有六行，别的一概不给
 *
 * 为什么这么做：
 *   模型每轮面对一大段"天机"（天下、朝中、军力、别人的产业…），
 *   反而丢掉了"我是谁、我在哪、眼前有谁"，于是自己编。
 *   信息越少越准，也越省钱。
 */
import { loadState, worldDate } from './state.js';

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
  const locName = String(world.places?.[locId]?.name || '未明');
  const here = Object.values(world.actors || {})
    .filter((a) => a && !a.dead && a.id !== actorId && a.location === locId)
    .map((a) => `${a.name}（${a.role || '在场'}）`);
  return `【此刻】${worldDate(world)?.iso || ''} 第${world.clock?.day || 1}日${world.clock?.hour || 0}时 · 在「${locName}」 · 眼前：${here.length ? here.join('、') : '没人'}。`;
}

function arcLine(world, actorId) {
  const arc = world.arcs?.[actorId];
  if (!arc) return null;
  if (arc.done) return `【你的难关】${arc.title}——已了结：${arc.outcome || ''}`;
  const steps = (arc.log || []).map((l) => l.text);
  const step = steps.length ? steps[steps.length - 1] : '';
  const left = arc.atEdge
    ? 3 - ((Number(world.clock?.day) || 1) - Math.max(Number(arc.atEdgeDay) || 0, Number(arc.lastActiveDay) || 0))
    : null;
  return `【你的难关】${arc.title}——${step}${left !== null && left > 0 ? `（再不动，${left}天后由不得你）` : ''}`;
}

function husbandLine(world, actorId) {
  const hus = Object.values(world.actors || {}).find((a) => a && a.id === 'husband');
  if (!hus) return null;
  if (hus.location === world.actors?.[actorId]?.location) {
    return `【王甯】你的相好，临江茶坊东家，此刻就在你跟前（他本人不在线，由你代演他）。`;
  }
  const place = String(world.places?.[hus.location]?.name || '别处');
  return `【王甯】你的相好，临江茶坊东家，此刻在「${place}」，不在这儿（他本人不在线，通篇由你代演他）。`;
}

/**
 * @returns {string} 六行身份卡（不超过 300 字）
 */
export function buildMemberCard(dataDir, actorId) {
  const world = loadState(dataDir);
  const me = world.actors?.[actorId];
  if (!me) return '（这个人不在世界里）';
  const lines = [selfLine(world, actorId, me), hereLine(world, actorId, me), moneyLine(world, actorId)];
  const arc = arcLine(world, actorId);
  if (arc) lines.push(arc);
  const hus = husbandLine(world, actorId);
  if (hus) lines.push(hus);
  lines.push(`【规矩】只认这五条。名单外的人不存在；不在场的人不许说成在场；你自己不替自己说话。王甯在场时，你找他他就得自己开口，不许让伙计挡驾。这屋里没有楼上楼下之分，在场的人都在这同一间。`);
  return lines.join('\n');
}
