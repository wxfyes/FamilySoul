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
import { ensureCourt, forceOf, ensureTerrain } from './state.js';
import { advanceArcs, ensureArcs, resolveArc } from './arcs.js';
import { spreadRumors } from './rumors.js';
import { moveActor } from './position.js';


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
      const boy = Math.random() < 0.5;
      const GIVEN_BOY = ['承宗', '景行', '念祖', '守拙', '明远', '亦安'];
      const GIVEN_GIRL = ['念慈', '柔嘉', '清婉', '静姝', '如珍', '亦宁'];
      const pool = boy ? GIVEN_BOY : GIVEN_GIRL;
      const given = pool[Math.floor(Math.random() * pool.length)];

      // 判定母亲是否王宅内眷（沈婉儿、林芸娘、小翠等）
      const isWangHousehold = Boolean(a.household) || ['husband_room', 'backyard', 'tea_house'].includes(a.home);
      let surname = '王';
      let socialFather = 'husband';
      let socialFatherName = '相公王甯';

      if (!isWangHousehold) {
        // 查母亲的合法丈夫（如紫嫣/刘文霞配偶为于子归/yujie）
        const spouseId = a.spouse || (a.id === 'liuwenxia' ? 'yujie' : null);
        const spouse = spouseId ? world.actors?.[spouseId] : null;
        if (spouse) {
          socialFather = spouse.id;
          socialFatherName = spouse.name;
          surname = spouse.name ? spouse.name[0] : '于';
        } else {
          surname = a.name ? a.name[0] : '王';
        }
      }

      const babyName = `${surname}${given}`;
      world.actors[id] = {
        id,
        name: babyName,
        role: `${a.name}${boy ? '所生之子' : '所生之女'}`,
        gender: boy ? 'male' : 'female',
        origin: 'spawned',
        household: isWangHousehold,
        home: a.home || a.location,
        location: a.location,
        bornDay: world.clock.day,
        goals: ['长大成人'],
        fatherSocial: socialFather,
        fatherBlood: pg.father || 'husband',
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
      if (isWangHousehold) {
        world.memories.push({
          text: `第${world.clock.day}日，${a.name}为王家诞下${boy ? '一子' : '一女'}，取名${babyName}，入王家族谱`,
          day: world.clock.day,
          at: Date.now(),
          about: [a.id, 'husband', id],
          visible: 'public',
        });
      } else {
        // 社会明面：归夫家
        world.memories.push({
          text: `第${world.clock.day}日，${a.name}为${socialFatherName}诞下${boy ? '一子' : '一女'}，取名${babyName}，随夫姓归于家`,
          day: world.clock.day,
          at: Date.now(),
          about: [a.id, socialFather, id],
          visible: 'public',
        });
        // 天道暗面：相公血脉
        world.memories.push({
          text: `第${world.clock.day}日，${a.name}所诞${babyName}（归${socialFatherName}名下），实为相公暗中骨血`,
          day: world.clock.day,
          at: Date.now(),
          about: [a.id, 'husband', id],
          visible: 'private',
        });
      }
      if (world.memories.length > 120) world.memories = world.memories.slice(-120);
      console.log(`[World] ${a.name}临盆，孩子入世：${babyName}（${boy ? '子' : '女'}，社会父亲:${socialFatherName}，暗父:相公）`);
    }
  }
}

export function buildMorningReport(world) {
  const day = world.clock?.day || 1;
  // ⑦ 优先从真实流言/事件提取风闻
  let gossip = '';
  if (Array.isArray(world.rumors) && world.rumors.length > 0) {
    const freshRumor = world.rumors.slice().reverse().find(r => r && (r.text || r.title));
    if (freshRumor) gossip = freshRumor.text || freshRumor.title;
  }
  if (!gossip) {
    gossip = dailyGossip(day);
  }

  const props = Array.isArray(world.assets?.properties) ? world.assets.properties : [];
  let incomeTotal = 0;
  for (const p of props) {
    if (p.owner === 'husband' || p.keeper === 'husband') {
      incomeTotal += Number(p.incomePerDay || 0);
    }
  }
  incomeTotal = Math.round(incomeTotal * 100) / 100;

  // 身孕喜讯汇报
  const pregs = Object.values(world.actors || {}).filter((a) => a?.pregnancy && !a.pregnancy.born);
  let pregText = '';
  if (pregs.length > 0) {
    pregText = `，后院${pregs.map(a => `${a.name}娘子已有喜${Math.floor((a.pregnancy.days || 0) / 30)}个月`).join('、')}`;
  }

  // ⑧ 婉儿早膳动态：婉儿在府且无怨怼才备早膳，否则不假借其名
  const waner = world.actors?.waner;
  const wanerGrievance = Number(waner?.relations?.husband?.grievance || 0);
  const wanerInHome = ['husband_room', 'backyard', 'tea_house'].includes(waner?.location);
  let wifeAction = '伙计已备下洗漱热水，请相公梳洗！';
  if (wanerInHome && wanerGrievance < 20) {
    wifeAction = '正房大娘子已吩咐备下早膳，请相公洗漱！';
  } else if (wanerInHome) {
    wifeAction = '大娘子正在书斋核账，吩咐备了清粥小菜，请相公洗漱。';
  }

  return `相公早！阿吉给相公请安！昨儿咱们运河大酒楼与茶坊老店流水共进账 ${incomeTotal} 两白银${pregText}；城里风闻说：${gossip}；${wifeAction}`;
}

