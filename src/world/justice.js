/**
 * 京华风云 · 朝堂刑律与天牢诏狱提审系统（Imperial Justice & Prison System）
 *
 * 核心宗旨：
 *   1. 连续性高于爽感，说过的每句话、做过的每件事都在世界里留下痕迹；
 *   2. 相公身为太子太保兼江南水陆提督，兵权在握、位在六部之上，有权动吏部、动户部、锁拿百官；
 *   3. 确立物理处所【京师·天牢诏狱（锦衣卫狱）】单一收监入口；
 *   4. 严格提供审讯提审环节，审问逼供产生的供词与铁证文卷，100% 实时直接存入相公随身行囊；
 *   5. 行囊证据可随时在御前（乾清宫）呈递天子，实现查贪除奸、替沈家平反的宏大叙事闭环。
 */

import { moveActor } from './position.js';
import { addMemory } from './memory.js';
import { addItem, itemsOf } from './items.js';
import { syncAutoChronicle } from './auto-chronicle.js';

/**
 * 确保朝堂涉案关键涉贪重臣实体化
 */
export function ensureCorruptOfficials(world) {
  world.actors = world.actors || {};
  world.court = world.court || {};
  world.court.offices = world.court.offices || {};

  // 1. 户部左侍郎 随科（崔党骨干，沈家旧案直接操盘手）
  if (!world.actors.suike) {
    world.actors.suike = {
      id: 'suike',
      name: '随科',
      role: '户部左侍郎',
      gender: 'male',
      age: 46,
      city: '京城',
      location: 'gov_京城',
      home: 'gov_京城',
      faction: 'chancellor',
      desc: '户部左侍郎，崔相心腹死党，掌两淮盐漕度支。当年沈侍郎案便是其奉崔相之命私改总账、侵吞漕银二百万两。',
      relations: { husband: { trust: 5, fear: 85, desire: 0, favor: 0, loyalty: 0 } },
    };
  }

  // 2. 吏部尚书 宋延年（崔党门阀天官，掌天下文官铨选）
  if (!world.actors.songyannian) {
    world.actors.songyannian = {
      id: 'songyannian',
      name: '宋延年',
      role: '吏部尚书',
      gender: 'male',
      age: 55,
      city: '京城',
      location: 'gov_京城',
      home: 'gov_京城',
      faction: 'chancellor',
      desc: '吏部天官之长，崔元礼入幕之宾，专权文选司，历年卖官鬻爵收受金银无数，满朝门生皆出其手。',
      relations: { husband: { trust: 10, fear: 70, desire: 0, favor: 0, loyalty: 0 } },
    };
  }

  // 3. 户部尚书 卢承业（已在 state seed，确保属性完整）
  if (!world.actors.luchengye) {
    world.actors.luchengye = {
      id: 'luchengye',
      name: '卢承业',
      role: '户部尚书',
      gender: 'male',
      age: 52,
      city: '京城',
      location: 'gov_京城',
      home: 'gov_京城',
      faction: 'chancellor',
      desc: '户部尚书，深谙度支做账之道，在崔相庇护下盘剥江南江北军饷与国库税银。',
      relations: { husband: { trust: 15, fear: 65, desire: 0, favor: 0, loyalty: 0 } },
    };
  }

  return world.actors;
}

/**
 * 匹配被相公点名拿办的目标官员
 */
function findTargetOfficial(world, query) {
  ensureCorruptOfficials(world);
  const q = String(query || '').trim();
  const actors = Object.values(world.actors || {});

  // 1. 精确人名匹配
  for (const a of actors) {
    if (!a || !a.name) continue;
    if (q.includes(a.name) || (a.name.length >= 2 && q.includes(a.name.slice(-2)))) {
      return a;
    }
  }

  // 2. 官职代称匹配
  if (/随科|随侍郎|户部侍郎|侍郎随/.test(q)) return world.actors.suike;
  if (/卢承业|卢尚书|户部尚书|尚书卢/.test(q)) return world.actors.luchengye;
  if (/宋延年|宋尚书|吏部尚书|吏部天官/.test(q)) return world.actors.songyannian;
  if (/崔元礼|崔相|首辅|宰相/.test(q)) return world.actors.cuiyuanli;

  // 3. 部院泛指
  if (/户部/.test(q)) return world.actors.suike || world.actors.luchengye;
  if (/吏部/.test(q)) return world.actors.songyannian;

  return null;
}

/**
 * 太子太保专权：抓人下诏狱单一入口
 * @param {object} world 
 * @param {string} query 指令文本或目标人名
 * @param {object} opts { reason, by }
 */
