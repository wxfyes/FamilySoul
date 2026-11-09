/**
 * 城市生活层：大户、富商、才女、公子、乡绅不是布景板。
 *
 * 全部本地规则，不调用模型：
 *   · 每人一份稳定的心愿（goals）
 *   · 一份按身份排的作息（schedule），到点由 runSchedules 真移动
 *   · 只有相公真的碰到、开口，才进入关系与记忆
 *
 * 不点名、不钦定，谁和谁遇见由作息与地点自己碰出来。
 */

import { moveActor } from './position.js';

const GOALS = {
  富商: ['做成一笔大买卖', '摸清城里的行情', '给自家字号扬名'],
  才女: ['寻一个真懂诗的人', '攒钱刻自己的集子', '看看城外的山水'],
  公子: ['结交几位名士', '考取功名', '替家里撑起门面'],
  小姐: ['寻一门合意的亲事', '学一套持家的本事', '把女红做到最好'],
  乡绅: ['守住祖上的田产', '给儿女议一门亲', '在街面上留个好名声'],
  老爷: ['守住家业', '给儿女铺路', '在官面上留几分体面'],
  夫人: ['把内宅理顺', '给儿女留心婚事', '拢住家里的银钱'],
};

const ROLE_KEYS = Object.keys(GOALS);

function goalsOf(role) {
  const key = ROLE_KEYS.find((k) => String(role || '').includes(k));
  return key ? GOALS[key].slice() : null;
}

const FOLK_GOALS = {
  小贩: ['多卖几文钱', '给家里添口肉', '盼个太平日子'],
  货郎: ['走遍四乡八镇', '攒钱娶媳妇', '摸清哪样货好卖'],
  脚夫: ['多接几趟活', '把腰伤养好', '给老娘寄点钱'],
  绣娘: ['绣出一幅好样子', '攒嫁妆', '寻个稳当人家'],
  厨娘: ['练一手好菜', '在主家站稳脚', '给儿子攒学费'],
  船夫: ['跑一趟顺风船', '还清船债', '看看下游的城'],
  更夫: ['夜里别出事', '多挣几文夜钱', '盼着天亮交班'],
  媒婆: ['说成一门好亲', '多收几份谢媒钱', '打听各家底细'],
  郎中: ['治好一个疑难症', '攒钱开自己的铺子', '采到一味好药'],
  书生: ['考取功名', '结交几位同窗', '抄书换些盘缠'],
  伙计: ['学一门手艺', '当上二掌柜', '攒钱自立门户'],
  木匠: ['打一套好家具', '收个徒弟', '接一桩大活'],
  铁匠: ['打出一把好刀', '把炉子重新砌过', '给家里添置冬衣'],
  织女: ['织完这匹布', '攒钱买架好机', '寻个好人家'],
  菜农: ['菜能卖上好价', '把地再扩两亩', '给娃攒学费'],
  挑夫: ['多挑几担', '换双结实鞋', '攒够回家的盘缠'],
  算命先生: ['多几个主顾', '看准一桩大事', '攒钱赁间铺面'],
  稳婆: ['接个平安胎', '在这一带落下好名声', '攒点养老钱'],
  酒客: ['喝一壶好酒', '听一桩新鲜事', '把今天的工钱喝回来'],
  茶客: ['会一会老友', '听点生意行情', '躲个清静'],
};

function folkGoalsOf(role) {
  const key = Object.keys(FOLK_GOALS).find((k) => String(role || '').includes(k));
  return key ? FOLK_GOALS[key].slice() : ['把日子过下去', '攒点钱', '盼个太平'];
}

function folkSchedule(world, a) {
  const b = baseOf(world, a);
  const role = String(a.role || '');
  const home = b.home || b.street;
  if (/更夫/.test(role)) {
    return [
      { at: 7, do: '回家歇息', place: home },
      { at: 17, do: '起身吃饭', place: home },
      { at: 20, do: '上街打更', place: b.street },
      { at: 23, do: '巡夜', place: b.street },
    ];
  }
  if (/小贩|货郎|挑夫|脚夫|菜农/.test(role)) {
    return [
      { at: 6, do: '挑担出门', place: b.market },
      { at: 12, do: '在街边用饭', place: b.market },
      { at: 18, do: '收摊回家', place: home },
      { at: 21, do: '安歇', place: home },
    ];
  }
  if (/绣娘|厨娘|织女|稳婆|媒婆/.test(role)) {
    return [
      { at: 7, do: '起来收拾', place: home },
      { at: 9, do: '出门做活', place: b.market },
      { at: 13, do: '回家用饭', place: home },
      { at: 17, do: '在街坊间走动', place: b.street },
      { at: 21, do: '歇息', place: home },
    ];
  }
  if (/书生|茶客|酒客/.test(role)) {
    return [
      { at: 8, do: '在屋里读书/醒酒', place: home },
      { at: 10, do: '去茶坊坐坐', place: b.market },
      { at: 15, do: '在长街走动', place: b.street },
      { at: 19, do: '回住处', place: home },
    ];
  }
  return [
    { at: 7, do: '起身做工', place: home },
    { at: 9, do: '上街找活', place: b.market },
    { at: 18, do: '收工回家', place: home },
    { at: 21, do: '安歇', place: home },
  ];
}

