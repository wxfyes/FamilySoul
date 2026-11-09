/**
 * 产业落地：花了钱开张的铺子，必须在产业总览里真有这一间。
 * 只从"某铺开张/盘铺/开业"这类明确流水里认，不猜。
 */

function slugOf(name, seq) {
  return `project_${seq}`;
}

/** 按本钱与定位估日入：普通铺 5%/日；雅集/清贵/达官客源 7.5%/日 */
export function recommendedIncome(amount, title = '') {
  const base = Math.max(0, Number(amount) || 0) * 0.05;
  const luxury = /雅|清贵|达官|世家|公子|琴|诗|高端|贵客|花魁|头牌|名士|雅集|贵人/.test(`${title}`);
  return Math.max(0.5, Math.round(base * (luxury ? 1.5 : 1) * 100) / 100);
}

function isLuxuryProject(text = '') {
  return /雅|清贵|达官|世家|公子|琴|诗|高端|贵客|花魁|头牌|名士|雅集|贵人/.test(String(text));
}

/** 给产业补楼层：雅集/清贵定位默认二层；一层大堂、二层雅间都要是真实地点 */
function ensureProjectFloors(world, prop, name, title = '') {
  if (!prop || !prop.placeId || !world.places?.[prop.placeId]) return;
  const luxury = isLuxuryProject(`${name} ${title} ${prop.desc || ''}`);
  const floors = Math.max(Number(prop.floors) || 0, luxury ? 2 : 1);
  const root = world.places[prop.placeId];
  root.rooms = root.rooms && typeof root.rooms === 'object' ? root.rooms : {};
  const specs = floors >= 2
    ? [{ key: 'f1', name: '一层大堂' }, { key: 'f2', name: '二层雅间' }]
    : [{ key: 'f1', name: '一层大堂' }];
  for (const s of specs) {
    const rid = `${prop.placeId}__${s.key}`;
    root.rooms[s.key] = root.rooms[s.key] || { id: rid, name: s.name, use: 'shop_floor', floor: s.key === 'f2' ? 2 : 1, access: 'public_shop' };
    if (!world.places[rid]) {
      world.places[rid] = {
        id: rid, name: `${name}·${s.name}`, parent: prop.placeId, use: 'shop_floor',
        floor: s.key === 'f2' ? 2 : 1, access: s.key === 'f2' ? 'family_core' : 'public_shop',
        exits: [prop.placeId], createdDay: prop.openedDay || world.clock?.day || 1,
      };
    }
    root.exits = Array.isArray(root.exits) ? root.exits : [];
    if (!root.exits.includes(rid)) root.exits.push(rid);
  }
  prop.floors = floors;
  prop.floorNames = specs.map((s) => s.name);
}

export function ensureProjectProperty(world, projectName, amount, { day = null, title = '' } = {}) {
  const name = String(projectName || '').replace(/^[「『\s]+|[」』\s]+$/g, '').trim().slice(0, 20);
  if (name.length < 2) return null;
  if (!/铺|店|楼|阁|坊|馆|轩|斋|庄|号|堂|居|园/.test(name)) return null;
  world.assets = world.assets || {};
  world.assets.properties = Array.isArray(world.assets.properties) ? world.assets.properties : [];
  const exists = world.assets.properties.find((p) => p && (
    String(p.name || '').includes(name) || name.includes(String(p.name || ''))
  ));
  if (exists) {
    // 之前用 1% 低估的旧产业，按定位补到合理日入；已有更高收入的不动
    const rec = recommendedIncome(Number(exists.costSilver ?? amount) || 0, `${exists.name || ''} ${title}`);
    if (exists.autoIncome !== false && Number(exists.incomePerDay) < rec && Number(exists.costSilver || 0) >= 50) {
      exists.incomePerDay = rec;
      exists.autoIncome = true;
      console.log(`[Project] 修正日入：${exists.name} → ${rec} 两/日`);
    }
    ensureProjectFloors(world, exists, name, title);
    return exists;
  }

  world.places = world.places || {};
  world.flags = world.flags || {};
  let placeId = Object.keys(world.places).find((id) => String(world.places[id]?.name || '').includes(name));
  if (!placeId) {
    world.flags.projectPlaceSeq = (Number(world.flags.projectPlaceSeq) || 0) + 1;
    placeId = slugOf(name, world.flags.projectPlaceSeq);
    world.places[placeId] = {
      id: placeId, name, exits: ['street'], use: 'shop', dynamic: true,
      createdDay: world.clock?.day || 1, desc: `相公置下的产业：${name}`,
    };
  }
  world.flags.propertySeq = (Number(world.flags.propertySeq) || 0) + 1;
  const prop = {
    id: `prop_${world.flags.propertySeq}`,
    name,
    status: '已开张',
    owner: 'husband',
    keeper: 'husband',
    keeperName: '王甯',
    ownerName: '王甯',
    costSilver: Math.max(0, Number(amount) || 0),
    capital: Math.max(0, Number(amount) || 0),
    placeId,
    staff: 0,
    staffIds: [],
    incomePerDay: recommendedIncome(Number(amount) || 0, `${name} ${title}`),
    autoIncome: true,
    openedDay: Number(day) || Number(world.clock?.day) || 1,
    desc: `相公出资置办并开张的产业${title ? `（${String(title).slice(0, 20)}）` : ''}`,
  };
  ensureProjectFloors(world, prop, name, title);
  world.assets.properties.push(prop);
  world.notes = Array.isArray(world.notes) ? world.notes : [];
  world.notes.push({ day: world.clock?.day || 1, hour: world.clock?.hour || 0, text: `产业入册：${name}（${prop.costSilver} 两开张）` });
  world.notes = world.notes.slice(-80);
  console.log(`[Project] 产业落地：${name}，成本 ${prop.costSilver} 两，日入 ${prop.incomePerDay}`);
  return prop;
}

/** 旧账修复：已经扣过"某某开张/盘铺"的钱，但没有产业记录的，补建。 */
export function repairProjectProperties(world) {
  let made = 0;
  const byName = new Map();
  for (const e of world?.ledger || []) {
    if (!e || Number(e.delta) >= 0) continue;
    const title = String(e.title || '').replace(/\s/g, '');
    const m = title.match(/^([\u4e00-\u9fa5]{2,10}?)(?:开张|盘铺|盘店|开业)/);
    if (!m) continue;
    const amt = Math.abs(Number(e.delta) || 0);
    if (amt < 50) continue;
    byName.set(m[1], Math.max(byName.get(m[1]) || 0, amt));
  }
  for (const [name, amt] of byName) {
    if (ensureProjectProperty(world, name, amt, { title: `${name}（旧账补录）` })) made += 1;
  }
  if (made) console.log(`[Project] 旧账补建产业 ${made} 间`);
  return made;
}
