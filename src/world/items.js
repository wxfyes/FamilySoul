/**
 * 物品账本：每件东西有编号、有类别、有持有者。
 *
 * 规矩：
 *   ① 物品不在谁手里，就不能给；
 *   ② 给/要/出示都走这里，单一写者；
 *   ③ 一件东西一个编号，同名的是两件。
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function ensureItems(world) {
  world.items = world.items && typeof world.items === 'object' ? world.items : {};
  world.flags = world.flags || {};
  world.flags.itemSeq = num(world.flags.itemSeq);
  return world.items;
}

export function addItem(world, { name, kind = '杂物', holder = 'husband', note = '' } = {}) {
  ensureItems(world);
  const nm = String(name || '').trim().slice(0, 24);
  if (!nm) return null;
  world.flags.itemSeq += 1;
  const id = `item_${world.flags.itemSeq}`;
  world.items[id] = {
    id, name: nm, kind: String(kind || '杂物').slice(0, 10),
    holder: String(holder || 'husband'), from: '', day: num(world.clock?.day) || 1,
    note: String(note || '').slice(0, 50),
  };
  return world.items[id];
}

export function itemsOf(world, holderId) {
  ensureItems(world);
  return Object.values(world.items).filter((it) => it && it.holder === String(holderId));
}

/** 按话里的词找一件东西（名字或类别命中） */
export function findItem(world, holderId, words) {
  const list = itemsOf(world, holderId);
  const w = String(words || '').trim();
  if (!w) return null;
  return list.find((it) => w.includes(it.name) || it.name.includes(w) || w.includes(it.kind) || it.kind.includes(w)) || null;
}

/** 给：只能给自己手里的东西 */
export function giveItem(world, fromId, toId, itemId) {
  ensureItems(world);
  const it = world.items[itemId];
  if (!it) return { ok: false, line: '（没有这件东西。）' };
  if (it.holder !== String(fromId)) return { ok: false, line: `（这件东西不在${world.actors?.[fromId]?.name || '你'}手里。）` };
  const to = world.actors?.[toId];
  if (!to) return { ok: false, line: '（没有这个人。）' };

  it.holder = String(toId);
  it.from = String(fromId);
  it.givenDay = num(world.clock?.day) || 1;

  // 增进羁绊与好感
  let trustDelta = 0;
  let desireDelta = 0;
  if (fromId === 'husband') {
    to.relations = to.relations || {};
    to.relations.husband = to.relations.husband || { trust: 20, desire: 10, grievance: 0 };
    const r = to.relations.husband;
    trustDelta = /契|银|珠|宝|玉|金|首饰|金钗|簪|玉镯/.test(it.name + it.kind) ? 8 : 4;
    desireDelta = to.gender === 'female' ? (/珠|宝|玉|金|首饰|金钗|簪|玉镯|绫罗/.test(it.name + it.kind) ? 6 : 3) : 0;
    r.trust = Math.min(100, (Number(r.trust) || 0) + trustDelta);
    r.desire = Math.min(100, (Number(r.desire) || 0) + desireDelta);
  }

  const fromName = world.actors?.[fromId]?.name || (fromId === 'husband' ? '相公' : fromId);
  console.log(`[Item] ${fromName} → ${to.name}：${it.name}`);
  return {
    ok: true,
    line: `（已把《${it.name}》赠予${to.name}。${trustDelta > 0 ? `对方信任+${trustDelta}，心意更深。` : ''}）`,
    item: it,
    trustDelta,
    desireDelta,
  };
}

/** 出示：随身拿着展示验看，不改变持有者 */
export function showItem(world, holderId, toId, itemId) {
  ensureItems(world);
  const it = world.items[itemId];
  if (!it) return { ok: false, line: '（没有这件东西。）' };
  if (it.holder !== String(holderId)) return { ok: false, line: `（这件东西不在手里。）` };
  const to = toId ? world.actors?.[toId] : null;
  const holderName = world.actors?.[holderId]?.name || (holderId === 'husband' ? '相公' : holderId);
  const toName = to?.name || '众人';
  return {
    ok: true,
    line: `（${holderName}自袖中取出一纸《${it.name}》，平摊在案前让${toName}当面勘验。）`,
    item: it,
  };
}

/** 索取：向在场某人讨要/取回东西 */
export function askItem(world, fromId, targetActorId, itemId) {
  ensureItems(world);
  const it = world.items[itemId];
  if (!it) return { ok: false, line: '（查无此物。）' };
  if (it.holder !== String(targetActorId)) return { ok: false, line: '（此物不在对方随身行囊中。）' };
  const target = world.actors?.[targetActorId];
  if (!target) return { ok: false, line: '（没有这个人。）' };

  const r = target.relations?.husband || {};
  const trust = Number(r.trust) || 0;
  const isDoc = /契|引|文|信|公文|卷宗/.test(it.name + it.kind);
  const isFamily = Boolean(target.household);
  const isLove = Boolean(target.intimacy?.consummated) || String(target.bondsWithHusband || '') === '相好' || Number(r.intimate) === 1;

  // 判定是否允许索取
  if (!isFamily && !isLove && !isDoc && trust < 40) {
    return {
      ok: false,
      refused: true,
      line: `（${target.name}下意识将《${it.name}》掩入袖口，面露难色：“相公休要说笑，此物事关体大，恕难从命。”）`,
    };
  }

  // 移交给索要者
  it.holder = String(fromId);
  it.from = String(targetActorId);
  it.givenDay = num(world.clock?.day) || 1;
  const receiverName = world.actors?.[fromId]?.name || (fromId === 'husband' ? '相公' : fromId);
  return {
    ok: true,
    line: `（${target.name}顺从地将《${it.name}》双手奉上，收入${receiverName}行囊。）`,
    item: it,
  };
}

