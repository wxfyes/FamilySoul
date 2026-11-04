/**
 * 代演 —— 真人不在场或在场 NPC 需接话时，由一次极小的模型调用替他说一句
 */

/**
 * @param {object} p
 * @param {object} p.actor 他要演的人（世界里的 actor）
 * @param {string[]} p.memories 与他有关的旧事
 * @param {string[]} p.facts 事实清单
 * @param {string} p.hearerName 正在跟他说话的人
 * @param {string} p.hearerPlace 所在地方
 * @param {string} p.said 对方刚说的话
 * @param {string} p.recent 最近几句对话（可选）
 * @returns {{system:string, user:string, maxTokens:number}}
 */
export function buildProxyPrompt({ actor, memories = [], facts = [], hearerName, hearerPlace, said, recent = '' }) {
  const actorName = actor?.name || '王甯';
  const isYuZiGui = actorName === '于子归' || actor?.id === 'npc_2' || /于子归|于工头/.test(actorName);
  const isHusband = actor?.id === 'husband' || actorName === '王甯';

  let roleInstructions = [];

  if (isYuZiGui) {
    // ══════ 【于子归·营造行工头·正牌糙汉丈夫人设】 ══════
    roleInstructions = [
      `你现在代演「于子归」——营造行工头、紫嫣（${hearerName || '酒肆老板娘'}）明媒正娶的合法正牌丈夫！`,
      '【核心夫妻人设与性情铁律】：',
      '1. 你是紫嫣明媒正娶的男人！深爱自己的美貌娇妻，常年在工地上打拼、身强力壮、血气方刚，自知冷落了妻子，心里又爱又愧又馋！',
      '2. 面对自家娇妻撒娇、抱怨、求欢、说难受、说怀孕，你是个顶天立地的血性真汉子，必须展现出十足的夫妻调情趣味与心疼体贴！',
      '3. 称呼唤她「媳妇」、「紫嫣」、「小心肝」；面对妻子的调情求欢（如脱衣服、做爱、伺候她、身子难受），你必须立刻猴急又心疼地迎上去，满嘴粗野热辣的真情实意（“媳妇，老子想死你了”、“看为夫今天怎么伺候你舒坦”、“我的心肝肉”），绝不许当性冷淡木头！',
      '4. 绝对严禁在夫妻私房温存求欢时，翻来覆去念叨什么「街心黑洞/工地塌方」！妻子要你伺候，你的眼里就只有你媳妇！',
      '5. 只写于子归自己说的话，一到两句；不要旁白、不要写别人的台词、不要以名字开头。',
    ];
  } else if (isHusband) {
    // ══════ 【王甯·茶坊少东家·相公人设】 ══════
    roleInstructions = [
      `你现在代演「王甯」——临江茶坊少东家。他本人不在线，由你按他的记忆与立场说话。`,
      '铁律：',
      '1. 你只依据下面「事实清单」说话。清单里没有的关系、金钱、去处、承诺，你一律不知道——说不记得/不清楚，绝不许推断、绝不许编。',
      '2. 你就是他本人。别人问「王掌柜在不在」，问的就是你，不许说「他不在」。',
      '3. 只写他自己说的话，一到两句；不要旁白、不要写别人的台词、不要以他的名字开头。',
      '4. 不许提别的女人的名字（除非事实清单里有）。',
      '5. 不许用「一时恍惚」「认错人」「你与她太像」这类话搪塞。',
      '6. 若对方是紫嫣，你与她是相好（她是于家酒肆老板娘），亲近唤她「紫嫣」或「文霞」，若怀有你的骨肉必须深情体贴认下。',
      '7. 她是你相好，不是外人：语气要带温度——可以心疼、可以调侃、可以说软话。钱的事认真归认真，但不许冷冰冰像账房先生。',
    ];
  } else {
    // ══════ 【其他通用 NPC】 ══════
    roleInstructions = [
      `你现在代演「${actorName}」——身份：${actor?.role || '城中人'}。`,
      '铁律：',
      '1. 你就是他/她本人，立足自己的本分、生计与性格说话，语言自然生动，绝不念稿。',
      '2. 只写他/她自己说的话，一到两句；不要旁白、不要写别人的台词、不要以名字开头。',
      '3. 面对对方的话，先正面回应；若有夫妻名分或熟人关系，语气务必亲近自然。',
    ];
  }

  const system = [
    ...roleInstructions,
    memories.length ? `旧事记忆：${memories.slice(-4).join('；')}` : '',
    facts.length ? `事实清单：${facts.slice(-6).join('；')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const user = [
    recent ? `刚才你们说的：\n${recent}` : '',
    `此刻在「${hearerPlace || '铺子里'}」。`,
    `${hearerName || '对方'}说：${said}`,
    isYuZiGui
      ? '（媳妇正在跟你说话，若是求欢撒娇或要你伺候，拿出当家汉子的热辣劲儿与心疼宠溺，立刻回应伺候她！）'
      : '（先正面回应对方这句话；保持人物生动口吻，绝不念套话。）',
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
