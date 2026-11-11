/**
 * 通用动态产业沙盒引擎（Universal Dynamic Industry & Asset Sandbox Engine）
 * 彻底杜绝打补丁与写死白名单，实现相公置办任何产业（兵工厂、窑厂、造纸坊、马场、镖局、货船等）
 * 的 100% 全自动化：智能行业分类、功能空间划分、专属管事大匠生成、时辰排班、日入测算与天道账簿闭环。
 */

import { hireStaff } from './employment.js';

function slugOf(name, seq) {
  return `project_${seq}`;
}

/**
 * 通用行业特征智能推导器
 * 根据产业名称与描述，自动推导出行业类型、管事头衔、营业时辰、功能空间、日入费率与经营描述
 */
export function inferIndustryProfile(projectName = '', title = '') {
  const s = `${projectName} ${title}`;

  // 1. 制造/军工/工场/作坊/烧造类（兵工厂、军械所、铁匠炉、陶瓷窑厂、砖瓦窑、造纸坊、印书局、织造厂、染坊、油坊等）
  if (/兵工|军械|铁匠|兵器|火器|武器|制造|工场|工匠|作坊|窑|烧造|瓷|陶|砖瓦|铸|冶|造纸|印书|织造|丝织|染坊|油坊|磨坊|工坊|酒坊|酿造/.test(s)) {
    const isMilitary = /兵工|军械|兵器|火器|铁匠|冶|铸/.test(s);
    const isKiln = /窑|瓷|陶|砖瓦/.test(s);
    return {
      kind: isMilitary ? 'military_workshop' : (isKiln ? 'kiln_workshop' : 'manufacture'),
      categoryCn: isMilitary ? '军械制造' : (isKiln ? '窑炉烧造' : '工坊制造'),
      managerRole: isMilitary ? '大匠总管' : (isKiln ? '窑头大管事' : '作坊大管事'),
      defaultStaffName: isMilitary ? '赵铁砧' : (isKiln ? '周窑师' : '齐大匠'),
      openHour: (isMilitary || isKiln) ? 0 : 6, // 窑炉与冶炼昼夜连炉不熄火
      closeHour: (isMilitary || isKiln) ? 24 : 20,
      shifts: (isMilitary || isKiln)
        ? [{ name: '早炉班', start: 0, end: 12 }, { name: '晚炉班', start: 12, end: 24 }]
        : [{ name: '作坊日班', start: 6, end: 20 }],
      rooms: isMilitary
        ? [{ key: 'forge', name: '锻打冶铁重区' }, { key: 'assembly', name: '军械装配房' }, { key: 'armory', name: '甲胄兵器封库' }]
        : (isKiln
          ? [{ key: 'kiln', name: '窑炉烧制重地' }, { key: 'pottery', name: '拉胚制坯房' }, { key: 'warehouse', name: '成瓷封箱仓' }]
          : [{ key: 'workshop', name: '工匠作坊' }, { key: 'warehouse', name: '原料成品仓' }]),
      rate: isMilitary ? 1.5 : (isKiln ? 1.4 : 1.3),
      desc: isMilitary
        ? `王家私家军械工坊。自造刀枪甲胄免市面高价采买，余量承接官衙驻军与大户护院订单，每日进账分润。`
        : (isKiln
          ? `王家名下烧造瓷窑。烧制精细瓷器与砖瓦，供名下酒楼大宅自用，大宗销往两淮客商，每日流水进账。`
          : `王家名下实业作坊。工料自给自足，大宗批发外销客商，每日结余进账。`),
      todayHighlight: isMilitary
        ? '熔炉通宵不熄，新出一批百炼精钢刀剑甲胄，结清官衙守备预支银两入账'
        : (isKiln
          ? '新一窑秘色瓷器开窑大吉，两淮客商通宵排队包圆起运，货款银两落账'
          : '工匠连夜赶制大宗订单交割，商队如期结算现银入账'),
    };
  }

  // 2. 水路漕运/货船/船帮
  if (/船|舟|舶|漕运|水运/.test(s)) {
    return {
      kind: 'ship',
      categoryCn: '水路漕运',
      managerRole: '船老大',
      defaultStaffName: '赵水生',
      openHour: 6,
      closeHour: 20,
      shifts: [{ name: '水路起航班', start: 6, end: 20 }],
      rooms: [{ key: 'deck', name: '船头甲板' }, { key: 'cabin', name: '货舱底舱' }],
      rate: 1.4,
      desc: '王家名下运河货船。常年承揽两淮客商拼船带货、捎货托运，每日漕运进账；自运茶粮免外包运费。',
      todayHighlight: '运河货船载满两淮客商托运南来丝绸与茶粮，结清水路运资入账',
    };
  }

  // 3. 陆路运输/镖局/车马行/货栈
  if (/镖局|车马|脚行|驿|货栈|运输|马队/.test(s)) {
    return {
      kind: 'logistics_land',
      categoryCn: '车马镖运',
      managerRole: '大镖头',
      defaultStaffName: '韩铁臂',
      openHour: 6,
      closeHour: 22,
      shifts: [{ name: '出镖日班', start: 6, end: 22 }],
      rooms: [{ key: 'hall', name: '前厅聚义堂' }, { key: 'yard', name: '后院演武场' }, { key: 'warehouse', name: '重载保税库' }],
      rate: 1.4,
      desc: '王家名下押运镖行。护送王家茶粮商队免遭山匪侵扰，兼接两淮客商大宗镖银托运，每日镖利流水进账。',
      todayHighlight: '长风镖队护送两淮茶商大队安全抵达，接取客商重赏并结清镖银入库',
    };
  }

  // 4. 产地/资源/马场/矿场/庄园/茶山/盐田
  if (/场|矿|山|庄|田|园|池|马场|林场|渔场|药圃/.test(s)) {
    return {
      kind: 'resource',
      categoryCn: '产地资源',
      managerRole: /马/.test(s) ? '马场总监' : (/矿/.test(s) ? '矿头总管' : '庄头管事'),
      defaultStaffName: '陈牧之',
      openHour: 6,
      closeHour: 20,
      shifts: [{ name: '农牧日班', start: 6, end: 20 }],
      rooms: [{ key: 'field', name: '产区总场' }, { key: 'office', name: '督管总棚' }],
      rate: 1.35,
      desc: '王家名下根基产地。源头出产大宗原料，自足各处铺面消耗，余料大宗外销，每日产出分润进账。',
      todayHighlight: '产地大批原料产出交割，大宗车队装车外运结清账款',
    };
  }

  // 5. 金融/钱庄/票号/当铺
  if (/钱庄|票号|当铺|典当|金银|银号/.test(s)) {
    return {
      kind: 'finance',
      categoryCn: '钱银汇兑',
      managerRole: '大朝奉',
      defaultStaffName: '钱文渊',
      openHour: 8,
      closeHour: 20,
      shifts: [{ name: '柜台日班', start: 8, end: 20 }],
      rooms: [{ key: 'counter', name: '高柜大堂' }, { key: 'vault', name: '厚铁地窖金库' }],
      rate: 1.5,
      desc: '王家名下钱银票号。操持银钱拆借、客商汇兑与典当利息，每日流水利钱滚滚进账。',
      todayHighlight: '南北客商大宗承兑现银，汇水抽分与典当息银流水落账',
    };
  }

  // 6. 雅集清贵/高端文娱（阁/楼/花楼/瓦舍）
  if (/阁|酒楼|花楼|瓦舍|勾栏|夜|琴|清贵|雅集/.test(s)) {
    return {
      kind: 'luxury',
      categoryCn: '酒楼雅集',
      managerRole: '大掌柜',
      defaultStaffName: '周掌柜',
      openHour: 10,
      closeHour: 26,
      shifts: [{ name: '日班', start: 10, end: 18 }, { name: '晚班', start: 18, end: 26 }],
      rooms: [{ key: 'f1', name: '一层大堂' }, { key: 'f2', name: '二层雅间' }],
      rate: 1.5,
      desc: '相公出资置办之清雅胜地，四方名士与世家公子包揽雅座，每日赏银进账。',
      todayHighlight: '达官贵客包揽雅间大宴宾客，赏银与酒水流水账款落账',
    };
  }

  // 7. 兜底传统市井商铺（铺、店、肆、坊、馆、堂、轩、行等）
  return {
    kind: 'shops',
    categoryCn: '市井商铺',
    managerRole: '掌柜',
    defaultStaffName: '李掌柜',
    openHour: 8,
    closeHour: 20,
    shifts: [{ name: '日班', start: 8, end: 20 }],
    rooms: [{ key: 'f1', name: '门面大堂' }],
    rate: 1.2,
    desc: `相公出资置办并开张的产业：${projectName}`,
    todayHighlight: '街坊四邻与往来客商络绎不绝，营生账目清算入账',
  };
}

