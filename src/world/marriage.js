import { addItem, itemsOf } from './items.js';

/**
 * 姻亲：说亲、婚配、结亲。
 *
 * 规矩：
 *   ① 婚配不是剧情道具：两个成年未婚男女，同在一城，才谈得上；
 *   ② 说亲要经媒婆、要聘礼，成不成看人家愿不愿意（信任/彩礼）；
 *   ③ 婚后写进 spouse 与 bonds，两家的姻亲关系跟着走。
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const labelOf = (nm, world) => {
  const seg = String(nm || '').split('·')[0];
  if (/府$|州$|县$/.test(seg) && world?.cities?.[seg]) return seg;
  return '临江府';
};

const cityOf = (world, actor) => {
  const byName = labelOf(world.places?.[actor?.location]?.name, world);
  if (byName !== '临江府') return byName;
  // 老宅名没带城（如"裴府"）：按 home 的 id 前缀认城
  const hid = String(actor?.home || '');
  for (const c of Object.keys(world?.cities || {})) {
    const slug = c.replace(/府$|县$|州$/g, '');
    if (hid.startsWith(`${slug}_`)) return c;
  }
  return byName;
};

/** 一城一个媒婆（没有就补） */
export function ensureMatchmaker(world, cityName) {
  const city = String(cityName || '');
  const b = world?.flags?.cityBase?.[city];
  if (!b) return null;
  const slug = city.replace(/府$|县$|州$/g, '');
  const id = `${slug}_matchmaker`;
  if (world.actors?.[id]) return world.actors[id];
  const usedNames = new Set(Object.values(world.actors || {}).map((a) => a && a.name).filter(Boolean));
  let name = '';
  for (let i = 0; i < 20; i += 1) {
    const cand = `${['王', '李', '张', '刘', '陈', '赵', '孙', '周'][Math.floor(Math.random() * 8)]}媒婆`;
    if (!usedNames.has(cand)) { name = cand; break; }
  }
  if (!name) name = `${city}媒婆`;
  world.actors[id] = {
    id, name, role: '媒婆', title: '媒婆', gender: 'female',
    age: 45 + Math.floor(Math.random() * 15),
    home: b.streetId, location: b.streetId, money: 1.5, relations: {},
    origin: 'city_base',
  };
  console.log(`[Marriage] ${city}补了个媒婆：${name}`);
  return world.actors[id];
}

// 核心保护名单：绝对严禁参与民间任何随机拉郎配结亲
export const PROTECTED_FEMALES = new Set([
  'waner', 'yunnia', 'yunniang', 'cuiwanning', 'wanning',
  'yangcaier', 'yangzhenhua', 'yangshenzhi_daughter', 'liuwenxia', 'xiaocui',
]);

/**
 * 是否属于受保护的名门千金、官宦闺秀或王家后宅眷属
 */
export function isProtectedFemale(world, a) {
  if (!a) return false;
  if (PROTECTED_FEMALES.has(a.id)) return true;
  const nm = String(a.name || '');
  if (/沈婉儿|林芸娘|崔婉宁|杨采儿|紫嫣|刘文霞|小翠/.test(nm)) return true;
  if (a.household === true || a.spouse === 'husband') return true;
  if (a.origin === 'preset') return true;
  const roleText = String(a.role || '');
  if (/千金|小姐|闺秀|才女|花魁|花魁娘子|行首|如夫人|大娘子|侧室|妾室|掌柜娘子/.test(roleText)) return true;
  return false;
}

/** 这人能说亲吗（民间搭桥） */
export function isMarriageable(world, a) {
  if (!a || a.dead || a.jailed) return false;
  if (a.spouse) return false;
  if (String(a.marital || '') === 'married') return false;
  const age = num(a.age);
  if (age && (age < 16 || age > 45)) return false;
  if (a.id === 'husband') return false;
  if (String(a.id).startsWith('usr_')) return false;

  // 严禁核心千金名门闺秀与后宅内眷参与民间拉郎配
  if (isProtectedFemale(world, a)) return false;

  return true;
}

/**
 * 获取相公后宅权威名分谱系（单一真相源）
 */
