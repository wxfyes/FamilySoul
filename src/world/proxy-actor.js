/**
 * 代演 —— 真人不在线时，由一次极小的模型调用替他说一句
 *
 * 为什么单独调用：
 *   主对话里模型总把"王甯"当成玩家，不肯写他的台词。
 *   那就在他被点名时，单独给他一次机会，用他自己的记忆和立场说一句。
 *   一次只要 100~200 tokens，比反复重试便宜得多。
 */

/**
 * @param {object} p
 * @param {object} p.actor 他要演的人（世界里的 actor）
 * @param {string[]} p.memories 与他有关的旧事
 * @param {string} p.hearerName 正在跟他说话的人
 * @param {string} p.hearerPlace 所在地方
 * @param {string} p.said 对方刚说的话
 * @param {string} p.recent 最近几句对话（可选）
 * @returns {{system:string, user:string, maxTokens:number}}
 */
export function buildProxyPrompt({ actor, memories = [], facts = [], hearerName, hearerPlace, said, recent = '' }) {
  const rel = actor?.relations?.husband || {};
  const system = [
    `你现在代演「${actor?.name || '王甯'}」——${actor?.role || '临江茶坊少东家'}。他本人不在线，由你按他的记忆与立场说话。`,
    '铁律：',
    '1. 你只依据下面「事实清单」说话。清单里没有的关系、金钱、去处、承诺，你一律不知道——说不记得/不清楚，绝不许推断、绝不许编。',
    '2. 你就是他本人。别人问「王掌柜在不在」，问的就是你，不许说「他不在」。',
    '3. 只写他自己说的话，一到两句；不要旁白、不要写别人的台词、不要以他的名字开头。',
    '4. 不许提别的女人的名字（除非事实清单里有）。',
    '5. 不许用「一时恍惚」「认错人」「你与她太像」这类话搪塞。',
    memories.length ? `旧事：${memories.slice(-6).join('；')}` : '',
    facts.length ? `事实清单：${facts.slice(-10).join('；')}` : '事实清单：（空）——那你什么都不知道，只说不记得。',
  ]
    .join('\n');

  const user = [
    recent ? `刚才你们说的：\n${recent}` : '',
    `此刻在「${hearerPlace || '某处'}」。`,
    `${hearerName || '对方'}说：${said}`,
    `请以「${actor?.name || '王甯'}」的身份，直接说一到两句。`,
  ]
    .filter(Boolean)
    .join('\n');

  return { system, user, maxTokens: 220 };
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