function runLocalEconomy(world, events) {
  const day = world.clock?.day ?? 1;
  const season = world.clock?.season || 'spring';
  for (const [name, ct] of Object.entries(world.cities || {})) {
    if (!ct) continue;
    // 物价向常价回归，再叠加季节与灾荒
    const drift = Math.round((100 - (Number(ct.price) || 100)) * 0.2);
    ct.price = Math.max(50, Math.min(300, Math.round((Number(ct.price) || 100) + drift)));
    const gp = Number(world.flags?.grainPressure) || 1;
    if (gp !== 1) ct.price = Math.max(50, Math.min(300, Math.round(ct.price * gp)));

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

/**
 * 朝廷不会坐着看：通缉高、占城多 → 压力上升 → 派兵围剿
 * 只算"阻力与代价"，不写台词。
 */
/** 每 5 天开一次朝议：朝廷要自己下旨，不是只会围剿 */
/** 到日子就传人：原告被告押到县衙，开审 */
function runHearings(world, events) {
  const day = Number(world.clock?.day) || 1;
  const hour = Number(world.clock?.hour) || 0;
  for (const c of world.cases || []) {
    if (!c) continue;
    // 老案子（只有 filed）补上开庭日，别永远卡着
    if (c.status === 'filed') {
      c.status = 'summoned';
      if (!Number(c.hearDay)) c.hearDay = day;
      if (!Number(c.hearHour)) c.hearHour = 9;
    }
    if (c.status !== 'summoned') continue;
    if (day < Number(c.hearDay || 0)) continue;
    if (day === Number(c.hearDay) && hour < Number(c.hearHour || 9)) continue;
    const p1 = world.actors?.[c.whoId];
    const p2 = world.actors?.[c.againstId];
    // 真人被告不硬拽，等他自己去；超过两天缺席审
    const husbandParty = c.whoId === 'husband' || c.againstId === 'husband';
    const lateDays = day - Number(c.hearDay || day);
    if (husbandParty && lateDays < 2) {
      const hus = world.actors.husband;
      if (!hus || hus.location !== 'yamen') continue;
    }
    if (p1 && p1.id !== 'husband') moveActor(world, p1.id, 'yamen', 'world', '升堂');
    if (p2 && p2.id !== 'husband') moveActor(world, p2.id, 'yamen', 'world', '升堂');
    c.status = 'hearing';
    events.push(nextEvent(world, { action: 'hearing', actor: c.againstId, place: 'yamen', payload: { text: `县衙开审：${c.who}告${c.against}` }, isPublic: true }));
  }
}

/**
 * 生老病死：会生、会老、会病、会死，死了产业要有人接。
 * 只给概率与代价，不写台词。
 */
function runLifecycle(world, events, queuePush) {
  const day = Number(world.clock?.day) || 1;
  world.flags = world.flags || {};

  // ① 生子：孕期满 280 天
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || !a.pregnancy || a.pregnancy.born) continue;
    a.pregnancy.days = (Number(a.pregnancy.days) || 0) + 1;
    if (a.pregnancy.days < 280) continue;
    a.pregnancy.born = true;
    const fatherId = a.pregnancy.father || 'husband';
    world.flags.npcSeq = (Number(world.flags.npcSeq) || 0) + 1;
    const cid = `npc_${world.flags.npcSeq}`;
    const isBoy = Math.random() < 0.5;
    const surnames = ['王', '沈', '林'];
    const sn = surnames[Math.floor(Math.random() * surnames.length)];
    world.actors[cid] = {
      id: cid, name: `${sn}${isBoy ? '郎' : '娘'}`, role: `${a.name}的${isBoy ? '儿子' : '女儿'}`,
      gender: isBoy ? 'male' : 'female', origin: 'spawned',
      age: 0, household: true, home: a.home || 'backyard', location: a.home || 'backyard',
      parents: [a.id, fatherId],
      relations: { husband: { trust: 40, desire: 0, fear: 0, grievance: 0 } },
      schedule: [],
    };
    world.memories = Array.isArray(world.memories) ? world.memories : [];
    world.memories.push({ text: `${a.name}生了${isBoy ? '个儿子' : '个女儿'}`, day, at: Date.now(), about: [a.id, 'husband'], visible: 'private' });
    events.push(nextEvent(world, { action: 'birth', actor: a.id, place: a.location, payload: { text: `${a.name}添了${isBoy ? '个儿子' : '个女儿'}` }, isPublic: true }));
    queuePush?.({ to: 'husband', reason: 'birth', facts: { 生子: a.name }, fallback: `${a.name}生了，母子平安。`, force: true });
  }

  // ② 衰老与病亡：一年长一岁；过了五十，日子开始咬人
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || a.id === 'husband') continue;
    if (day % 360 === 0) a.age = (Number(a.age) || 20) + 1;
    const age = Number(a.age) || 20;
    if (age < 45) continue;
    const p = Math.min(0.5, (age - 45) * 0.01);
    if (Math.random() > p) continue;
    a.dead = true;
    a.deadDay = day;
    a.pendingDeath = true;
    events.push(nextEvent(world, { action: 'death', actor: a.id, place: a.location, payload: { text: `${a.name}病故` }, isPublic: true }));
    world.memories = Array.isArray(world.memories) ? world.memories : [];
    world.memories.push({ text: `${a.name}病故了`, day, at: Date.now(), about: [a.id, 'husband'], visible: 'private' });
    queuePush?.({ to: 'husband', reason: 'death', facts: { 丧: a.name }, fallback: `${a.name}去了。`, force: true });
  }

  // ③ 继承：死人名下的产业，交给配偶或子女
  for (const a of Object.values(world.actors || {})) {
    if (!a || !a.pendingDeath) continue;
    delete a.pendingDeath;
    const kids = Object.values(world.actors || {}).filter((x) => x && !x.dead && Array.isArray(x.parents) && x.parents.includes(a.id));
    const heir = kids[0] || Object.values(world.actors || {}).find((x) => x && !x.dead && x.id !== a.id && x.home === a.home && x.id !== 'husband');
    for (const pr of world.assets?.properties || []) {
      if (!pr) continue;
      if (pr.owner === a.id) pr.owner = heir ? heir.id : 'husband';
      if (pr.keeper === a.id) pr.keeper = heir ? heir.id : 'husband';
    }
    if (heir) {
      events.push(nextEvent(world, { action: 'inherit', actor: heir.id, place: heir.location, payload: { text: `${heir.name}接了${a.name}的产业` }, isPublic: true }));
      console.log(`[Life] ${a.name}身后，产业归${heir.name}`);
    }
  }
}

/** 民间案子：民心越乱，案子越多。只记事实，不写过程。 */
function runPettyCrimes(world, events) {
  const day = Number(world.clock?.day) || 1;
  const hour = Number(world.clock?.hour) || 0;
  // 刑满释放
  for (const a of Object.values(world.actors || {})) {
    if (!a || !a.jailed) continue;
    if (day >= Number(a.jailed.untilDay || 0)) {
      moveActor(world, a.id, a.home || 'street', 'world', '刑满');
      delete a.jailed;
      events.push(nextEvent(world, { action: 'released', actor: a.id, place: a.location, payload: { text: `${a.name}刑满出狱` }, isPublic: true }));
    }
  }
  // 每天只查一次（卯时或之后第一次到）；步进/补算也能触发
  if (hour < 6) return;
  world.flags = world.flags || {};
  if (world.flags.pendingCase && !world.flags.pendingCase.city) world.flags.pendingCase = null;
  if (Number(world.flags.crimeCheckedDay) === day) return;
  world.flags.crimeCheckedDay = day;
  const cities = Object.values(world.cities || {}).filter(Boolean);
  if (!cities.length) return;
  const avgUnrest = cities.reduce((s, c) => s + (Number(c.unrest) || 0), 0) / cities.length;
  const p = 0.2 + Math.min(0.4, avgUnrest / 200);
  if (Math.random() > p) return;
  // 只决定"哪座城出了事"，案情由天道现写
  // 城市是按「名字」做 key 的，对象里不一定有 name 字段
  const entries = Object.entries(world.cities || {}).filter(([, c]) => c && !c.dead);
  const worst = entries.sort((x, y) => (Number(y[1].unrest) || 0) - (Number(x[1].unrest) || 0))[0];
  if (!worst) return;
  const worstName = String(worst[1].name || worst[0] || '');
  world.flags = world.flags || {};
  if (!world.flags.pendingCase || !world.flags.pendingCase.city) {
    world.flags.pendingCase = { city: worstName, day };
  }
}

/** 补缺：位子空了，就从举人里选人补上；没举人就现补一个 */
function runAppointments(world, events) {
  const offices = world.court?.offices || {};
  const vacancies = Object.entries(offices).filter(([, o]) => o && o.vacant);
  if (!vacancies.length) return;
  const pool = Object.values(world.actors || {}).filter(
    (a) => a && !a.dead && a.id !== 'husband' && ['秀才', '举人', '进士'].includes(String(a.rank || '')),
  ).sort((x, y) => (Number(y.study) || 0) - (Number(x.study) || 0));
  for (const [key, off] of vacancies.slice(0, 2)) {
    const pick = pool.find((a) => !a.officeKey);
    if (pick) {
      pick.officeKey = key;
      pick.role = off.title || pick.role;
      off.holder = pick.id;
      off.vacant = false;
      events.push(nextEvent(world, { action: 'appoint', actor: pick.id, place: null, payload: { text: `${pick.name}补${off.title || key}缺` }, isPublic: true }));
      continue;
    }
    // 没人可用：现补一个候补官
    const SURNAMES = ['孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗', '郑'];
    const sn = SURNAMES[Math.abs(String(key).length * 7 + Number(world.clock?.day || 1)) % SURNAMES.length];
    world.flags = world.flags || {};
    world.flags.npcSeq = (Number(world.flags.npcSeq) || 0) + 1;
    const id = `npc_${world.flags.npcSeq}`;
    const title = String(off.title || '地方官');
    world.actors[id] = {
      id, name: `${sn}${title.slice(0, 2)}`, role: title, gender: 'male', origin: 'spawned',
      home: 'yamen', location: 'yamen', officeKey: key, rank: '进士', study: 70,
      goals: ['坐稳这个位子'], relations: { husband: { trust: 25, desire: 0, fear: 0, grievance: 0 } },
      schedule: [{ at: 9, do: '升堂理事', place: 'yamen' }],
    };
    off.holder = id;
    off.vacant = false;
    events.push(nextEvent(world, { action: 'appoint', actor: id, place: 'yamen', payload: { text: `${world.actors[id].name}补${title}缺` }, isPublic: true }));
  }
}

