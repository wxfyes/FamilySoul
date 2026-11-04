/**
 * 落地第一幕：新人刚进世界时，天道主动开口。
 *
 * 铁律：
 *   · 不写死台词、不写死人物——只给事实，让天道现写
 *   · 事实全部来自账本：他是谁、带多少钱、住哪、身边有谁、城里在热闹什么
 *   · 只生成一次（actor.opened 标记），之后靠世界自己走
 */

export function buildOpeningFacts(world, actorId) {
  const a = world?.actors?.[actorId];
  if (!a) return null;
  const placeId = a.location;
  const place = world.places?.[placeId];
  const here = Object.values(world.actors || {})
    .filter((x) => x && !x.dead && x.id !== actorId && x.location === placeId)
    .slice(0, 5)
    .map((x) => `${x.name}（${x.role || '在此'}）`);

  const near = Object.keys(world.places || {})
    .filter((id) => id !== placeId)
    .slice(0, 0); // 预留：需要时再算附近

  const rumors = (world.rumors || []).slice(-2).map((r) => String(r.text || '')).filter(Boolean);
  const events = (world.recentEvents || []).slice(-3).map((e) => String(e.text || '')).filter(Boolean);
  const homeName = a.home ? world.places?.[a.home]?.name || '' : '';
  const money = Number(a.money) || 0;

  return {
    name: a.name,
    age: a.age,
    role: a.role || '',
    origin: a.originKind && a.originKind !== 'preset' ? a.originKind : (a.origin || ''),
    placeName: place?.name || '',
    homeName,
    money,
    here,
    rumors: rumors.concat(events).slice(0, 4),
    near,
  };
}

export function buildOpeningPrompt(facts) {
  const system = [
    '你是这个古代世界的天道。一个新人刚落地，你要用世界自己的方式把他迎进来。',
    '规矩：',
    '1. 只写这一幕，不要解释、不要总结、不要问玩家想做什么。',
    '2. 必须让一个人开口：他身边若没有人，就安排一个合理的过门人（邻居、货郎、房东、路过的差役）。',
    '   这个人要用 [[spawn:姓名|身份]] 声明，引擎会真的把他立进世界，以后还能再见。',
    '3. 台词前必须写说话人：【姓名】：……（旁白不要标人名）。',
    '4. 台词要有身份口吻，不要现代词，不要说"欢迎来到这个世界"。',
    '5. 结尾留一个自然的开口，让他知道下一步能做什么（但不许替他决定）。',
    '6. 可以补白：光影、天气、街上的动静、桌上的旧物。',
    '7. 绝不许补白：他的亲属、他的过往、他没做过的事。这些只有账本上有的才算。',
    '8. 字数 120~220 字。',
  ].join('\n');

  const user = [
    `【新人】${facts.name}，${facts.age}岁，${facts.role}${facts.origin ? `，从${facts.origin}来` : ''}。`,
    `【身上】${facts.money} 两。`,
    `【住处】${facts.homeName || '还没有定所'}（此刻在「${facts.placeName}」）。`,
    `【眼前】${facts.here.length ? facts.here.join('、') : '身边没有别人'}。`,
    facts.rumors.length ? `【近日城中】${facts.rumors.join('；')}` : '',
    '',
    '请写他落地的第一幕：用眼前的人开口，把他迎进这个世界。',
  ].filter(Boolean).join('\n');

  return { system, user };
}
