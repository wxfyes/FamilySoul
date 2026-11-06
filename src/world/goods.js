/**
 * 货物与赌坊：世界里"能赚快钱"的两条路，都要引擎结算。
 *
 * 规矩：
 *   ① 货有数量、有市价，买卖走单一入口；
 *   ② 赌有庄家抽头，真会输；官府会查，打点能压住一阵；
 *   ③ 模型只提议，不直接改银子。
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (v) => Math.round(v * 100) / 100;

export function ensureGoods(world) {
  world.goods = world.goods && typeof world.goods === 'object' ? world.goods : {};
  return world.goods;
}

/** 米价：世界米价指数 × 底价（两/斗） */
export function ricePrice(world) {
  const g = world?.market?.grain || {};
  const base = num(g.base) || 0.4;
  const idx = num(g.index) || 1;
  return round2(base * idx);
}

const bag = (world, whoId) => {
  ensureGoods(world);
  const key = String(whoId || 'husband');
  world.goods[key] = world.goods[key] || {};
  world.goods[key].rice = num(world.goods[key].rice);
  return world.goods[key];
};

export function stockOf(world, whoId) {
  return bag(world, whoId).rice;
}

const purseOf = (world, whoId) => (String(whoId) === 'husband'
  ? num(world.assets?.silver)
  : num(world.actors?.[whoId]?.money));

const pay = (world, whoId, amount) => {
  if (String(whoId) === 'husband') world.assets.silver = round2(num(world.assets.silver) - amount);
  else if (world.actors?.[whoId]) world.actors[whoId].money = round2(num(world.actors[whoId].money) - amount);
};

const receive = (world, whoId, amount) => {
  if (String(whoId) === 'husband') world.assets.silver = round2(num(world.assets.silver) + amount);
  else if (world.actors?.[whoId]) world.actors[whoId].money = round2(num(world.actors[whoId].money) + amount);
};

const record = (world, whoId, delta, title) => {
  if (String(whoId) !== 'husband') return;
  world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
  world.ledger.push({
    day: world.clock?.day || 1, hour: world.clock?.hour || 0,
    delta: round2(delta), title: String(title).slice(0, 24), by: 'husband',
    balance: round2(num(world.assets?.silver)),
  });
  if (world.ledger.length > 300) world.ledger = world.ledger.slice(-300);
};

/** 买米：按当下米价进斗数 */
export function buyRice(world, whoId, dou) {
  const qty = Math.floor(num(dou));
  if (!(qty > 0)) return { ok: false, line: '（要买的数目不对。）' };
  const price = ricePrice(world);
  const cost = round2(price * qty);
  const purse = purseOf(world, whoId);
  if (purse < cost) return { ok: false, line: `（买 ${qty} 斗要 ${cost.toFixed(2)} 两，手头只有 ${purse.toFixed(2)} 两。）` };
  pay(world, whoId, cost);
  bag(world, whoId).rice += qty;
  record(world, whoId, -cost, `买米 ${qty} 斗`);
  console.log(`[Goods] ${whoId} 买米 ${qty} 斗 @ ${price}/斗，花 ${cost} 两`);
  return { ok: true, line: `（吃进 ${qty} 斗米，价 ${price.toFixed(2)} 两/斗，共花 ${cost.toFixed(2)} 两。现存 ${bag(world, whoId).rice} 斗。）` };
}

/** 只记货、不再扣钱（钱已由付款入口扣过） */
export function addRice(world, whoId, dou) {
  const qty = Math.floor(num(dou));
  if (!(qty > 0)) return { ok: false, line: '' };
  bag(world, whoId).rice += qty;
  return { ok: true, line: `\uFF08\u5403\u8fdb ${qty} \u6597\u7c73\uFF0C\u5df2\u5165\u4ed3\u3002\u73b0\u5b58 ${bag(world, whoId).rice} \u6597\u3002\uFF09` };
}

/** 卖米：铺面/牙行抽三分，剩的进账 */
export function sellRice(world, whoId, dou) {
  const have = stockOf(world, whoId);
  const qty = Math.min(Math.floor(num(dou)) || have, have);
  if (!(qty > 0)) return { ok: false, line: '（仓里没有米可卖。）' };
  const price = ricePrice(world);
  const gross = round2(price * qty);
  const net = round2(gross * 0.97);
  bag(world, whoId).rice -= qty;
  receive(world, whoId, net);
  record(world, whoId, net, `卖米 ${qty} 斗`);
  console.log(`[Goods] ${whoId} 卖米 ${qty} 斗 @ ${price}/斗，得 ${net} 两`);
  return { ok: true, line: `（出 ${qty} 斗米，价 ${price.toFixed(2)} 两/斗，牙行抽三分，实得 ${net.toFixed(2)} 两。仓里还剩 ${bag(world, whoId).rice} 斗。）` };
}