/** 御案上的折子：言官会弹劾地方官 */
function runMemorials(world, events) {
  const day = Number(world.clock?.day) || 1;
  if (day % 4 !== 0) return;
  if (Math.random() > 0.5) return;
  const officials = Object.entries(world.court?.offices || {})
    .filter(([k, o]) => o && o.holder && k.startsWith('city:'))
    .map(([, o]) => o);
  if (!officials.length) return;
  const off = officials[Math.floor(Math.random() * officials.length)];
  const holder = world.actors?.[off.holder];
  if (!holder) return;
  world.memorials = Array.isArray(world.memorials) ? world.memorials : [];
  if (world.memorials.some((m) => m && m.againstId === holder.id && m.status === 'pending')) return;
  world.flags = world.flags || {};
  world.flags.memorialSeq = (Number(world.flags.memorialSeq) || 0) + 1;
  const claims = ['贪墨税银', '纵容家奴横行', '虚报灾情冒赈', '办案受贿', '私加火耗'];
  world.memorials.push({
    id: `memorial_${world.flags.memorialSeq}`,
    against: holder.name, againstId: holder.id, office: off.title || '',
    claim: claims[Math.floor(Math.random() * claims.length)],
    day, status: 'pending',
  });
  events.push(nextEvent(world, { action: 'memorial', actor: 'court', place: null, payload: { text: `御案上多了一份弹劾${holder.name}的折子` }, isPublic: true }));
}

function markCourtDecree(world) {
  const day = Number(world.clock?.day) || 1;
  world.court = world.court || {};
  if (world.court.pendingDecree) return;
  const last = Number(world.court.lastDecreeDay) || 0;
  if (day - last < 5) return;
  world.court.pendingDecree = true;
}

/** 把一道旨意落到天下：加税/减税/征役/赈灾/严打/大赦 */
export function applyDecree(world, events, d) {
  const kind = String(d?.action || 'raise_tax');
  const amount = Math.max(0, Math.min(60, Number(d?.amount) || 10));
  const cities = Object.values(world.cities || {}).filter(Boolean);
  const eff = (fn) => cities.forEach(fn);
  if (kind === 'raise_tax') {
    eff((c) => { c.tax = Math.min(50, (Number(c.tax) || 10) + Math.round(amount / 2)); c.unrest = Math.min(100, (Number(c.unrest) || 0) + 4); });
  } else if (kind === 'lower_tax') {
    eff((c) => { c.tax = Math.max(0, (Number(c.tax) || 10) - Math.round(amount / 2)); c.unrest = Math.max(0, (Number(c.unrest) || 0) - 3); });
  } else if (kind === 'corvee') {
    eff((c) => { c.unrest = Math.min(100, (Number(c.unrest) || 0) + 7); c.price = Math.min(300, Math.round((Number(c.price) || 100) * 1.05)); });
  } else if (kind === 'relief') {
    eff((c) => { c.unrest = Math.max(0, (Number(c.unrest) || 0) - 8); c.price = Math.max(50, Math.round((Number(c.price) || 100) * 0.9)); });
  } else if (kind === 'crackdown') {
    eff((c) => { c.unrest = Math.min(100, (Number(c.unrest) || 0) + 3); });
  } else if (kind === 'amnesty') {
    eff((c) => { c.unrest = Math.max(0, (Number(c.unrest) || 0) - 5); });
  }
  world.court = world.court || {};
  world.court.decisions = Array.isArray(world.court.decisions) ? world.court.decisions : [];
  world.court.lastDecreeDay = world.clock?.day || 1;
  world.court.decisions.push({ day: world.clock?.day || 1, text: String(d?.decree || ''), action: kind, amount });
  if (world.court.decisions.length > 30) world.court.decisions = world.court.decisions.slice(-30);
  if (Array.isArray(events)) {
    events.push(nextEvent(world, {
      action: 'decree',
      actor: 'court',
      place: null,
      payload: { text: String(d?.decree || '朝廷下旨') },
      isPublic: true,
    }));
  }
  return kind;
}

function runCourtReaction(world, events, queuePush) {
  const day = world.clock?.day ?? 1;
  world.flags = world.flags || {};
  const mine = Object.entries(world.cities || {}).filter(([, c]) => c.owner === 'wangjia' || String(c.owner || '').startsWith('actor_'));
  const threat = (Number(world.wanted) || 0) * 0.5 + mine.length * 20 + (Number(world.reputation) || 0) * 0.2;
  let pressure = Number(world.flags.courtPressure) || 0;
  pressure = Math.max(0, pressure + (threat > 55 ? 12 : -4));
  world.flags.courtPressure = Math.min(100, pressure);

  if (threat <= 55 || pressure < 45) return;
  if (Math.random() > 0.5) return;

  // 挑一座"非朝廷"的城来打
  const target = mine.length ? mine[Math.floor(Math.random() * mine.length)] : null;
  const attackerPower = 250 + pressure * 8;
  if (!target) {
    // 没城：抄你的产业
    const props = world.assets?.properties || [];
    if (props.length) {
      const p = props[Math.floor(Math.random() * props.length)];
      const loss = Math.round((Number(p.incomePerDay) || 0) * 0.3 * 100) / 100;
      p.incomePerDay = Math.max(0, Math.round(((Number(p.incomePerDay) || 0) - loss) * 100) / 100);
      world.flags.courtPressure = Math.max(0, pressure - 15);
      events.push(nextEvent(world, { action: 'court_raid', actor: 'system', place: p.place || null, payload: { text: `官府查封${p.name}，日入受损` }, isPublic: true }));
      queuePush?.({ to: 'husband', reason: 'court', facts: { 官府: '查封产业' }, fallback: `官府来人查了${p.name}的账。`, force: true });
    }
    return;
  }

  const [cityName, ct] = target;
  const owner = ct.owner;
  const ownerActor = owner.startsWith('actor_') ? owner.slice(6) : 'husband';
  const f = forceOf(world, ownerActor);
  // 盟友协防（各出四成）
  let allyDef = 0;
  for (const allyId of world.allies?.[ownerActor] || []) {
    const af = world.forces?.[allyId] || (allyId === 'husband' ? world.military : null);
    if (!af) continue;
    allyDef += ((Number(af.army) || 0) + (Number(af.militia) || 0) * 0.6) * 0.4;
  }
  const defensePower = (Number(ct.defense) || 10) * 30 + ((Number(f.army) || 0) + (Number(f.militia) || 0) * 0.6) + (Number(world.infra?.workshop) || 0) * 50 + allyDef;

  if (defensePower >= attackerPower) {
    // 守住
    f.army = Math.max(0, Math.round((Number(f.army) || 0) * 0.9));
    f.morale = Math.max(0, (Number(f.morale) || 50) + 5);
    if (owner === 'wangjia') world.reputation = Math.min(100, (Number(world.reputation) || 50) + 5);
    world.flags.courtPressure = Math.max(0, pressure - 20);
    events.push(nextEvent(world, { action: 'court_repelled', actor: 'system', place: ct.region || null, payload: { text: `朝廷兵马来攻${cityName}，被挡回去` }, isPublic: true }));
    queuePush?.({
      to: ownerActor,
      reason: 'court',
      facts: { 战事: `${cityName}守住了` },
      fallback: `官府派兵来攻${cityName}，被你的人挡了回去。折了些兵马，但城还在。`,
      force: true,
    });
  } else {
    // 城丢
    ct.owner = 'court';
    ct.defense = Math.max(5, Math.round(attackerPower / 40));
    f.army = Math.max(0, Math.round((Number(f.army) || 0) * 0.7));
    f.militia = Math.max(0, Math.round((Number(f.militia) || 0) * 0.8));
    f.morale = Math.max(0, (Number(f.morale) || 50) - 25);
    if (owner === 'wangjia') world.reputation = Math.max(0, (Number(world.reputation) || 50) - 8);
    world.flags.courtPressure = Math.max(0, pressure - 10);
    events.push(nextEvent(world, { action: 'court_take', actor: 'system', place: ct.region || null, payload: { text: `朝廷夺回${cityName}` }, isPublic: true }));
    queuePush?.({
      to: ownerActor,
      reason: 'court',
      facts: { 战事: `${cityName}失守` },
      fallback: `官府大军压境，${cityName}没守住。兵马折了大半，城归了朝廷。`,
      force: true,
    });
  }
}

