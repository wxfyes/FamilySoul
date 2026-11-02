/**
 * 状态摘要 —— 把世界状态压成一段给叙述层看的「天机」文字
 * 纯规则生成，不调用大模型；目标 ≤ 800 token。
 */
import { loadState, readRecentEvents, seasonCN, shichenOf, round2 } from './state.js';
import { describeScene } from './scene.js';
import { recentActivities } from './actors.js';

function money(assets) {
  const parts = [];
  parts.push(`现银 ${round2(assets.silver)} 两`);
  if (Number(assets.copper)) parts.push(`铜钱 ${assets.copper} 吊`);
  const income = (assets.properties || []).reduce((s, p) => s + (Number(p.incomePerDay) || 0), 0);
  if (income > 0) parts.push(`日入 ${round2(income)} 两`);
  return parts.join(' · ');
}

function propsLine(assets) {
  const props = (assets.properties || []).filter((p) => p.status !== '正常营业');
  if (props.length === 0) return '';
  return props.map((p) => `${p.name}（${p.status}）`).join('、');
}

// 只列「主子级」在场者。仆役（阿吉/小翠）一律不列：
// 一旦把仆人写进【在场】，模型遇到"回家/看茶"这类场景就会让仆人抢答，把主母的戏抢走。
// 只把「仆人」排除在【在场】之外（他们抢话），其余在场的人一律给出态度，好人坏人都有阻力
const SERVANT_IDS = new Set(['xiaocui', 'aji']);

/**
 * 把关系数值翻译成「她此刻的态度」。
 * 只给阻力（好不好接近、会不会答应），**不给结局**——成不成由天道演。
 */
function attitudeOf(actor) {
  const d = Number(actor?.relations?.husband?.desire ?? 0);
  const t = Number(actor?.relations?.husband?.trust ?? 0);
  const g = Number(actor?.relations?.husband?.grievance ?? 0);

  // 已进门的妻妾侍女：是自己人，绝不会真拒绝，最多闹闹小脾气
  if (actor?.household) {
    if (g >= 60) return '心里有气，会闹一场、要哄，但仍是你的妻妾';
    if (d >= 60) return '心里有你，主动迎合';
    if (d >= 30) return '愿意服侍，但会撒撒娇、拿你两句';
    return '虽有些倦，仍会应下';
  }

  // 外人 / 有夫之妇：这里才是真阻力
  if (g >= 60) return '心里有怨，轻易不松口';
  if (d >= 70 && t >= 55) return '心里已有你，半推半就';
  if (d >= 45) return '有点意动，但要给足由头与体面';
  if (t >= 45) return '当你是可信的人，但到此为止';
  if (d <= 20 && t <= 30) return '只是相识，提防着——第一次必拒，硬来会翻脸';
  return '有意无意地打量着，不肯先开口';
}

function relationLine(actor) {
  const r = actor?.relations?.husband;
  if (!r) return actor?.name || '';
  const bits = [`信任${Math.round(r.trust ?? 0)}`, `欲望${Math.round(r.desire ?? 0)}`];
  if (Number(r.grievance) > 0) bits.push(`怨怼${Math.round(r.grievance)}`);
  return `${actor.name}（${bits.join(' ')}｜${attitudeOf(actor)}）`;
}

function describeEvent(e) {
  if (!e) return '';
  const day = `第${e.day}日`;
  if (e.action === 'gossip') return `${day}·市井风闻：${e.payload?.text || ''}`;
  if (e.action === 'event_fired') return `${day}·${e.payload?.desc || '城中起了变故'}`;
  if (e.action === 'settle') return '';
  if (e.payload?.text) return `${day}·${e.payload.text}`;
  return '';
}

/**
 * 生成给相公端（丈夫）看的状态摘要。
 * 女主人端与孩子端不出这段，避免王家账本串味（见 docs/world-engine.md 第 13 节）。
 */