export function arrestActorToPrison(world, query, { reason = '', by = 'husband' } = {}) {
  const target = findTargetOfficial(world, query);
  if (!target) {
    return { ok: false, error: '未查明该官员身家底细，未能拿办' };
  }
  if (target.id === 'husband' || target.id === 'emperor') {
    return { ok: false, error: '国之重器，不可妄动' };
  }

  // 确保天牢物理处所存在
  world.places = world.places || {};
  if (!world.places.capital_prison) {
    world.places.capital_prison = {
      id: 'capital_prison',
      name: '京师·天牢诏狱（锦衣卫狱）',
      city: '京城',
      kind: '天牢',
      use: 'jail',
      access: 'restricted',
      exits: ['capital_street', 'palace_meridian_gate'],
    };
  }

  const origRole = target.role || '官员';
  const targetName = target.name;

  // 1. 褫夺乌纱官袍
  target.formerRole = origRole;
  target.role = `待罪阶下囚·原${origRole}`;
  target.prisoner = true;

  // 2. 标记收监天牢
  target.jailed = {
    place: 'capital_prison',
    day: world.clock?.day || 1,
    hour: world.clock?.hour || 0,
    reason: reason || '太子太保严令锦衣卫缇骑查办收监',
    by,
    interrogated: false,
  };

  // 3. 物理移动到天牢
  moveActor(world, target.id, 'capital_prison', 'world', '捕送收监京师天牢诏狱');

  // 4. 朝堂官缺空置
  for (const [key, off] of Object.entries(world.court?.offices || {})) {
    if (off && off.holder === target.id) {
      off.vacant = true;
      off.formerHolder = target.id;
      off.holder = null;
    }
  }

  // 5. 记录重大事件记忆与大事记
  const memText = `太子太保王甯雷霆下令，锦衣卫缇骑四出直扑衙署，当场褫夺${origRole}${targetName}顶戴花翎，套上五十斤铁叶重枷打入京师天牢诏狱！`;
  addMemory(world, {
    text: memText,
    about: ['husband', target.id],
    visible: 'public',
    day: world.clock?.day,
  });

  world.milestones = Array.isArray(world.milestones) ? world.milestones : [];
  const msTitle = `【铁腕震肃朝纲·革职查办${targetName}下天牢诏狱】`;
  if (!world.milestones.some((m) => String(m).includes(targetName) && String(m).includes('天牢'))) {
    world.milestones.unshift(`${msTitle}：相公官拜太子太保，行雷霆权柄，密调锦衣卫缇骑当堂革除${origRole}${targetName}官阶，套上重枷打入京师天牢诏狱候审，满朝文武莫不震悚！`);
  }

  return {
    ok: true,
    actor: target,
    text: `（太子太保钧旨既下，锦衣卫缇骑四出直扑衙署，铁链声震耳，当场褫夺${origRole}${targetName}顶戴公服，套上五十斤重枷，押入京师天牢诏狱候审！）`,
  };
}

/**
 * 天牢提审与审问逼供单一入口：逼出供词，证据 100% 实时放入相公随身行囊
 * @param {object} world 
 * @param {string} query 审讯目标或言辞
 * @param {object} opts { method, by }
 */