function runLoanDues(world, events, queuePush) {
  const day = Number(world.clock?.day) || 1;
  for (const pr of world.promises || []) {
    if (!pr || !pr.loan || pr.done) continue;
    const due = Number(pr.due) || 0;
    if (!due || day <= due) continue;
    const borrower = pr.loan.to;
    const name = world.actors?.[borrower]?.name || borrower;
    if (!pr.overdueDay) {
      pr.overdueDay = day;
      world.reputation = Math.max(0, (Number(world.reputation) || 50) - 3);
      events.push(nextEvent(world, { action: 'loan_overdue', actor: borrower, place: world.actors?.[borrower]?.location || null, payload: { text: `${name}借的银子过了期没还` }, isPublic: false }));
      queuePush?.({ to: borrower, reason: 'loan', facts: { 借款: '已逾期' }, fallback: `借的银子到期了还没还——名声会受影响。`, force: true });
      continue;
    }
    if (day - Number(pr.overdueDay) >= 3 && !pr.failed) {
      pr.failed = true;
      world.memories = Array.isArray(world.memories) ? world.memories : [];
      world.memories.push({ text: `${name}赖了一笔账没还`, day, at: Date.now(), about: [borrower], visible: 'private' });
      events.push(nextEvent(world, { action: 'loan_default', actor: borrower, place: null, payload: { text: `${name}赖账` }, isPublic: false }));
      queuePush?.({ to: borrower, reason: 'loan', facts: { 借款: '已赖账' }, fallback: `那笔银子到底没还上，街面上开始有人说了。`, force: true });
    }
    // 逾期 7 天：出借人不再等，直接从她账上扣
    if (day - Number(pr.overdueDay) >= 7 && !pr.done) {
      const owed = round2((Number(pr.loan.amount) || 0) - (Number(pr.repaid) || 0));
      const purse = Number(world.wallets?.[borrower]) || 0;
      const take = Math.min(purse, owed);
      if (take > 0) {
        world.wallets = world.wallets || {};
        world.wallets[borrower] = round2(purse - take);
        const lender = pr.loan.from || 'husband';
        if (lender === 'husband') world.assets.silver = round2((Number(world.assets.silver) || 0) + take);
        else world.wallets[lender] = round2((Number(world.wallets[lender]) || 0) + take);
        pr.repaid = round2((Number(pr.repaid) || 0) + take);
        events.push(nextEvent(world, { action: 'loan_collected', actor: borrower, place: null, payload: { text: `强行扣还${name}${take}两` }, isPublic: false }));
        queuePush?.({ to: borrower, reason: 'loan', facts: { 借款: '被强行扣还' }, fallback: `那笔旧账被人从你账上直接划走了 ${take} 两。`, force: true });
      }
      if ((Number(pr.repaid) || 0) >= (Number(pr.loan.amount) || 0)) {
        pr.done = true;
        pr.doneDay = day;
      }
    }
  }
}

/**
 * 国库与粮仓：钱和粮都有来处、有去处。
 *  收：朝廷占的城按税率上缴
 *  支：官俸（每位在任官）＋军饷（每千兵）＋赈济（灾年）
 *  空：国库见底 → 朝廷只能加税 → 民心崩
 *  粮：秋收入库，灾荒出仓；仓越空，粮价越高
 */

/**
 * 个人经济：每人每天有进项也有开销。
 * 不写台词，只让钱真的在流：有钱的攒、没钱的欠、欠多了会出事。
 */

/**
 * 月例：每月从家里银两给各房发月钱。
 * 给足了她们手头宽裕、怨气消；发不出，她们自己想办法——
 * 这层不写台词，只让"体面钱"真的存在。
 */
function runAllowances(world, events) {
  const day = Number(world.clock?.day) || 1;
  if (day % 30 !== 0) return;

  // 名分 → 月例
  const ALLOWANCE = [
    { re: /正妻|大娘子/, amount: 5.0 },
    { re: /如夫人|二房|侧室|妾/, amount: 3.0 },
    { re: /通房|贴身丫鬟|丫鬟|丫头/, amount: 0.8 },
  ];
  const OUTSIDER = 2.0;   // 外室（不入府，暗中给）
  const CHILD = 0.3;      // 每个孩子

  let total = 0;
  const lines = [];

  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || a.id === 'husband') continue;
    const role = String(a.role || '');
    let amount = 0;

    if (a.household) {
      const hit = ALLOWANCE.find((x) => x.re.test(role));
      amount = hit ? hit.amount : 0;
      // 府里孩子：每月 0.2
      if (Array.isArray(a.parents) && a.parents.length) amount += CHILD;
    } else {
      // 外室：已圆房且不是正经内眷
      const intimate = (a.intimacy && a.intimacy.consummated) || Number(a.relations?.husband?.trust) >= 60;
      if (intimate) amount = OUTSIDER;
    }
    if (amount <= 0) continue;

    total += amount;
    lines.push(`${a.name}${amount.toFixed(1)}`);
  }

  if (!lines.length) return;

  world.assets = world.assets || {};
  const silver = Number(world.assets.silver) || 0;

  if (silver >= total) {
    world.assets.silver = Math.round((silver - total) * 100) / 100;
    // 足额：发到个人手里，怨气消一点
    for (const a of Object.values(world.actors || {})) {
      if (!a || a.dead || a.id === 'husband') continue;
      const role = String(a.role || '');
      let amount = 0;
      if (a.household) {
        const hit = ALLOWANCE.find((x) => x.re.test(role));
        amount = hit ? hit.amount : 0;
        if (Array.isArray(a.parents) && a.parents.length) amount += CHILD;
      } else {
        const intimate = (a.intimacy && a.intimacy.consummated) || Number(a.relations?.husband?.trust) >= 60;
        if (intimate) amount = OUTSIDER;
      }
      if (amount <= 0) continue;
      a.money = Math.round(((Number(a.money) || 0) + amount) * 100) / 100;
      const rel = a.relations?.husband;
      if (rel) rel.grievance = Math.max(0, Math.round((Number(rel.grievance) || 0) - 1));
    }
    console.log(`[Allowance] 第${day}日发月例 ${total.toFixed(1)} 两：${lines.join('、')}`);
    events.push(nextEvent(world, {
      action: 'allowance', actor: 'husband', place: 'husband_room',
      payload: { text: `发月例 ${total.toFixed(1)} 两` }, isPublic: false,
    }));
  } else {
    // 发不出：每人怨气 +3，记账
    for (const a of Object.values(world.actors || {})) {
      if (!a || a.dead || a.id === 'husband') continue;
      const rel = a.relations?.husband;
      if (!rel) continue;
      const role = String(a.role || '');
      const inHouse = a.household || (a.intimacy && a.intimacy.consummated);
      if (!inHouse) continue;
      rel.grievance = Math.min(100, Math.round((Number(rel.grievance) || 0) + 3));
    }
    console.log(`[Allowance] 第${day}日银两不足，月例 ${total.toFixed(1)} 两发不出`);
    events.push(nextEvent(world, {
      action: 'allowance_arrears', actor: 'husband', place: 'husband_room',
      payload: { text: `月例发不出，各房皆有怨言` }, isPublic: false,
    }));
  }
}


/**
 * 月事：28 天一轮，行经 4~6 天。
 * 这几天她身子不爽、不愿同房，也怀不上——这不是惩罚，是常识。
 */
function runMenses(world) {
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || a.gender !== 'female' || !a.menses) continue;
    const m = a.menses;
    m.cycleDay = ((Number(m.cycleDay) || 0) + 1) % (Number(m.cycle) || 28);
    const on = m.cycleDay < (Number(m.periodLen) || 5);
    if (on !== Boolean(m.on)) {
      m.on = on;
      const rel = a.relations?.husband;
      if (rel) {
        if (on) rel.grievance = Math.min(100, Math.round((Number(rel.grievance) || 0) + 1));
      }
      console.log(`[Menses] ${a.name}${on ? '来了月事' : '月事已净'}`);
    }
  }
}

