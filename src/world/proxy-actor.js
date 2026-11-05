/**
 * 代演 —— 真人不在场或在场 NPC 需接话时，由一次极小的模型调用替他说一句。
 *
 * 【本文件的铁律】
 * 代演的人设一律由「他与眼前这个人是什么关系」推出来，绝不按角色名硬写死。
 * 同一个于子归：
 *   面对自己媳妇  → 糙汉疼媳妇、动手动脚
 *   面对来求职的  → 工头掌柜，问力气、谈工钱
 *   面对不相干的  → 市井汉子，粗声粗气就事论事
 * 关系来源只有一个：actor.spouse / actor.relations / actor.lovers。
 */

/** 他与听者的关系（唯一出处） */
export function relationOf(actor, hearer) {
  if (!actor || !hearer) return 'outsider';
  const hid = String(hearer.id || '');
  if (!hid) return 'outsider';
  if (actor.spouse && String(actor.spouse) === hid) return 'spouse';
  if (Array.isArray(actor.lovers) && actor.lovers.includes(hid)) return 'lover';
  const rel = actor.relations?.[hid] || {};
  if (rel.lover || rel.intimacy === 'lover') return 'lover';
  if (Number(rel.desire) >= 70 && Number(rel.trust) >= 60) return 'lover';
  if (actor.id === 'husband' && hearer.household) return 'household';
  if (actor.household && hearer.id === 'husband') return 'household';
  if (actor.household && hearer.household) return 'household';
  return 'outsider';
}

/** 说话人的行当气质（按身份类别，不按姓名） */
function flavorOf(actor) {
  const text = `${actor?.role || ''} ${actor?.name || ''}`;
  if (/工头|营造|泥瓦|木匠|力工/.test(text)) return 'rough';
  if (/书办|书吏|衙役|吏|先生|夫子/.test(text)) return 'scholar';
  if (/东家|掌柜|少东家|商人|客商/.test(text)) return 'merchant';
  if (/婆|婶|娘|嫂|丫鬟|绣/.test(text)) return 'woman';
  return 'townsfolk';
}

/**
 * @param {object} p
 * @param {object} p.actor 他要演的人（世界里的 actor）
 * @param {object} [p.hearer] 正在跟他说话的人（actor）
 * @param {string[]} p.memories 与他有关的旧事
 * @param {string[]} p.facts 事实清单
 * @param {string} p.hearerName 正在跟他说话的人
 * @param {string} p.hearerPlace 所在地方
 * @param {string} p.said 对方刚说的话
 * @param {string} p.recent 最近几句对话（可选）
 * @returns {{system:string, user:string, maxTokens:number}}
 */
export function buildProxyPrompt({ actor, hearer = null, memories = [], facts = [], hearerName, hearerPlace, said, recent = '' }) {
  const actorName = actor?.name || '王甯';
  const relation = relationOf(actor, hearer);
  const intimate = relation === 'spouse' || relation === 'lover';
  const flavor = flavorOf(actor);
  const who = hearer?.name || hearerName || '对方';

  const lines = [];
  lines.push(`你现在代演「${actorName}」——${actor?.role || '城中人'}。他本人不在线，由你按他的立场说话。`);

  // ① 关系铁律：这是本轮最要紧的一条，写在最前面
  if (intimate) {
    lines.push(`【眼前这个人】：${who}，是他的${relation === 'spouse' ? '结发之人' : '相好'}。可以有关起门来的亲近与疼惜，但要像活人，不要写成荤段子。`);
  } else {
    lines.push(`【眼前这个人】：${who}，**与他没有婚配、不是他的相好，只是个外人**。`);
    lines.push('绝不可称对方"媳妇/娘子/宝贝"，绝不可动手动脚、揽腰拉手，绝不可说"想你了"这类私房话。');
  }

  // ② 行当气质
  if (flavor === 'rough') {
    lines.push(intimate
      ? '你是营造行的大工头，手上几十号兄弟，嗓门大、力气足；对着自家媳妇会粗声粗气地疼人，会拍胸脯把难处揽下来。'
      : '你是营造行的大工头、酒肆的男掌柜：嗓门大、手脚快、就事论事。来求职的，先看他身板力气、问会什么手艺、谈工钱与吃住；来吃酒的，吆喝一声上酒上菜。');
  } else if (flavor === 'scholar') {
    lines.push(intimate
      ? '你在衙门当差，人前谨饬寡言，回到房里对自家人才有几分软话。'
      : '你在衙门当差，说话谨慎、按规矩来；对外人客客气气，不逾矩。');
  } else if (flavor === 'merchant') {
    lines.push(intimate
      ? '你是做买卖的人，对自家妻室温和体贴，账目上的事也肯与她商量。'
      : '你是做买卖的人：先问客人要什么、多少价、几时交货；客气、精明、不卑不亢。');
  } else if (flavor === 'woman') {
    lines.push(intimate
      ? '你与对方是自家人，说话亲热随意，会念叨柴米、会护短。'
      : '你是市井里的妇人，说话有分寸；对着生客，只答该答的，不热络也不失礼。');
  } else {
    lines.push(intimate
      ? '你与对方是自家人，说话随意亲切，会顾着对方冷暖。'
      : '你是江南市井里活生生的人，有自己的营生与盘算；对生客客气但保持距离。');
  }

  // ③ 通用铁律
  lines.push('铁律：');
  lines.push('1. 只依据下面「事实清单」说话；清单里没有的关系、银钱、去处、承诺，一律不知道，不许编。');
  lines.push('2. 先正面回应对方这句话，再按自己的本分推进一步（招工就谈差事工钱，买卖就谈货价，闲话就接闲话）。');
  lines.push('3. 不许复读陈年旧事；不许替对方说话；不许写旁白。');
  lines.push('4. 只写他自己说的话，一到两句；不要以名字开头。');

  const system = [
    ...lines,
    memories.length ? `旧事记忆：${memories.slice(-4).join('；')}` : '',
    facts.length ? `事实清单：${facts.slice(-6).join('；')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const user = [
    recent ? `刚才你们说的：\n${recent}` : '',
    `此刻在「${hearerPlace || '铺子里'}」。`,
    `${who}说：${said}`,
    intimate
      ? '（就眼前这句话接下去；亲近要像过日子的人，不要写成露骨荤话。）'
      : '（就眼前这句话正面回应；你是他的行当身份，不是他媳妇的丈夫。）',
    `请以「${actorName}」的身份，直接说一到两句。`,
  ]
    .filter(Boolean)
    .join('\n');

  return { system, user, maxTokens: 240 };
}

/** 把代演出来的句子包成台词；失败返回 null */
export function wrapProxyLine(name, raw) {
  let t = String(raw || '').trim();
  if (!t) return null;
  // 去掉模型可能自带的名字前缀 / 引号 / 旁白
  t = t.replace(/^(旁白|解说)[:：]\s*/, '').replace(/^【[^】]*】\s*/, '');
  t = t.replace(new RegExp(`^${String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:：]?\\s*`), '');
  t = t.replace(/^["'“”「」]+|["'“”「」]+$/g, '');
  t = t.split('\n')[0].trim();
  if (!t) return null;
  return `【${name}】：${t}`;
}
