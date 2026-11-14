/**
 * 水陆提督帅府 · 骨干将领班底与调兵遣将调度中枢（Military Dispatch Engine）
 *
 * 核心宗旨：
 *   1. 相公奉旨代天巡狩，节制江南江北水陆诸军，手握钦赐尚方宝剑与天下兵符；
 *   2. 彻底拒绝“口头打嘴炮的光杆司令”，设立五大得力骨干将领与亲卫营（有身有名有姓、有官阶印信）；
 *   3. “来人！”一呼百应，亲兵统领赵雷携铁甲甲士即刻大踏步按刀而入，单膝跪地听候差遣；
 *   4. 调兵遣将（看守、封锁、镇压、驻防）真实改变地点世界状态，并标注防备守军；
 *   5. 提供家眷随行大令与官府和离文书出具单一写入口。
 */

import { moveActor } from './position.js';
import { addItem } from './items.js';
import { addMemory } from './memory.js';
import { getHusbandMilitaryCommand, ensureCourtSystem } from './court.js';

/** 水陆提督麾下五大得力骨干将领编制 */
export const MILITARY_GENERALS = [
  {
    id: 'general_zhaolei',
    name: '赵雷',
    role: '游击将军兼亲卫统领',
    title: '亲兵统领',
    rank: '正四品',
    gender: 'male',
    age: 32,
    city: '临江府',
    location: 'yamen',
    home: 'husband_room__barracks',
    faction: 'husband',
    desc: '水陆提督亲随悍将，沉毅勇猛，执掌提督贴身宿卫亲兵营。形影不离宿卫相公，随唤随到，奉令必行。',
    relations: { husband: { trust: 98, fear: 10, desire: 0, favor: 95, loyalty: 99 } },
  },
  {
    id: 'general_zhouwu',
    name: '周武',
    role: '提督中军副将',
    title: '中军副将',
    rank: '正三品',
    gender: 'male',
    age: 46,
    city: '临江府',
    location: 'husband_room__council',
    home: 'husband_room__council',
    faction: 'husband',
    desc: '提督帅帐中军副帅，老成持重，深谙排兵布阵与大军拔营调度，统辖两淮镇守标兵营万余大军。',
    relations: { husband: { trust: 92, fear: 15, desire: 0, favor: 90, loyalty: 95 } },
  },
  {
    id: 'general_chenhaiping',
    name: '陈海平',
    role: '两淮水师参将',
    title: '水师参将',
    rank: '从三品',
    gender: 'male',
    age: 40,
    city: '临江府',
    location: 'dock',
    home: 'dock',
    faction: 'husband',
    desc: '水战宿将，掌两淮水师战船大队与艨艚巨舰，巡弋长江运河水汛，专司封锁水路与缉捕私盐。',
    relations: { husband: { trust: 90, fear: 10, desire: 0, favor: 88, loyalty: 92 } },
  },
  {
    id: 'general_sutie',
    name: '苏铁',
    role: '神机亲营千总',
    title: '神机千总',
    rank: '正五品',
    gender: 'male',
    age: 35,
    city: '京城',
    location: 'capital_mansion__barracks',
    home: 'capital_mansion__barracks',
    faction: 'husband',
    desc: '掌管神机火器、鸟铳与佛郎机火炮营，擅长强攻坚寨、铁桶合围与城防守备。',
    relations: { husband: { trust: 88, fear: 10, desire: 0, favor: 85, loyalty: 90 } },
  },
  {
    id: 'general_lishitou',
    name: '李石头',
    role: '亲兵百户兼队正',
    title: '亲兵百户',
    rank: '正六品',
    gender: 'male',
    age: 26,
    city: '临江府',
    location: 'yamen',
    home: 'husband_room__barracks',
    faction: 'husband',
    desc: '赵雷麾下亲卫队正，相公近身带刀警卫长，机警精悍，专司仪仗前驱、公堂押解与随行侍卫。',
    relations: { husband: { trust: 95, fear: 15, desire: 0, favor: 92, loyalty: 98 } },
  },
];

/**
 * 确保提督麾下骨干将领班底入籍健全（幂等自愈）
 */
export function ensureMilitaryGenerals(world) {
  world.actors = world.actors || {};
  world.places = world.places || {};
  let added = 0;

  for (const gen of MILITARY_GENERALS) {
    if (!world.actors[gen.id]) {
      world.actors[gen.id] = { ...gen };
      added += 1;
    } else {
      const cur = world.actors[gen.id];
      cur.name = gen.name;
      cur.role = gen.role;
      cur.title = gen.title;
      cur.rank = gen.rank;
      cur.faction = 'husband';
      if (!cur.location) cur.location = gen.location;
      if (!cur.home) cur.home = gen.home;
    }
  }

  return added;
}