function runPersonalEconomy(world, events) {
  const day = Number(world.clock?.day) || 1;
  let broke = 0;

  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || a.id === 'husband') continue;
    if (typeof a.money !== 'number') a.money = 1;

    const role = String(a.role || '');
    // ── 进项 ──
    let income = 0.02;                       // 兜底：打零工
    if (/天子/.test(role)) income = 3;
    else if (/宰相|尚书/.test(role)) income = 0.8;
    else if (/知府/.test(role)) income = 0.5;
    else if (/知县|县令/.test(role)) income = 0.35;
    else if (/巡检|都尉|统领|把总/.test(role)) income = 0.25;
    else if (/掌柜|东家/.test(role)) income = 0.4;
    else if (/郎中|大夫/.test(role)) income = 0.2;
    else if (/镖头|镖师/.test(role)) income = 0.15;
    else if (/先生|夫子|教书/.test(role)) income = 0.1;
    else if (/伙计|小二|小厮|跑堂/.test(role)) income = 0.06;
    else if (/丫鬟|丫头|嬷嬷/.test(role)) income = 0.03;
    else if (/绣娘|针线/.test(role)) income = 0.08;
    else if (/农|佃|田/.test(role)) income = 0.05;
    else if (/妇人|寡妇|婆|娘/.test(role)) income = 0.06;

    // 铺子在自家名下的，多分一点（东家分红）
    const mine = (world.assets?.properties || []).find((x) => x && x.owner === a.id);
    if (mine) income += Math.max(0, (Number(mine.incomePerDay) || 0) * 0.4);

    // ── 开销 ──
    let cost = 0.02;                          // 一人一日饭钱
    if (/天子|宰相|尚书|知府/.test(role)) cost = 0.15;
    else if (/知县|掌柜|东家|郎中/.test(role)) cost = 0.08;
    if (day % 30 === 0) cost += 0.1;          // 月租

    a.money = Math.round((a.money + income - cost) * 100) / 100;

    // 欠钱：记账 + 怨气
    if (a.money < 0) {
      a.money = 0;
      a.debt = Math.round(((Number(a.debt) || 0) + (cost - income)) * 100) / 100;
      const rel = a.relations?.husband;
      if (rel) rel.grievance = Math.min(100, Math.round((Number(rel.grievance) || 0) + 1));
      broke += 1;
      if (broke <= 2 && Math.random() < 0.02) {
        events.push(nextEvent(world, {
          action: 'poverty', actor: a.id, place: a.location,
          payload: { text: `${a.name}手头紧，欠了${a.debt}两` }, isPublic: true,
        }));
      }
    }
  }

  if (broke > 0 && day % 10 === 0) {
    console.log(`[Money] 第${day}日：${broke} 人手头见底`);
  }
}

function runTreasury(world, events) {
  const day = Number(world.clock?.day) || 1;
  world.court = world.court || {};
  const tr = world.court.treasury = world.court.treasury || { silver: 1200, grain: 800, lastIncome: 0, lastExpense: 0 };

  // 收：朝廷的城
  let income = 0;
  for (const ct of Object.values(world.cities || {})) {
    if (!ct) continue;
    const courtOwned = !ct.owner || ct.owner === 'court';
    if (!courtOwned) continue;
    const tax = Math.max(0, Math.min(50, Number(ct.tax) || 10));
    income += Math.round(((Number(ct.wealth) || 30) * tax) / 100 / 3 * 100) / 100;
  }
  // 支：官俸 + 军饷
  const offices = Object.values(world.court.offices || {}).filter((o) => o && o.holder && !o.vacant);
  const salary = offices.length * 1.5;
  const mil = world.military || {};
  const pay = ((Number(mil.army) || 0) + (Number(mil.militia) || 0) * 0.5) / 100 * 2;
  const expense = Math.round((salary + pay) * 100) / 100;

  tr.silver = Math.round(((Number(tr.silver) || 0) + income - expense) * 100) / 100;
  tr.lastIncome = Math.round(income * 100) / 100;
  tr.lastExpense = expense;

  // 国库见底：加税或欠俸
  if (tr.silver < 0) {
    tr.silver = 0;
    world.flags = world.flags || {};
    world.flags.courtBankrupt = (Number(world.flags.courtBankrupt) || 0) + 1;
    for (const ct of Object.values(world.cities || {})) {
      if (!ct) continue;
      ct.tax = Math.min(50, (Number(ct.tax) || 10) + 2);
      ct.unrest = Math.min(100, (Number(ct.unrest) || 0) + 2);
    }
    events.push(nextEvent(world, { action: 'treasury_empty', actor: 'court', place: null, payload: { text: '国库告罄，朝廷加征' }, isPublic: true }));
  }

  // 欠俸：国库长期不足，官府只能加派、贪腐更狠
  if (tr.silver < 300) {
    world.flags = world.flags || {};
    world.flags.courtPressure = Math.min(100, (Number(world.flags.courtPressure) || 0) + 2);
    if (day % 7 === 0) {
      events.push(nextEvent(world, { action: 'arrears', actor: 'court', place: null, payload: { text: '官俸拖欠，衙门加派捐税' }, isPublic: true }));
    }
  }

  // 秋收入仓（每 30 天一次），灾荒出仓
  if (day % 30 === 0) {
    tr.grain = Math.min(3000, (Number(tr.grain) || 0) + 600);
    events.push(nextEvent(world, { action: 'harvest', actor: 'court', place: null, payload: { text: '秋收入仓' }, isPublic: true }));
  }
  const disasters = (events || []).filter((e) => e?.action === 'disaster').length;
  if (disasters > 0 && Number(tr.grain) > 0) {
    const give = Math.min(Number(tr.grain), disasters * 120);
    tr.grain = Number(tr.grain) - give;
    for (const ct of Object.values(world.cities || {})) {
      if (!ct) continue;
      ct.unrest = Math.max(0, (Number(ct.unrest) || 0) - 3);
    }
    events.push(nextEvent(world, { action: 'relief_grain', actor: 'court', place: null, payload: { text: `开仓放粮 ${give} 石` }, isPublic: true }));
  }

  // 仓越空，粮价越高
  const stock = Number(tr.grain) || 0;
  const pressure = stock < 200 ? 1.25 : stock < 500 ? 1.1 : stock > 1500 ? 0.95 : 1;
  world.flags = world.flags || {};
  world.flags.grainPressure = pressure;
}

/** 外交：邻国有自己的算盘 */
function runForeign(world, events, queuePush) {
  const day = Number(world.clock?.day) || 1;
  const f = world.foreign || {};
  const list = Object.values(f).filter(Boolean);
  if (!list.length) return;
  for (const n of list) {
    n.relation = Math.max(0, Math.min(100, (Number(n.relation) || 50) + (Math.random() < 0.5 ? -1 : 1)));
  }
  // 边患：关系差的国家会来抢边城
  if (day % 3 === 0) {
    const foe = list.filter((n) => (Number(n.relation) || 50) < 40).sort((a, b) => a.relation - b.relation)[0];
    if (foe && Math.random() < 0.5) {
      const cities = Object.values(world.cities || {}).filter(Boolean);
      const edge = cities[Math.floor(Math.random() * cities.length)];
      if (edge) {
        const loss = Math.round((Number(edge.wealth) || 30) * 0.08 * 100) / 100;
        edge.wealth = Math.max(0, Math.round(((Number(edge.wealth) || 30) - loss) * 100) / 100);
        edge.unrest = Math.min(100, (Number(edge.unrest) || 0) + 5);
        events.push(nextEvent(world, { action: 'border_raid', actor: 'court', place: edge.region || null, payload: { text: `${foe.name}犯边，${edge.name}被掠` }, isPublic: true }));
        queuePush?.({ to: 'husband', reason: 'court', facts: { 边患: foe.name }, fallback: `${foe.name}犯边，${edge.name}被抢了。`, force: true });
      }
    }
  }
  // 使节：每 20 天可能来一个
  if (day % 20 === 0 && !world.envoy) {
    const who = list[Math.floor(Math.random() * list.length)];
    const demands = ['纳贡', '通商', '和亲', '借道'];
    const demand = demands[Math.floor(Math.random() * demands.length)];
    world.envoy = { from: who.id, name: who.name, demand, arriveDay: day + 1, decided: false };
    events.push(nextEvent(world, { action: 'envoy', actor: 'court', place: null, payload: { text: `${who.name}遣使，求${demand}` }, isPublic: true }));
    queuePush?.({ to: 'husband', reason: 'court', facts: { 使节: who.name }, fallback: `${who.name}的使节到了，说是要${demand}。`, force: true });
  }
}

