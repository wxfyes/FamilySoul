/**
 * 世界时钟 —— 纯规则模拟，全程不调用大模型
 *
 * 真人机时比：默认 1 真实小时 = 1 世界日（即 2.5 真实分钟 = 1 世界小时）。
 * 用户关掉 App 三天再回来，世界已经走了 72 天。
 */
import {
  loadState,
  saveState,
  appendEvents,
  nextEvent,
  seasonOf,
  weatherOf,
  shichenOf,
  round2,
} from './state.js';
import { runNPCInitiatives } from './actors.js';
import { healWorld } from './heal.js';
import { advanceArcs, ensureArcs } from './arcs.js';

export const DEFAULT_MS_PER_WORLD_HOUR = 2.5 * 60 * 1000;
export const DEFAULT_TICK_INTERVAL_MS = 2 * 60 * 1000; // 2 分钟心跳：世界推进更细，不用干等 10 分钟
const MAX_STEPS_PER_TICK = 720; // 一次最多补算 30 个世界日
const GOSSIP_HOUR = 8; // 每日辰时（8 点）开市，阿吉报送市井风闻

const DAILY_GOSSIP = [
  '运河码头新到一批徽州客商，正四处打听临江头春茶的行情',
  '城东翟家货栈昨夜又有人在花街喝到天明，翟老板至今未归',
  '知府衙门贴出告示，今春茶税要按新例重核',
  '城南于家酒肆新出了一款茶酒，据说是老板娘亲手调的',
  '县衙巡检徐老虎的人马这几日在西市收例钱，商户多有怨言',
  '紫阳山后的茶路听说塌了一段，运茶的车马要绕远',
  '秦淮画舫来了个会唱曲的清倌人，城里几个公子哥儿天天去捧场',
  '漕帮雷七爷的人在码头清点货船，说要整肃水运规矩',
];

function dailyGossip(day) {
  return DAILY_GOSSIP[Math.abs(day) % DAILY_GOSSIP.length];
}

const PROACTIVE_COOLDOWN_HOURS = 6; // 主动推送按「世界时辰」间隔，至少隔 6 个世界小时

function worldHourStamp(world) {
  return (Number(world.clock?.day) || 1) * 24 + (Number(world.clock?.hour) || 0);
}

/**
 * 排队一条「世界主动找上门」的请求。
 *
 * 注意：这里**不写台词**——只登记「该她开口了」这个事实（reason + 事实材料），
 * 真正的措辞由天道（大模型）在发送前现写，见 pet-service.generateProactive()。
 * fallback 仅在大模型不可用时兜底，绝不作日常文案。
 */
export function queueProactive(
  world,
  { text = null, reason = 'proactive', facts = {}, fallback = null, speaker = null, type = 'proactive', to = 'husband', atMs = Date.now(), force = false } = {},
) {
  if (!text && !fallback && !reason) return false;
  const stamp = worldHourStamp(world);
  const last = Number(world.flags.lastProactiveStamp) || 0;
  if (!force && last > 0 && stamp - last < PROACTIVE_COOLDOWN_HOURS) return false;
  world.flags.lastProactiveStamp = stamp;
  world.proactive = Array.isArray(world.proactive) ? world.proactive : [];
  world.proactive.push({
    id: `p_${stamp}_${world.proactive.length}_${Math.floor(Math.random() * 1000)}`,
    type,
    to,
    reason,
    facts,
    text,
    fallback,
    speaker,
    at: atMs,
    day: world.clock.day,
    hour: world.clock.hour,
  });
  if (world.proactive.length > 20) world.proactive = world.proactive.slice(-20);
  return true;
}

