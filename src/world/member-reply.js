/**
 * 她那一侧的回复规范化 —— 引擎校验，不靠删句子
 *
 * 设计：
 *   1. 模型必须按「【说话人】台词」逐行输出，说话人只能取自"在场名单"；
 *   2. 引擎逐段校验：说话人不在场 / 是她本人 → 直接丢掉；
 *   3. 没有任何有效段落时，用账本事实生成一句旁白（不写任何人台词）；
 *   4. 绝不出现"她自己说话"、也绝不出现"不在场的人在说话"。
 */

/** 从回复里切出 [{speaker, text}] */
export function splitSegments(reply) {
  const text = String(reply || '');
  const parts = text.split(/(?=【[^】\n]{1,12}】)/);
  const out = [];
  for (const part of parts) {
    const m = part.match(/^【([^】\n]{1,12})】[:：]?\s*([\s\S]*)$/);
    if (m) out.push({ speaker: m[1].trim(), text: (m[2] || '').trim() });
    else if (part.trim()) out.push({ speaker: null, text: part.trim() });
  }
  return out;
}

/**
 * @param {string} reply 模型原始输出
 * @param {object} ctx { selfName, selfAliases, present: string[], husbandPresent: boolean, husbandPlace: string }
 * @returns {string} 可直接下发的文本
 */
export function normalizeMemberReply(reply, ctx) {
  const selfName = String(ctx?.selfName || '');
  const selfAliases = new Set([selfName, ...(ctx?.selfAliases || [])].filter(Boolean));
  const present = new Set((ctx?.present || []).filter(Boolean));

  const segs = splitSegments(reply);
  const kept = [];

  for (const seg of segs) {
    const body = String(seg.text || '').replace(/^[：:]\s*/, '').trim();
    if (!body || body === '……' || body === '...') continue;

    if (!seg.speaker) {
      // 无标签：当旁白，但去掉"她自己"的痕迹
      kept.push({ speaker: '旁白', text: body });
      continue;
    }

    const sp = seg.speaker;
    // 她自己说的话 → 丢掉（她由真人控制）
    if ([...selfAliases].some((n) => n && (sp === n || sp.endsWith(n) || n.endsWith(sp)))) continue;

    // 说话人必须在场
    const bare = sp.includes('·') ? sp.split('·').pop() : sp;
    const allowed = present.has(sp) || present.has(bare);
    if (!allowed) continue;

    kept.push({ speaker: bare || sp, text: body });
  }

  // 全部被丢：用账本事实兜底，不写任何人台词
  if (kept.length === 0) {
    if (ctx?.husbandPlace) {
      return `【旁白】：他此刻在「${ctx.husbandPlace}」，眼下不在这间屋里。`;
    }
    return '【旁白】：（没人应声。）';
  }

  return kept.map((s) => `【${s.speaker}】：${s.text}`).join('\n');
}