/**
 * 随时随地“来人！”召集亲兵护卫队列
 * 亲军统领赵雷率李石头及 8-10 名铁甲亲兵按刀而入，单膝点地抱拳听令！
 */
export function summonGuards(world, options = {}) {
  ensureMilitaryGenerals(world);
  const me = world.actors?.husband;
  if (!me) return { ok: false, notice: '（大帅不在阵中。）' };

  const targetPlace = me.location || 'yamen';
  const placeName = world.places?.[targetPlace]?.name || '堂前';
  const count = Math.max(8, Math.min(12, Number(options.count) || 10));

  // 亲兵统领赵雷与李石头立即随同入场
  const zhao = world.actors?.general_zhaolei;
  const li = world.actors?.general_lishitou;

  if (zhao && zhao.location !== targetPlace) {
    moveActor(world, zhao.id, targetPlace, 'world', '亲兵护卫听令');
  }
  if (li && li.location !== targetPlace) {
    moveActor(world, li.id, targetPlace, 'world', '亲卫随侍听令');
  }

  // 记录随侍侍卫阵列在地点状态中，并锁定相公当前对话对象为亲军统领赵雷
  world.places[targetPlace] = world.places[targetPlace] || { name: placeName };
  world.places[targetPlace].guardsPresent = {
    commander: '赵雷',
    deputy: '李石头',
    count,
    ready: true,
    atDay: world.clock?.day || 1,
  };
  world.chatPartners = world.chatPartners || {};
  world.chatPartners.husband = 'general_zhaolei';

  const line = `（甲片铿锵，脚步整齐如一！亲军统领赵雷按刀疾步跨入，队正李石头率十名铁甲亲兵手执长枪利刃霍然列阵于阶前侍立！）`;
  return { ok: true, notice: line, count, commander: '赵雷' };
}

/**
 * 亲兵退下令（“好，退出去吧”、“退下待命”）
 */
export function dismissGuards(world) {
  ensureMilitaryGenerals(world);
  const me = world.actors?.husband;
  if (!me) return { ok: false, notice: '（大帅不在阵中。）' };

  const isCapital = me.city === '京城' || (me.location && me.location.startsWith('capital_'));
  const barracks = isCapital ? 'capital_mansion__barracks' : 'husband_room__barracks';
  const outYard = isCapital ? 'capital_mansion__front' : 'husband_room__front';
  const dest = world.places?.[barracks] ? barracks : (world.places?.[outYard] ? outYard : 'street');

  const zhao = world.actors?.general_zhaolei;
  const li = world.actors?.general_lishitou;

  if (zhao && zhao.location === me.location) {
    moveActor(world, zhao.id, dest, 'world', '亲兵领命退回外院待命');
  }
  if (li && li.location === me.location) {
    moveActor(world, li.id, dest, 'world', '亲兵领命退回外院待命');
  }

  if (me.location && world.places?.[me.location]?.guardsPresent) {
    delete world.places[me.location].guardsPresent;
  }

  const line = `（亲兵统领赵雷与队正李石头肃容按刀，躬身齐步倒退三步，领着十名铁甲亲兵无声退回院外值房待命。）`;
  return { ok: true, notice: line, dest };
}

/**
 * 调兵遣将：派兵看守、封锁、镇压、驻防（单一写入口）
 */
