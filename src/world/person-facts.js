/**
 * 某个人的"底细"：他本人该知道、别人一问就该对得上的事实。
 *
 * 为什么要有：陆羽（新角色）账上未婚、有自己的一座小院，
 * 但被点名说话时，这些事实没进他的嘴，于是他只能编"天字三号房"。
 *
 * 产出唯一，谁用谁读：NPC 代演、她的身份卡、以后看板都能用这一句。
 */

const MARITAL = {
  single: '未婚',
  married: '已婚',
  widowed: '寡居',
  concubine: '侧室',
};

export function personFacts(world, actorId) {
  const a = world?.actors?.[actorId];
  if (!a) return '';

  const bits = [];

  // ① 婚配
  const spouse = a.spouse ? world.actors?.[a.spouse] : null;
  if (spouse && !spouse.dead) {
    bits.push(`婚配：已婚，配偶是${spouse.name}。`);
  } else if (a.marital && MARITAL[a.marital]) {
    bits.push(`婚配：${MARITAL[a.marital]}。`);
  } else if (a.household) {
    bits.push('婚配：已婚（府内眷属）。');
  } else {
    bits.push('婚配：未婚。');
  }

  // ② 住处（自有/租住/客栈，按 residence 推；没有就按 home 推）
  const res = a.residence;
  const resPlace = res?.placeId ? world.places?.[res.placeId] : (a.home ? world.places?.[a.home] : null);
  if (res?.type === 'own' && resPlace) bits.push(`住处：自有民宅「${resPlace.name}」。`);
  else if (res?.type === 'rent' && resPlace) bits.push(`住处：租住「${resPlace.name}」。`);
  else if (res?.type === 'family' && resPlace) bits.push(`住处：寄居「${resPlace.name}」。`);
  else if (res?.type === 'inn') bits.push('住处：暂住客栈，没有自己的宅子。');
  else if (resPlace) bits.push(`住处：「${resPlace.name}」。`);
  else bits.push('住处：没有固定的宅子。');

  // ③ 差事与东家
  if (a.workplace) {
    const ownerName = a.employer ? (world.actors?.[a.employer]?.name || '') : '';
    bits.push(`差事：在「${a.workplace}」做${a.role || '伙计'}${ownerName ? `，东家是${ownerName}` : ''}。`);
  }

  // ④ 此刻所在
  const here = world.places?.[a.location]?.name;
  if (here) bits.push(`此刻在「${here}」。`);

  return `【你的底细】${bits.join('')}`;
}