export function getHusbandHouseholdRoster(world) {
  const roster = [];
  const marriages = Array.isArray(world?.marriages) ? world.marriages : [];
  const known = new Set();

  // 1. 沈婉儿：正妻大娘子
  if (world?.actors?.waner) {
    roster.push({
      id: 'waner',
      name: world.actors.waner.name || '沈婉儿',
      rank: '正妻·大娘子',
      role: '主母',
      location: world.actors.waner.location || 'husband_room',
    });
    known.add('waner');
  }

  // 2. 林芸娘：二房如夫人
  const yunKey = world?.actors?.yunnia ? 'yunnia' : (world?.actors?.yunniang ? 'yunniang' : null);
  if (yunKey && world.actors[yunKey]) {
    roster.push({
      id: yunKey,
      name: world.actors[yunKey].name || '林芸娘',
      rank: '二房·如夫人',
      role: '掌柜如夫人',
      location: world.actors[yunKey].location || 'backyard',
    });
    known.add(yunKey);
    known.add('yunnia');
    known.add('yunniang');
  }

  // 3. 崔婉宁：明媒纳聘侧室
  const cuiKey = world?.actors?.cuiwanning ? 'cuiwanning' : (world?.actors?.wanning ? 'wanning' : null);
  if (cuiKey && world.actors[cuiKey]) {
    roster.push({
      id: cuiKey,
      name: world.actors[cuiKey].name || '崔婉宁',
      rank: '侧室·名门千金',
      role: '侧室',
      location: world.actors[cuiKey].location || 'backyard',
    });
    known.add(cuiKey);
  }

  // 4. 杨采儿：正室·并嫡平妻
  if (world?.actors?.yangzhenhua && marriages.some((m) => m && (m.who === 'yangzhenhua' || m.id === 'marriage_yangcaier' || m.name === '杨采儿'))) {
    roster.push({
      id: 'yangzhenhua',
      name: world.actors.yangzhenhua.name || '杨采儿',
      rank: '正室·平妻',
      role: '知府千金平妻',
      location: world.actors.yangzhenhua.location || 'wang_mansion__east_room',
    });
    known.add('yangzhenhua');
  }

  // 5. 其余已纳之妾
  for (const m of marriages) {
    if (!m || !m.who || known.has(m.who)) continue;
    const a = world.actors?.[m.who];
    if (!a) continue;
    roster.push({
      id: m.who,
      name: a.name || m.name,
      rank: m.rank || a.role || '如夫人',
      role: a.role || '内眷',
      location: a.location || 'backyard',
    });
    known.add(m.who);
  }

  return roster;
}

/**
 * 相公说亲：成不成看对方意愿与聘礼
 * @returns {{ok:boolean, line:string}}
 */
export function proposeMarriage(world, suitorId, targetId, gift = 2) {
  const suitor = world.actors?.[suitorId];
  const target = world.actors?.[targetId];
  if (!suitor || !target) return { ok: false, line: '（没这个人。）' };
  if (!isMarriageable(world, target)) return { ok: false, line: `（${target.name}不是能说亲的人。）` };
  if (cityOf(world, suitor) !== cityOf(world, target)) return { ok: false, line: `（${target.name}不在本城，说亲得当面。）` };

  const rel = target.relations?.[suitorId] || {};
  const trust = num(rel.trust);
  const giftNum = num(gift);

  // 门第：大户小姐、才女，家里要门当户对——交情与聘礼都得够
  const gentle = /小姐|才女|闺秀|千金/.test(String(target.role || ''));
  if (gentle) {
    const props = (world.assets?.properties || []).filter((x) => x && (String(x.owner || '') === String(suitorId) || String(x.keeper || '') === String(suitorId))).length;
    const fame = Number(world.actors?.[suitorId]?.fame || 0);
    const standing = props >= 1 || fame >= 15;
    if (trust < 40 || giftNum < 20) {
      return { ok: false, line: `（${target.name}家里要门当户对：先与她说得上话（交情${Math.round(trust)}/40），聘礼也不能寒酸（${giftNum.toFixed(0)}/20 两）。）` };
    }
    if (!standing) {
      return { ok: false, line: `（${target.name}的父亲摇了摇头：你家底还薄，先立起一处产业再来提亲。）` };
    }
  }

  const chance = Math.min(0.95, 0.15 + trust / 100 + Math.min(0.4, giftNum / 20));
  const accepted = Math.random() < chance;
  if (!accepted) {
    return { ok: false, line: `（${target.name}低了低头，说这桩事还得再想想。）` };
  }
  // 结亲
  suitor.spouse = target.id;
  target.spouse = suitor.id;
  suitor.marital = 'married';
  target.marital = 'married';
  if (target.home) {
    target.oldHome = target.home;
    target.home = suitor.home || target.home;
    if (suitor.home && world.places?.[suitor.home]) target.location = suitor.home;
  }
  try {
    world.bonds = world.bonds || {};
    world.bonds[suitor.id] = world.bonds[suitor.id] || {};
    world.bonds[target.id] = world.bonds[target.id] || {};
    world.bonds[suitor.id][target.id] = { type: '姻亲', score: 60 };
    world.bonds[target.id][suitor.id] = { type: '姻亲', score: 60 };
  } catch { /* 忽略 */ }
  console.log(`[Marriage] ${suitor.name} 娶了 ${target.name}（聘礼 ${giftNum} 两）`);
  return { ok: true, line: `（媒婆两头跑了几趟，${target.name}点了头。这桩亲事成了。）` };
}

