/**
 * 意图动作层（Step 4：纯解析 + 只读候选，不执行位移）
 *
 * 军规：
 *   ① 本文件**不写世界**：不 import loadState/saveState/moveActor，不碰 fs；
 *   ② 只做解析：传唤谁、打发谁走/是否全员清场、默认回哪间屋、[[pay:...]] 报价；
 *   ③ 真正的位移/扣款仍由 pet-service.js 统一执行（moveActor / 记账唯一入口）；
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

/**
 * 解析"打发人走 / 送客"的台词（只解析，不移动）。
 * @param {string} sayText 相公原始台词
 * @returns {{isDismiss:boolean, targetName:string|null, targetWhere:string|null}}
 */
export function parseDismissIntent(sayText) {
  const say = String(sayText || '').trim();
  const isDismiss =
    /(?:让|叫|命|打发|请)?\s*([^去回到往先\s]{1,4})\s*(?:先)?\s*(?:去|回|到|往)\s*(回家|回去|回房|回屋|回府|回铺子|去铺子|回院子|出去|退下|房间|厢房|东厢|西厢|屋里|歇着|等我|候着|睡觉|[\u4e00-\u9fa5]{2,6})/.test(say)
    || /(?:让|叫|命|打发|请)?\s*([^去回到往先\s]{1,4})\s*(?:先)?\s*(回家|回去|回房|回屋|回府|回铺子|回院子|出去|退下|退出去|走吧|回房间|去睡)/.test(say)
    || /^(?:你|你们|都|先)?\s*(?:走|回去吧|回吧|退下|下去|散了|去吧|出门吧|慢走|送客|睡吧|安歇吧)[。！!~…\s]*$/.test(say)
    || /送客|你回吧|你走吧|退下吧|都散了吧|各自回房|都回屋|各自回|回房间睡觉|回屋睡|去睡吧|回房睡|都走吧/.test(say)
    || /(?:怎么|为何)?还不(?:走|退|回去|回房|歇|动身|出去)/.test(say)
    || /都[^。]{0,6}(出去|退下|散了|退出去|回去|回房|睡觉|走)/.test(say);

  let targetName = null;
  let targetWhere = null;

  // 1. 优先捕获质问催促（如："芸娘怎么还不走？"、"小翠怎么还不走"、"芸娘还不回去"）
  const mUrge = /(?:让|叫)?\s*([^去回到往先怎么为何\s，,。？！!?]{1,4})\s*(?:怎么|为何|怎么还|为何还)?还不(?:走|退|回去|回房|歇|动身|出去)/.exec(say);
  if (mUrge && mUrge[1]) {
    targetName = mUrge[1];
    targetWhere = '回房';
  }

  // 2. 捕获常规打发（如："叫芸娘回房"、"婉宁先回东厢"）
  if (!targetName) {
    const m1 = /(?:让|叫|命|打发|请)?\s*([^去回到往先\s]{1,4})\s*(?:先)?\s*(?:去|回|到|往)\s*(回家|回去|回房|回屋|回府|回铺子|去铺子|回院子|出去|退下|房间|厢房|东厢|西厢|屋里|歇着|等我|候着|睡觉|[\u4e00-\u9fa5]{2,6})/.exec(say);
    const m2 = /(?:让|叫|命|打发|请)?\s*([^去回到往先\s]{1,4})\s*(?:先)?\s*(回家|回去|回房|回屋|回府|回铺子|回院子|出去|退下|退出去|走吧|回房间|去睡)/.exec(say);
    if (m1) {
      targetName = m1[1];
      targetWhere = m1[2];
    } else if (m2) {
      targetName = m2[1];
      targetWhere = m2[2] || '回房';
    }
  }

  // 3. 泛指代词强力清洗：含"都/各/大伙/大家/诸位/你们/全/所有/众人"的一律不是具体人名
  if (targetName) {
    if (/(?:^|.*?)(?:都|各|大伙|大家|诸位|你们|全|所有|众人)/.test(targetName)) {
      targetName = null;
    } else if (/^(你|你们|大家|大伙|都|大家伙|诸位|全|各自|都各自|所有人|众人)$/.test(targetName)) {
      targetName = null;
    }
  }

  return { isDismiss, targetName, targetWhere };
}

/** 是否"全员清场"（都出去/全退下/散了/各自回房…） */
export function isMassDismiss(sayText) {
  return /都|全|大伙|诸位|退下|散了|各自|大家|所有人|众人/.test(String(sayText || '').trim());
}

/**
 * 名字 → 王宅内默认去处（纯映射，不写库；解析不到返回 null）。
 * @param {string} name 人物名
 * @param {{includeWife?:boolean, hasServantRoom?:boolean, places?:object}} opts
 */
export function homeRoomForName(name, { includeWife = false, hasServantRoom = false, places = null } = {}) {
  const n = String(name || '');
  if (n.includes('婉宁')) return 'wang_mansion_east';
  if (n.includes('芸娘')) return 'wang_mansion_west';
  if (includeWife && n.includes('婉儿')) return 'husband_room';
  if (n.includes('小翠')) {
    if (places && typeof places === 'object') {
      const houzhao = Object.keys(places).find((k) => /后罩房|下房|耳房/.test(String(places[k]?.name || '')));
      if (houzhao) return houzhao;
    }
    return hasServantRoom ? 'husband_room__servant' : 'wang_mansion_west';
  }
  return null;
}

/**
 * [[pay:标题|选项=价|选项=价]] 纯解析。
 * @returns {{title:string, options:Array<{key:string,label:string,price:number}>}}
 */
export function parsePayTag(body) {
  const [title, ...optParts] = String(body || '').split('|');
  const options = optParts
    .map((x) => {
      const m = /^(.+?)=([\d.]+)$/.exec(String(x).trim());
      return m ? { key: m[1], label: m[1], price: Number(m[2]) || 0 } : null;
    })
    .filter(Boolean);
  return { title: String(title || ''), options };
}

/** 引擎动作已管的名目（开房/买米/走货/赌/打点）：付款标签作废，免重复扣钱 */
export function isActionHandledPay(title, sayText) {
  return /开房|上房|房钱|住店|买米|卖米|走货|赌|打点/.test(`${title} ${String(sayText || '')}`);
}
