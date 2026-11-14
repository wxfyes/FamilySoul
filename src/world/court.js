/**
 * 大乾中枢朝堂与党争人事任免引擎（Court Faction & Official Appointment Engine）
 * 
 * 核心宗旨：
 *   1. 文武百官皆有其身，非死板符号；
 *   2. 官员有派系、有品级、有人心倾向，可被弹劾、罢免、开缺、提拔、相公亲自兼领或委派属下顶替；
 *   3. 相公官拜从一品水陆提督，奉旨节制天下水陆诸军，兵权在握；
 *   4. 四大派系鼎立：帝党（天子）、相党（首辅）、王党（提督军门派/相公）、清流风宪派。
 */

import { nextEvent } from './state.js';
import { addMemory } from './memory.js';

// 中枢官缺与品阶编制
export const COURT_OFFICE_SPECS = {
  // ═══ 文官中枢 ═══
  chancellor: { title: '当朝首辅大学士', rank: '正一品', category: 'civil', desc: '内阁之首，票拟天下奏章，秉国重权。' },
  sub_chancellor: { title: '内阁次辅大学士', rank: '从一品', category: 'civil', desc: '内阁次席，协理阁务，分掌六部之议。' },
  personnel: { title: '吏部尚书', rank: '正二品', category: 'civil', desc: '天官之长，主司天下文官升迁黜陟与考核大计。' },
  revenue: { title: '户部尚书', rank: '正二品', category: 'civil', desc: '地官之长，掌天下财赋、度支国库与田亩盐漕。' },
  rites: { title: '礼部尚书', rank: '正二品', category: 'civil', desc: '掌天下典礼、科举取士、宗藩礼法与四方朝贡。' },
  war: { title: '兵部尚书', rank: '正二品', category: 'military_admin', desc: '夏官之长，掌天下武官铨选、行军图谱与兵籍军饷。' },
  justice: { title: '刑部尚书', rank: '正二品', category: 'civil', desc: '秋官之长，掌天下律令刑名与秋决重案。' },
  works: { title: '工部尚书', rank: '正二品', category: 'civil', desc: '冬官之长，掌天下城防要塞、河渠营造与匠作工造。' },
  censor_chief: { title: '都察院左都御史', rank: '正二品', category: 'censor', desc: '风宪言官之首，纠劾百官，纠绳朝野纲纪。' },

  // ═══ 武官禁卫与军门枢纽 ═══
  tiduzongbing: { title: '江南江北水陆提督总兵官', rank: '从一品', category: 'military_field', desc: '特授钦赐尚方宝剑，总督江南江北水陆诸镇兵马，开府建牙。' },
  capital_commander: { title: '九门提督兼京营巡防', rank: '正二品', category: 'military_field', desc: '节制京师九门防务与巡防马步精锐，宿卫京畿。' },
  guard_commander: { title: '殿前禁军领侍卫内大臣', rank: '正一品', category: 'military_guard', desc: '宿卫大内金銮与乾清宫，掌大汉将军与御前带刀侍卫。' },
  governor: { title: '江南巡抚都察院右副都御史', rank: '从二品', category: 'civil_field', desc: '巡抚江南地方，总督民政巡防。' },
};

/** 派系定义 */
export const FACTIONS = {
  husband: { id: 'husband', name: '王党（提督军门派）', leader: 'husband', desc: '以水陆提督王甯为核心之军功与实业新贵，手握天下兵符与江淮财税命脉。' },
  court: { id: 'court', name: '帝党（天子近臣）', leader: 'emperor', desc: '忠于年轻天子萧景隆，急于革除弊政、重振大乾雄风之忠直力量。' },
  chancellor: { id: 'chancellor', name: '相党（世家门阀）', leader: 'cuiyuanli', desc: '首辅崔元礼把持之内阁门阀文官势力，根深蒂固，权倾朝野。' },
  censor: { id: 'censor', name: '清流清议派', leader: 'xuzhengdao', desc: '都察院御史与翰林清流，崇尚直谏名节，自视孤高，弹劾不避权贵。' },
};

/**
 * 初始化并健全中枢百官体系与派系羁绊（幂等自愈）
 */
