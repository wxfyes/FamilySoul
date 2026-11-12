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
  const nm = String(name || '').trim().slice(0, 28);
  if (!nm) return null;
  world.flags.itemSeq += 1;
  const id = `item_${world.flags.itemSeq}`;
  world.items[id] = {
    id, name: nm, kind: String(kind || '杂物').slice(0, 10),
    holder: String(holder || 'husband'), from: '', day: num(world.clock?.day) || 1,
    note: String(note || '').slice(0, 80),
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

  // 朝廷告身敕牒与虎符官印乃命官身家所系，只可出示亮印，不可送人
  if (/告身|敕牒|诰命|官印|兵符|虎符|委任牌票|尚方/.test(String(it.name || '') + String(it.kind || ''))) {
    return {
      ok: false,
      line: `（《${it.name}》乃朝廷兵部颁授的命官告身与兵符重器，干系身家性命与军权，只可当众【出示】亮明官威，绝不可赠予他人！）`,
    };
  }

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
  const holderName = world.actors?.[holderId]?.name || (holderId === 'husband' ? '王都司' : holderId);
  const toName = to?.name || '在场众人';
  const isOfficialCred = /告身|敕牒|诰命|官印|兵符|虎符|委任牌票|尚方/.test(String(it.name || '') + String(it.kind || ''));
  if (isOfficialCred) {
    let trustDelta = 8;
    if (to) {
      to.relations = to.relations || {};
      to.relations.husband = to.relations.husband || { trust: 20, desire: 10, grievance: 0 };
      to.relations.husband.trust = Math.min(100, (Number(to.relations.husband.trust) || 0) + trustDelta);
    }
    return {
      ok: true,
      line: `（${holderName}自怀中取出朝廷兵部颁授的《${it.name}》，鲜红兵部朱印与虎符寒光凛然，当众亮明大明朝廷命官真凭实据！${toName}见状凛然肃立、躬身抱拳行礼！）`,
      item: it,
      trustDelta,
    };
  }
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
    label: '春茶',
    match: /春茶|明前|雨前|紫阳|好茶|茶叶|新茶|龙井|毛尖|茶/,
    name: '紫阳山头春茶（明前极品锡罐）',
    kind: '茗茶',
    note: '自家紫阳山茶园头采明前嫩芽，锡罐严封，汤清叶绿、兰香沁脾',
  },
  {
    key: 'wine_huadiao',
    label: '花雕',
    match: /酒|美酒|花雕|女儿红|竹叶青|佳酿|酒坛/,
    name: '陈年绍兴女儿红（泥封佳酿）',
    kind: '美酒',
    note: '运河码头大酒楼地窖珍藏十载花雕佳酿，醇厚回甘',
  },
  {
    key: 'pastry_box',
    label: '茶点',
    match: /点心|糕点|桂花糕|茶点|吃食|食盒|酥酪/,
    name: '江南桂花酥酪精致食盒',
    kind: '茶点',
    note: '临江茶坊老店秘制细点，甜而不腻，最宜佐茶',
  },
  {
    key: 'hairpin_gold',
    label: '步摇',
    match: /珠钗|步摇|首饰|簪|钗|金钗|玉簪|头面/,
    name: '赤金点翠衔珠步摇',
    kind: '首饰',
    note: '临江银楼赤金累丝镶东珠步摇，华贵典雅，宜赠佳人',
  },
  {
    key: 'jade_bangle',
    label: '玉镯',
    match: /玉佩|玉镯|手镯|翡翠|美玉|白玉|镯子/,
    name: '羊脂白玉玲珑腕镯',
    kind: '珍玩',
    note: '温润无瑕羊脂白玉镯，雕工精湛，触手生温',
  },
  {
    key: 'silk_brocade',
    label: '云锦',
    match: /绸缎|锦缎|云锦|布料|衣裳|罗裙|绫罗/,
    name: '江南苏绣流光云锦缎',
    kind: '绫罗',
    note: '上等苏绣流光云锦，色泽柔美，裁衣绝佳',
  },
  {
    key: 'rouge_box',
    label: '香粉',
    match: /胭脂|水粉|香粉|螺子黛|香囊|香料/,
    name: '扬州鹅蛋香粉与螺子黛礼盒',
    kind: '闺物',
    note: '江南名坊贡品香粉黛墨，香气幽雅持久',
  },
  {
    key: 'silver_note',
    label: '银票',
    match: /银票|银子|盘缠|礼金|银两/,
    name: '大通钱庄五十两现兑银票',
    kind: '银票',
    note: '大通钱庄朱印官票，凭票即兑纹银五十两',
  },
  {
    key: 'banquet_card',
    label: '请帖',
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
  if (!preset && /^(想想|办法|递信|回信|去看看|看看|问问|商议|过去|去找|知道|明白|安排|吩咐)/.test(w)) {
    return null;
  }
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

/**
 * 朝廷武勋官阶与正式文书凭证、官印虎符映射表（单一真相源）
 */
export const OFFICIAL_CREDENTIAL_DEFS = [
  {
    officeKey: 'tuanlian',
    rank: '正七品',
    title: '临江府乡勇团练使',
    rankTitle: '正七品·临江府乡勇团练使',
    shortCall: '王团练',
    credentials: [
      {
        name: '临江府衙·乡勇团练使委任牌票',
        kind: '敕牒',
        from: '临江知府衙门',
        note: '临江知府杨慎之大人亲批红押委任状，准统领乡勇团练弹压地方匪盗',
      },
    ],
  },
  {
    officeKey: 'shoubei',
    rank: '从五品',
    title: '临江府守备',
    rankTitle: '从五品·临江府守备',
    shortCall: '王守备',
    credentials: [
      {
        name: '兵部勘合·临江府守备告身文凭',
        kind: '敕牒',
        from: '朝廷兵部武选司',
        note: '兵部武选清吏司勘合实授从五品临江府守备告身，掌一府城池守御之权',
      },
    ],
  },
  {
    officeKey: 'dusi',
    rank: '正四品',
    title: '临江府都司',
    rankTitle: '正四品·临江府都司',
    shortCall: '王都司',
    credentials: [
      {
        name: '兵部武选司·临江府都司实授敕牒',
        kind: '敕牒',
        from: '朝廷兵部武选司',
        note: '朝廷兵部尚书省朱印勘合敕牒，叙剿匪大功实授正四品临江府都指挥佥事（都司）',
      },
      {
        name: '临江府都司·紫金虎符与官印',
        kind: '官印',
        from: '朝廷兵部与礼部铸印局',
        note: '正四品武官紫金调兵虎符与「临江府都司之印」铜印、玄铁嵌金腰牌',
      },
    ],
  },
  {
    officeKey: 'canjiang',
    rank: '从三品',
    title: '江淮参将',
    rankTitle: '从三品·江淮参将',
    shortCall: '王参将',
    credentials: [
      {
        name: '兵部奉旨·江淮参将诰命敕书',
        kind: '敕牒',
        from: '朝廷兵部与司礼监',
        note: '奉天承运皇帝制曰：实授从三品江淮分守参将，节制江淮水陆诸营兵马',
      },
      {
        name: '江淮参将·调兵银虎符',
        kind: '官印',
        from: '朝廷兵部',
        note: '从三品江淮参将虎符关防大印，持符可调遣江淮各州府驻军协剿',
      },
    ],
  },
  {
    officeKey: 'fuzongbing',
    rank: '正三品',
    title: '江北副总兵',
    rankTitle: '正三品·江北副总兵',
    shortCall: '王总戎',
    credentials: [
      {
        name: '兵部尚书省·江北副总兵金册诰命',
        kind: '敕牒',
        from: '朝廷兵部',
        note: '正三品昭勇将军、协守江北副总兵官金册诰命与总戎虎符关防',
      },
    ],
  },
  {
    officeKey: 'zongbing',
    rank: '正二品',
    title: '镇守两淮总兵官',
    rankTitle: '正二品·镇守两淮总兵官',
    shortCall: '王大帅',
    credentials: [
      {
        name: '敕谕·镇守两淮总兵官平贼将军金印',
        kind: '官印',
        from: '当今天子钦颁',
        note: '正二品镇守两淮地方总兵官、挂平贼将军金印，开府建牙，节制两淮军政',
      },
    ],
  },
  {
    officeKey: 'tiduzongbing',
    rank: '从一品',
    title: '江南水陆提督总兵官',
    rankTitle: '从一品·江南水陆提督总兵官',
    shortCall: '王提督',
    credentials: [
      {
        name: '钦赐尚方剑·江南水陆提督军务诏书',
        kind: '官印',
        from: '当今天子钦赐',
        note: '从一品江南江北水陆提督军务总兵官诏书并钦赐尚方宝剑，副将以下先斩后奏',
      },
    ],
  },
];

/**
 * 提取相公当前持有的朝廷最高官职与全部官衔信息
 */
export function getHusbandOfficialInfo(world) {
  const offices = world?.court?.offices || {};
  const heldDefs = OFFICIAL_CREDENTIAL_DEFS.filter(
    (d) => offices[d.officeKey] && String(offices[d.officeKey].holder || '') === 'husband'
  );
  if (heldDefs.length === 0) {
    return {
      hasOffice: false,
      rank: '',
      highestTitle: '',
      fullTitle: '',
      shortCall: '王少掌柜',
      quelled: Number(world?.flags?.quelledTotal) || 0,
      allTitles: [],
    };
  }
  const highest = heldDefs[heldDefs.length - 1];
  return {
    hasOffice: true,
    officeKey: highest.officeKey,
    rank: highest.rank,
    highestTitle: highest.title,
    fullTitle: highest.rankTitle,
    shortCall: highest.shortCall,
    quelled: Math.max(Number(world?.flags?.quelledTotal) || 0, heldDefs.length * 2),
    allTitles: heldDefs.map((d) => d.title),
  };
}

/**
 * 核发并补齐相公已获授官职对应的正式兵部告身敕牒与官印虎符入随身行囊（幂等）
 */
export function ensureOfficialCredentials(world) {
  ensureItems(world);
  if (Array.isArray(world.items)) {
    for (let i = world.items.length - 1; i >= 0; i--) {
      const it = world.items[i];
      if (it && it.kind === '随身礼' && /^(想想办法|递信|回信|去看看|看看|问问|商议|过去|去找)$/.test(String(it.name || '').trim())) {
        world.items.splice(i, 1);
      }
    }
  }
  const offices = world?.court?.offices || {};
  const myItems = itemsOf(world, 'husband');
  const issued = [];

  for (const def of OFFICIAL_CREDENTIAL_DEFS) {
    const off = offices[def.officeKey];
    if (!off || String(off.holder || '') !== 'husband') continue;
    for (const cred of def.credentials) {
      const exists = myItems.some((it) => it && it.name === cred.name);
      if (!exists) {
        const added = addItem(world, {
          name: cred.name,
          kind: cred.kind,
          holder: 'husband',
          note: cred.note,
        });
        if (added) {
          added.from = cred.from;
          added.day = Number(off.at?.day) || Number(world.clock?.day) || 1;
          issued.push(added);
        }
      }
    }
  }

  // 同步更新相公的权威身份标签（朝廷命官 + 商界巨擘双重尊荣）
  const info = getHusbandOfficialInfo(world);
  if (info.hasOffice && world.actors?.husband) {
    world.actors.husband.officialTitle = info.highestTitle;
    world.actors.husband.role = `${info.highestTitle}·临江王氏家主`;
  }

  return issued;
}



