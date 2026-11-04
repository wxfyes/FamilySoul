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

import { moveActor } from './position.js';
import { isPlaceName } from './naming.js';

export function hireStaff(world, { propName = '', name = '', role = '伙计', via = 'dm', hiredBy = null, taskId = null } = {}) {
  const nm = String(name || '').trim();
  if (!isPlaceName(nm)) return { ok: false, error: `名字「${nm}」不像人名` };

  const prop = (world.assets?.properties || []).find((x) => x && String(x.name).includes(String(propName || '')));
  if (!prop) return { ok: false, error: `没有产业「${propName}」` };
  if (!prop.placeId || !world.places?.[prop.placeId]) return { ok: false, error: '这处产业还没挂地点' };

  let a = Object.values(world.actors || {}).find((x) => x && x.name === nm);
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