export function ensureCourtSystem(world) {
  world.court = world.court || {};
  world.court.offices = world.court.offices || {};
  world.court.factions = world.court.factions || { ...FACTIONS };
  world.actors = world.actors || {};

  // 1. 初始化预设核心大臣
  const presetMinisters = [
    {
      id: 'emperor',
      name: '萧景隆',
      role: '当朝天子',
      title: '天子',
      office: 'emperor',
      gender: 'male',
      age: 24,
      city: '京城',
      location: 'palace_qianqing',
      home: 'palace_qianqing',
      faction: 'court',
      desc: '大乾当今天子，年富力强，心怀天下苍生却常受朝中门阀牵制。对水陆提督王甯恩宠日盛，倚为匡扶社稷之长城。',
      relations: { husband: { trust: 75, fear: 15, desire: 0, favor: 85, loyalty: 0 } },
    },
    {
      id: 'cuiyuanli',
      name: '崔元礼',
      role: '当朝首辅大学士',
      title: '当朝宰相',
      office: 'chancellor',
      gender: 'male',
      age: 58,
      city: '京城',
      location: 'palace_wenhua',
      home: 'palace_wenhua',
      faction: 'chancellor',
      desc: '当朝内阁首辅，历经三朝，门生故吏遍天下。深谙帝王权术与文官掣肘之道，对相公统兵之势暗中戒备。',
      relations: { husband: { trust: 40, fear: 45, desire: 0, favor: 40, loyalty: 0 } },
    },
    {
      id: 'hanchong',
      name: '韩崇',
      role: '兵部尚书',
      title: '兵部尚书',
      office: 'war',
      gender: 'male',
      age: 52,
      city: '京城',
      location: 'palace_wuying',
      home: 'palace_wuying',
      faction: 'husband', // 武将归心王党
      desc: '老牌边关宿将出身，性烈如火，刚正不阿。深知军旅疾苦，与相公同气相求，力主水陆提督统领天下兵马。',
      relations: { husband: { trust: 88, fear: 10, desire: 0, favor: 85, loyalty: 80 } },
    },
    {
      id: 'luchengye',
      name: '卢承业',
      role: '户部尚书',
      title: '户部尚书',
      office: 'revenue',
      gender: 'male',
      age: 55,
      city: '京城',
      location: 'capital_street',
      home: 'capital_street',
      faction: 'court',
      desc: '掌天下钱粮国库，为人精打细算、圆滑稳重，常在早朝哭诉国库亏空，对相公富可敌国的财资既羡且畏。',
      relations: { husband: { trust: 65, fear: 30, desire: 0, favor: 65, loyalty: 50 } },
    },
    {
      id: 'peijingzhi',
      name: '裴敬之',
      role: '吏部尚书',
      title: '吏部尚书',
      office: 'personnel',
      gender: 'male',
      age: 54,
      city: '京城',
      location: 'palace_wenhua',
      home: 'palace_wenhua',
      faction: 'chancellor',
      desc: '吏部尚书，相党中坚，掌文官考绩之权。言语持重，喜怒不形于色。',
      relations: { husband: { trust: 45, fear: 35, desire: 0, favor: 45, loyalty: 20 } },
    },
    {
      id: 'xuzhengdao',
      name: '徐正道',
      role: '都察院左都御史',
      title: '左都御史',
      office: 'censor_chief',
      gender: 'male',
      age: 50,
      city: '京城',
      location: 'palace_meridian_gate',
      home: 'palace_meridian_gate',
      faction: 'censor',
      desc: '铁面御史，风宪之长。弹劾权贵不避斧钺，虽对军功新贵持有戒心，但敬佩相公扫荡两淮巨匪之功。',
      relations: { husband: { trust: 60, fear: 20, desire: 0, favor: 60, loyalty: 40 } },
    },
    {
      id: 'gaochengen',
      name: '高承恩',
      role: '九门提督兼京营巡防',
      title: '九门提督',
      office: 'capital_commander',
      gender: 'male',
      age: 46,
      city: '京城',
      location: 'capital_garrison',
      home: 'capital_garrison',
      faction: 'husband',
      desc: '京师九门提督，佩剑巡察四门，早年曾受相公军饷济助，对相公钦佩服膺，密誓为相公羽翼。',
      relations: { husband: { trust: 85, fear: 15, desire: 0, favor: 85, loyalty: 85 } },
    },
  ];

  for (const minister of presetMinisters) {
    if (!world.actors[minister.id]) {
      world.actors[minister.id] = { ...minister };
    } else {
      const cur = world.actors[minister.id];
      cur.faction = cur.faction || minister.faction;
      if (!cur.location) cur.location = minister.location;
      cur.role = minister.role;
    }
  }

  // 2. 映射官缺与在任者
  for (const [key, spec] of Object.entries(COURT_OFFICE_SPECS)) {
    if (!world.court.offices[key]) {
      let defaultHolder = null;
      if (key === 'tiduzongbing') defaultHolder = 'husband';
      else if (key === 'chancellor') defaultHolder = 'cuiyuanli';
      else if (key === 'war') defaultHolder = 'hanchong';
      else if (key === 'revenue') defaultHolder = 'luchengye';
      else if (key === 'personnel') defaultHolder = 'peijingzhi';
      else if (key === 'censor_chief') defaultHolder = 'xuzhengdao';
      else if (key === 'capital_commander') defaultHolder = 'gaochengen';
      else if (key === 'governor') defaultHolder = 'zhenghuaian';

      const holderActor = defaultHolder ? world.actors[defaultHolder] : null;
      world.court.offices[key] = {
        title: spec.title,
        rank: spec.rank,
        category: spec.category,
        holder: defaultHolder,
        holderName: holderActor?.name || defaultHolder,
        faction: holderActor?.faction || (defaultHolder === 'husband' ? 'husband' : 'court'),
        vacant: !defaultHolder,
        desc: spec.desc,
      };
    }
  }

  // 3. 确保相公持有水陆提督最高权位
  if (world.court.offices.tiduzongbing) {
    world.court.offices.tiduzongbing.holder = 'husband';
    world.court.offices.tiduzongbing.holderName = world.actors?.husband?.name || '王甯';
    world.court.offices.tiduzongbing.faction = 'husband';
    world.court.offices.tiduzongbing.vacant = false;
  }

  return true;
}