/**
 * 民间自己结亲：每天给几对同城未婚男女搭桥
 * @returns {number} 成了几对
 */
export function dailyMarriages(world) {
  const day = num(world.clock?.day) || 1;
  world.flags = world.flags || {};
  if (num(world.flags.marriageDay) === day) return 0;
  world.flags.marriageDay = day;

  const pool = Object.values(world?.actors || {}).filter((a) => isMarriageable(world, a) && a.household !== true);
  let pairs = 0;
  for (const a of pool) {
    if (pairs >= 3) break;
    if (a.spouse) continue;
    const cands = pool.filter((b) => b.id !== a.id && !b.spouse
      && ((a.gender === 'female') !== (b.gender === 'female'))
      && cityOf(world, b) === cityOf(world, a)
      && Math.abs(num(a.age) - num(b.age)) <= 15);
    if (!cands.length) continue;
    const b = cands[Math.floor(Math.random() * cands.length)];
    a.spouse = b.id;
    b.spouse = a.id;
    a.marital = 'married';
    b.marital = 'married';
    try {
      world.bonds = world.bonds || {};
      world.bonds[a.id] = world.bonds[a.id] || {};
      world.bonds[b.id] = world.bonds[b.id] || {};
      world.bonds[a.id][b.id] = { type: '姻亲', score: 55 };
      world.bonds[b.id][a.id] = { type: '姻亲', score: 55 };
    } catch { /* 忽略 */ }
    console.log(`[Marriage] ${cityOf(world, a)}：${a.name} 与 ${b.name} 结亲`);
    pairs += 1;
  }
  return pairs;
}


const standingOf = (world, actorId) => {
  const props = (world.assets?.properties || []).filter((x) => x && (String(x.owner || '') === String(actorId) || String(x.keeper || '') === String(actorId)));
  const silver = Number(world.assets?.silver) || 0;
  const fame = Number(world.actors?.[actorId]?.fame || 0);
  return { props: props.length, silver, fame, score: props * 3 + silver / 100 + fame / 5 };
};

/**
 * 大户人家主动来联姻：你在这城里站稳了，人家才来问
 * @returns {object|null} 新的提亲
 */
