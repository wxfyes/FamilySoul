/**
 * 事件 → 给人看的时间线
 *
 * 事件流里存的是机器可读的 action（ritual_finish / spawn / move …），
 * 界面上直接显示这些词就等于把日志怼到脸上。
 * 这里统一做三件事，别处不再各写一套：
 *   ① 把 action 翻成人话（带上人名与地点）
 *   ② 同一时刻同一件事的多条记录合并成一条（并注明次数）
 *   ③ 输出按时间倒序，供时间线直接渲染
 */

const LABELS = {
  move: '移步',
  npc_home: '归家',
  spawn: '新面孔',
  ritual_unlock: '解禁',
  ritual_finish: '温存归位',
  ritual_start: '亲近',
  marriage: '成婚',
  birth: '添丁',
  death: '亡故',
  income: '进账',
  expense: '开销',
  judged: '判案',
  case_filed: '报案',
  decree: '圣旨',
  rumor: '风闻',
  released: '出狱',
  jailed: '收监',
  bond: '结缘',
  break: '反目',
  custom: '世事',
};

function nameOf(world, id) {
  if (!id) return '';
  return world?.actors?.[id]?.name || (id === 'husband' ? '相公' : '');
}

function placeOf(world, id) {
  if (!id) return '';
  return world?.places?.[id]?.name || '';
}

export function eventText(world, e) {
  if (!e) return '';
  if (e.payload?.text) return String(e.payload.text);
  const label = LABELS[e.action] || String(e.action || '世事');
  const who = nameOf(world, e.payload?.actorId) || nameOf(world, e.actor) || '';
  const where = placeOf(world, e.place);
  const bits = [label];
  if (who) bits.push(who);
  if (where && e.action === 'move') bits.push(`去${where}`);
  else if (e.payload?.name) bits.push(e.payload.name);
  else if (e.payload?.role) bits.push(`（${e.payload.role}）`);
  return bits.join('·');
}

/** 合并同一时刻同一件事，输出倒序时间线 */
export function buildTimeline(world, events, limit = 12) {
  const merged = [];
  for (const e of events || []) {
    if (!e) continue;
    const key = `${e.day}|${e.hour}|${e.action}|${e.actor}|${e.payload?.actorId || ''}`;
    const last = merged[merged.length - 1];
    if (last && last.key === key) {
      last.count += 1;
      continue;
    }
    merged.push({
      key,
      day: e.day,
      hour: e.hour,
      action: e.action,
      text: eventText(world, e),
      count: 1,
    });
  }
  return merged
    .slice(-limit)
    .reverse()
    .map((x) => ({ ...x, text: x.count > 1 ? `${x.text}（×${x.count}）` : x.text }));
}