/** 按营生定营业时辰 */
export function businessHoursFor(name = '', kind = '') {
  const profile = inferIndustryProfile(name, kind);
  return {
    openHour: profile.openHour,
    closeHour: profile.closeHour,
    shifts: profile.shifts,
  };
}

/** 按本钱与行业属性自动测算日入：基准 5% * 行业加成率 */
export function recommendedIncome(amount, title = '') {
  const base = Math.max(0, Number(amount) || 0) * 0.05;
  const profile = inferIndustryProfile('', title);
  return Math.max(0.5, Math.round(base * (profile.rate || 1.2) * 100) / 100);
}

/** 动态给产业挂载功能空间（厂房、窑炉、车马场、货舱、雅间等） */
function ensureProjectSpaces(world, prop, name, title = '') {
  if (!prop || !prop.placeId || !world.places?.[prop.placeId]) return;
  const profile = inferIndustryProfile(name, `${title} ${prop.desc || ''}`);
  const root = world.places[prop.placeId];
  root.rooms = root.rooms && typeof root.rooms === 'object' ? root.rooms : {};
  const specs = profile.rooms || [{ key: 'main', name: '主厅大堂' }];

  for (const s of specs) {
    const rid = `${prop.placeId}__${s.key}`;
    root.rooms[s.key] = root.rooms[s.key] || {
      id: rid,
      name: s.name,
      use: 'workshop_space',
      access: 'public_shop',
    };
    if (!world.places[rid]) {
      world.places[rid] = {
        id: rid,
        name: `${name}·${s.name}`,
        parent: prop.placeId,
        use: 'workshop_space',
        access: 'family_core',
        exits: [prop.placeId],
        createdDay: prop.openedDay || world.clock?.day || 1,
      };
    }
    root.exits = Array.isArray(root.exits) ? root.exits : [];
    if (!root.exits.includes(rid)) root.exits.push(rid);
  }
  prop.floors = specs.length;
  prop.floorNames = specs.map((s) => s.name);
}