/**
 * 朝廷围剿：通缉高、占城多，朝廷就会真的派兵来。
 * 这是"造反"的另一半——你占了城，朝廷不会装看不见。
 */
function runImperialCrackdown(world, events, queuePush) {
  const day = Number(world.clock?.day) || 1;
  world.flags = world.flags || {};
  const wanted = Number(world.flags.wanted) || 0;
  const pressure = Number(world.flags.courtPressure) || 0;
  const myCities = Object.entries(world.cities || {}).filter(([, c]) => c && c.owner === 'wangjia');
  const threat = wanted * 20 + pressure + myCities.length * 15;

  // 已经在路上的朝廷兵马
  if (world.imperialArmy) {
    const ia = world.imperialArmy;
    if (day < Number(ia.arriveDay || 0)) return;
    const ct = world.cities?.[ia.target];
    if (!ct) { world.imperialArmy = null; return; }
    const mil = world.military || {};
    const gar = Number(world.garrisons?.[ia.target]) || 0;
    const ours = (Number(mil.army) || 0) + (Number(mil.militia) || 0) * 0.6 + gar;
    const oursPower = ours * (1 + (Number(mil.morale) || 0) / 200) * (1 + (Number(mil.quality) || 0) / 200);
    const theirPower = ia.count * (1 + Math.random() * 0.2);
    if (oursPower > theirPower) {
      world.flags.wanted = Math.max(0, wanted - 1);
      world.flags.courtPressure = Math.max(0, pressure - 20);
      mil.morale = Math.min(100, (Number(mil.morale) || 50) + 5);
      events.push(nextEvent(world, { action: 'defend_win', actor: 'husband', place: ct.region || null, payload: { text: `击退朝廷${ia.count}兵马` }, isPublic: true }));
      queuePush?.({ to: 'husband', reason: 'court', facts: { 官军: '已退' }, fallback: `官军${ia.count}人来攻${ia.target}，被你打退了。`, force: true });
    } else {
      ct.owner = 'court';
      world.flags.wanted = wanted + 1;
      mil.army = Math.max(0, Math.round((Number(mil.army) || 0) * 0.7));
      mil.morale = Math.max(0, (Number(mil.morale) || 50) - 15);
      world.garrisons = world.garrisons || {};
      world.garrisons[ia.target] = 0;
      events.push(nextEvent(world, { action: 'defend_lose', actor: 'husband', place: ct.region || null, payload: { text: `${ia.target}被官军夺回` }, isPublic: true }));
      queuePush?.({ to: 'husband', reason: 'court', facts: { 官军: '城破' }, fallback: `官军破了${ia.target}，你的兵折了大半。`, force: true });
    }
    world.imperialArmy = null;
    return;
  }

  if (threat < 60) return;
  if (Math.random() > Math.min(0.6, threat / 200)) return;
  const target = myCities.length ? myCities[0][0] : '临江府';
  const count = 40 + Math.round(threat * 0.8);
  world.imperialArmy = { count, target, arriveDay: day + 2 };
  events.push(nextEvent(world, { action: 'imperial_march', actor: 'court', place: null, payload: { text: `朝廷点${count}兵马来剿` }, isPublic: true }));
  queuePush?.({ to: 'husband', reason: 'court', facts: { 官军: '将至' }, fallback: `朝廷点了${count}兵马，两日后到${target}。`, force: true });
}

/** 行军到达：把兵驻进目标城 */
function runMarches(world, events) {
  const day = Number(world.clock?.day) || 1;
  if (!Array.isArray(world.marches) || !world.marches.length) return;
  world.garrisons = world.garrisons && typeof world.garrisons === 'object' ? world.garrisons : {};
  world.marches = world.marches.filter((m) => {
    if (!m) return false;
    if (day < Number(m.arriveDay || 0)) return true;
    world.garrisons[m.to] = (Number(world.garrisons[m.to]) || 0) + (Number(m.count) || 0);
    events.push(nextEvent(world, { action: 'march_in', actor: 'husband', place: null, payload: { text: `${m.count}兵抵${m.to}` }, isPublic: true }));
    return false;
  });
}

/** 山贼流寇：民心乱的城，会被抢。有兵才有太平。 */
function runBandits(world, events) {
  const day = Number(world.clock?.day) || 1;
  if (day % 2 !== 0) return; // 隔日可能出事
  const cities = Object.values(world.cities || {}).filter(Boolean);
  if (!cities.length) return;
  const hot = cities.filter((c) => (Number(c.unrest) || 0) >= 45);
  if (!hot.length) return;
  if (Math.random() > 0.35) return;
  const ct = hot[Math.floor(Math.random() * hot.length)];
  const mine = ct.owner === 'wangjia';
  const mil = world.military || {};
  const guards = mine ? ((Number(mil.army) || 0) + (Number(mil.militia) || 0) + (Number(mil.guards) || 0)) : 0;
  const defense = (Number(ct.defense) || 10) * 12 + guards;
  const raiders = 20 + Math.floor(Math.random() * 60);
  if (defense >= raiders * 4) {
    if (mine && guards > 0) {
      world.military.morale = Math.max(0, (Number(world.military.morale) || 50) - 2);
      world.military.supplies = Math.max(0, (Number(world.military.supplies) || 0) - 2);
      events.push(nextEvent(world, { action: 'repelled', actor: 'husband', place: null, payload: { text: `${ct.name}击退一股流寇` }, isPublic: true }));
    }
    return;
  }
  const loss = Math.round((Number(ct.wealth) || 30) * (mine ? 0.12 : 0.06) * 100) / 100;
  ct.wealth = Math.max(0, Math.round(((Number(ct.wealth) || 30) - loss) * 100) / 100);
  ct.unrest = Math.min(100, (Number(ct.unrest) || 0) + 6);
  events.push(nextEvent(world, { action: 'bandits', actor: 'system', place: ct.region || null, payload: { text: `${ct.name}遭流寇劫掠，损${loss}两` }, isPublic: true }));
  if (mine) {
    world.military = world.military || {};
    world.military.morale = Math.max(0, (Number(world.military.morale) || 50) - 8);
    world.military.army = Math.max(0, Math.round((Number(world.military.army) || 0) * 0.92));
  }
}

/** 读书与科举：学识靠读，功名靠考 */
function runStudy(world, events) {
  const day = Number(world.clock?.day) || 1;
  const hasAcademy = Boolean(world.places?.academy);
  if (!hasAcademy) return;
  // 每天有几个年轻人去书院：不然永远没人读书，科举就是空的
  const youths = Object.values(world.actors || {}).filter(
    (a) => a && !a.dead && a.id !== 'husband' && !a.playerControlled && !a.jailed
      && !/(知府|知县|尚书|宰相|天子|巡抚|统领|老鸨|帮主)/.test(String(a.role || ''))
      && (Number(a.study) || 0) < 95,
  );
  if (youths.length) {
    const go = youths.slice(0, 3);
    for (const a of go) {
      if (a.location !== 'academy') moveActor(world, a.id, 'academy', 'world', '上学');
    }
  }
  // 在书院的人，学识每天长一点
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || a.id === 'husband') continue;
    if (a.location !== 'academy') continue;
    const cur = Number(a.study) || 0;
    a.study = Math.min(100, Math.round((cur + 0.6) * 10) / 10);
  }
  // 每 90 天乡试：学识最高的几个人里有中的
  if (day % 90 !== 0) return;
  const candidates = Object.values(world.actors || {})
    .filter((a) => a && !a.dead && (Number(a.study) || 0) >= 30)
    .sort((a, b) => (Number(b.study) || 0) - (Number(a.study) || 0))
    .slice(0, 5);
  if (!candidates.length) return;
  const winner = candidates[0];
  const cur = String(winner.rank || '');
  const next = !cur ? '秀才' : cur === '秀才' ? '举人' : cur === '举人' ? '进士' : '进士';
  winner.rank = next;
  winner.role = `${next}·${String(winner.role || '读书人').replace(/^(秀才|举人|进士)·?/, '')}`;
  const rel = winner.relations?.husband || { trust: 30, desire: 0, fear: 0, grievance: 0 };
  rel.trust = Math.min(100, (Number(rel.trust) || 30) + 8);
  winner.relations = winner.relations || {};
  winner.relations.husband = rel;
  events.push(nextEvent(world, { action: 'exam', actor: winner.id, place: 'academy', payload: { text: `${winner.name}中${next}` }, isPublic: true }));
}

