/**
 * 世界账本体检 —— 纯代码，零 LLM 调用，零 token
 *
 * 只回答一个问题：账本本身有没有坏（越界、失效、堆积、非法数值）。
 * 不判断剧情好坏，也不判断模型说得对不对。
 */

function walkNumbers(obj, pathStr, out, depth = 0) {
  if (depth > 8 || obj === null || obj === undefined) return;
  if (typeof obj === 'number') {
    if (!Number.isFinite(obj)) out.push(`非法数值 ${pathStr} = ${obj}`);
    return;
  }
  if (typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) walkNumbers(v, `${pathStr}.${k}`, out, depth + 1);
}

/**
 * @param {object} world loadState 出来的世界对象
 * @returns {string[]} 问题清单（空数组 = 健康）
 */
export function auditWorld(world) {
  const issues = [];
  if (!world || typeof world !== 'object') return ['世界对象缺失'];

  // 资产
  if (!(Number(world.assets?.silver) >= 0)) issues.push(`现银非法: ${world.assets?.silver}`);
  for (const p of world.assets?.properties || []) {
    if (!(Number(p?.incomePerDay) >= 0)) issues.push(`产业收入非法: ${p?.name}=${p?.incomePerDay}`);
  }

  // 人物
  for (const a of Object.values(world.actors || {})) {
    if (!a) continue;
    const rel = a.relations?.husband;
    if (rel) {
      for (const f of ['trust', 'desire', 'fear', 'grievance']) {
        const v = rel[f];
        if (typeof v === 'number' && (v < 0 || v > 100)) issues.push(`关系越界: ${a.name}.${f}=${v}`);
      }
    }
    if (a.location && !world.places?.[a.location]) issues.push(`位置失效: ${a.name}@${a.location}`);
  }

  // 堆积
  const cap = (arr, n, label) => {
    if (Array.isArray(arr) && arr.length > n) issues.push(`${label}堆积 ${arr.length} 条`);
  };
  cap(world.pending, 8, '暗涌');
  cap(world.proactive, 8, '推送');
  cap(world.memories, 120, '记忆');
  cap(world.clues, 60, '线索');
  cap(world.appointments, 20, '约定');

  // 地点重名
  const names = Object.values(world.places || {}).map((p) => p?.name);
  if (new Set(names).size !== names.length) issues.push('存在重名地点');

  // 约定是否已经过期还没触发
  const nowHour = (Number(world.clock?.day) || 1) * 24 + (Number(world.clock?.hour) || 0);
  const overdue = (world.appointments || []).filter((a) => Number(a?.day) * 24 + Number(a?.hour) < nowHour - 24);
  if (overdue.length > 0) issues.push(`有 ${overdue.length} 条约定过期未触发`);

  // 全量数字健康
  walkNumbers(world, 'world', issues);

  return [...new Set(issues)];
}