export function interrogatePrisoner(world, query, { method = '用大刑', by = 'husband' } = {}) {
  ensureCorruptOfficials(world);
  // 优先在关押于 capital_prison 的犯人中寻找
  const prisonersInJail = Object.values(world.actors || {}).filter(
    (a) => a && a.jailed && (a.location === 'capital_prison' || a.jailed.place === 'capital_prison' || /天牢|诏狱/.test(String(world.places?.[a.location]?.name || '')))
  );

  let target = null;
  const q = String(query || '').trim();
  if (prisonersInJail.length === 1 && !/(卢承业|随科|宋延年|崔元礼)/.test(q)) {
    target = prisonersInJail[0];
  } else {
    for (const p of prisonersInJail) {
      if (q.includes(p.name) || (p.role && q.includes(p.role))) {
        target = p;
        break;
      }
    }
  }

  if (!target) {
    // 若天牢暂无人，但相公指名道姓要审问某位涉案奸官，先触发当场抓拿收监再提审
    const candidate = findTargetOfficial(world, query);
    if (candidate) {
      arrestActorToPrison(world, candidate.name, { reason: '太保提审立案' });
      target = candidate;
    } else if (prisonersInJail.length > 0) {
      target = prisonersInJail[0];
    } else {
      return { ok: false, error: '诏狱铁栅内眼下并无可供提审的朝廷要犯。相公可先传令抓拿涉案奸官下狱！' };
    }
  }

  world.items = world.items || {};
  const dayNow = Number(world.clock?.day) || 1;
  const targetId = target.id;
  const targetName = target.name;
  const itemsGranted = [];
  let confessionSpeech = '';

  // ═══ 针对不同要犯生成无可辩驳的核心铁证 ═══
  if (targetId === 'suike' || /随科|户部/.test(target.role || '')) {
    // 核心证物 1：沈家旧案二百万两私账暗册
    const item1 = {
      name: '《沈家旧案·户部亏空二百万两私账暗册》',
      kind: '证据',
      holder: 'husband',
      from: '京师天牢诏狱·户部侍郎随科逼供画押',
      day: dayNow,
      note: '户部侍郎随科被诏狱大刑拷讯后亲笔画押招供之机密铁证！详录当年崔元礼与户部侵吞两淮盐税漕银二百万两、私改账目陷害沈侍郎之全部手抄底账与分赃明细，铁证如山！',
    };
    const added1 = addItem(world, item1);
    if (added1) itemsGranted.push(item1.name);

    // 核心证物 2：随科认罪血书供状
    const item2 = {
      name: '《随科亲笔画押认罪血书供状》',
      kind: '证据',
      holder: 'husband',
      from: '京师天牢诏狱公案',
      day: dayNow,
      note: '随科在锦衣卫诏狱刑讯公案前亲手按血手印之招认供词，逐字招认受首辅崔元礼密令陷害沈侍郎、侵吞军饷之全部罪状。',
    };
    const added2 = addItem(world, item2);
    if (added2) itemsGranted.push(item2.name);

    confessionSpeech = `【嫌犯画押认罪·随科】：（披头散发，戴着重木枷扑通跪倒在血污刑砖上，哭嚎叩首）“太保大人饶命！太保大人饶命啊！小的全招了！当年沈侍郎根本没有亏空……是崔阁老嫌他挡了世家发财的路，逼着小的在户部总账上动了手脚，那二百万两漕银全被崔府门阀私分了！暗账就藏在小的京城西宅枯井夹壁里，小的全写在这本册子上了……求太保爷在皇上面前留小的一条狗命啊！”`;
  } else if (targetId === 'songyannian' || /宋延年|吏部/.test(target.role || '')) {
    const item1 = {
      name: '《吏部文选司·卖官鬻爵通敌私账底册》',
      kind: '证据',
      holder: 'husband',
      from: '京师天牢诏狱·吏部尚书宋延年搜缴供词',
      day: dayNow,
      note: '吏部尚书宋延年招认画押之文选司卖官暗档，详细列明崔党安插在江南江北十三省的所有门生故吏名单与受贿黄金十万两明细。',
    };
    const added1 = addItem(world, item1);
    if (added1) itemsGranted.push(item1.name);

    confessionSpeech = `【嫌犯画押认罪·宋延年】：（脸色惨白，战战兢兢按上朱红手印）“下官招了……吏部文选司每岁缺员选授，皆按崔阁老的意思立价贩卖。这份底册写尽了崔党十三省所有暗线故吏，全凭太保大人发落处置！”`;
  } else if (targetId === 'luchengye' || /卢承业/.test(target.role || '')) {
    const item1 = {
      name: '《户部度支司·克扣江南水师军饷底单》',
      kind: '证据',
      holder: 'husband',
      from: '京师天牢诏狱·卢承业招供画押',
      day: dayNow,
      note: '户部尚书卢承业画押呈缴之克扣大军粮饷底单，明载兵部实发五万大军粮饷皆被层层克扣入相府私库之罪状。',
    };
    const added1 = addItem(world, item1);
    if (added1) itemsGranted.push(item1.name);

    confessionSpeech = `【嫌犯画押认罪·卢承业】：（瘫坐在地，痛哭流涕）“太保爷明察！江南大军的粮饷真不是下官一人敢贪的啊……全是相党每月抽走七成！账簿在此，下官签字画押，只求保全家小性命！”`;
  } else {
    const item1 = {
      name: `《${targetName}亲笔画押认罪口供卷宗》`,
      kind: '证据',
      holder: 'husband',
      from: '京师天牢诏狱提审',
      day: dayNow,
      note: `${targetName}在太子太保威势前认罪画押之供状文卷，罪证确凿，立案存底。`,
    };
    const added1 = addItem(world, item1);
    if (added1) itemsGranted.push(item1.name);

    confessionSpeech = `【嫌犯画押认罪·${targetName}】：（跪地哀告，颤抖画押）“小的罪该万死，所有欺君罔上、贪赃枉法之勾当尽皆招认，全凭太保大人裁决严惩！”`;
  }

  target.jailed.interrogated = true;
  target.confessed = true;

  // 记录重大记忆
  const memText = `太子太保王甯亲临天牢诏狱提审${targetName}，严明律法，迫其全盘吐露罪状并画押认罪，当场起获【${itemsGranted.join('、')}】并存入相公随身行囊！`;
  addMemory(world, {
    text: memText,
    about: ['husband', target.id],
    visible: 'private',
    day: dayNow,
  });

  // 大事记记录
  syncAutoChronicle(world);

  return {
    ok: true,
    actor: target,
    items: itemsGranted,
    speech: confessionSpeech,
    text: `（刑讯室内烛火阴森，烙铁赤红。千户陆锋端上供状，在相公威严注视下，${targetName}防线彻底瓦解，哭嚎着招认所有罪状并按上鲜红血手印！）\n\n${confessionSpeech}\n\n【随身行囊已入账】：\n${itemsGranted.map((n) => `• 获得重要物证：${n}`).join('\n')}\n（物证已稳妥收入相公随身行囊，可随时动身前往紫禁城乾清宫面圣呈递御览！）`,
  };
}