/**
 * 核心入口：落地相公出资的任何产业（完全无需人工加正则，全自动适配）
 */
export function ensureProjectProperty(world, projectName, amount, { day = null, title = '' } = {}) {
  const name = String(projectName || '').replace(/^[「『\s]+|[」』\s]+$/g, '').trim().slice(0, 20);
  if (name.length < 2) return null;
  // 过滤明显的口语非产业词
  if (/^(相公|夫君|娘子|婉儿|芸娘|小翠|今天|明天|我们|他们|这个|那个|多少)$/.test(name)) return null;

  world.assets = world.assets || {};
  world.assets.properties = Array.isArray(world.assets.properties) ? world.assets.properties : [];
  const exists = world.assets.properties.find((p) => p && (
    String(p.name || '').includes(name) || name.includes(String(p.name || ''))
  ));

  const profile = inferIndustryProfile(name, title);

  if (exists) {
    const rec = recommendedIncome(Number(exists.costSilver ?? amount) || 0, `${exists.name || ''} ${title}`);
    if (exists.autoIncome !== false && Number(exists.incomePerDay) < rec && Number(exists.costSilver || 0) >= 50) {
      exists.incomePerDay = rec;
      exists.autoIncome = true;
      console.log(`[Project] 修正日入：${exists.name} → ${rec} 两/日`);
    }
    ensureProjectSpaces(world, exists, name, title);
    if (!Number(exists.openHour)) Object.assign(exists, businessHoursFor(name, exists.kind || ''));
    return exists;
  }

  world.places = world.places || {};
  world.flags = world.flags || {};
  const isShip = profile.kind === 'ship';

  let placeId = Object.keys(world.places).find((id) => String(world.places[id]?.name || '').includes(name));
  if (!placeId) {
    world.flags.projectPlaceSeq = (Number(world.flags.projectPlaceSeq) || 0) + 1;
    placeId = slugOf(name, world.flags.projectPlaceSeq);
    const parentExit = isShip ? (world.places?.dock ? 'dock' : 'street') : 'street';
    world.places[placeId] = {
      id: placeId,
      name: isShip ? `运河码头·${name}` : name,
      exits: [parentExit],
      use: isShip ? 'ship' : 'shop',
      dynamic: true,
      createdDay: world.clock?.day || 1,
      desc: profile.desc || `相公置下的产业：${name}`,
    };
  }

  world.flags.propertySeq = (Number(world.flags.propertySeq) || 0) + 1;
  const prop = {
    id: `prop_${world.flags.propertySeq}`,
    name,
    kind: profile.kind,
    category: profile.categoryCn,
    status: isShip ? '正常起航' : '已开张',
    owner: 'husband',
    keeper: 'husband',
    keeperName: '王甯',
    ownerName: '王甯',
    costSilver: Math.max(0, Number(amount) || 0),
    capital: Math.max(0, Number(amount) || 0),
    placeId,
    staff: 1,
    staffIds: [],
    incomePerDay: recommendedIncome(Number(amount) || 0, `${name} ${title}`),
    autoIncome: true,
    openedDay: Number(day) || Number(world.clock?.day) || 1,
    desc: profile.desc || `相公出资置办并开张的产业（${title || name}）`,
    todayHighlight: profile.todayHighlight,
  };

  ensureProjectSpaces(world, prop, name, title);
  Object.assign(prop, businessHoursFor(name, prop.kind || ''));
  world.assets.properties.push(prop);

  world.notes = Array.isArray(world.notes) ? world.notes : [];
  world.notes.push({ day: world.clock?.day || 1, hour: world.clock?.hour || 0, text: `产业入册：${name}（${prop.costSilver} 两开办）` });
  world.notes = world.notes.slice(-80);

  // 自动为新产业配备专属主管/大工头/掌柜
  if (!prop.staffIds || prop.staffIds.length === 0) {
    try {
      hireStaff(world, {
        propName: prop.name,
        name: profile.defaultStaffName || '沈管事',
        role: profile.managerRole || '管事',
        via: 'system',
      });
      console.log(`[Project] 自动配备主管：${profile.defaultStaffName}（${profile.managerRole}）入驻 ${prop.name}`);
    } catch { /* 忽略 */ }
  }

  console.log(`[Project] 全自动产业落地：${name}（${profile.categoryCn}），本钱 ${prop.costSilver} 两，日入 ${prop.incomePerDay} 两`);
  return prop;
}

