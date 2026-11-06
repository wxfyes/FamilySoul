/**
 * 经营动作：走货、夜市——让"婉儿提的方案"真的动钱。
 *
 * 规矩：
 *   ① 模型只提方案，引擎校验本钱、扣钱、记船期；
 *   ② 到期结算按行情与运气，赚赔都可能；
 *   ③ 一切进出走 ledger，可查。
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => Math.round(v * 100) / 100;

export function ensureBiz(world) {
  world.tradeRuns = Array.isArray(world.tradeRuns) ? world.tradeRuns : [];
  world.flags = world.flags || {};
  world.flags.bizNotices = Array.isArray(world.flags.bizNotices) ? world.flags.bizNotices : [];
  return world;
}

const silverOf = (world, whoId) => (String(whoId) === 'husband'
  ? num(world.assets?.silver)
  : num(world.actors?.[whoId]?.money));

const paySilver = (world, whoId, amount) => {
  if (String(whoId) === 'husband') world.assets.silver = round2(num(world.assets.silver) - amount);
  else if (world.actors?.[whoId]) world.actors[whoId].money = round2(num(world.actors[whoId].money) - amount);
};

const gainSilver = (world, whoId, amount) => {
  if (String(whoId) === 'husband') world.assets.silver = round2(num(world.assets.silver) + amount);
  else if (world.actors?.[whoId]) world.actors[whoId].money = round2(num(world.actors[whoId].money) + amount);
};

const ledger = (world, whoId, delta, title) => {
  if (String(whoId) !== 'husband') return;
  world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
  world.ledger.push({
    day: world.clock?.day || 1, hour: world.clock?.hour || 0,
    delta: round2(delta), title: String(title).slice(0, 24), by: 'husband',
    balance: round2(num(world.assets?.silver)),
  });
};

const notify = (world, text) => {
  ensureBiz(world);
  world.flags.bizNotices.push({ day: world.clock?.day || 1, text: String(text).slice(0, 80) });
  if (world.flags.bizNotices.length > 20) world.flags.bizNotices = world.flags.bizNotices.slice(-20);
};

/** 起一船货：投入本钱，定天数（默认 7 天） */
export function startTradeRun(world, whoId, capital, days = 7) {
  ensureBiz(world);
  const cap = round2(Math.min(2000, Math.max(5, num(capital))));
  const has = silverOf(world, whoId);
  if (has < cap) return { ok: false, line: `（走这一船要 ${cap.toFixed(2)} 两本钱，手头只有 ${has.toFixed(2)} 两。）` };
  const day = num(world.clock?.day) || 1;
  const dur = Math.max(3, Math.min(20, Math.floor(num(days)) || 7));
  paySilver(world, whoId, cap);
  ledger(world, whoId, -cap, '走货本钱');
  world.tradeRuns.push({
    id: `run_${Date.now()}`,
    who: String(whoId),
    capital: cap,
    startDay: day,
    dueDay: day + dur,
    status: 'at_sea',
  });
  console.log(`[Biz] ${whoId} 走一船货：本钱 ${cap}，${dur} 天回`);
  return { ok: true, line: `（备了 ${cap.toFixed(2)} 两本钱，船已经发出去，约 ${dur} 天后有回信。这趟赚赔，看行情也看运气。）` };
}

/** 结算到期船次 */
export function settleTradeRuns(world) {
  ensureBiz(world);
  const day = num(world.clock?.day) || 1;
  const done = [];
  for (const run of world.tradeRuns) {
    if (!run || run.status !== 'at_sea') continue;
    if (day < num(run.dueDay)) continue;
    const roll = Math.random();
    let factor;
    let note;
    if (roll < 0.55) { factor = 1.15 + Math.random() * 0.65; note = '顺风顺水，卖了个好价'; }
    else if (roll < 0.82) { factor = 0.9 + Math.random() * 0.25; note = '行情平，薄利回来'; }
    else if (roll < 0.95) { factor = 0.5 + Math.random() * 0.35; note = '路上耽搁，折了本'; }
    else { factor = 0.1 + Math.random() * 0.3; note = '遇上风浪/匪，几乎血本无归'; }
    const back = round2(num(run.capital) * factor);
    gainSilver(world, run.who, back);
    ledger(world, run.who, back, '走货回银');
    run.status = 'done';
    run.back = back;
    run.result = note;
    const profit = round2(back - num(run.capital));
    const name = world.actors?.[run.who]?.name || '相公';
    notify(world, `${name}那船货回来了：本钱 ${num(run.capital).toFixed(2)} 两，回银 ${back.toFixed(2)} 两（${profit >= 0 ? '赚' : '亏'} ${Math.abs(profit).toFixed(2)} 两）。${note}。`);
    console.log(`[Biz] 船回：本 ${run.capital} → 回 ${back}（${note}）`);
    done.push(run);
  }
  return done;
}

/** 取走待告知的经营消息（聊天出口用） */
export function drainBizNotices(world) {
  ensureBiz(world);
  const list = world.flags.bizNotices.splice(0, world.flags.bizNotices.length);
  return list;
}

/** 夜市：花一笔开销，酒楼/茶坊这几天多进项（也有被查风险） */
export function startNightMarket(world, whoId, cost = 8) {
  ensureBiz(world);
  const fee = round2(Math.max(2, Math.min(50, num(cost))));
  const has = silverOf(world, whoId);
  if (has < fee) return { ok: false, line: `（支夜市要 ${fee.toFixed(2)} 两灯油伙计钱，手头不够。）` };
  const props = (world.assets?.properties || []).filter((p) => p && /酒楼|茶坊|茶栈|酒肆/.test(String(p.name || '')));
  if (!props.length) return { ok: false, line: '（你名下没有酒楼茶坊，夜市没处支。）' };
  paySilver(world, whoId, fee);
  ledger(world, whoId, -fee, '夜市开销');
  const day = num(world.clock?.day) || 1;
  for (const p of props.slice(0, 3)) {
    p.nightBoost = { untilDay: day + 5, rate: 0.3 };
  }
  world.flags.nightMarket = { untilDay: day + 5, risk: 0.15 };
  console.log(`[Biz] 夜市开了：${props.map((p) => p.name).join('、')}，5 天`);
  return { ok: true, line: `（${props.map((p) => p.name).join('、')} 支起夜市，灯油伙计花 ${fee.toFixed(2)} 两，五日内进项上浮三成——但衙门也可能来查。）` };
}

/** 日结：夜市到期清除 */
export function settleNightMarket(world) {
  ensureBiz(world);
  const day = num(world.clock?.day) || 1;
  for (const p of (world.assets?.properties || [])) {
    if (p?.nightBoost && day > num(p.nightBoost.untilDay)) delete p.nightBoost;
  }
  if (world.flags?.nightMarket && day > num(world.flags.nightMarket.untilDay)) delete world.flags.nightMarket;
}