export const initCourtOffices = ensureCourtSystem;

function findOffice(world, officeKeyOrTitle) {
  if (!world.court?.offices) return null;
  if (world.court.offices[officeKeyOrTitle]) {
    return { key: officeKeyOrTitle, office: world.court.offices[officeKeyOrTitle] };
  }
  for (const [k, off] of Object.entries(world.court.offices)) {
    if (off.title === officeKeyOrTitle || off.title?.includes(officeKeyOrTitle) || k === officeKeyOrTitle) {
      return { key: k, office: off };
    }
  }
  return null;
}

/**
 * 罢免、削职或弹劾官员（单一写入口）
 */
export function dismissOfficial(world, officeKeyOrTitle, options = {}) {
  ensureCourtSystem(world);
  const found = findOffice(world, officeKeyOrTitle);
  if (!found) return { ok: false, error: `朝廷无此官缺：${officeKeyOrTitle}` };
  const { key: officeKey, office } = found;

  const reason = typeof options === 'string' ? options : (options.reason || '奉旨削职开缺');
  const impeachedBy = typeof options === 'object' && options.impeachedBy ? options.impeachedBy : 'husband';
  if (office.vacant || !office.holder) return { ok: false, error: `${office.title} 业已开缺，无须罢免` };

  const prevHolderId = office.holder;
  const prevHolder = world.actors?.[prevHolderId];
  const holderName = prevHolder?.name || prevHolderId;

  // 执行开缺
  office.holder = null;
  office.holderName = null;
  office.faction = null;
  office.formerHolder = prevHolderId;
  office.vacant = true;
  office.lastVacatedReason = reason;

  if (prevHolder) {
    prevHolder.role = `原任${office.title}（罢职候参）`;
    prevHolder.office = null;
    // 关系变化
    if (prevHolder.relations?.husband) {
      prevHolder.relations.husband.trust = Math.max(0, (prevHolder.relations.husband.trust || 50) - 25);
      prevHolder.relations.husband.fear = Math.min(100, (prevHolder.relations.husband.fear || 30) + 30);
    }
  }

  // 记录世界事件与天道记忆
  try {
    nextEvent(world, {
      action: 'official_dismissed',
      actor: impeachedBy,
      place: 'palace_throne_hall',
      payload: {
        office: officeKey,
        title: office.title,
        target: prevHolderId,
        text: `【朝野震动】相公于金銮殿降旨弹劾，${office.title}【${holderName}】因「${reason}」被奉旨削职免官，中枢大位悬缺！`,
      },
      isPublic: true,
    });
    addMemory(world, {
      text: `金銮殿朝议风云：${office.title}${holderName}被奉旨革职开缺，中枢大权易手！`,
      type: 'court_coup',
      permanent: true,
    });
  } catch {}

  return {
    ok: true,
    office: officeKey,
    title: office.title,
    dismissed: holderName,
    message: `【${holderName}】已被革去【${office.title}】之职，官缺现已开置！`,
  };
}

