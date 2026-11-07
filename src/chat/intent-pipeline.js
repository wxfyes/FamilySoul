/**
 * 意图动作层（Step 4a：先抽"纯解析 + 只读候选"，不执行位移）
 *
 * 军规：
 *   ① 本文件**不写世界**：不 import loadState/saveState/moveActor，不碰 fs；
 *   ② 只做两件事：从台词里解析"要传唤谁"，从世界里挑出"最可能是谁"；
 *   ③ 真正的位移仍然由 pet-service.js 统一调 moveActor()（单一权威写入口）；
 *   ④ 依赖单向：chat/* ← pet-service.js。
 */

const NOT_A_NAME = /^(你|你们|都|大伙|大家|全)$/;

/**
 * 解析"相公要叫谁过来"。
 * 覆盖：
 *   - "叫芸娘来 / 让婉儿过来 / 传小翠来伺候"
 *   - "叫来吧 / 叫她来 / 快叫来 / 催催"（承接上一轮呼唤的名字）
 * @param {string} rawText 相公这一轮的原始输入
 * @param {Array<{role:string,text:string}>} recentMessages 最近历史（最多取末尾 4 条）
 * @returns {string|null} 目标名字（未归一），没解析到返回 null
 */
export function parseSummonTarget(rawText, recentMessages = []) {
  const text = String(rawText || '');
  const say = text.trim();
  let targetName = null;

  const m1 = /(?:让|叫|命|请|唤|打发|派人叫|把)?\s*([^去回到往先来叫让请过\s]{1,4})\s*(?:叫|请|唤)?\s*(?:过来|过来吧|来|来吧|来一趟|来一下|来正房|到这来|到这里|到跟前|来伺候)/.exec(say);
  const m2 = /(?:叫|唤|请|传)\s*([^去回到往先来叫让请过\s]{1,4})\s*(?:来吧|过来|到跟前来)/.exec(say);
  if (m1 && !NOT_A_NAME.test(m1[1])) targetName = m1[1];
  else if (m2 && !NOT_A_NAME.test(m2[1])) targetName = m2[1];

  // 承接上一轮：若相公说"叫来吧/叫她来/快叫来/催催"，回溯上一轮相公呼唤的名字
  if (!targetName && /^(?:叫|唤|请|传)?\s*(?:来吧|叫来吧|叫她来吧|唤她来|快叫来|快唤来|催催|那就叫来|快去叫)[。！!~…\s]*$/.test(say)) {
    const hist = Array.isArray(recentMessages) ? recentMessages.slice(-4) : [];
    const prevUserMsg = hist.reverse().find((m) => m.role === 'user' && m.text !== text)?.text || '';
    const mPrev = /(?:让|叫|命|请|唤|打发|把)?\s*([^去回到往先来叫让请过\s]{1,4})\s*(?:叫|请|唤)?\s*(?:过来|过来吧|来|来吧|来一趟|来一下|来正房|到这来|到这里|到跟前|来伺候)/.exec(prevUserMsg);
    if (mPrev && !/^(你|你们|都|大伙)$/.test(mPrev[1])) targetName = mPrev[1];
  }

  return targetName;
}

/**
 * 按名字从世界人物里挑最可能被传唤的那一个（只读）。
 * 优先级：名字精确 > 以目标结尾 > 包含；同分时府内内眷优先。
 * @param {object} world 世界状态（只读）
 * @param {string|null} targetName parseSummonTarget 的结果
 * @param {string} selfId 相公/当前账号的 actor id
 * @returns {object|null}
 */
export function pickSummonActor(world, targetName, selfId = 'husband') {
  if (!targetName) return null;
  const cands = Object.values(world?.actors || {}).filter((a) => {
    if (!a || a.dead || a.id === selfId) return false;
    if (a.name === targetName) return true;
    if (targetName.length >= 2 && (a.name.endsWith(targetName) || a.name.includes(targetName))) return true;
    if (targetName.length === 1 && a.name.includes(targetName)) return true;
    return false;
  });
  if (!cands.length) return null;
  cands.sort((x, y) => {
    const xInMansion = (x.location && x.location.startsWith('wang_mansion_')) || x.household ? 2 : 0;
    const yInMansion = (y.location && y.location.startsWith('wang_mansion_')) || y.household ? 2 : 0;
    return yInMansion - xInMansion;
  });
  return cands[0];
}
