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
  if (selfName.includes('刘文霞') || selfName.includes('紫嫣') || ctx?.actorId === 'liuwenxia') {
    selfAliases.add('紫嫣');
    selfAliases.add('刘文霞');
    selfAliases.add('文霞');
  }
  const present = new Set((ctx?.present || []).filter(Boolean));
  const placeLabel = String(ctx?.placeName || '这里');

  const segs = splitSegments(reply);
  const kept = [];

  for (const seg of segs) {
    const body = String(seg.text || '').replace(/^[：:]\s*/, '').trim();
    if (!body || body === '……' || body === '...') continue;

    if (!seg.speaker) {
      // 无标签：当旁白，但去掉"她自己"的痕迹
      const defaultSpeaker = ctx?.husbandPresent ? "王甯" : placeLabel;
      kept.push({ speaker: defaultSpeaker, text: body });
      continue;
    }

    let sp = seg.speaker;
    // 若模型把相公对她的叮嘱误标成了她自己的名字（例如把相公说的"紫嫣你在酒肆看着店，我去寻你"标成【紫嫣】）
    const isSelfSpeaker = [...selfAliases].some((n) => n && (sp === n || sp.endsWith(n) || n.endsWith(sp)));
    if (isSelfSpeaker) {
      if (ctx?.husbandPresent || /(去寻你|看着店|等我|等相公|娘子|找你|回酒肆)/.test(body)) {
        sp = '王甯'; // 智能纠正为相公王甯说话，绝不让玩家自己回复自己
      } else {
        continue; // 丢掉由真人控制的角色台词
      }
    }

    // 若其他女眷（如沈婉儿、林芸娘）冒出相公口吻称呼"叫娘子"或轻抚手等相公举动，智能纠正为相公王甯
    if (/^(沈婉儿|婉儿|林芸娘|芸娘|小翠)$/.test(sp) && /(叫娘子|唤你娘子|轻抚.*的手|为夫|耽搁些时日)/.test(body)) {
      sp = '王甯';
    }

    // 说话人必须在场
    const bare = sp.includes('·') ? sp.split('·').pop() : sp;
    const allowed = present.has(sp) || present.has(bare);
    if (!allowed) continue;

    kept.push({ speaker: bare || sp, text: body });
  }

  // 全部被丢：用账本事实兜底，不写任何人台词
  if (kept.length === 0) {
    if (ctx?.askedHusband && ctx?.husbandPlace) {
      return `（王甯此刻人在「${ctx.husbandPlace}」，眼下并不在跟前。）`;
    }
    return `（四下清静，一时无人接话。）`;
  }

  return kept.map((s) => `【${s.speaker}】：${s.text}`).join('\n');
}
