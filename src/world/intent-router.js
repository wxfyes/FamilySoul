/**
 * 统一意图入口：先听懂相公一句话里要办几件事，再逐件交给单一入口执行。
 *
 * 现在先接管最容易“说了不办”的四类：
 *   · 招人（琴娘/舞娘/伙计/掌柜/头牌……）
 *   · 调人（让阿福去粮铺坐柜）
 *   · 约定/提醒（明日回门，记得提醒我）
 * 不再要求相公记固定句式；没听懂就明说，不装懂。
 */

import { moveActor } from './position.js';
import { hireStaff } from './employment.js';
import { fallbackName } from './migration.js';

const ROLE_RE = /(二掌柜|掌柜|伙计|跑堂|账房|厨子|琴娘|舞娘|头牌|花魁|琴师|歌女)/g;
const CN_NUM = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

function num(raw) {
  const t = String(raw || '').trim();
  if (/^\d+$/.test(t)) return Number(t);
  let total = 0; let cur = 0;
  for (const ch of t) {
    if (CN_NUM[ch] != null) cur = CN_NUM[ch];
    else if (ch === '十') { total += (cur || 1) * 10; cur = 0; }
    else if (ch === '百') { total += (cur || 1) * 100; cur = 0; }
  }
  return total + cur;
}

function splitClauses(text) {
  return String(text || '')
    .split(/([，。；！？\n])/)
    .reduce((acc, part) => {
      if (!part) return acc;
      const last = acc[acc.length - 1];
      if (last && !/[，。；！？\n]$/.test(last.text)) last.text += part;
      else acc.push({ text: part, sep: '' });
      return acc;
    }, [])
    .map((x) => ({ text: x.text.replace(/[，。；！？\n]$/, '').trim(), raw: x.text }))
    .filter((x) => x.text);
}

function propertiesOf(world) {
  return Array.isArray(world?.assets?.properties) ? world.assets.properties.filter((p) => p && p.name) : [];
}

function resolveProperty(world, text, me) {
  const props = propertiesOf(world);
  const hit = props
    .filter((p) => text.includes(String(p.name)) || (String(p.name).length > 2 && text.includes(String(p.name).slice(-2))))
    .sort((a, b) => String(b.name).length - String(a.name).length)[0];
  if (hit) return hit;
  const here = world.places?.[me?.location];
  const root = here?.parent || me?.location;
  return props.find((p) => p.placeId === me?.location || p.placeId === root
    || String(world.places?.[p.placeId]?.parent || '') === root)
    || (props.length === 1 ? props[0] : null);
}

function resolveActor(world, text, me = null) {
  const actors = Object.values(world?.actors || {}).filter((a) => a && !a.dead && a.id !== 'husband' && a.name);
  const hits = actors.filter((a) => text.includes(String(a.name))
    || (String(a.name).length > 2 && text.includes(String(a.name).slice(-2))));
  if (!hits.length) return null;
  // 全名优先；只叫“婉宁”这种叠名时，先认本宅家眷，再认当前在场的人，绝不乱点同名
  const exact = hits.filter((a) => text.includes(String(a.name)));
  const pool = exact.length ? exact : hits;
  const kin = pool.filter((a) => a.household || a.spouse === 'husband' || /正妻|侧室|如夫人|二房|通房|妾/.test(String(a.role || '')));
  if (kin.length === 1) return kin[0];
  const here = pool.filter((a) => me?.location && a.location === me.location);
  if (here.length === 1) return here[0];
  pool.sort((a, b) => String(b.name).length - String(a.name).length);
  return pool[0] || null;
}

function roleFrom(text) {
  return [...String(text).matchAll(ROLE_RE)].map((m) => m[1])[0] || '';
}

function countNear(text, role) {
  const a = new RegExp(`(\\d+|[一二两三四五六七八九十]+|几|数)\\s*(?:个|名|位|人)?\\s*${role}`).exec(text);
  const b = new RegExp(`${role}\\s*(\\d+|[一二两三四五六七八九十]+|几|数)\\s*(?:个|名|位|人)`).exec(text);
  const m = a || b;
  if (!m) return 1;
  return /几|数/.test(m[1]) ? 2 : Math.max(1, Math.min(10, num(m[1])));
}

function timeOf(text, world) {
  const day = Number(world?.clock?.day) || 1;
  const hour = Number(world?.clock?.hour) || 0;
  let d = null; let h = null;
  if (/后天/.test(text)) d = day + 2;
  else if (/明天|明日|明早|明晚/.test(text)) d = day + 1;
  else if (/今天|今日|今晚/.test(text)) d = day;
  const mDay = /第\s*(\d+)\s*日/.exec(text);
  if (mDay) d = Number(mDay[1]);
  if (/明早|早上|清晨/.test(text)) h = 8;
  else if (/明晚|晚上|夜里|今晚/.test(text)) h = 20;
  else if (/上午/.test(text)) h = 10;
  else if (/中午|晌午/.test(text)) h = 12;
  else if (/下午/.test(text)) h = 14;
  const mHour = /(\d{1,2})\s*(?:时|点)/.exec(text);
  if (mHour) h = Math.max(0, Math.min(23, Number(mHour[1])));
  if (d == null && h == null) return null;
  const outDay = d == null ? day : d;
  const outHour = h == null ? 10 : h;
  if (outDay * 24 + outHour <= day * 24 + hour) return { day: outDay + 1, hour: outHour };
  return { day: outDay, hour: outHour };
}

function pushUnique(list, item) {
  if (!list.some((x) => x === item)) list.push(item);
}

/**
 * @returns {{notices:string[], remainingText:string, handled:string[]}}
 */