/** 节庆：每月初一十五庙会，香火旺、街面热闹 */
function runFestivals(world, events) {
  const day = Number(world.clock?.day) || 1;
  if (day % 15 !== 0) return;
  const tpl = world.places?.temple;
  for (const ct of Object.values(world.cities || {})) {
    if (!ct) continue;
    ct.price = Math.min(300, Math.round((Number(ct.price) || 100) * 1.04));
    ct.unrest = Math.max(0, (Number(ct.unrest) || 0) - 2);
  }
  events.push(nextEvent(world, { action: 'festival', actor: 'monk', place: tpl ? 'temple' : null, payload: { text: '初一庙会，城隍庙前摆满摊子' }, isPublic: true }));
  const monkA = world.actors?.monk;
  if (monkA) {
    const rel = monkA.relations?.husband || { trust: 28, grievance: 0 };
    rel.trust = Math.min(100, (Number(rel.trust) || 28) + 1);
    monkA.relations = monkA.relations || {};
    monkA.relations.husband = rel;
  }
}

/** 行会：同行抽成、会首说话有分量 */
function runGuilds(world, events) {
  world.guilds = world.guilds || {};
  for (const g of Object.values(world.guilds)) {
    if (!g) continue;
    let head = world.actors?.[g.head];
    if (!head && g.headName) {
      head = Object.values(world.actors || {}).find((a) => a && a.name === g.headName);
      if (head) g.head = head.id;
    }
    if (head) {
      const rel = head.relations?.husband || {};
      // 会首对相公越亲近，行会对他的铺子越客气
      g.attitude = (Number(rel.trust) || 30) >= 50 ? 'friendly' : (Number(rel.grievance) || 0) >= 30 ? 'hostile' : 'neutral';
    }
    g.power = Math.max(0, Math.min(100, (Number(g.power) || 30) + (g.attitude === 'friendly' ? 0 : 0.2)));
  }
  // 茶行每月抽一次：茶坊日入的 dues% 归茶行
  const day = Number(world.clock?.day) || 1;
  if (day % 30 !== 0) return;
  for (const g of Object.values(world.guilds)) {
    if (!g) continue;
    const props = (world.assets?.properties || []).filter((p) => p && new RegExp(String(g.name).replace('行', '')).test(String(p.name || '')));
    if (!props.length) continue;
    const dues = props.reduce((s, p) => s + (Number(p.incomePerDay) || 0) * (Number(g.dues) || 3) / 100, 0);
    if (dues <= 0) continue;
    world.assets.silver = round2(Math.max(0, (Number(world.assets.silver) || 0) - dues));
    events.push(nextEvent(world, { action: 'guild_dues', actor: g.head, place: null, payload: { text: `${g.name}抽成 ${dues.toFixed(2)} 两` }, isPublic: false }));
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

function recordHistory(world) {
  const day = Number(world.clock?.day) || 1;
  world.history = Array.isArray(world.history) ? world.history : [];
  if (world.history.some((h) => h && h.day === day)) return;
  const cities = Object.values(world.cities || {}).filter(Boolean);
  const unrest = cities.length ? Math.round(cities.reduce((a, c) => a + (Number(c.unrest) || 0), 0) / cities.length) : 0;
  const price = cities.length ? Math.round(cities.reduce((a, c) => a + (Number(c.price) || 100), 0) / cities.length) : 100;
  world.history.push({
    day,
    unrest,
    price,
    treasury: Math.round(Number(world.court?.treasury?.silver) || 0),
    grain: Math.round(Number(world.court?.treasury?.grain) || 0),
    silver: Math.round(Number(world.assets?.silver) || 0),
  });
  if (world.history.length > 40) world.history = world.history.slice(-40);
}

function onNewDay(world, events) {
  try { recordHistory(world); } catch (e) { /* 忽略 */ }
  try {
    const spread = spreadRumors(world);
    if (spread.length) console.log(`[Rumor] 传开 ${spread.length} 次`);
  } catch (err) {
    console.warn('[Rumor] 扩散失败：', err.message);
  }
  try {
    runGuilds(world, events);
  } catch (err) {
    console.warn('[Guild] 行会结算失败：', err.message);
  }
  try {
    runStudy(world, events);
    runFestivals(world, events);
  } catch (err) {
    console.warn('[Study] 读书节庆失败：', err.message);
  }
  try {
    runBandits(world, events);
  } catch (err) {
    console.warn('[Bandit] 流寇失败：', err.message);
  }
  try {
    runMarches(world, events);
  } catch (err) {
    console.warn('[March] 行军失败：', err.message);
  }
  try {
    runImperialCrackdown(world, events, (o) => queueProactive(world, { type: 'court', ...o }));
  } catch (err) {
    console.warn('[Court] 围剿失败：', err.message);
  }
  try {
    runForeign(world, events, (o) => queueProactive(world, { type: 'court', ...o }));
  } catch (err) {
    console.warn('[Foreign] 外交失败：', err.message);
  }
  try {
    runMemorials(world, events);
  } catch (err) {
    console.warn('[Court] 折子失败：', err.message);
  }
  try {
    runAppointments(world, events);
  } catch (err) {
    console.warn('[Court] 补缺失败：', err.message);
  }
  try {
    runLifecycle(world, events, (o) => queueProactive(world, { type: 'life', ...o }));
  } catch (err) {
    console.warn('[Life] 生老病死失败：', err.message);
  }
  consumeSupplies(world);
  try {
    runTreasury(world, events);
  runMenses(world);
  runPersonalEconomy(world, events);
  runAllowances(world, events);
  } catch (err) {
    console.warn('[Treasury] 国库结算失败：', err.message);
  }
  try {
    runLoanDues(world, events, (o) => queueProactive(world, { type: 'loan', ...o }));
  } catch (err) {
    console.warn('[Loan] 借还款结算失败：', err.message);
  }
  try {
    runLocalEconomy(world, events);
    runCourtReaction(world, events, (o) => queueProactive(world, { type: 'court', ...o }));
  try {
    markCourtDecree(world);
  } catch (err) {
    console.warn('[Court] 朝议标记失败：', err.message);
  }
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

/** 产业当日进项：底数 × 行情 × 民心 × 季节 × 掌柜本事（有涨有落，不写死）*/
function dailyIncomeOf(world, prop) {
  const base = Number(prop.baseIncome ?? prop.incomePerDay) || 0;
  if (!(base > 0)) return 0;
  if (prop.baseIncome == null) prop.baseIncome = base;
  const city = world.cities?.[prop.city] || Object.values(world.cities || {}).find((c) => c && c.name === prop.city);
  const price = Number(city?.price) || 100;
  const unrest = Number(city?.unrest) || 0;
  const season = String(world.clock?.season || 'spring');
  const keeper = world.actors?.[prop.keeper];
  const trust = Number(keeper?.relations?.husband?.trust ?? 30);
  let m = 1;
  m *= 0.6 + Math.min(2.2, price / 100) * 0.4;        // 物价高，生意跟着好
  m *= 1 - Math.min(0.6, unrest / 160);                // 民心乱，客少
  if (/茶/.test(String(prop.name || '')) ) m *= season === 'spring' ? 1.12 : season === 'winter' ? 0.92 : 1;
  if (/酒/.test(String(prop.name || '')) ) m *= season === 'winter' ? 1.15 : 1;
  m *= 0.9 + Math.min(0.35, trust / 300);              // 掌柜得力
  if (Number(prop.staff) > 0) m *= 1 + Math.min(0.25, Number(prop.staff) * 0.03);
  m *= 0.92 + Math.random() * 0.16;                    // 每日小波动
  const gain = Math.round(base * m * 100) / 100;
  prop.incomePerDay = gain;                            // 显示的就是今日进项
  return gain;
}

  // 各人的产业各人收：有掌柜归掌柜，没掌柜才进公账
  world.wallets = world.wallets && typeof world.wallets === "object" ? world.wallets : {};
  let income = 0;
  for (const p of world.assets.properties || []) {
    const gain = dailyIncomeOf(world, p);
    // 工钱：每人每日 0.12 两，从掌柜/东家账上扣；扣不出就有人辞工
    const staff = Number(p.staff) || 0;
    if (staff > 0) {
      const wage = Math.round(staff * 0.12 * 100) / 100;
      const payer = (p.keeper && p.keeper !== 'husband' && world.actors?.[p.keeper]) ? p.keeper : 'husband';
      const purse = payer === 'husband' ? (Number(world.assets.silver) || 0) : (Number(world.wallets?.[payer]) || 0);
      if (purse >= wage) {
        if (payer === 'husband') world.assets.silver = round2(purse - wage);
        else world.wallets[payer] = round2(purse - wage);
      } else {
        p.staff = Math.max(0, staff - 1);
        p.morale = Math.max(0, (Number(p.morale) || 50) - 8);
        console.log(`[Wage] ${p.name}发不出工钱，走了一个人（剩 ${p.staff}）`);
      }
    }
    if (!(gain > 0)) continue;
    const keeper = String(p.keeper || "");
    if (keeper && keeper !== "husband" && world.actors?.[keeper]) {
      world.wallets[keeper] = round2((Number(world.wallets[keeper]) || 0) + gain);
    } else {
      income += gain;
    }
  }
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
function markNpcArcs(world) {
  const day = Number(world.clock?.day) || 1;
  world.npcArcs = world.npcArcs || {};
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || a.id === 'husband') continue;
    if (a.servant && !a.name) continue;
    // 世界里每个活人都有自己的事，不再只挑"局中人"
    if (!a.role && !a.schedule?.length) continue;
    const arc = world.npcArcs[a.id] || {};
    if (arc.pendingStep) continue;
    const lastDay = Number(arc.day) || 0;
    if (lastDay && day - lastDay < 3) continue;
    arc.stage = (Number(arc.stage) || 0) + 1;
    arc.pendingStep = true;
    arc.day = day;
    world.npcArcs[a.id] = arc;
  }
}

function ensureActivity(world) {
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || a.id === 'husband') continue;
    if (a.activity?.text) continue;
    const role = String(a.role || '');
    let text = '忙着手里的事';
    if (/知府|知县/.test(role)) text = '坐堂理事，批折子';
    else if (/尚书|宰相/.test(role)) text = '在衙门里议事';
    else if (/天子/.test(role)) text = '在宫里听政';
    else if (/掌柜|东家|老板娘/.test(role)) text = '守着铺子看账';
    else if (/工头|匠/.test(role)) text = '在工地上盯活';
    else if (/行商|商/.test(role)) text = '在外头跑买卖';
    else if (/伙计|跑堂/.test(role)) text = '招呼客人';
    else if (/护卫|统领|兵/.test(role)) text = '当值巡街';
    else if (/寡妇|绣|妇人/.test(role)) text = '在家做针线';
    a.activity = { text, at: world.clock?.hour || 0, day: world.clock?.day || 1 };
  }
}