function baseOf(world, a) {
  const city = String(world.places?.[a.home]?.name || world.places?.[a.location]?.name || '临江府').split('·')[0];
  const b = world.flags?.cityBase?.[city] || null;
  return {
    city,
    street: b?.streetId || 'street',
    market: b?.marketId || b?.streetId || 'street',
    home: a.home && world.places?.[a.home] ? a.home : (b?.streetId || 'street'),
  };
}

function scheduleOf(world, a) {
  const role = String(a.role || '');
  const b = baseOf(world, a);
  if (/公子|小姐/.test(role)) {
    return [
      { at: 8, do: '在府里用早膳', place: b.home },
      { at: 10, do: '出门会友', place: b.market },
      { at: 13, do: '在茶坊坐一坐', place: b.market },
      { at: 17, do: '回府', place: b.home },
      { at: 21, do: '安歇', place: b.home },
    ];
  }
  if (/富商/.test(role)) {
    return [
      { at: 7, do: '去市集看行情', place: b.market },
      { at: 12, do: '在茶坊会客', place: b.market },
      { at: 15, do: '回铺子理账', place: b.market },
      { at: 18, do: '在长街走动', place: b.street },
      { at: 21, do: '回住处歇息', place: b.home },
    ];
  }
  if (/才女/.test(role)) {
    return [
      { at: 8, do: '在窗下读书', place: b.home },
      { at: 10, do: '去书铺看看', place: b.market },
      { at: 13, do: '在茶坊听人说话', place: b.market },
      { at: 17, do: '沿长街慢慢走', place: b.street },
      { at: 21, do: '回屋安歇', place: b.home },
    ];
  }
  if (/乡绅/.test(role)) {
    return [
      { at: 7, do: '在街上转转', place: b.street },
      { at: 10, do: '去茶坊听行情', place: b.market },
      { at: 14, do: '看田租账目', place: b.home },
      { at: 18, do: '在长街会人', place: b.street },
      { at: 21, do: '回家安歇', place: b.home },
    ];
  }
  return [
    { at: 7, do: '起身理事', place: b.home },
    { at: 10, do: '出门走动', place: b.street },
    { at: 18, do: '回家', place: b.home },
    { at: 21, do: '安歇', place: b.home },
  ];
}

const FOLK_ROLES = [
  { role: '小贩', g: 'male' }, { role: '货郎', g: 'male' }, { role: '脚夫', g: 'male' },
  { role: '挑夫', g: 'male' }, { role: '船夫', g: 'male' }, { role: '木匠', g: 'male' },
  { role: '铁匠', g: 'male' }, { role: '郎中', g: 'male' }, { role: '书生', g: 'male' },
  { role: '伙计', g: 'male' }, { role: '更夫', g: 'male' }, { role: '菜农', g: 'male' },
  { role: '算命先生', g: 'male' }, { role: '酒客', g: 'male' }, { role: '茶客', g: 'male' },
  { role: '绣娘', g: 'female' }, { role: '厨娘', g: 'female' }, { role: '织女', g: 'female' },
  { role: '媒婆', g: 'female' }, { role: '稳婆', g: 'female' },
];
const SURNAMES = ['陈', '王', '李', '周', '柳', '赵', '孙', '吴', '郑', '冯', '褚', '卫', '蒋', '沈', '韩', '杨', '朱', '秦', '许', '何'];
const GIVEN_M = ['阿福', '小满', '石头', '水生', '木生', '阿贵', '三郎', '阿顺', '有田', '阿庆', '大牛', '阿寿', '小乙', '阿兴'];
const GIVEN_F = ['阿巧', '小莲', '阿秀', '三娘', '阿杏', '小桃', '阿兰', '七妹', '阿珍', '小娥', '阿喜', '二丫'];

function slugOf(city) {
  return String(city || '').replace(/府$|县$|州$/g, '');
}

/**
 * 按城等级补市井人口：大府 26、州 18、县 12（含已有大户/富商/才女）。
 * 只在本地生成，不调用模型；同 id 幂等，重启不会重复加。
 */