function applyEffects(world, effects = []) {
  for (const eff of effects) {
    if (eff.type === 'relation') {
      const actor = world.actors?.[eff.target];
      const rel = actor?.relations?.husband;
      if (rel && typeof rel[eff.field] === 'number') {
        rel[eff.field] = Math.max(0, Math.min(100, rel[eff.field] + Number(eff.delta || 0)));
      }
    } else if (eff.type === 'silver') {
      world.assets.silver = round2((world.assets.silver || 0) + Number(eff.delta || 0));
    } else if (eff.type === 'reputation') {
      world.flags.reputation = (Number(world.flags.reputation) || 0) + Number(eff.delta || 0);
    }
  }
}

/** 新的一天：结算日流水（市井风闻改到每日辰时播报，见 advanceHour）*/
function advancePregnancies(world, events) {
  for (const a of Object.values(world.actors || {})) {
    const pg = a?.pregnancy;
    if (!pg || !pg.sinceDay) continue;
    const days = world.clock.day - Number(pg.sinceDay);
    pg.days = days;
    // 足月（约 280 天）→ 生下孩子，变成世界里真正的人
    if (days >= 280 && !pg.born) {
      pg.born = true;
      world.flags.npcSeq = (Number(world.flags.npcSeq) || 0) + 1;
      const id = `npc_${world.flags.npcSeq}`;
      // 性别 50/50 真随机；孩子随父姓（王家）
      const boy = Math.random() < 0.5;
      const GIVEN_BOY = ['承宗', '景行', '念祖', '守拙', '明远', '亦安'];
      const GIVEN_GIRL = ['念慈', '柔嘉', '清婉', '静姝', '如珍', '亦宁'];
      const pool = boy ? GIVEN_BOY : GIVEN_GIRL;
      const given = pool[Math.floor(Math.random() * pool.length)];
      const babyName = `王${given}`;
      world.actors[id] = {
        id,
        name: babyName,
        role: `${a.name}${boy ? '所生之子' : '所生之女'}`,
        gender: boy ? 'male' : 'female',
        origin: 'spawned',
        household: Boolean(a.household),
        home: a.home || a.location,
        location: a.location,
        bornDay: world.clock.day,
        goals: ['长大成人'],
        relations: { husband: { trust: 50, desire: 0, fear: 0, grievance: 0 } },
        schedule: [],
      };
      a.pregnancy = { ...pg, bornDay: world.clock.day };
      events.push(
        nextEvent(world, {
          action: 'birth',
          actor: a.id,
          place: a.location,
          payload: { text: `${a.name}诞下${babyName}` },
          isPublic: true,
        }),
      );
      world.memories = Array.isArray(world.memories) ? world.memories : [];
      world.memories.push({
        text: `第${world.clock.day}日，${a.name}为相公诞下${boy ? '一子' : '一女'}，取名${babyName}`,
        day: world.clock.day,
        at: Date.now(),
      });
      if (world.memories.length > 120) world.memories = world.memories.slice(-120);
      console.log(`[World] ${a.name}临盆，孩子入世：${babyName}（${boy ? '子' : '女'}）`);
    }
  }
}

/**
 * 地方经济与税收：物价浮动、天灾、抽税、民心
 * 税高→民心散→民变；税低→民心归→但收入少。这就是"王朝好坏"的根。
 */
