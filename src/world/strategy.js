/**
 * 天下推演：势力在没有真人指挥时，也会自己动。
 *
 * 两种驱动并存：
 *   ① 有天道（LLM）时——每 7 个世界日问一次"天下大势该怎么走"，它给决策
 *   ② 没有 LLM 或调用失败——用规则推演：兵多粮足者扩张，弱者守成
 *
 * 铁律：天道只给"决策"，引擎负责校验与执行（兵不够就不打，粮不够就散）。
 * 任何决策都不允许直接改数字，必须走 warfare.js 的门。
 */

import { factionOf, factionSilver, factionStrength } from './factions.js';
import { recruit, besiege, bribeCity, buyGrain } from './warfare.js';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** 无 LLM 时的规则推演：强者扩张、弱者囤粮 */
export function npcStrategyTurn(world, events, sink) {
  const results = [];
  const factions = Object.values(world.factions || {}).filter(
    (f) => f && f.kind !== 'player' && num(f.troops) > 0,
  );

  for (const f of factions) {
    const strength = factionStrength(world, f);
    if (strength <= 0) continue;

    // 粮不够先囤粮，别打
    if (num(f.grain) < num(f.troops) * 0.5) {
      const r = buyGrain(world, f.id, Math.max(10, Math.round(num(f.troops) * 0.3)));
      if (r.ok) results.push(`${f.name}购粮 ${r.grain} 石`);
      continue;
    }

    // 野心够、兵够，就找一座最弱的、不属于自己的城
    const ambition = num(f.ambition) || 30;
    if (Math.random() * 100 > ambition) continue;

    const targets = Object.entries(world.cities || {})
      .filter(([, ct]) => ct && String(ct.owner || 'court') !== f.id)
      .sort((a, b) => num(a[1].defense) - num(b[1].defense));
    const target = targets[0];
    if (!target) continue;

    const [cityName] = target;
    // 只派一半兵出去，留一半守家
    const send = Math.max(1, Math.round(num(f.troops) * 0.5));
    if (factionStrength(world, f) < num(target[1].defense) * 0.8) continue;

    const r = besiege(world, { attacker: f.id, cityName, troops: send });
    if (r.ok) {
      results.push(r.text);
      if (sink) sink(world, { action: r.win ? 'city_taken' : 'siege_failed', actor: f.leader, place: cityName, payload: { text: r.text } });
    }
  }
  return results;
}

/** 给天道的推演材料：只给事实，不给结论 */
export function buildStrategyPrompt(world) {
  const factions = Object.values(world.factions || {}).map((f) => ({
    id: f.id,
    name: f.name,
    leader: f.leader,
    troops: num(f.troops),
    grain: num(f.grain),
    silver: Math.round(factionSilver(world, f)),
    morale: num(f.morale),
    ambition: num(f.ambition),
    cities: (f.cities || []).slice(0, 8),
    stance: f.stance,
  }));

  const cities = Object.entries(world.cities || {}).map(([name, ct]) => ({
    name,
    owner: String(ct.owner || 'court'),
    defense: num(ct.defense),
    unrest: num(ct.unrest),
    wealth: num(ct.wealth),
  }));

  const system = [
    '你是这个世界的天道，负责推演天下大势。',
    '只输出 JSON 数组，不要解释。每个元素形如：',
    '{"faction":"势力id","action":"recruit|buy_grain|besiege|bribe|fortify|hold","target":"城名或空","amount":数字,"reason":"一句话理由"}',
    '规则：',
    '1. 只能给出现有势力与现有城；不要编造。',
    '2. 兵不够、粮不够时，不许让他们打仗——你可以让他们囤粮、募兵或按兵不动。',
    '3. 势力的野心（ambition）与士气（morale）决定他们敢不敢动。',
    '4. 一次最多 6 条决策，宁少勿滥。',
    '5. 不许安排任何"必然胜利"的结局。',
  ].join('\n');

  const user = [
    `【天下】【第${world.clock?.day}日】`,
    '势力：',
    ...factions.map((f) => `- ${f.id}｜${f.name}｜兵${f.troops}｜粮${f.grain}石｜银${f.silver}｜士气${f.morale}｜野心${f.ambition}｜城${f.cities.length}座`),
    '城池（名称｜归属｜城防｜民心｜富庶）：',
    ...cities.slice(0, 60).map((c) => `- ${c.name}｜${c.owner}｜${c.defense}｜${c.unrest}｜${c.wealth}`),
    '',
    '请给出这一轮天下大势的决策（JSON 数组）。',
  ].join('\n');

  return { system, user };
}

/** 解析并执行天道给的决策：每一条都要过 warfare 的门 */
export function applyStrategyDecisions(world, decisions, sink) {
  const applied = [];
  const list = Array.isArray(decisions) ? decisions.slice(0, 6) : [];
  for (const d of list) {
    if (!d || typeof d !== 'object') continue;
    const fid = String(d.faction || '');
    const f = factionOf(world, fid);
    if (!f) continue;
    const action = String(d.action || 'hold');
    const target = String(d.target || '');
    const amount = Math.max(1, Math.min(500, Math.round(num(d.amount) || 50)));

    let r = null;
    if (action === 'recruit') r = recruit(world, fid, amount);
    else if (action === 'buy_grain') r = buyGrain(world, fid, Math.max(10, amount));
    else if (action === 'besiege') r = besiege(world, { attacker: fid, cityName: target, troops: amount });
    else if (action === 'bribe') r = bribeCity(world, fid, target, amount);
    else if (action === 'fortify') r = { ok: false, error: '暂未开放' };
    else continue;

    if (r && r.ok) {
      const text = r.text || `${f.name}${action}完成`;
      applied.push(text);
      if (sink) sink(world, { action: 'faction_act', actor: f.leader, place: target || null, payload: { text } });
    }
  }
  return applied;
}
