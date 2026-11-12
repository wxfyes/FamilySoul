/**
 * 雇佣：全世界只有这里能把一个人放进某处产业。
 *
 * 以前"雇人"这段逻辑抄在三个地方（天道招人、自检修账、管理接口），
 * 改一处漏两处。现在收成一个入口：hireStaff()。
 *
 * 它负责：
 *   · 人不存在就立起来（天道给的名字就是真名）
 *   · 已有的人就派过去
 *   · 记明东家与工位（employer / workplace / workplaceId）
 *   · 进产业名册 staffIds，刷新在岗人数
 *   · 位置走 moveActor（受单一写入口与真人保护约束）
 */

import { moveActor, isHumanBound } from './position.js';
import { isPlaceName } from './naming.js';

export function hireStaff(world, { propName = '', name = '', role = '伙计', via = 'dm', hiredBy = null, taskId = null } = {}) {
  const nm = String(name || '').trim();
  if (!isPlaceName(nm)) return { ok: false, error: `名字「${nm}」不像人名` };

  const prop = (world.assets?.properties || []).find((x) => x && String(x.name).includes(String(propName || '')));
  if (!prop) return { ok: false, error: `没有产业「${propName}」` };
  if (!prop.placeId || !world.places?.[prop.placeId]) return { ok: false, error: '这处产业还没挂地点' };

  let a = Object.values(world.actors || {}).find((x) => x && x.name === nm);
  const alreadyStaff = a && Array.isArray(prop.staffIds) && prop.staffIds.includes(a.id);
  if (a && !alreadyStaff) {
    if (isHumanBound(world, a.id)) {
      return { ok: false, error: `「${nm}」是真人角色，不能当 NPC 雇；请另取艺名` };
    }
    return { ok: false, error: `名字「${nm}」已经有主，不能重复起名` };
  }
  const created = !a;
  if (!a) {
    const id = `npc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    a = {
      id, name: nm, role: String(role || '伙计').slice(0, 8), gender: 'unknown',
      home: prop.placeId, work: prop.placeId, location: prop.placeId,
      money: 0, relations: {}, schedule: [], origin: via === 'admin' ? 'hired' : 'dm_hired',
      createdDay: world.clock?.day || 1,
    };
    world.actors[id] = a;
  } else {
    if (!a.role) a.role = String(role || '伙计').slice(0, 8);
    moveActor(world, a.id, prop.placeId, via === 'admin' ? 'ui' : 'world', '到岗');
  }

  // 来历：谁招进来的、因为哪桩差事。没有来历的人在世界里站不住
  a.employer = prop.owner || 'husband';
  a.hiredBy = a.hiredBy || hiredBy || null;
  a.sourceTask = a.sourceTask || taskId || null;
  a.hiredDay = a.hiredDay || (world.clock?.day || 1);
  world.events = world.events || [];
  world.events.push({
    day: world.clock?.day || 1,
    hour: world.clock?.hour || 0,
    text: `${a.hiredBy ? (world.actors?.[a.hiredBy]?.name || '府里') + '替' : ''}${prop.name}请了${a.name}做${a.role}`,
  });
  a.workplace = prop.name;
  a.workplaceId = prop.placeId;
  if (!a.home) a.home = prop.placeId;

  prop.staffIds = Array.isArray(prop.staffIds) ? prop.staffIds : [];
  if (!prop.staffIds.includes(a.id)) prop.staffIds.push(a.id);
  prop.staff = prop.staffIds.length;

  world.notes = Array.isArray(world.notes) ? world.notes : [];
  world.notes.push({
    day: world.clock?.day || 1,
    hour: world.clock?.hour || 0,
    text: `${a.name}进了${prop.name}做${a.role}`,
  });

  return { ok: true, actor: a, prop, created };
}

/**
 * 谁看得见哪些产业（唯一出处）。
 * 相公：自己名下、自己管的、以及无主的老铺；
 * 其他人：只看得见自己名下或自己管的。
 */
export function visiblePropertiesOf(world, actorId) {
  const props = Array.isArray(world?.assets?.properties) ? world.assets.properties : [];
  const id = actorId || 'husband';
  return props.filter((p) => {
    if (!p) return false;
    if (id === 'husband') {
      return p.owner === 'husband' || p.keeper === 'husband' || (!p.owner && !p.keeper);
    }
    return p.owner === id || p.keeper === id;
  });
}

/**
 * 产业是否处于正常营运产生收益的状态（单一规范判定）
 * 包含：正常营业、已开张、正常起航、起航中、营运中、出海中、运营中等
 * 排除：自住府邸、筹备中、筹建中、未开张、歇业、查封、停业
 */
export function isPropertyOperational(prop) {
  if (!prop) return false;
  const st = String(prop.status || '').trim();
  if (['自住府邸', '筹备中', '筹建中', '未开张', '歇业', '查封', '停业'].includes(st)) return false;
  if (/正常营业|已开张|开张|起航|营运|出海|运营|航行/.test(st)) return true;
  // 兜底：如果 status 为空但已有 incomePerDay > 0 且不是府邸住宅，视为营业中
  return Number(prop.incomePerDay) > 0 && !/宅|府邸|后院/.test(String(prop.name || ''));
}

/**
 * 产业额定基准日入（单一出处，防缩水与日入稳定性锚点）
 */
export function getPropertyNominalIncome(prop) {
  if (!prop) return 0;
  const nm = String(prop.name || '');
  const id = String(prop.id || '');

  // 1. 核心重点产业基准锚定（依据军规大事记与既定契纸）
  if (id === 'canal_restaurant' || /运河码头三层大酒楼|运河大酒楼/.test(nm)) {
    return 124.1; // 军规铁律：相公全资盘下盛大开业，日进斗金（日入过百两）
  }
  if (id === 'xinyage' || /鑫雅阁/.test(nm)) {
    return 102.6; // 达官名流清贵雅阁
  }
  if (/新铺/.test(nm)) {
    return 80.7;
  }
  if (/王家运河大船队/.test(nm)) {
    return 43.8; // 旗舰加三艘驳船与二十船工
  }
  if (/码头盐铺/.test(nm)) {
    return 24.5; // 两淮特许官盐专营，暴利商行
  }
  if (/运河茶栈/.test(nm)) {
    return 19.8;
  }
  if (/两条货船及船工安家银/.test(nm)) {
    return 19.1;
  }
  if (/码头茶栈/.test(nm)) {
    return 14.7;
  }
  if (/东跨院杂货铺/.test(nm)) {
    return 14.7;
  }
  if (id === 'tea_house' || /临江茶坊老店/.test(nm)) {
    return 12.4; // 祖传茶坊名点
  }
  if (/运河货船/.test(nm)) {
    return 8.4;
  }
  if (id === 'wine_shop' || /于家酒肆/.test(nm)) {
    return 7.4; // 紫嫣陈酿直供
  }
  if (/王记花店/.test(nm)) {
    return 6.2;
  }
  if (/苏州阊门小茶栈/.test(nm)) {
    return 4.7;
  }
  if (/临街花铺/.test(nm)) {
    return 4.7;
  }
  if (/王记粮铺/.test(nm)) {
    return 4.0;
  }

  // 2. 泛化保底：已有核定收入或按购入本金的 5% 估算，最低不低于 1.5 两
  const cur = Number(prop.incomePerDay) || 0;
  const cost = Number(prop.costSilver) || 0;
  const base = Number(prop.baseIncome) || 0;
  return Math.max(cur, base, Math.round(cost * 0.05 * 10) / 10, 1.5);
}