/**
 * 拜官、提拔或相公兼领任官（单一写入口）
 */
export function appointOfficial(world, officeKeyOrTitle, targetActorIdOrName, options = {}) {
  ensureCourtSystem(world);
  const found = findOffice(world, officeKeyOrTitle);
  if (!found) return { ok: false, error: `朝廷无此官缺：${officeKeyOrTitle}` };
  const { key: officeKey, office } = found;

  const reason = typeof options === 'string' ? options : (options.reason || '简在帝心，破格提拔');
  const appointedBy = typeof options === 'object' && options.appointedBy ? options.appointedBy : 'husband';

  const actors = Object.values(world.actors || {});
  let target = actors.find((a) => a && (a.id === targetActorIdOrName || a.name === targetActorIdOrName));
  if (!target) {
    target = actors.find((a) => a && a.name && (a.name.includes(targetActorIdOrName) || targetActorIdOrName.includes(a.name)));
  }
  if (!target) return { ok: false, error: `朝廷名册查无此人：${targetActorIdOrName}` };

  const prevHolder = office.holder;
  office.holder = target.id;
  office.holderName = target.name;
  office.faction = target.faction || (appointedBy === 'husband' ? 'husband' : 'court');
  office.vacant = false;
  office.lastAppointedReason = reason;

  target.office = officeKey;
  target.role = office.title;
  if (!target.faction) target.faction = 'husband'; // 相公提拔的人默认归入王党

  if (target.relations?.husband) {
    target.relations.husband.trust = Math.min(100, (target.relations.husband.trust || 50) + 30);
    target.relations.husband.loyalty = Math.min(100, (target.relations.husband.loyalty || 50) + 40);
  }

  // 记录大典
  try {
    nextEvent(world, {
      action: 'official_appointed',
      actor: appointedBy,
      place: 'palace_throne_hall',
      payload: {
        office: officeKey,
        title: office.title,
        target: target.id,
        text: `【圣谕下达】诏拜【${target.name}】实授【${office.title}】（${office.rank}），执掌中枢大权，朝野改色！`,
      },
      isPublic: true,
    });
    addMemory(world, {
      text: `新臣拜相入阁：【${target.name}】奉诏实授【${office.title}】，王党势力执掌要津。`,
      type: 'court_appointment',
      permanent: true,
    });
  } catch {}

  return {
    ok: true,
    office: officeKey,
    title: office.title,
    appointed: target.name,
    message: `【${target.name}】已正式受诏实授【${office.title}】！`,
  };
}

/**
 * 获取天下中枢水陆兵马大权概览
 */
export function getHusbandMilitaryCommand(world) {
  ensureCourtSystem(world);
  const me = world.actors?.husband;
  const isCommander = Boolean(world.court?.offices?.tiduzongbing?.holder === 'husband');
  
  // 基础直属提督亲兵与水陆大军
  let fleetTroops = 4000;
  let guards = 2500;
  let provTroops = 15000;
  let totalCommand = isCommander ? (fleetTroops + guards + provTroops + 30000) : 500;

  return {
    isCommander,
    rank: '从一品水陆提督总兵官',
    sword: '钦赐尚方宝剑（代天巡狩）',
    divisions: [
      { name: '中军神机亲营', count: guards, station: '京师·提督王府校场' },
      { name: '两淮水师战船大队', count: fleetTroops, station: '大运河与长江水汛' },
      { name: '两淮镇守标兵营', count: provTroops, station: '江淮水陆大营' },
      { name: '天下统调征剿军马', count: 30000, station: '各府卫所奉符提调' },
    ],
    totalTroops: totalCommand,
    readyToSiege: isCommander && totalCommand >= 5000,
  };
}