export function applyUnifiedIntents({ world, viewerId = 'husband', sayText = '' }) {
  const notices = [];
  const handled = [];
  const me = world?.actors?.[viewerId] || world?.actors?.husband;
  if (!me) return { notices, remainingText: String(sayText || ''), handled };
  const day = Number(world.clock?.day) || 1;
  const clauses = splitClauses(sayText);
  const keep = [];

  for (const c of clauses) {
    const text = c.text;
    if (!text) continue;
    const roles = [...new Set([...text.matchAll(ROLE_RE)].map((m) => m[1]))];

    // 1) 招人 / 调人
    if (roles.length > 0) {
      const prop = resolveProperty(world, text, me);
      const actor = resolveActor(world, text, me);
      const hireWord = /(招|雇|聘|请|添|增加|加|补|找)/.test(text);
      const transferWord = /(让|叫|派|调|安排|请)/.test(text) && /(到|去|往)/.test(text);

      if (actor && prop?.placeId && transferWord) {
        const role = roleFrom(text);
        if (role) actor.role = role;
        moveActor(world, actor.id, prop.placeId, 'world', '调往产业');
        prop.staffIds = Array.isArray(prop.staffIds) ? prop.staffIds : [];
        if (!prop.staffIds.includes(actor.id)) prop.staffIds.push(actor.id);
        prop.staff = prop.staffIds.length;
        actor.home = prop.placeId;
        actor.quarters = prop.placeId;
        actor.workplace = prop.name;
        actor.workplaceId = prop.placeId;
        actor.employer = prop.owner || 'husband';
        actor.schedule = [];
        actor.activity = { text: `在${prop.name}当${actor.role || '差'}`, at: Number(world.clock?.hour) || 0, day };
        if (/掌柜/.test(role || '')) { prop.keeper = actor.id; prop.keeperName = actor.name; }
        notices.push(`${actor.name}已到${prop.name}当差。`);
        pushUnique(handled, 'transfer');
        continue;
      }

      if (prop?.placeId && hireWord) {
        if (roles.includes('掌柜') && Object.values(world.actors || {}).some((a) => a && !a.dead
          && (a.location === prop.placeId || String(world.places?.[a.location]?.parent || '') === prop.placeId)
          && /掌柜/.test(String(a.role || '')))) {
          notices.push(`（${prop.name}已经有掌柜了。）`);
          pushUnique(handled, 'hire');
          continue;
        }
        const namedNew = /(?:雇|请|聘|招)\s*([\u4e00-\u9fa5]{2,4})(?=\s*(?:来|当|做|任|到|去|管|掌|坐柜|看店))/.exec(text)?.[1] || '';
        const namedTaken = namedNew && Object.values(world.actors || {}).some((a) => a && a.name === namedNew);
        const names = [];
        for (const role of roles) {
          const n = countNear(text, role);
          for (let i = 0; i < n; i += 1) {
            const nm = (namedNew && !namedTaken && roles.length === 1 && names.length === 0)
              ? namedNew
              : fallbackName(world, /琴娘|舞娘|歌女|头牌|花魁|厨娘|婆子/.test(role) ? 'female' : 'male');
            const r = hireStaff(world, { propName: prop.name, name: nm, role, hiredBy: me.id });
            if (r?.ok) names.push({ name: nm, role });
          }
        }
        if (names.length) {
          const cost = Math.round(names.length * 0.5 * 100) / 100;
          const purse = Number(world.assets?.silver) || 0;
          if (purse >= cost) {
            world.assets.silver = Math.round((purse - cost) * 100) / 100;
            world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
            const summary = roles.map((r) => `${r}${names.filter((x) => x.role === r).length}人`).join('、');
            world.ledger.push({ day, hour: Number(world.clock?.hour) || 0, delta: -cost, title: `${prop.name}添${summary}·安家银`, by: me.id, balance: world.assets.silver, category: '雇工' });
            notices.push(`${prop.name}添了 ${names.map((x) => x.name).join('、')}，分任${summary}，安家银共 ${cost.toFixed(2)} 两。`);
          } else {
            notices.push(`（银不够：${prop.name}添这些人要 ${cost.toFixed(2)} 两安家银。）`);
          }
          pushUnique(handled, 'hire');
          continue;
        }
      }
    }

    // 2) 约定/提醒
    const time = timeOf(text, world);
    const remindWord = /(提醒|叫我|记得|别忘了|回门|约定|约好)/.test(text);
    if (time && remindWord) {
      const actor = resolveActor(world, text, me);
      const name = actor?.name || '';
      if (name) {
        world.appointments = Array.isArray(world.appointments) ? world.appointments : [];
        const eventKey = /回门/.test(text) ? '回门' : '';
        const sameActor = world.appointments.filter((ap) => ap
          && (ap.actorId === actor?.id || ap.name === name));
        const found = sameActor.find((ap) => eventKey && String(ap.text || '').includes(eventKey))
          || sameActor.find((ap) => ap.day === time.day);
        if (found) {
          found.day = time.day;
          found.hour = time.hour;
          found.text = text.slice(0, 80);
          if (actor) { found.actorId = actor.id; found.name = name; }
          notices.push(`${name}的事改到第${time.day}日 ${time.hour}时，到点提醒相公。`);
        } else {
          world.appointments.push({ actorId: actor?.id || null, name, day: time.day, hour: time.hour, place: me.location || null, text: text.slice(0, 80), madeAt: { day, hour: Number(world.clock?.hour) || 0 } });
          notices.push(`记下了：第${time.day}日 ${time.hour}时，${name}的事到点提醒相公。`);
        }
        pushUnique(handled, 'appointment');
        continue;
      }
    }

    keep.push(c.raw || text);
  }

  return { notices, remainingText: keep.join(''), handled };
}