export function dispatchGarrison(world, { generalName = '赵雷', placeTarget = '', count = 50, mission = '看守' } = {}) {
  ensureMilitaryGenerals(world);
  const me = world.actors?.husband;
  const targetStr = String(placeTarget || '').trim();
  if (!targetStr) return { ok: false, notice: '（大帅请示下欲遣兵看守何处？）' };

  // 1. 寻找匹配地点
  let destId = null;
  let destPlace = null;

  for (const [pid, pl] of Object.entries(world.places || {})) {
    if (!pl || !pl.name) continue;
    if (pl.name === targetStr || pl.name.includes(targetStr) || pid === targetStr) {
      destId = pid;
      destPlace = pl;
      break;
    }
  }

  // 别名模糊匹配常见目标
  if (!destPlace) {
    const aliasMap = {
      '库房': 'yamen__store',
      '县衙库房': 'yamen__store',
      '县衙': 'yamen',
      '大门': 'yamen__gate',
      '码头': 'dock',
      '运河码头': 'dock',
      '货栈': 'zhai_warehouse',
      '翟家货栈': 'zhai_warehouse',
      '茶栈': 'place_77',
      '运河茶栈': 'place_77',
      '大酒楼': 'canal_restaurant',
      '茶坊': 'tea_house',
      '钱庄': 'sihai_bank',
      '四海钱庄': 'sihai_bank',
      '提督府': 'capital_mansion',
      '王府': 'capital_mansion',
    };
    for (const [k, v] of Object.entries(aliasMap)) {
      if (targetStr.includes(k) && world.places?.[v]) {
        destId = v;
        destPlace = world.places[v];
        break;
      }
    }
  }

  if (!destPlace) {
    return { ok: false, notice: `（斥候回报：未能探得「${targetStr}」所在之地，请大帅明示地名。）` };
  }

  // 2. 匹配将领
  let targetGen = Object.values(world.actors || {}).find(
    (a) => a && a.faction === 'husband' && (a.name === generalName || a.role?.includes(generalName) || a.title?.includes(generalName)),
  ) || world.actors?.general_zhaolei;

  const actualCount = Math.max(10, Math.min(500, Number(count) || 50));
  const missionType = /镇压|查抄|缉捕/.test(mission) ? '严密镇压' : (/围|封锁/.test(mission) ? '铁桶合围' : '重兵看守');

  // 3. 真实落地驻防世界状态
  destPlace.garrison = {
    general: targetGen.name,
    generalId: targetGen.id,
    count: actualCount,
    mission: missionType,
    sinceDay: world.clock?.day || 1,
    sinceHour: world.clock?.hour || 12,
  };

  const line = `【帅令如山】${targetGen.role} ${targetGen.name} 肃容抱拳领命：“末将得令！立刻抽调亲军精锐 ${actualCount} 人，披坚执锐进驻「${destPlace.name}」实施${missionType}！一只苍蝇也休想飞出去！”`;
  return { ok: true, notice: line, placeName: destPlace.name, count: actualCount, general: targetGen.name };
}

/**
 * “点兵”检阅中枢帅帐兵马总账
 */
export function reviewTroops(world) {
  ensureCourtSystem(world);
  ensureMilitaryGenerals(world);
  const mil = getHusbandMilitaryCommand(world);

  const lines = [
    `【水陆提督帅帐 · 统军点将录】`,
    `官阶印信：${mil.rank} ｜ ${mil.sword}`,
    `节制水陆总兵力：${mil.totalTroops.toLocaleString()} 兵马（江南江北各水陆诸镇皆奉令调遣）`,
    `───────────────`,
    `【麾下骨干战将班底】`,
    `· 正三品中军副将 周武：坐镇帅营中军，统辖江淮步骑标兵营（15,000人）`,
    `· 从三品水师参将 陈海平：统领两淮战船艨艚大队，巡弋长江运河水汛（4,000人）`,
    `· 正四品游击兼亲卫统领 赵雷：执掌提督贴身侍卫亲兵营，形影不离宿卫大帅（100精锐）`,
    `· 正五品神机亲营千总 苏铁：统率佛郎机大炮与鸟铳神机营（2,500人，驻京师王府校场）`,
    `· 正六品亲兵百户 李石头：亲随队正，掌亲兵宿卫巡察与前驱仪仗`,
    `───────────────`,
    `各营军械整肃，粮草充盈，大帅一声令下即可拔营出征、进驻各府！`,
  ];

  return { ok: true, notice: lines.join('\n'), military: mil };
}

/**
 * 家眷随行大令（随我回京 / 回临江）
 */
