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
  const placeLabel = String(ctx?.placeName || '这里');

  const segs = splitSegments(reply);
  const kept = [];

  for (const seg of segs) {
    const body = String(seg.text || '').replace(/^[：:]\s*/, '').trim();
    if (!body || body === '……' || body === '...') continue;

    if (!seg.speaker) {
      // 无标签：当旁白，但去掉"她自己"的痕迹
      kept.push({ speaker: placeLabel, text: body });
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
  // 他明明在场、玩家又点名找他，模型却没写他 → 至少用旁白点明他在
  if (ctx?.husbandPresent && ctx?.askedHusband) {
    const spoken = kept.some((x) => /王甯|相公|王掌柜|少掌柜/.test(String(x.speaker || '')));
    if (!spoken) kept.push({ speaker: placeLabel, text: '（王甯就在这屋里，只是没急着开口。）' });
  }

  if (kept.length === 0) {
    if (ctx?.askedHusband && ctx?.husbandPlace) {
      return `【${placeLabel}】：他此刻在「${ctx.husbandPlace}」，眼下不在这屋里。`;
    }
    return `【${placeLabel}】：（屋里一时没人应声。）`;
  }

  return kept.map((s) => `【${s.speaker}】：${s.text}`).join('\n');
}
