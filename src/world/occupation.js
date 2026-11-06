/**
 * 身份与营生：标签跟着日子走，不是出生就定死。
 *
 * 规矩：
 *   ① 标签从"他此刻在做什么、手里有什么"推出来，不写死；
 *   ② 今天摆摊就是摊贩，明天盘下铺子就是掌柜，产业多了就是东家；
 *   ③ 只改标签，不改人——账、位子、关系都不动。
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** 他手里有哪些产业（自己的 or 他当掌柜的） */
export function propertiesOf(world, actorId) {
  const list = Array.isArray(world?.assets?.properties) ? world.assets.properties : [];
  return list.filter((p) => p && (String(p.owner || '') === String(actorId) || String(p.keeper || '') === String(actorId)));
}

/** 产业的通称：酒楼/茶坊/铺子/货栈…… */
function tradeName(p) {
  const n = String(p?.name || '');
  if (/酒楼|酒肆|饭庄/.test(n)) return '酒楼';
  if (/茶坊|茶肆|茶楼|茶栈/.test(n)) return '茶坊';
  if (/货栈|码头|栈/.test(n)) return '货栈';
  if (/铺|店|号|行|坊/.test(n)) return '铺子';
  return '产业';
}

/**
 * 推他此刻的身份标签
 * @returns {string}
 */
export function deriveTitle(world, actor) {
  if (!actor) return '';
  const id = String(actor.id || '');
  const props = propertiesOf(world, id);

  // 有产业：东家（多业）或按行当称掌柜
  if (props.length >= 3) return '东家';
  if (props.length === 2) {
    const kinds = [...new Set(props.map(tradeName))].slice(0, 2);
    return `${kinds.join('·')}东家`;
  }
  if (props.length === 1) {
    const p = props[0];
    if (String(p.keeper || '') === id && String(p.owner || '') !== id) return '掌柜';
    return `${tradeName(p)}东家`;
  }

  // 摆摊的
  if (actor.stall) return '摊贩';

  // 当差的
  if (actor.duty?.post === 'gate') return '门房';

  // 官身
  if (actor.office) return String(actor.office);

  // 已有的固定身份（NPC 生成时带的）
  const role = String(actor.role || '').trim();
  if (role && role !== '布衣') return role;

  // 实在没有：布衣
  return '布衣';
}

/**
 * 刷新所有人的标签
 * @returns {number} 改了几个
 */
export function refreshTitles(world) {
  let changed = 0;
  for (const a of Object.values(world?.actors || {})) {
    if (!a || a.dead) continue;
    const next = deriveTitle(world, a);
    if (!next) continue;
    if (a.title !== next) {
      a.title = next;
      changed += 1;
    }
    // 玩家与摆摊的，role 始终跟着营生走；老 NPC 的 role 保留（可能是"账房先生"这种细称）
    const syncRole = String(a.id).startsWith('usr_') || a.id === 'husband' || Boolean(a.stall);
    if (syncRole && a.role !== next) {
      a.role = next;
      changed += 1;
    }
  }
  return changed;
}

/** 说话人标签用这个（优先 title，其次 role，再兜底布衣） */
export function titleOf(world, actor) {
  if (!actor) return '布衣';
  return String(actor.title || '').trim() || String(actor.role || '').trim() || '布衣';
}
