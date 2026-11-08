/**
 * 天道行止调度：让大模型定期替「有名有姓的人」决定去哪。
 *
 * 代码只负责挑人、给事实、执行 [[go]]；目的地由模型定。
 * 不按钟点硬编地点，也不替模型做决定。
 */

import { loadState, saveState } from '../world/state.js';
import { isHumanBound } from '../world/position.js';
import { applyGoTags } from './narrative-engine.js';

const LIMIT = 6;

function wantedActors(world) {
  const out = [];
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || a.id === 'husband') continue;
    if (isHumanBound(a)) continue;
    if (a.origin === 'city_base') continue;
    const isStaffInHall = /家丁|护院/.test(String(a.role || '')) && /议事厅/.test(String(world.places?.[a.location]?.name || ''));
    if (!(a.household || (Array.isArray(a.goals) && a.goals.length > 0) || isStaffInHall)) continue;
    // 只在临江（相公所在城）的人参与，避免跨城调度
    const city = String(world.places?.[a.location]?.name || '').split('·')[0];
    if (city && city !== '临江') continue;
    out.push(a);
  }
  return out.slice(0, LIMIT);
}

function placeChoices(world) {
  const names = [];
  for (const p of Object.values(world.places || {})) {
    const n = String(p?.name || '');
    if (!n) continue;
    if (!/王宅|茶坊|酒楼|花园|账房|议事厅|书房|西厢|东厢|祠堂|厨房|正房|大门|门房|外院/.test(n)) continue;
    if (!names.includes(n)) names.push(n);
  }
  return names.slice(0, 24);
}

/**
 * 让天道安排一次行止。
 * @param {object} svc pet-service 实例（用 llmClient / dataDir）
 * @param {{force?: boolean}} opts force=true 时忽略「本时段已安排过」
 * @returns {Promise<Array<{id,name,to,toName}>>}
 */
export async function planNamedNpcMoves(svc, { force = false } = {}) {
  try {
    if (!svc?.llmClient?.isReady?.()) return [];
    const world = loadState(svc.dataDir);
    const day = Number(world.clock?.day) || 1;
    const hour = Number(world.clock?.hour) || 0;
    const stamp = `${day}:${hour}`;
    if (!force && world.flags?.lastPlanStamp === stamp) return [];

    const roster = wantedActors(world);
    if (roster.length === 0) return [];
    const places = placeChoices(world);
    const facts = roster.map((a) => ({
      姓名: a.name,
      身份: a.role || '',
      此刻: String(world.places?.[a.location]?.name || ''),
      心事: Array.isArray(a.goals) ? a.goals.slice(0, 3) : [],
    }));

    const system = [
      '你是这个世界的天道，不是任何角色。',
      '根据时辰与各人的心事、差事，决定她们此刻该去哪。',
      '只输出行，每行一个：[[go:姓名|地点名]]。地点必须从「可用地点」里原样选。',
      '不想动的人不要写；不要解释，不要台词，不要输出别的内容。',
    ].join('\n');
    const user = `第${day}日${hour}时。\n人物：${JSON.stringify(facts)}\n可用地点：${JSON.stringify(places)}`;

    const res = await svc.llmClient.complete({
      system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 200,
      temperature: 0.6,
    });
    const raw = String(res?.text || '');
    if (!/\[\[go:/.test(raw)) {
      // 模型选择都不动，也记一笔，避免同小时反复问
      const w2 = loadState(svc.dataDir);
      w2.flags = w2.flags || {};
      w2.flags.lastPlanStamp = stamp;
      saveState(svc.dataDir, w2);
      return [];
    }

    const { moved } = applyGoTags(svc.dataDir, raw);
    const w3 = loadState(svc.dataDir);
    w3.flags = w3.flags || {};
    w3.flags.lastPlanStamp = stamp;
    saveState(svc.dataDir, w3);
    if (moved.length > 0) console.log(`[Plan] 天道安排行止：${moved.map((m) => `${m.name}→${m.toName}`).join('，')}`);
    return moved;
  } catch (err) {
    console.warn('[Plan] 行止调度失败：', err.message);
    return [];
  }
}