export function ensureCityPopulation(world) {
  const cities = Object.keys(world?.cities || {});
  if (!cities.length) return 0;
  const existingTotal = Object.keys(world.actors || {}).length;
  if (existingTotal > 4200) return 0;
  const usedNames = new Set(Object.values(world.actors || {}).map((a) => a && a.name).filter(Boolean));
  let added = 0;
  for (const city of cities) {
    const base = world.flags?.cityBase?.[city];
    const street = base?.streetId ? world.places?.[base.streetId] : null;
    if (!base || !street) continue;
    const slug = slugOf(city);
    const wealth = Number(world.cities?.[city]?.wealth) || 30;
    const tier = wealth >= 60 ? 3 : (wealth >= 35 ? 2 : 1);
    const target = tier >= 3 ? 26 : (tier >= 2 ? 18 : 12);
    const local = Object.values(world.actors || {}).filter((a) => a && (
      a.city === city
      || String(a.home || '').startsWith(`${slug}_`)
      || a.home === base.streetId
      || a.home === base.marketId
    )).length;
    let need = Math.max(0, target - local);
    if (!need) continue;
    const market = base.marketId && world.places?.[base.marketId] ? base.marketId : base.streetId;
    for (let i = 0; i < need; i += 1) {
      if (existingTotal + added >= 4200) break;
      const fp = FOLK_ROLES[(added + city.length + i) % FOLK_ROLES.length];
      let id = `${slug}_folk_${i + 1}`;
      let seq = i + 1;
      while (world.actors[id]) { seq += 1; id = `${slug}_folk_${seq}`; }
      let name = '';
      for (let tries = 0; tries < 60; tries += 1) {
        const sn = SURNAMES[(added + i + tries + city.length) % SURNAMES.length];
        const pool = fp.g === 'female' ? GIVEN_F : GIVEN_M;
        const gn = pool[(added * 3 + i + tries) % pool.length];
        const cand = `${sn}${gn}`;
        if (!usedNames.has(cand)) { name = cand; break; }
      }
      if (!name) name = `${SURNAMES[(added + i) % SURNAMES.length]}${fp.g === 'female' ? '阿' : '小'}${seq}`;
      usedNames.add(name);
      world.actors[id] = {
        id, name, role: fp.role, title: fp.role, gender: fp.g,
        age: 18 + ((added + i * 7) % 38),
        home: base.streetId, location: market,
        money: Math.round((0.5 + ((added + i) % 9) * 0.8) * 100) / 100,
        relations: {}, origin: 'city_folk', city,
        createdDay: world.clock?.day || 1,
        spouse: null,
      };
      added += 1;
    }
    world.flags.cityFolkDone = world.flags.cityFolkDone || {};
    world.flags.cityFolkDone[city] = { at: Date.now(), target };
  }
  if (added) console.log(`[CityLife] 按城等级补市井人口 ${added} 人（本地生成，不耗模型）`);
  return added;
}

export function ensureCityLife(world) {
  let made = 0;
  let homed = 0;
  for (const a of Object.values(world?.actors || {})) {
    if (!a || a.dead || a.id === 'husband') continue;
    const isFolk = a.origin === 'city_folk';
    if (!isFolk && a.origin !== 'city_class' && !ROLE_KEYS.some((k) => String(a.role || '').includes(k))) continue;
    // 城郊大户被历史漂移堆到临江长街的，先归回本城本宅
    const home = world.places?.[a.home];
    // 外城大户不是王宅的人，绝不能借 household 混进相公文书/内宅名单；
    // 但已嫁给相公的侧室/二房/通房，哪怕住东跨院，也不是"外城大户"
    const roleText = String(a.role || '');
    const isHusbandKin = a.spouse === 'husband' || a.marital === 'concubine'
      || /正妻|大娘子|如夫人|二房|侧室|妾|通房/.test(roleText);
    if (a.origin === 'city_class' && a.household && !isHusbandKin
      && !String(a.home || '').startsWith('husband_room')) {
      delete a.household;
    }
    if (a.origin === 'city_class' && home && a.home !== 'street' && a.location === 'street' && !a.cityLifeHomed) {
      const mv = moveActor(world, a.id, a.home, 'world', '归家');
      if (mv?.ok) { a.cityLifeHomed = true; homed += 1; }
    }
    let changed = false;
    if (!Array.isArray(a.goals) || a.goals.length === 0) {
      const goals = isFolk ? folkGoalsOf(a.role) : goalsOf(a.role);
      if (goals) { a.goals = goals; changed = true; }
    }
    if (!Array.isArray(a.schedule) || a.schedule.length === 0) {
      a.schedule = isFolk ? folkSchedule(world, a) : scheduleOf(world, a);
      changed = true;
    }
    if (changed) made += 1;
  }
  if (made || homed) console.log(`[CityLife] 给 ${made} 个城中人补上心愿与作息，${homed} 人归回本城本宅（本地规则，不耗模型）`);
  return made + homed;
}
