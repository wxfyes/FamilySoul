/**
 * 街上摆摊的：自己会来、会走、会吆喝，不靠谁安排。
 *
 * 规矩：
 *   ① 摊子按"这个时辰、这条街、这桩货"生成，不是写死某个卖花女；
 *   ② 摊贩有自己的家、自己的作息：早出摊，晚了收；
 *   ③ 卖什么看当天行情：茶、盐、布、菜、鱼、针线、竹器、柴禾……
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const GOODS = [
  { key: '菜', word: '青菜' },
  { key: '鱼', word: '鲜鱼' },
  { key: '茶', word: '粗茶' },
  { key: '布', word: '土布' },
  { key: '柴', word: '柴禾' },
  { key: '针线', word: '针线' },
  { key: '竹器', word: '竹篮' },
  { key: '果', word: '时果' },
  { key: '糕', word: '米糕' },
  { key: '草鞋', word: '草鞋' },
];

const SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '赵', '周', '吴', '郑', '孙', '何', '吕', '施', '张'];
const NAMES = ['阿婆', '阿公', '大嫂', '二嫂', '老汉', '小娘子', '后生', '阿妹', '阿福', '阿贵', '阿秀', '阿全'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 街上现有的摊子（按 actor.stall 认） */
export function stallsOf(world, placeId = 'street') {
  return Object.values(world?.actors || {}).filter(
    (a) => a && !a.dead && a.stall && String(a.location) === String(placeId),
  );
}

/**
 * 补摊子：白天街上至少有两三个摊，夜里收摊
 * @returns {number} 新来几个
 */
export function ensureStalls(world, placeId = 'street') {
  const hour = num(world.clock?.hour);
  const day = num(world.clock?.day) || 1;
  const place = world?.places?.[placeId];
  if (!place) return 0;

  // 夜里收摊：摊贩回家
  if (hour >= 20 || hour < 6) {
    let closed = 0;
    for (const a of Object.values(world?.actors || {})) {
      if (!a || a.dead || !a.stall) continue;
      const home = a.home && world.places?.[a.home] ? a.home : null;
      if (home && a.location !== home) { a.location = home; closed += 1; }
    }
    return -closed;
  }

  const want = hour >= 7 && hour <= 11 ? 3 : 2;   // 早市热闹些
  const have = stallsOf(world, placeId);
  if (have.length >= want) {
    // 摊贩得在摊上
    for (const a of have) if (a.location !== placeId) a.location = placeId;
    return 0;
  }

  let added = 0;
  const existingNames = new Set(Object.values(world?.actors || {}).map((a) => a && a.name).filter(Boolean));
  for (let i = have.length; i < want; i++) {
    let name = '';
    for (let t = 0; t < 30; t++) {
      const cand = pick(SURNAMES) + pick(NAMES);
      if (!existingNames.has(cand)) { name = cand; break; }
    }
    if (!name) continue;
    existingNames.add(name);
    const good = pick(GOODS);
    const id = `vendor_${Date.now()}_${Math.floor(Math.random() * 10000)}_${i}`;
    world.actors[id] = {
      id,
      name,
      role: '摊贩',
      title: '摊贩',
      gender: /婆|嫂|娘|妹|秀/.test(name) ? 'female' : 'male',
      age: 22 + Math.floor(Math.random() * 40),
      stall: { good: good.key, word: good.word, price: Math.round((0.02 + Math.random() * 0.08) * 100) / 100, sinceDay: day },
      home: null,
      location: placeId,
      money: Math.round((0.3 + Math.random() * 1.5) * 100) / 100,
      relations: {},
      origin: 'street_stall',
      createdDay: day,
      schedule: [
        { at: 7, do: '挑担出摊', place: placeId },
        { at: 19, do: '收摊回家', place: 'street' },
      ],
    };
    added += 1;
  }
  if (added) console.log(`[Stall] 街上新来 ${added} 个摆摊的`);
  return added;
}

/** 这摊卖什么（给天道当事实用） */
export function stallFact(a) {
  if (!a?.stall) return '';
  return `${a.name}在街边摆摊卖${a.stall.word}，一份约 ${Number(a.stall.price).toFixed(2)} 两`;
}
