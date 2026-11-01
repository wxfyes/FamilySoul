/**
 * 状态摘要 —— 把世界状态压成一段给叙述层看的「天机」文字
 * 纯规则生成，不调用大模型；目标 ≤ 800 token。
 */
import { loadState, readRecentEvents, seasonCN, shichenOf, round2 } from './state.js';
import { describeScene } from './scene.js';

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
const MASTER_IDS = new Set(['waner', 'yunnia', 'yangzhenhua']);

function relationLine(actor) {
  const r = actor?.relations?.husband;
  if (!r) return actor?.name || '';
  const bits = [`信任${Math.round(r.trust ?? 0)}`, `欲望${Math.round(r.desire ?? 0)}`];
  if (Number(r.grievance) > 0) bits.push(`怨怼${Math.round(r.grievance)}`);
  return `${actor.name}（${bits.join(' ')}）`;
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

    const present = Object.values(world.actors || {})
      .filter((a) => a && a.id !== 'husband' && a.location === here && MASTER_IDS.has(a.id))
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

    const recent = readRecentEvents(dataDir, 12)
      .map(describeEvent)
      .filter(Boolean)
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

    const promises = (world.promises || []).filter((p) => p && !p.done);
    if (promises.length > 0) {
      const items = promises
        .slice(0, 3)
        .map((p) => `第${p.due}日「${String(p.text || '').slice(0, 30)}」${day > Number(p.due) ? '（已逾期）' : '（未到期）'}`);
      lines.push(`【待兑现】${items.join('；')}`);
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
