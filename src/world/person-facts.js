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

  // ① 婚配与名分
  const spouse = a.spouse ? world.actors?.[a.spouse] : null;
  if (spouse && !spouse.dead) {
    const roleText = a.role || '内眷';
    bits.push(`婚配：已婚（${roleText}），夫君是${spouse.name}。`);
  } else if (a.marital && MARITAL[a.marital]) {
    bits.push(`婚配：${MARITAL[a.marital]}。`);
  } else if (a.household) {
    bits.push('婚配：已婚（府内眷属）。');
  } else {
    bits.push('婚配：未婚。');
  }

  // ② 出身与家世亲族（查世家豪门与父母谱系，绝不容大模型凭空脑补死爹死夫）
  if (a.id === '临江_gentry_1_小姐' || a.name === '崔婉宁') {
    const f = world.actors?.['临江_gentry_1_老爷'];
    const m = world.actors?.['临江_gentry_1_夫人'];
    const fName = f?.name || '崔文远';
    const mName = m?.name || '崔知微';
    bits.push(`家世门第：临江大商士绅崔府千金，父亲是${fName}老爷，母亲是${mName}夫人，父母俱在、家资殷实。系崔府登门提亲、相公纳聘八十两正经迎纳为侧室过门，清清白白黄花闺秀出阁，绝非再嫁，断无亡夫亡父！`);
  } else if (a.id === 'waner' || a.name === '沈婉儿') {
    bits.push('家世门第：名门落魄千金，父亲沈老太爷曾任官宦，相公落难相扶，明媒正娶结发正妻。');
  } else if (a.id === 'yunnia' || a.name === '林芸娘') {
    bits.push('家世门第：紫阳山茶农林老汉之女，清清白白采茶闺女，相公仗义相助后明礼迎纳为二房如夫人。');
  } else if (typeof a.id === 'string' && a.id.includes('_gentry_')) {
    const parts = a.id.split('_');
    const city = parts[0];
    const num = parts[2];
    const fId = `${city}_gentry_${num}_老爷`;
    const mId = `${city}_gentry_${num}_夫人`;
    const f = world.actors?.[fId];
    const m = world.actors?.[mId];
    if (f || m) {
      bits.push(`家世亲族：${city}士绅名门${f?.name ? `，父亲是${f.name}` : ''}${m?.name ? `，母亲是${m.name}` : ''}。`);
    }
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
  if (/知县|县令|知府|巡抚|县丞|通判/.test(String(a.role || '')) || a.id === 'county_magistrate') {
    bits.push(`身份官阶：朝廷命官（${a.role || '知县'}），一县之尊正印父母官，执掌刑名钱谷。自称「本官/老夫/文达」，称平民商人为「王少掌柜/少掌柜/小友」，绝不可自称小的、奴才，绝不可叫王甯东家！`);
  } else if (a.workplace) {
    const ownerName = a.employer ? (world.actors?.[a.employer]?.name || '') : '';
    bits.push(`差事：在「${a.workplace}」做${a.role || '伙计'}${ownerName ? `，东家是${ownerName}` : ''}。`);
  }

  // ④ 此刻所在
  const here = world.places?.[a.location]?.name;
  if (here) bits.push(`此刻在「${here}」。`);

  return `【你的底细】${bits.join('')}`;
}