function runLocalEconomy(world, events) {
  const day = world.clock?.day ?? 1;
  const season = world.clock?.season || 'spring';
  for (const [name, ct] of Object.entries(world.cities || {})) {
    if (!ct) continue;
    // 物价向常价回归，再叠加季节与灾荒
    const drift = Math.round((100 - (Number(ct.price) || 100)) * 0.2);
    ct.price = Math.max(50, Math.min(300, Math.round((Number(ct.price) || 100) + drift)));

    // 天灾：小概率
    if (Math.random() < 0.04) {
      const kind = ['旱', '涝', '蝗', '雪灾'][Math.floor(Math.random() * 4)];
      ct.price = Math.min(300, Math.round((Number(ct.price) || 100) * 1.25));
      ct.unrest = Math.min(100, (Number(ct.unrest) || 0) + 6);
      events.push(
        nextEvent(world, {
          action: 'disaster',
          actor: 'system',
          place: ct.region || null,
          payload: { text: `${name}遭${kind}，粮价上涨` },
          isPublic: true,
        }),
      );
    }

    // 税：占城者收，朝廷的城不归你
    const tax = Math.max(0, Math.min(50, Number(ct.tax) || 0));
    if (ct.owner === 'wangjia') {
      const gain = Math.round(((Number(ct.wealth) || 30) * tax) / 100 / 5 * 100) / 100;
      if (gain > 0) {
        world.assets.silver = Math.round(((Number(world.assets.silver) || 0) + gain) * 100) / 100;
      }
      // 税越高，民心越散
      ct.unrest = Math.max(0, Math.min(100, (Number(ct.unrest) || 0) + Math.round(tax / 8)));
    } else {
      ct.unrest = Math.max(0, Math.min(100, (Number(ct.unrest) || 0) + (tax >= 20 ? 1 : -1)));
    }

    // 民心涣散到极点 → 民变
    if ((Number(ct.unrest) || 0) >= 85 && Math.random() < 0.15) {
      ct.owner = 'court';
      ct.unrest = 60;
      events.push(
        nextEvent(world, {
          action: 'revolt',
          actor: 'system',
          place: ct.region || null,
          payload: { text: `${name}民变，城池易手` },
          isPublic: true,
        }),
      );
    }
  }
}

function consumeSupplies(world) {
  const mil = world.military;
  if (!mil) return;
  const need = Math.ceil(((Number(mil.army) || 0) + (Number(mil.militia) || 0) * 0.5) / 100);
  if (need <= 0) return;
  const have = Number(mil.supplies) || 0;
  if (have >= need) {
    mil.supplies = have - need;
  } else {
    mil.supplies = 0;
    mil.morale = Math.max(0, (Number(mil.morale) || 0) - 5);
  }
}

function onNewDay(world, events) {
  consumeSupplies(world);
  try {
    runLocalEconomy(world, events);
  } catch (err) {
    console.warn('[Econ] 地方经济结算失败：', err.message);
  }
  // 气是会消的：每天自动消退 1 点（被人一再冷落才会积住）
  for (const a of Object.values(world.actors || {})) {
    const g = a?.relations?.husband?.grievance;
    if (typeof g === 'number' && g > 0) {
      a.relations.husband.grievance = Math.max(0, Math.round((g - 1) * 10) / 10);
    }
  }

  const income = (world.assets.properties || []).reduce(
    (sum, p) => sum + (Number(p.incomePerDay) || 0),
    0,
  );
  if (income > 0) {
    world.assets.silver = round2((world.assets.silver || 0) + income);
    events.push(
      nextEvent(world, {
        action: 'settle',
        place: 'tea_house',
        payload: { income, silver: world.assets.silver },
        isPublic: false,
      }),
    );
  }
}

/** NPC 按日程移动（只改位置，不产生噪音事件）*/
function runSchedules(world) {
  const husbandPlace = world.actors?.husband?.location;
  for (const actor of Object.values(world.actors || {})) {
    if (!Array.isArray(actor.schedule)) continue;
    for (const slot of actor.schedule) {
      if (slot.at === world.clock.hour && slot.place && actor.location !== slot.place) {
        // 正在私会的人不打断；被相公派出去的人（外派豁免期内）也不拉回来
        if (actor.intimacy?.ritual === 'unlocked') continue;
        if (actor.away && Number(actor.away.untilDay) >= Number(world.clock.day)) continue;
        actor.location = slot.place;
        // 主子（不含正妻本人）走到相公所在之处 → 主动来见
        if (
          husbandPlace &&
          actor.location === husbandPlace &&
          actor.id !== 'husband' &&
          actor.id !== 'waner' &&
          (actor.id === 'yunnia' || actor.id === 'yangzhenhua')
        ) {
          queueProactive(world, {
            reason: 'arrival',
            facts: { who: actor.name, where: world.places?.[actor.location]?.name || actor.location },
            speaker: actor.name,
            fallback: `相公，${actor.name}来了，正在帘外候着呢。`,
            type: 'proactive',
          });
        }
      }
    }
  }
}

