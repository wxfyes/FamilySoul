/**
 * 她那一侧的身份卡 —— 只有核心事实，别的一概不给
 *
 * 为什么这么做：
 *   模型每轮面对一大段"天机"（天下、朝中、军力、别人的产业…），
 *   反而丢掉了"我是谁、我在哪、眼前有谁、这是谁的店"，于是自己编。
 *   把当前产业归属铁律写明，绝不许胡编为赵主簿或外人产业。
 */
import { loadState, worldDate } from './state.js';
import { arcStepText } from './arcs.js';

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

function placeLine(world, actorId, me) {
  const locId = me.location;
  const loc = world.places?.[locId];
  if (!loc) return null;

  // 匹配是否为王家名下产业（运河码头大酒楼、临江茶坊老店等）
  const props = Array.isArray(world.assets?.properties) ? world.assets.properties : [];
  const p = props.find((x) => {
    const pn = String(x.name || '');
    return pn && (loc.name?.includes(pn) || pn.includes(loc.name) || x.id === locId || x.placeId === locId);
  });

  if (p) {
    const isWangJia = !p.owner || p.owner === 'husband' || p.owner === 'wangjia';
    if (isWangJia) {
      return `【眼前产业最高铁律】这间「${p.name}」是【临江茶坊王甯（相公）】此前斥资五百一十两白银全资盘下的私产！房契地契官府红押全部齐全立案在正房大娘子沈婉儿妆匣！绝不是租的，更绝对严禁说成知府衙门赵主簿或任何外人的产业！在场所有人（周有福、陈二、何顺等）全是王相公雇来打理的掌柜伙计，凡被问及东家，必须斩钉截铁回答：这是王甯王相公的产业！`;
    } else {
      const ownerActor = world.actors?.[p.owner]?.name || p.owner;
      return `【眼前产业】这间「${p.name}」的东家是【${ownerActor}】。`;
    }
  }

  // 特殊匹配运河码头酒楼地点
  if (locId === 'canal_restaurant' || (loc.name && loc.name.includes('酒楼'))) {
    return `【眼前产业最高铁律】这栋「运河码头三层大酒楼」是【王甯（相公）】全款买下的产业！绝非租用，绝不归知府赵主簿！在场周有福、何顺等皆为雇工，东家唯有王甯！`;
  }
  return null;
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
  const hus = Object.values(world.actors || {}).find((a) => a && a.id === 'husband');
  if (!hus) return null;
  if (hus.location === world.actors?.[actorId]?.location) {
    return `【王甯】你的相好，临江茶坊东家，此刻就在你跟前（他本人不在线，由你代演他）。`;
  }
  const place = String(world.places?.[hus.location]?.name || '别处');
  return `【王甯】你的相好，临江茶坊东家，此刻在「${place}」，不在这儿（他本人不在线，通篇由你代演他）。`;
}

/**
 * @returns {string} 独立视角身份卡
 */
export function buildMemberCard(dataDir, actorId) {
  const world = loadState(dataDir);
  const me = world.actors?.[actorId];
  if (!me) return '（这个人不在世界里）';
  const lines = [selfLine(world, actorId, me), hereLine(world, actorId, me)];
  const placeFact = placeLine(world, actorId, me);
  if (placeFact) lines.push(placeFact);
  lines.push(moneyLine(world, actorId));
  const arc = arcLine(world, actorId);
  if (arc) lines.push(arc);
  const hus = husbandLine(world, actorId);
  if (hus) lines.push(hus);
  lines.push(`【规矩】只认以上事实。名单外的人不存在；不在场的人不许说成在场；你自己不替自己说话。王甯在场时，你找他他就得自己开口，不许让伙计挡驾。这屋里没有楼上楼下之分，在场的人都在这同一间。`);
  return lines.join('\n');
}