export function maybeOfferAlliance(world, playerId = 'husband', force = false) {
  const day = num(world.clock?.day) || 1;
  world.flags = world.flags || {};
  if (num(world.flags.allianceCheckedDay) === day) return null;
  world.flags.allianceCheckedDay = day;
  if (world.flags.allianceOffer) return world.flags.allianceOffer;

  const player = world.actors?.[playerId];
  if (!player) return null;
  const city = cityOf(world, player);
  const me = standingOf(world, playerId);

  // 自己得先立住：三处产业，或银子上千，或名声在外
  if (!(me.props >= 3 || me.silver >= 1000 || me.fame >= 30)) return null;
  if (!force && Math.random() > 0.45) return null;

  // 只挑"有府邸、有老爷做主"的人家，别把街上独居的才女当成大户提亲
  const girls = Object.values(world?.actors || {}).filter((a) => a && !a.dead
    && /小姐|才女/.test(String(a.role || '')) && isMarriageable(world, a)
    && cityOf(world, a) === city)
    .filter((a) => {
      const h = world.places?.[a.home];
      if (!h?.residence) return false;
      return Object.values(world.actors || {}).some((x) => x && x.role === '老爷' && x.home === a.home);
    });
  if (!girls.length) return null;
  const girl = girls[Math.floor(Math.random() * girls.length)];
  const family = girl.home && world.places?.[girl.home];
  const lord = Object.values(world.actors || {}).find((a) => a && a.home === girl.home && a.role === '老爷');

  world.flags.allianceOffer = {
    girlId: girl.id, girlName: girl.name, familyId: girl.home,
    familyName: family?.name || '某府', lordName: lord?.name || '',
    city, day, status: 'pending',
  };
  console.log(`[Marriage] ${family?.name || ''} 托媒婆来提亲：欲将 ${girl.name} 许给 ${player.name}`);
  return world.flags.allianceOffer;
}

/** 答应联姻：小姐进门做侧室，两家结姻亲 */
export function acceptAlliance(world, playerId = 'husband') {
  const offer = world.flags?.allianceOffer;
  if (!offer || offer.status !== 'pending') return { ok: false, line: '（眼下没有人家来提亲。）' };
  const girl = world.actors?.[offer.girlId];
  const player = world.actors?.[playerId];
  if (!girl || !player) return { ok: false, line: '（这门亲事已经作罢。）' };
  girl.household = true;
  girl.spouse = playerId;
  girl.marital = 'concubine';
  girl.oldHome = girl.home;
  girl.home = player.home || girl.home;
  girl.location = player.home || girl.location;
  player.spouse = player.spouse || girl.id;
  try {
    world.bonds = world.bonds || {};
    world.bonds[playerId] = world.bonds[playerId] || {};
    world.bonds[girl.id] = world.bonds[girl.id] || {};
    world.bonds[playerId][girl.id] = { type: '姻亲', score: 65 };
    world.bonds[girl.id][playerId] = { type: '姻亲', score: 65 };
  } catch { /* 忽略 */ }
  offer.status = 'accepted';
  world.flags.allianceOffer = null;
  console.log(`[Marriage] 联姻成了：${girl.name} 入 ${player.name} 家`);
  return { ok: true, line: `（${offer.familyName}择日送了 ${girl.name} 过门，两家成了姻亲。）` };
}

/** 回绝 */
export function declineAlliance(world) {
  const offer = world.flags?.allianceOffer;
  if (!offer) return { ok: false, line: '（眼下没有人家来提亲。）' };
  world.flags.allianceOffer = null;
  console.log(`[Marriage] 回绝了 ${offer.familyName} 的提亲`);
  return { ok: true, line: `（${offer.familyName}的媒婆悻悻走了。）` };
}

/**
 * 权威通用大乾礼法与婚聘生命周期引擎：
 * 无论迎娶何人（千金、闺秀、才女、医女），依照大明律与大乾礼制全自动推演：
 *   ① 礼法名分定级（正室 / 并嫡平妻 / 侧室 / 如夫人 / 贵妾）；
 *   ② 官押大红婚书生成并自动收归相公随身行囊；
 *   ③ 后宅厢房分配与居住空间自动挂载；
 *   ④ 全方位编织夫妻羁绊与岳家姻亲关系网；
 *   ⑤ 写入天下大事记与后宅权威名册。
 */