/**
 * 太子太保专权：天牢处决正法（杀人）单一入口
 */
export function executePrisoner(world, query, { by = 'husband' } = {}) {
  const prisonersInJail = Object.values(world.actors || {}).filter(
    (a) => a && a.jailed && (a.location === 'capital_prison' || a.jailed.place === 'capital_prison')
  );
  let target = null;
  const q = String(query || '').trim();
  for (const p of prisonersInJail) {
    if (q.includes(p.name) || (p.role && q.includes(p.role))) {
      target = p;
      break;
    }
  }
  if (!target && prisonersInJail.length === 1) target = prisonersInJail[0];
  if (!target) return { ok: false, error: '天牢内未找到所指要犯，未能行刑' };

  target.dead = true;
  target.deadDay = world.clock?.day || 1;
  target.deadReason = '奉太子太保法旨斩立决';
  delete target.jailed;

  const targetName = target.name;
  const memText = `太子太保王甯手按尚方利刃，在京师天牢严令斩决巨奸${targetName}，明正典刑，悬首示众，京华百官为之震怖！`;
  addMemory(world, {
    text: memText,
    about: ['husband', target.id],
    visible: 'public',
    day: world.clock?.day,
  });

  return {
    ok: true,
    actor: target,
    text: `（诏狱刑场黑幡招展，相公掷下朱红令箭！刽子手鬼头大刀寒光乍现，噗嗤一声，巨奸${targetName}当场枭首正法！天日昭昭，人心大快！）`,
  };
}

/**
 * 乾清宫御前呈递铁证：面圣平反沈家旧案
 */
export function presentEvidenceToEmperor(world) {
  const husbandItems = itemsOf(world, 'husband');
  const evidenceItems = Array.isArray(husbandItems)
    ? husbandItems.filter((it) => it && (it.name?.includes('沈家旧案') || it.name?.includes('随科') || it.name?.includes('私账暗册')))
    : [];

  if (evidenceItems.length === 0) {
    return { ok: false, error: '随身行囊中尚无户部贪墨与沈家旧案之确凿铁证文卷，请先下诏狱提审要犯。' };
  }

  // 皇帝龙颜大怒并下旨昭雪
  world.flags = world.flags || {};
  world.flags.shenFamilyVindicated = true;

  const msTitle = '【乾清宫呈递铁证·天子下旨彻底昭雪沈家旧案】';
  world.milestones = Array.isArray(world.milestones) ? world.milestones : [];
  if (!world.milestones.some((m) => String(m).includes('彻底昭雪沈家旧案'))) {
    world.milestones.unshift(`${msTitle}：相公于乾清宫御案前亲呈《户部亏空二百万两私账暗册》与《随科亲笔画押血书供状》，当今天子萧景隆拍案大怒，当场朱批降旨：沈家当年清白无辜，特予平反昭雪，追复沈侍郎官爵谥号；户部贪官尽数抄没，首辅崔元礼结党营私着令内阁严加查办！正妻沈婉儿沉冤得雪，感极而泣！`);
  }

  return {
    ok: true,
    text: `（紫禁城·乾清宫内。相公自随身行囊中取出《沈家旧案·户部亏空二百万两私账暗册》与随科血书供状，双手呈递御案！\n天子萧景隆御览之下，勃然作色，一掌狠狠拍在金丝楠木御案上：“好一个崔元礼！好一个户部！两百万两漕银，他们竟敢栽赃到忠良头上分肥！若非太保雷霆手段拿到铁证，朕还要被这帮国贼蒙在鼓里！”\n天子当即执起朱笔，御批圣旨昭雪沈家，下诏重重褒奖太保之功！）`,
  };
}