export function buildStateSummary(dataDir, { roleName = '', memberKey = 'husband' } = {}) {
  try {
    const world = loadState(dataDir);
    const lines = [];

    const day = world.clock?.day ?? 1;
    const hour = world.clock?.hour ?? 0;
    const season = world.clock?.season || 'spring';
    const weather = world.clock?.weather || '';
    lines.push(
      `【天机】${world.era || '乾宁三年'}·${seasonCN(season)} 第${day}日 ${shichenOf(hour)}${weather ? ` ${weather}` : ''}`,
    );

    const me = world.actors?.[memberKey] || world.actors?.husband;
    const here = me?.location || 'tea_house';
    const placeName = world.places?.[here]?.name || '临江茶坊';
    lines.push(`【所在】${placeName}`);

    // 同场与偶遇：有别的真人在同一处，这场话就是公开的，私密不得外露
    try {
      lines.push(`【场合】${describeScene(world, here, memberKey).line}`);
    } catch {
      /* 场景信息失败不影响摘要 */
    }

    // 府中到底有谁：以世界账本为准（旧的花名册数组早就不准了）
    try {
      const household = Object.values(world.actors || {}).filter(
        (a) => a && a.kind !== 'human' && a.household,
      );
      if (household.length > 0) {
        lines.push(
          `【府中】你的家人，天天见面的自己人：${household
            .map((a) => {
              const where = world.places?.[a.location]?.name || a.location || '';
              return `${a.name}（${a.role}${where ? `，住${where}` : ''}）`;
            })
            .join('、')}`,
        );
      }
    } catch {
      /* 忽略 */
    }

    const present = Object.values(world.actors || {})
      .filter((a) => a && a.id !== 'husband' && a.kind !== 'human' && a.location === here && !SERVANT_IDS.has(a.id))
      .map(relationLine)
      .filter(Boolean);
    if (present.length > 0) lines.push(`【在场】${present.join('、')}`);

    const moneyText = money(world.assets || {});
    const propsText = propsLine(world.assets || {});
    lines.push(`【家底】${moneyText}${propsText ? ` · ${propsText}` : ''}`);

    const milestones = Array.isArray(world.milestones) ? world.milestones.slice(-2) : [];
    if (milestones.length > 0) {
      lines.push(`【既定事实】${milestones.map((m) => String(m).slice(0, 80)).join(' / ')}`);
    }

    // NPC 自己的日子：只给事实（谁在忙什么），怎么演由天道裁定
    try {
      const acts = recentActivities(world, 2);
      if (acts.length > 0) {
        lines.push(`【近况】${acts.map((a) => `${a.name}在忙：${String(a.goal).slice(0, 24)}`).join('；')}`);
      }
    } catch {
      /* 忽略 */
    }

    // 账本消毒：府里已有的人，绝不可能再被"迎娶/纳聘"——这类记录是历史误记，一律不显示
    const houseKeys = new Set(
      Object.values(world.actors || {})
        .filter((a) => a?.household && a.name)
        .flatMap((a) => [a.name, a.name.length > 2 ? a.name.slice(-2) : a.name]),
    );
    const isBogusMarriage = (t) => {
      const s = String(t || '');
      if (!/(迎娶|迎纳|纳妾|聘礼|八抬|入府|进门|开脸|娶)/.test(s)) return false;
      for (const n of houseKeys) if (s.includes(n)) return true;
      return false;
    };
    const recent = readRecentEvents(dataDir, 12)
      .map(describeEvent)
      .filter(Boolean)
      .filter((line) => !isBogusMarriage(line))
      .slice(-3);
    if (recent.length > 0) lines.push(`【她记得】${recent.join('；')}`);

    // 暗号与亲密状态（契约的当前档位，不是台词）
    const ritualId =
      roleName === '傲娇助手'
        ? 'waner'
        : Object.entries(world.actors || {}).find(([, a]) => a?.role === roleName)?.[0];
    const intimacy = ritualId ? world.actors?.[ritualId]?.intimacy : null;
    if (intimacy?.ritual) {
      lines.push(
        intimacy.ritual === 'unlocked'
          ? `【私密】已解禁 · 语气档位 ${intimacy.tone ?? 3}/3（事毕须立刻归位温存）`
          : '【私密】未解禁（端庄矜持；对出暗号方才解禁）',
      );
    }


    const promises = (world.promises || []).filter((p) => p && !p.done && !isBogusMarriage(p.text));
    if (promises.length > 0) {
      const items = promises
        .slice(0, 3)
        .map((p) => `第${p.due}日「${String(p.text || '').slice(0, 30)}」${day > Number(p.due) ? '（已逾期）' : '（未到期）'}`);
      lines.push(`【待兑现】${items.join('；')}`);
    }

    // 约定：约好某日某时见面，到点她会自己上门
    try {
      const nowHour = day * 24 + hour;
      // 同一人同一时刻只保留最新那条（后写的覆盖先写的），避免自相矛盾的约定堆在一起
      const raw2 = (world.appointments || []).filter((a) => a && Number(a.day) * 24 + Number(a.hour) >= nowHour);
      const latest = new Map();
      for (const a of raw2) {
        const key = `${a.day}-${a.hour}-${a.name}`;
        latest.set(key, a); // 后出现的覆盖前面的
      }
      const aps = [...latest.values()]
        .sort((a, b) => Number(a.day) * 24 + Number(a.hour) - (Number(b.day) * 24 + Number(b.hour)))
        .slice(0, 3);
      if (aps.length > 0) {
        lines.push(
          `【约定】${aps
            .map((a) => `第${a.day}日${a.hour}时 ${a.name}${a.text ? `（${a.text}）` : ''}`)
            .join('；')} —— **在场的那一位必须主动提起这件事**（"明日晌午雅阁，妾身记着呢"）。`,
        );
      }
    } catch {
      /* 忽略 */
    }

    // 势力与线索：复仇/翻案线的进度账本
    try {
      const fs2 = Object.values(world.factions || {});
      if (fs2.length > 0) {
        lines.push(`【势力】${fs2.map((f) => `${f.name} ${Number(f.relation) >= 0 ? '+' : ''}${Math.round(Number(f.relation) || 0)}`).join(' · ')}`);
      }
      const cls = (world.clues || []).slice(-4);
      if (cls.length > 0) {
        lines.push(`【线索】${cls.map((c) => String(c.text || '').slice(0, 30)).join('；')}`);
      }
    } catch {
      /* 忽略 */
    }

    // 「她与相公的约」：把当前这个角色自己的约定单独拎出来，否则她根本不会主动提
    try {
      const meId =
        roleName === '傲娇助手'
          ? 'waner'
          : Object.entries(world.actors || {}).find(([, a]) => a?.role === roleName)?.[0];
      const meActor = meId ? world.actors?.[meId] : null;
      const mine = (world.appointments || []).filter(
        (a) => a && meActor && (a.actorId === meId || a.name === meActor.name),
      );
      if (mine.length > 0) {
        lines.push(
          `【她与相公的约】${mine
            .map((a) => `第${a.day}日${a.hour}时 在${world.places?.[a.place]?.name || a.place || '老地方'}${a.text ? `（${a.text}）` : ''}`)
            .join('；')} —— 这是她自己应下的，见面时要主动提起。`,
        );
      }
    } catch {
      /* 忽略 */
    }

    // 长期记忆：不受 14 条对话窗口限制，一直跟着她
    try {
      const mems = Array.isArray(world.memories) ? world.memories.slice(-12) : [];
      if (mems.length > 0) {
        lines.push(`【旧事】${mems.map((m) => String(m.text || '').slice(0, 40)).join('；')}`);
      }
    } catch {
      /* 忽略 */
    }

    const pending = (world.pending || []).slice(0, 3);
    if (pending.length > 0) {
      const items = pending.map((p) => `第${p.due}日 ${String(p.desc || '').slice(0, 40)}`);
      lines.push(`【暗涌】${items.join('；')}`);
    }

    return lines.join('\n');
  } catch (err) {
    console.warn('[World] 状态摘要生成失败：', err.message);
    return '';
  }
}