/** 一城一间赌坊（没有就支起来） */
export function ensureDen(world, cityName) {
  const city = String(cityName || '临江府');
  const slug = city.replace(/府$|县$|州$/g, '');
  const id = `${slug}_den`;
  if (!world.places?.[id]) {
    const streetId = Object.keys(world.places || {}).find((pid) => {
      const n = String(world.places[pid]?.name || '');
      return n.startsWith(city) && /街/.test(n);
    }) || 'street';
    world.places[id] = { id, name: `${city}·赌坊`, exits: [streetId], use: 'den', dynamic: true };
    if (world.places[streetId]) {
      world.places[streetId].exits = Array.isArray(world.places[streetId].exits) ? world.places[streetId].exits : [];
      if (!world.places[streetId].exits.includes(id)) world.places[streetId].exits.push(id);
    }
    console.log(`[Den] ${city} 开了赌坊`);
  }
  return id;
}

/**
 * 赌一把：庄家抽头，输赢当场结
 * 赢面 45%，赢则得 2 倍（净赚一倍）；平 5%；输 50%
 */
export function gamble(world, whoId, stake) {
  const amount = Math.min(50, Math.max(0.5, round2(num(stake))));
  const purse = purseOf(world, whoId);
  if (purse < amount) return { ok: false, line: `（押 ${amount.toFixed(2)} 两，手头只有 ${purse.toFixed(2)} 两。）` };
  const roll = Math.random();
  const bribed = Number(world.flags?.gambleBribedDay || 0) === (Number(world.clock?.day) || 1);
  if (roll < 0.45) {
    receive(world, whoId, amount);
    record(world, whoId, amount, '赌坊赢钱');
    world.flags = world.flags || {};
    world.flags.gambleHeat = num(world.flags.gambleHeat) + 1;
    return { ok: true, line: `（骰子开了——赢了。净进 ${amount.toFixed(2)} 两。庄家抽头之后，到手就是这么些。）` };
  }
  if (roll < 0.5) {
    return { ok: true, line: '（骰子停在中间，和局。押的钱退回来了。）' };
  }
  pay(world, whoId, amount);
  record(world, whoId, -amount, '赌坊输钱');
  world.flags = world.flags || {};
  world.flags.gambleHeat = num(world.flags.gambleHeat) + 1;
  return { ok: true, line: `（骰子开了——输了 ${amount.toFixed(2)} 两。庄家照抽，不认人。）` };
}

/** 打点官府：压住这一天的查赌风声 */
export function bribeOfficials(world, whoId, amount = 10) {
  const cost = round2(Math.min(50, Math.max(1, num(amount) || 10)));
  const purse = purseOf(world, whoId);
  if (purse < cost) return { ok: false, line: `（打点要 ${cost.toFixed(2)} 两，手头不够。）` };
  pay(world, whoId, cost);
  record(world, whoId, -cost, '打点官府');
  world.flags = world.flags || {};
  world.flags.gambleBribedDay = Number(world.clock?.day) || 1;
  world.flags.gambleHeat = 0;
  return { ok: true, line: `（使了 ${cost.toFixed(2)} 两，衙门那边今天不会来查。）` };
}

/** 日结：赌得凶又没打点，就可能被查 */
export function dailyGambleRaid(world) {
  const heat = num(world.flags?.gambleHeat);
  if (heat < 3) return null;
  const day = Number(world.clock?.day) || 1;
  if (Number(world.flags?.gambleBribedDay || 0) === day) return null;
  if (Math.random() > 0.35) return null;
  const fine = Math.min(60, 10 + heat * 2);
  const purse = purseOf(world, 'husband');
  const taken = Math.min(fine, purse);
  pay(world, 'husband', taken);
  record(world, 'husband', -taken, '赌坊被查罚银');
  world.flags.gambleHeat = 0;
  console.log(`[Den] 赌坊被查，罚 ${taken} 两`);
  return { fine: taken };
}