/** 清掉过期货：陈年风闻不该攒着一次全推给你 */
function pruneProactive(world) {
  if (!Array.isArray(world.proactive)) return;
  const nowHour = world.clock.day * 24 + world.clock.hour;
  world.proactive = world.proactive
    .filter((p) => {
      if (!p) return false;
      if (p.reason === 'appointment') return true; // 约定必须送达
      if (p.reason === 'arc') return true;         // 她自己的难关，等她上线再看
      const h = (Number(p.day) || 1) * 24 + (Number(p.hour) || 0);
      return nowHour - h <= 24;
    })
    .slice(-8);
}

/** 到点的约定：人要上门，还要主动告诉相公 */
function fireAppointments(world, events) {
  if (!Array.isArray(world.appointments) || world.appointments.length === 0) return;
  const nowHour = world.clock.day * 24 + world.clock.hour;
  const keep = [];

  for (const ap of world.appointments) {
    const dueHour = (Number(ap.day) || 0) * 24 + (Number(ap.hour) || 0);
    if (dueHour > nowHour) {
      keep.push(ap);
      continue;
    }

    const actor =
      (ap.actorId && world.actors?.[ap.actorId]) ||
      Object.values(world.actors || {}).find((a) => a && a.name === ap.name);

    // 到点了：相公是否真在那个地方？
    const meetPlace = ap.place || world.actors?.husband?.location;
    const husbandThere = !meetPlace || world.actors?.husband?.location === meetPlace;
    // 她按时去了约定的地方（不管相公来没来）
    if (actor && meetPlace) actor.location = meetPlace;

    if (husbandThere) {
      // 会面成了
      events.push(
        nextEvent(world, {
          action: 'appointment_met',
          actor: actor?.id || 'system',
          payload: { who: ap.name, text: ap.text },
          isPublic: true,
        }),
      );
      queueProactive(world, {
        reason: 'appointment',
        facts: { who: ap.name, text: ap.text, met: true },
        speaker: actor ? actor.name : ap.name,
        force: true,
      });
    } else {
      // 失约：她白等一场，这件事必须有后果
      const rel = actor?.relations?.husband;
      if (rel && typeof rel.grievance === 'number') {
        rel.grievance = Math.max(0, Math.min(100, rel.grievance + 3));
      }
      events.push(
        nextEvent(world, {
          action: 'appointment_missed',
          actor: actor?.id || 'system',
          place: meetPlace || null,
          payload: { who: ap.name, text: ap.text, place: world.places?.[meetPlace]?.name || '' },
          isPublic: true,
        }),
      );
      queueProactive(world, {
        reason: 'appointment_missed',
        facts: { who: ap.name, text: ap.text, place: world.places?.[meetPlace]?.name || '' },
        speaker: actor ? actor.name : ap.name,
        force: true,
      });
    }

    // 周期性约定（如「每旬晌午雅阁见面」）：触发后自动排下一次，不会约一次就断
    if (Number(ap.every) > 0) {
      keep.push({
        ...ap,
        day: Number(ap.day) + Number(ap.every),
        madeAt: { day: world.clock.day, hour: world.clock.hour },
      });
    }
  }

  world.appointments = keep;
}