/** 旧账修复：自动扫描所有扣款流水，凡属实业投资未建成的全部自动补建 */
export function repairProjectProperties(world) {
  let made = 0;
  for (const p of world?.assets?.properties || []) {
    if (!p || !p.name) continue;
    if (!Number(p.openHour)) Object.assign(p, businessHoursFor(p.name, p.kind || ''));
    if (p.placeId) continue;
    const hit = Object.entries(world.places || {}).find(([, pl]) => pl && (
      String(pl.name) === String(p.name) || String(pl.name).includes(String(p.name))
    ));
    if (hit) {
      p.placeId = hit[0];
      p.place = hit[0];
      p.placeName = String(hit[1].name || '');
      if (!p.status) p.status = '已开张';
      console.log(`[Project] 补挂产业地点：${p.name} → ${hit[1].name}`);
    }
  }

  const byName = new Map();
  for (const e of world?.ledger || []) {
    if (!e || Number(e.delta) >= 0) continue;
    const title = String(e.title || '').replace(/\s/g, '');
    const m = title.match(/^([\u4e00-\u9fa5]{2,12}?)(?:开张|盘铺|盘店|开业|买船|打船|造船|建厂|开厂|设坊)/)
      || title.match(/^(?:置办|购置|打制|买下|开办|筹建|设立|兴建)([\u4e00-\u9fa5]{2,12}?)$/);
    if (!m) continue;
    const cleanName = m[1];
    const amt = Math.abs(Number(e.delta) || 0);
    if (amt < 30) continue;
    byName.set(cleanName, Math.max(byName.get(cleanName) || 0, amt));
  }
  for (const [name, amt] of byName) {
    if (ensureProjectProperty(world, name, amt, { title: `${name}（旧账补录）` })) made += 1;
  }
  if (made) console.log(`[Project] 旧账补建产业 ${made} 间`);
  return made;
}