export function executeMarriageAlliance(world, {
  wifeId,
  rank = '并嫡平妻',
  dowry = 100,
  day = null,
  chamber = null,
  matchmaker = null,
} = {}) {
  world.marriages = Array.isArray(world.marriages) ? world.marriages : [];
  world.actors = world.actors || {};
  world.places = world.places || {};
  world.bonds = world.bonds || {};
  world.notes = Array.isArray(world.notes) ? world.notes : [];

  const weddingDay = Number(day) || Number(world.clock?.day) || 26;
  const targetKey = String(wifeId || '').trim();

  // 1. 精准解析妻子实体（支持 ID 或姓名模糊匹配）
  let girl = world.actors[targetKey] || Object.values(world.actors).find((a) => a && (a.name === targetKey || a.id === targetKey));
  if (!girl) {
    // 动态保护性补全知名角色
    if (/采儿|yangzhenhua|知府千金/.test(targetKey)) {
      girl = { id: 'yangzhenhua', name: '杨采儿', role: '知府千金', label: '知府千金', gender: 'female', age: 19 };
      world.actors['yangzhenhua'] = girl;
    } else {
      return { ok: false, error: `未在世间寻得此女子（${targetKey}）` };
    }
  }

  const girlId = girl.id;
  const girlName = girl.name;

  // 2. 依据大乾礼法归正名分与等级
  let formalRank = '正室·平妻';
  let formalStatus = '平妻';
  let bondScore = 85;
  let defaultChamber = 'wang_mansion__main_room';
  let defaultChamberName = '临江·提督王府·正房暖阁';

  const rStr = String(rank || '');
  if (/正室|发妻|元配|正房|大娘子/.test(rStr) && !/平妻|两头大/.test(rStr)) {
    formalRank = '正妻·大娘子';
    formalStatus = '正室';
    bondScore = 90;
    defaultChamber = 'wang_mansion__main_room';
    defaultChamberName = '临江·提督王府·正房暖阁';
  } else if (/平妻|两头大|并嫡/.test(rStr)) {
    formalRank = '正室·平妻';
    formalStatus = '平妻';
    bondScore = 85;
    // 礼法铁律：平妻与正妻并嫡（两头大），位列正房，绝不发配偏房东厢！
    defaultChamber = 'wang_mansion__main_room';
    defaultChamberName = '临江·提督王府·正房暖阁';
  } else if (/侧室|二房|如夫人/.test(rStr)) {
    formalRank = girl.origin === 'noble' || /千金|名门/.test(girl.role || '') ? '名门侧室' : '二房如夫人';
    formalStatus = '侧室';
    bondScore = 75;
    defaultChamber = 'wang_mansion__west_room';
    defaultChamberName = '临江·提督王府·西跨院暖阁';
  } else {
    formalRank = '妾室';
    formalStatus = '妾室';
    bondScore = 65;
    defaultChamber = 'wang_mansion__wing';
    defaultChamberName = '临江·提督王府·侧厢居室';
  }

  const chosenChamber = chamber || defaultChamber;

  // 3. 权威登册入 world.marriages
  let m = world.marriages.find((x) => x && (x.who === girlId || x.wifeId === girlId || x.id === `marriage_${girlId}`));
  if (!m) {
    m = {
      id: `marriage_${girlId}`,
      who: girlId,
      wifeId: girlId,
      name: girlName,
      wifeName: girlName,
      rank: formalRank,
      status: formalStatus,
      dowry: Number(dowry) || 0,
      day: weddingDay,
      chamber: chosenChamber,
    };
    world.marriages.push(m);
  } else {
    m.who = m.who || girlId;
    m.wifeId = m.wifeId || girlId;
    m.name = m.name || girlName;
    m.wifeName = m.wifeName || girlName;
    m.rank = formalRank;
    m.status = formalStatus;
    m.dowry = Number(dowry) || m.dowry || 0;
    m.day = weddingDay;
    m.chamber = chosenChamber;
  }

  // 4. 确保居住空间物理存在
  if (!world.places[chosenChamber]) {
    world.places[chosenChamber] = {
      id: chosenChamber,
      name: defaultChamberName,
      parent: 'wang_mansion',
      use: 'bedroom',
      access: 'private_family',
      exits: ['wang_mansion', 'wang_mansion__hall'],
      owner: 'husband',
      occupant: girlId,
    };
  }

  // 5. 女方状态确立与入籍王府
  girl.household = true;
  girl.spouse = 'husband';
  girl.marital = 'married';
  girl.role = formalRank;
  girl.title = `${formalStatus}·${girl.title || girl.label || girlName}`;
  girl.home = 'wang_mansion';
  girl.location = chosenChamber;
  girl.residence = { type: 'own', placeId: chosenChamber };
  girl.relations = girl.relations || {};
  girl.relations.husband = {
    trust: Math.max(Number(girl.relations.husband?.trust) || 0, bondScore),
    desire: Math.max(Number(girl.relations.husband?.desire) || 0, Math.round(bondScore * 0.7)),
    lover: true,
    fear: 0,
    grievance: 0,
  };
  girl.intimacy = girl.intimacy || { level: 4, tone: 2, lastAt: Date.now() };

  // 6. 编织夫妻羁绊网络
  world.bonds.husband = world.bonds.husband || {};
  world.bonds[girlId] = world.bonds[girlId] || {};
  world.bonds.husband[girlId] = { type: '夫妻', score: bondScore };
  world.bonds[girlId].husband = { type: '夫妻', score: bondScore };

  // 7. 自动梳理岳家亲族社会网络（父辈翁婿羁绊）
  const parents = [];
  if (girl.father && world.actors[girl.father]) parents.push(world.actors[girl.father]);
  if (girl.mother && world.actors[girl.mother]) parents.push(world.actors[girl.mother]);
  // 智能推导长辈（如杨慎之之于杨采儿，崔文远之于崔婉宁）
  if (parents.length === 0) {
    if (girlId === 'yangzhenhua' && world.actors.yangshenzhi) parents.push(world.actors.yangshenzhi);
    if (/cui/i.test(girlId) && world.actors.cuiwenyuan) parents.push(world.actors.cuiwenyuan);
  }

  for (const p of parents) {
    world.bonds[p.id] = world.bonds[p.id] || {};
    world.bonds.husband[p.id] = { type: '岳婿', score: 75 };
    world.bonds[p.id].husband = { type: '岳婿', score: 75 };
    p.relations = p.relations || {};
    p.relations.husband = p.relations.husband || { trust: 50, desire: 0, fear: 0, grievance: 0 };
    p.relations.husband.trust = Math.max(Number(p.relations.husband.trust) || 0, 80);
  }

  // 8. 官押大红婚书通用自动生成入相公随身行囊
  const certName = formalStatus === '平妻'
    ? `《大乾临江府正三品知府千金${girlName}并嫡平妻婚书》`
    : `《大乾临江府衙朱印·${girlName}${formalStatus}婚书》`;

  const existingCert = itemsOf(world, 'husband').find((it) => it && (it.name === certName || String(it.name).includes(`${girlName}`) && String(it.name).includes('婚书')));
  if (!existingCert) {
    addItem(world, {
      name: certName,
      kind: '婚书',
      holder: 'husband',
      note: `朝廷兵部武选司与临江府衙大红官押。两姓联姻，明媒正娶，载明${girlName}正式入籍临江王府为${formalRank}（${formalStatus}），两头并大，琴瑟和鸣，永结秦晋之好，立字为凭。`,
      from: '大乾临江府衙与兵部司堂红押',
      day: weddingDay,
    });
  }

  // 9. 大事记流水落账
  const noteKey = `${girlName}·${formalStatus}`;
  if (!world.notes.some((n) => String(n.text || '').includes(girlName) && String(n.text || '').includes(formalStatus))) {
    world.notes.push({
      day: weddingDay,
      hour: 12,
      text: `王都司明媒正娶${girl.role || ''}${girlName}入府为${formalRank}，出具府衙官押红帖婚书，开席宴请临江官绅，两姓结为秦晋之好！`,
    });
  }

  console.log(`[MarriageEngine] 礼法成亲推演完毕：${girlName} 礼聘为王府【${formalRank}】，婚书入囊，厢房【${chosenChamber}】`);
  return {
    ok: true,
    marriage: m,
    girl,
    certName,
    line: `（两府官押齐备，吉日良辰，${girlName}已明媒正娶迎入王府东厢暖阁为${formalRank}，《${certName}》已稳妥存入您的随身行囊！）`,
  };
}

/**
 * 权威落地：明媒正娶正三品知府千金杨采儿入府为并嫡平妻（两头大）
 * （由通用大乾礼法引擎 executeMarriageAlliance 权威驱动，彻底废除个案特判）
 */
export function marryYangCaier(world, { dowry = 600, day = null } = {}) {
  return executeMarriageAlliance(world, {
    wifeId: 'yangzhenhua',
    rank: '正室·平妻',
    dowry,
    day,
    chamber: 'wang_mansion__main_room',
  });
}