export function escortFamily(world, destinationCity = '京城') {
  const me = world.actors?.husband;
  const isToCapital = /京|北|首都/.test(destinationCity);
  const targetCity = isToCapital ? '京城' : '临江府';
  const targetBase = isToCapital ? 'capital_mansion' : 'husband_room';

  // 眷属名单
  const familyRoster = [
    { id: 'waner', name: '沈婉儿', role: '正房', room: isToCapital ? 'capital_mansion__main' : 'husband_room' },
    { id: 'caier', name: '杨采儿', role: '平妻', room: isToCapital ? 'capital_mansion__main' : 'husband_room' },
    { name: '崔婉宁', role: '侧室', room: isToCapital ? 'capital_mansion__east' : 'wang_mansion_east' },
    { id: 'yunnia', name: '林芸娘', role: '二房', room: isToCapital ? 'capital_mansion__west' : 'wang_mansion_west' },
    { id: 'xiaocui', name: '小翠', role: '丫鬟', room: isToCapital ? 'capital_mansion__servant' : 'husband_room' },
    { name: '秋菊', role: '丫鬟', room: isToCapital ? 'capital_mansion__servant' : 'husband_room' },
  ];

  const movedNames = [];

  for (const f of familyRoster) {
    const a = f.id ? world.actors?.[f.id] : Object.values(world.actors || {}).find((x) => x && x.name === f.name);
    if (!a || a.dead) continue;
    a.city = targetCity;
    const destRoom = world.places?.[f.room] ? f.room : targetBase;
    moveActor(world, a.id, destRoom, 'world', `王府家眷随行迁居${targetCity}`);
    a.home = destRoom;
    movedNames.push(a.name);

    // 为每位家眷写入永久不朽迁徙记忆（严禁失忆！）
    const day = Number(world.clock?.day) || 26;
    const memText = isToCapital
      ? `第${day}日，相公官拜从一品水陆提督，亲率铁甲亲兵车驾仪仗护送我与婉儿姐姐、采儿妹妹等举家进京，进驻京师东堂子胡同九进一品提督王府！正房暖阁朱漆雕梁，御赐王府风光无双！`
      : `第${day}日，相公率王府亲兵仪仗护送全家自京城安然还乡临江府提督王府正房，正房西厢各院落妥善安歇。`;

    addMemory(world, {
      text: `【${a.name}】${memText}`,
      about: [a.id, 'husband'],
      visible: 'public',
      kind: 'milestone',
      permanent: true,
      day,
    });
    a.memories = Array.isArray(a.memories) ? a.memories : [];
    if (!a.memories.some((m) => String(m.text || m).includes('提督王府'))) {
      a.memories.unshift({ text: memText, day, permanent: true });
    }
  }

  const destTitle = isToCapital ? '京师·九进提督王府' : '临江·提督王府府邸';
  const line = `【王府仪仗大开】大帅军令传下，亲兵营全副武装护卫王府内眷车驾！发妻沈婉儿、平妻杨采儿、侧室崔婉宁、二房林芸娘及随行丫鬟已全部安然抵达「${destTitle}」，正房、跨院皆已妥善安歇！`;
  return { ok: true, notice: line, moved: movedNames, targetCity };
}

/**
 * 官府和离大印立案（准予和离·出具和离文书）
 */
export function grantDivorce(world, targetNameOrId = '陈静儿') {
  const me = world.actors?.husband;
  const searchName = String(targetNameOrId || '').trim();

  // 寻找目标女子
  let targetWoman = null;
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead) continue;
    if (a.id === searchName || a.name === searchName || (searchName && a.name?.includes(searchName))) {
      targetWoman = a;
      break;
    }
  }

  // 模糊匹配静儿或货栈老板娘
  if (!targetWoman) {
    if (/静儿|陈静/.test(searchName)) {
      targetWoman = Object.values(world.actors || {}).find((a) => a && /静儿|陈静/.test(a.name));
    } else if (/老板娘|翟/.test(searchName)) {
      targetWoman = Object.values(world.actors || {}).find((a) => a && /老板娘|翟/.test(a.name || a.role));
    }
  }

  const womanName = targetWoman?.name || (searchName ? searchName.replace(/[准允办立出给]|和离|文书|书/g, '') : '陈静儿') || '陈静儿';

  // 1. 若找到人物，解除其婚配羁绊
  if (targetWoman) {
    targetWoman.spouse = null;
    targetWoman.maritalStatus = '和离';
    targetWoman.role = `${targetWoman.role || '良家女子'}（已和离）`;
    targetWoman.relations = targetWoman.relations || {};
    targetWoman.relations.husband = targetWoman.relations.husband || {};
    targetWoman.relations.husband.favor = Math.min(100, (targetWoman.relations.husband.favor || 60) + 25);
    targetWoman.relations.husband.trust = Math.min(100, (targetWoman.relations.husband.trust || 60) + 30);
  }

  // 2. 出具正式官府和离文书入库相公行囊
  const docName = `《临江县衙·准予${womanName}和离官凭文书》`;
  addItem(world, {
    name: docName,
    kind: '文书',
    holder: 'husband',
    note: `临江县衙朱笔大印勘合，从一品提督亲自过问，准予${womanName}与夫家立案和离，一别两宽各生欢喜，受大乾律法庇佑。`,
  });

  const line = `【官府和离立案】临江县衙正堂大印朱笔勘合！县令当堂用印批红，正式出具并奉上${docName}！${womanName}前缘尽释、恢复自由之身，满怀感激拜谢大帅天高地厚之恩！`;
  return { ok: true, notice: line, woman: womanName, document: docName };
}

