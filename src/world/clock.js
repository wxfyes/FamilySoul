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
function onNewDay(world, events) {
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
  for (const actor of Object.values(world.actors || {})) {
    if (!Array.isArray(actor.schedule)) continue;
    for (const slot of actor.schedule) {
      if (slot.at === world.clock.hour && slot.place && actor.location !== slot.place) {
        actor.location = slot.place;
      }
    }
  }
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
    } else {
      stillPending.push(item);
    }
  }
  world.pending = stillPending;
}

function advanceHour(world, events) {
  world.clock.hour += 1;
  if (world.clock.hour >= 24) {
    world.clock.hour = 0;
    world.clock.day += 1;
    onNewDay(world, events);
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
  }

  runSchedules(world);
  fireDue(world, events);
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
  for (let i = 0; i < steps; i += 1) advanceHour(world, events);

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
  } = opts;
  if (!enabled) {
    console.log('[World] 世界时钟已禁用（config.world.enabled = false）');
    return () => {};
  }

  const run = () => {
    try {
      const { world, events, steps } = tick(dataDir, { msPerWorldHour });
      if (steps > 0) {
        console.log(
          `[World] 补算 ${steps} 世界小时 → 第${world.clock.day}日 ${shichenOf(world.clock.hour)}，产生 ${events.length} 条事件`,
        );
      }
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