/** 到期的待发酵事件 */
function fireDue(world, events) {
  if (!Array.isArray(world.pending) || world.pending.length === 0) return;
  const stillPending = [];
  for (const item of world.pending) {
    if (Number(item.due) <= world.clock.day) {
      events.push(
        nextEvent(world, {
          action: 'event_fired',
          place: item.place || 'street',
          payload: { id: item.id, desc: item.desc, severity: item.severity || 1 },
          isPublic: true,
        }),
      );
      applyEffects(world, item.effects);
      // 出事了，得让屋里人知道
      queueProactive(world, {
        reason: 'event',
        facts: { desc: item.desc, severity: item.severity || 1 },
        fallback: `相公，外头出了事——${item.desc}。`,
        type: 'proactive',
      });
    } else {
      stillPending.push(item);
    }
  }
  world.pending = stillPending;
}

/**
 * 1:1 同步模式：世界时间直接取现实时钟，不靠累加（累加会因锚点分钟数产生最多 59 分钟偏差）
 */
function syncToRealClock(world, nowMs) {
  const d = new Date(nowMs);
  const realHour = d.getHours();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const lastIso = world.flags?.realDateMark || iso;
  if (lastIso !== iso) {
    world.clock.day = (Number(world.clock.day) || 1) + 1;
    world.flags = world.flags || {};
    world.flags.realDateMark = iso;
  } else if (!world.flags?.realDateMark) {
    world.flags = world.flags || {};
    world.flags.realDateMark = iso;
  }
  if (world.clock.hour !== realHour) world.clock.hour = realHour;
}

function advanceHour(world, events, nowMs) {
  world.clock.hour += 1;
  if (world.clock.hour >= 24) {
    world.clock.hour = 0;
    world.clock.day += 1;

  // 世界日翻篇时自愈一次：账本坏了它自己修，不靠人管
    try {
      const fixes = healWorld(world);
      if (fixes.length > 0) {
        console.log(`[Heal] 自动修复 ${fixes.length} 处：`);
        fixes.slice(0, 8).forEach((f) => console.log(`  - ${f}`));
      }
    } catch (err) {
      console.warn('[Heal] 自愈失败：', err.message);
    }
    advancePregnancies(world, events);

    // 个人主线：她不上线，她的难关也会往前走
    try {
      ensureArcs(world);
      advanceArcs(world, events, (opts) => queueProactive(world, { type: 'arc', ...opts }), nextEvent);
    } catch (err) {
      console.warn('[Arc] 主线推进失败：', err.message);
    }
    onNewDay(world, events);
  }

  // 亥时各回各家：客人不会永远赖在别人家里（正陪在相公身边的除外）
  if (world.clock.hour === 21) {
    const here = world.actors?.husband?.location;
    for (const a of Object.values(world.actors || {})) {
      if (!a || a.kind === 'human' || a.id === 'husband') continue;
      const home = a.home && world.places?.[a.home] ? a.home : null;
      if (!home) continue;
      if (a.location === home) continue;
      // 哪怕就在相公跟前，天黑了也要回自己家；只有正在私会时例外
      if (a.intimacy?.ritual === 'unlocked') continue; // 正在私会，别打断
      a.location = home;
      events.push(
        nextEvent(world, {
          action: 'npc_home',
          actor: a.id,
          place: home,
          payload: { text: `${a.name}回了${world.places[home]?.name || '家'}` },
          isPublic: false,
        }),
      );
    }
  }

  // 每日辰时开市：阿吉报送市井风闻（世界不必等午夜才有动静）
  if (world.clock.hour === GOSSIP_HOUR) {
    events.push(
      nextEvent(world, {
        action: 'gossip',
        place: 'street',
        payload: { text: dailyGossip(world.clock.day) },
        isPublic: true,
      }),
    );
    queueProactive(world, {
      reason: 'gossip',
      facts: { gossip: dailyGossip(world.clock.day) },
      fallback: `相公，阿吉方才从外头回来，说：${dailyGossip(world.clock.day)}。`,
      type: 'proactive',
    });
  }

  // 未时（14 点）：手里没事、也没有约在身 → 世界主动递一件要你决断的事，免得无事可做
  if (world.clock.hour === 14) {
    // 每天未时固定递一件事（冷却机制会自动防刷屏，不再因为"手上有暗涌"就永不触发）
    queueProactive(world, {
      reason: 'hook',
      facts: { day: world.clock.day },
      fallback: '相公，周掌柜那边派人来问，酒楼开张的日子到底定在哪天，人家等着回话呢。',
      type: 'proactive',
    });
  }

  // 掌灯时分仍不见人 → 她先开口问一句（不用主人先说话）
  if (world.clock.hour === 20) {
    const lastUser = Number(world.flags.lastUserMessageAt) || 0;
    if (lastUser > 0 && nowMs - lastUser > 6 * 60 * 60 * 1000) {
      queueProactive(world, {
        reason: 'hook',
        facts: { hoursAway: Math.round((nowMs - lastUser) / 3600000) },
        fallback: '相公，周掌柜那边派人来问，酒楼开张的日子到底定在哪天，人家等着回话呢。',
        type: 'proactive',
      });
    }
  }

  runSchedules(world);
  runNPCInitiatives(world, events, (opts) => queueProactive(world, { type: 'proactive', ...opts }));
  fireAppointments(world, events);
  fireDue(world, events);
  pruneProactive(world);
}