function runSchedules(world) {
  const husbandPlace = world.actors?.husband?.location;
  for (const actor of Object.values(world.actors || {})) {
    if (!Array.isArray(actor.schedule)) continue;
    for (const slot of actor.schedule) {
      if (slot.at === world.clock.hour && slot.place) {
        actor.activity = { text: String(slot.do || ''), at: world.clock.hour, day: world.clock.day };
        if (actor.location === slot.place) continue;
        // 正在私会的人不打断；被相公派出去的人（外派豁免期内）也不拉回来；在押服刑者严禁外出走动作息
        if (actor.jailed) continue;
        if (actor.intimacy?.ritual === 'unlocked') continue;
        if (actor.away && Number(actor.away.untilDay) >= Number(world.clock.day)) continue;
        moveActor(world, actor.id, slot.place, 'world', String(slot.do || ''));
        actor.activity = { text: String(slot.do || ''), at: world.clock.hour, day: world.clock.day };
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
      if (p.reason === 'court') return true;       // 朝廷打过来了，必须让她知道
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
    if (actor && meetPlace) moveActor(world, actor.id, meetPlace, 'world', '赴约');

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
      ensureCourt(world);
      ensureTerrain(world);
      advanceArcs(world, events, (opts) => queueProactive(world, { type: 'arc', ...opts }), nextEvent);
      // 躺平到限期：世界替她做决定（结果由她的处境算出来）
      for (const actorId of Object.keys(world.arcs || {})) {
        const res = resolveArc(world, actorId);
        if (!res) continue;
        world.memories = Array.isArray(world.memories) ? world.memories : [];
        world.memories.push({ text: res.memory, day: world.clock.day, at: Date.now() });
        if (world.memories.length > 120) world.memories = world.memories.slice(-120);
        events.push(
          nextEvent(world, {
            action: 'arc_resolved',
            actor: actorId,
            place: world.actors?.[actorId]?.location || null,
            payload: { text: res.text },
            isPublic: false,
          }),
        );
        queueProactive(world, {
          to: actorId,
          reason: 'arc',
          facts: { 结果: res.text },
          fallback: res.text,
          force: true,
          type: 'arc',
        });
      }
    } catch (err) {
      console.warn('[Arc] 主线推进失败：', err.message);
    }
    onNewDay(world, events);
  }

  // 亥时各回各家：客人不会永远赖在别人家里（正陪在相公身边的除外）
  if (world.clock.hour === 21) {
    const here = world.actors?.husband?.location;
    for (const a of Object.values(world.actors || {})) {
      if (!a || a.dead || a.kind === 'human' || a.id === 'husband') continue;
      const home = a.home && world.places?.[a.home] ? a.home : null;
      if (!home) continue;
      if (a.location === home) continue;
      // 哪怕就在相公跟前，天黑了也要回自己家；只有正在私会时例外
      if (a.intimacy?.ritual === 'unlocked') continue; // 正在私会，别打断
      moveActor(world, a.id, home, 'world', '天黑回家');
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
      const reportText = buildMorningReport(world);
      events.push(
        nextEvent(world, {
          action: 'morning_report',
          place: 'tea_house',
          payload: { text: reportText },
          isPublic: true,
        }),
      );
      queueProactive(world, {
        reason: 'morning_report',
        facts: { report: reportText },
        fallback: reportText,
        type: 'proactive',
        force: true,
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

  try {
    runHearings(world, events);
    runPettyCrimes(world, events);
  } catch (err) {
    console.warn('[Case] 民间案子失败：', err.message);
  }

  ensureActivity(world);
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

  // 每次心跳都检查：不依赖"跨点"，重启也不会错过
  try {
    markNpcArcs(world);
    markCourtDecree(world);
  } catch (err) {
    console.warn('[World] 标记失败：', err.message);
  }

  const elapsed = Math.max(0, now - world.lastRealAt);
  const rawSteps = Math.floor(elapsed / msPerWorldHour);
  const steps = Math.min(Math.max(0, rawSteps), MAX_STEPS_PER_TICK);

  const events = [];
  for (let i = 0; i < steps; i += 1) advanceHour(world, events, now);

  if (steps > 0 || world.court?.pendingDecree || Object.keys(world.npcArcs || {}).length) {
    if (steps > 0) world.lastRealAt += steps * msPerWorldHour; // 只吃掉已结算的时间，剩余欠账留到下次
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