/** 府库/茶坊/酒楼常备礼单模板：支持口语要茶、备礼或储物空间一键取用 */
export const HOUSEHOLD_SUPPLY_PRESETS = [
  {
    key: 'tea_mingqian',
    match: /春茶|明前|雨前|紫阳|好茶|茶叶|新茶|龙井|毛尖|茶/,
    name: '紫阳山头春茶（明前极品锡罐）',
    kind: '茗茶',
    note: '自家紫阳山茶园头采明前嫩芽，锡罐严封，汤清叶绿、兰香沁脾',
  },
  {
    key: 'wine_huadiao',
    match: /酒|美酒|花雕|女儿红|竹叶青|佳酿|酒坛/,
    name: '陈年绍兴女儿红（泥封佳酿）',
    kind: '美酒',
    note: '运河码头大酒楼地窖珍藏十载花雕佳酿，醇厚回甘',
  },
  {
    key: 'pastry_box',
    match: /点心|糕点|桂花糕|茶点|吃食|食盒|酥酪/,
    name: '江南桂花酥酪精致食盒',
    kind: '茶点',
    note: '临江茶坊老店秘制细点，甜而不腻，最宜佐茶',
  },
  {
    key: 'hairpin_gold',
    match: /珠钗|步摇|首饰|簪|钗|金钗|玉簪|头面/,
    name: '赤金点翠衔珠步摇',
    kind: '首饰',
    note: '临江银楼赤金累丝镶东珠步摇，华贵典雅，宜赠佳人',
  },
  {
    key: 'jade_bangle',
    match: /玉佩|玉镯|手镯|翡翠|美玉|白玉|镯子/,
    name: '羊脂白玉玲珑腕镯',
    kind: '珍玩',
    note: '温润无瑕羊脂白玉镯，雕工精湛，触手生温',
  },
  {
    key: 'silk_brocade',
    match: /绸缎|锦缎|云锦|布料|衣裳|罗裙|绫罗/,
    name: '江南苏绣流光云锦缎',
    kind: '绫罗',
    note: '上等苏绣流光云锦，色泽柔美，裁衣绝佳',
  },
  {
    key: 'rouge_box',
    match: /胭脂|水粉|香粉|螺子黛|香囊|香料/,
    name: '扬州鹅蛋香粉与螺子黛礼盒',
    kind: '闺物',
    note: '江南名坊贡品香粉黛墨，香气幽雅持久',
  },
  {
    key: 'silver_note',
    match: /银票|银子|盘缠|礼金|银两/,
    name: '大通钱庄五十两现兑银票',
    kind: '银票',
    note: '大通钱庄朱印官票，凭票即兑纹银五十两',
  },
  {
    key: 'banquet_card',
    match: /请帖|拜帖|请柬|邀帖/,
    name: '运河大酒楼天字阁雅席请柬',
    kind: '书帖',
    note: '王少掌柜亲笔泥金雅席邀帖，三层天字阁凭江设宴',
  },
];

/**
 * 从自家府库/茶坊/酒楼备妥一件物品放入相公随身储物空间
 */
export function prepareHouseholdItem(world, rawWord = '', fromName = '府库') {
  ensureItems(world);
  const w = String(rawWord || '').trim()
    .replace(/^(?:一点|一些|一罐|两罐|一盒|一份|一坛|一支|一件|个|点|好|上好|新焙的)+/g, '')
    .replace(/(?:来|吧|呀|啊|呢|给我|准备好)+$/g, '')
    .trim();
  const preset = HOUSEHOLD_SUPPLY_PRESETS.find((p) => p.key === w || p.match.test(w || rawWord));
  const itemName = preset ? preset.name : (w.length >= 2 && w.length <= 14 ? w : '紫阳山头春茶（明前极品锡罐）');
  const itemKind = preset ? preset.kind : '随身礼';
  const itemNote = preset ? preset.note : `由${fromName}遵命备妥并放入相公随身储物空间`;

  // 若行囊中已有同名物品，直接返回该物品（或若明确要茶/礼也可新增一件）
  const existing = itemsOf(world, 'husband').find((it) => it.name === itemName);
  if (existing) return { item: existing, created: false };

  const created = addItem(world, {
    name: itemName,
    kind: itemKind,
    holder: 'husband',
    note: itemNote,
  });
  if (created && fromName) created.from = fromName;
  return { item: created, created: true };
}