/**
 * 推进世界。
 * @returns {{world: object, events: object[], steps: number}}
 */
export function tick(dataDir, { now = Date.now(), msPerWorldHour = DEFAULT_MS_PER_WORLD_HOUR } = {}) {
  const world = loadState(dataDir);
  if (!Number.isFinite(world.lastRealAt) || world.lastRealAt <= 0) {
    world.lastRealAt = now;
  }

  const elapsed = Math.max(0, now - world.lastRealAt);
  const rawSteps = Math.floor(elapsed / msPerWorldHour);
  const steps = Math.min(Math.max(0, rawSteps), MAX_STEPS_PER_TICK);

  const events = [];
  for (let i = 0; i < steps; i += 1) advanceHour(world, events, now);

  if (steps > 0) {
    world.lastRealAt += steps * msPerWorldHour; // 只吃掉已结算的时间，剩余欠账留到下次
    world.clock.season = seasonOf(world.clock.day);
    world.clock.weather = weatherOf(world.clock.day, world.clock.season);
    world.version = world.version || 1;
    saveState(dataDir, world);
    appendEvents(dataDir, events);
  }

  return { world, events, steps };
}

/** 只读取当前世界（不推进）*/
export function peek(dataDir) {
  return loadState(dataDir);
}

/**
 * 启动世界时钟：先补算一次离线时间，之后按间隔心跳。
 * @returns {() => void} 停止函数
 */
export function startWorldClock(dataDir, opts = {}) {
  const {
    intervalMs = DEFAULT_TICK_INTERVAL_MS,
    msPerWorldHour = DEFAULT_MS_PER_WORLD_HOUR,
    enabled = true,
    onAfterTick = null,
  } = opts;
  if (!enabled) {
    console.log('[World] 世界时钟已禁用（config.world.enabled = false）');
    return () => {};
  }

  const run = async () => {
    try {
      const { world, events, steps } = tick(dataDir, { msPerWorldHour });
      if (steps > 0) {
        console.log(
          `[World] 补算 ${steps} 世界小时 → 第${world.clock.day}日 ${shichenOf(world.clock.hour)}，产生 ${events.length} 条事件`,
        );
      }
      // 排队了「该她开口」的请求 → 交给天道现写台词
      if (typeof onAfterTick === 'function') await onAfterTick(world);
    } catch (err) {
      console.warn('[World] tick 失败：', err.message);
    }
  };

  run();
  const timer = setInterval(run, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();

  console.log(
    `[World] 世界时钟已启动：${Math.round(msPerWorldHour / 1000)} 秒 = 1 世界小时，心跳 ${Math.round(intervalMs / 60000)} 分钟`,
  );
  return () => clearInterval(timer);
}
