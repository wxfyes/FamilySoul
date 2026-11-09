/**
 * 意图动作层（Step 4：纯解析 + 只读候选，不执行位移）
 *
 * 军规：
 *   ① 本文件**不写世界**：不 import loadState/saveState/moveActor，不碰 fs；
 *   ② 只做解析：传唤谁、打发谁走/是否全员清场、默认回哪间屋、[[pay:...]] 报价；
 *   ③ 真正的位移/扣款仍由 pet-service.js 统一执行（moveActor / 记账唯一入口）；
 *   ④ 依赖单向：chat/* ← pet-service.js。
 */

const NOT_A_NAME = /^(你|你们|都|大伙|大家|全|进|来|进来|出去|退下|上门|两个|几个|一人|二人|门房|家丁|护院|下人|伙计|掌柜|东家|店家|客栈|酒楼|茶坊)$/;
// 代词：整句只有这些词时，不是具体人名（她/他/它 也必须排除，避免"她怎么还不走"被当成人）
const PRONOUNS = /^(?:你|您|你们|我|我们|他|她|它|他们|她们|它们|大家|大伙|大家伙|诸位|各位|众人|所有人)$/;
// 群体称呼：只认"整体就是群体词"（可带 都/们/给我/一起/全 等语气尾巴），
// 绝不按"名字里含全/都/各"就误杀——"全叔/都管"是正常人名。
const GROUP_WORDS = /^(?:都|全都|全|各|各自|大伙|大家|大家伙|诸位|各位|你们|我们|他们|她们|所有人|众人)(?:都|们|给我|一起|全|各自|各)?$/;

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

  // 严格排除动词与方位词（如"进来两个护院"、"叫护院进来"）
  const m1 = /(?:让|叫|命|请|唤|打发|派人叫|把)?\s*([^去回到往先来叫让请过进出入退走\s]{2,4})\s*(?:叫|请|唤)?\s*(?:过来|过来吧|来|来吧|来一趟|来一下|来正房|到这来|到这里|到跟前|来伺候)/.exec(say);
  const m2 = /(?:叫|唤|请|传)\s*([^去回到往先来叫让请过进出入退走\s]{2,4})\s*(?:来吧|过来|到跟前来|进屋|进厅)/.exec(say);
  if (m1 && !NOT_A_NAME.test(m1[1])) targetName = m1[1];
  else if (m2 && !NOT_A_NAME.test(m2[1])) targetName = m2[1];

  if (targetName) {
    targetName = targetName.replace(/[，。！？、；：\s\d个名位两]+/g, '').trim();
    if (targetName.length < 2 || NOT_A_NAME.test(targetName)) targetName = null;
  }

  // 承接上一轮：若相公说"叫来吧/叫她来/快叫来/催催"，回溯上一轮相公呼唤的名字
  if (!targetName && /^(?:叫|唤|请|传)?\s*(?:来吧|叫来吧|叫她来吧|唤她来|快叫来|快唤来|催催|那就叫来|快去叫)[。！!~…\s]*$/.test(say)) {
    const hist = Array.isArray(recentMessages) ? recentMessages.slice(-4) : [];
    const prevUserMsg = hist.reverse().find((m) => m.role === 'user' && m.text !== text)?.text || '';
    const mPrev = /(?:让|叫|命|请|唤|打发|把)?\s*([^去回到往先来叫让请过进出入退走\s]{2,4})\s*(?:叫|请|唤)?\s*(?:过来|过来吧|来|来吧|来一趟|来一下|来正房|到这来|到这里|到跟前|来伺候)/.exec(prevUserMsg);
    if (mPrev && !NOT_A_NAME.test(mPrev[1])) targetName = mPrev[1];
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
  if (!targetName || targetName.length < 2) return null;
  const cands = Object.values(world?.actors || {}).filter((a) => {
    if (!a || a.dead || a.id === selfId) return false;
    if (a.name === targetName) return true;
    if (targetName.length >= 2 && (a.name.endsWith(targetName) || a.name.includes(targetName))) return true;
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
  // 1. 第一人称自己走动（如"我回家了"、"我回房了"、"我走了"）：是相公台词，绝不是打发送客！
  if (/^(?:我|咱|俺|为夫|老子|本掌柜|少掌柜|本少爷)[^。！？\n]{0,8}(?:走|回|去|睡|歇)/.test(say)) {
    return { isDismiss: false, targetName: null, targetWhere: null };
  }

  // 2. 排除明确否定与商榷挽留句（如"要不要退下"、"能不能走"、"别走"、"不要走"、"先别走"）
  const isQuestionOrNegation = /(?:要不要|能不能|可否|别走|不要走|先别走|暂且别|不用退|别退|先不走|先不退|走不走|退不退)/.test(say);
  if (isQuestionOrNegation) {
    return { isDismiss: false, targetName: null, targetWhere: null };
  }

  // 2.5 到某产业当差/当头牌，是调人上工，不是打发送客
  const isStaffing = /(?:请|让|叫|派|调|安排|雇|聘)[^。！？\n]{0,24}(?:到|去|往)[^。！？\n]{0,14}(?:当|做|任|坐柜|掌事|当头牌|当掌柜|当伙计)/.test(say)
    || /(?:到|去|往)[^。！？\n]{0,20}(?:当头牌|当掌柜|当伙计|做头牌|做掌柜|做伙计|坐柜|掌事)/.test(say);
  if (isStaffing) {
    return { isDismiss: false, targetName: null, targetWhere: null };
  }

  const isDismiss =
    /(?:让|叫|命|打发|请)?\s*([^去回到往先\s]{1,4})\s*(?:先)?\s*(?:去|回|到|往)\s*(回家|回去|回房|回屋|回府|回铺子|去铺子|回院子|出去|退下|房间|厢房|东厢|西厢|屋里|歇着|等我|候着|睡觉|[\u4e00-\u9fa5]{2,6})/.test(say)
    || /(?:让|叫|命|打发|请)?\s*([^去回到往先\s]{1,4})\s*(?:先)?\s*(回家|回去|回房|回屋|回府|回铺子|回院子|出去|退下|退出去|走吧|回房间|去睡)/.test(say)
    || /^(?:你|你们|都|先)?\s*(?:走(?:吧|啦)?|回去(?:吧)?|回吧|退下(?:吧)?|下去(?:吧)?|散了(?:吧)?|去吧|出门吧|慢走|送客|睡吧|安歇吧)[。！!~…\s]*$/.test(say)
    || /送客|你回吧|你走吧|退下吧|都散了吧|各自回房|都回屋|各自回|回房间睡觉|回屋睡|去睡吧|回房睡|都走吧|走吧|走啦|退出去|退下吧/.test(say)
    || /(?:怎么|为何)?还不(?:走|退|回去|回房|歇|动身|出去)/.test(say)
    || /都[^。]{0,6}(出去|退下|散了|退出去|回去|回房|睡觉|走)/.test(say)
    || /(?:让|叫|命|打发|请)?[^。！？\n]{0,8}各自[^。！？\n]{0,4}(散|忙去|去忙|回房|回屋)/.test(say)
    || /(?:都|全|大伙|诸位|你们|他们)[^。！？\n]{0,6}(散了|散了吧|下去吧|退下吧|忙去|干活)/.test(say)
    || /(?:出去|去|退下|退出去|回门房)?\s*(?:干活|忙去|去忙|当差|巡视)(?:去)?(?:吧)?[。！!~…\s]*$/.test(say)
    || /(?:不用了|没事了|行了|好了|去吧)[^。！？\n]{0,8}(?:走吧|退下|下去|出去|干活|去忙|忙去)/.test(say);

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

  // 2.5 名字清洗：解析可能把"都散了，"、"没事了，"、"出去"这种动词或语气助词短语误当人名
  // 古风人名至少 2 字（如"罗叔"、"沈婉儿"），单字绝不可作为独立点名人名
  if (targetName) {
    targetName = String(targetName).replace(/[，。！？、；：\s]+/g, '');
    if (
      !targetName
      || targetName.length < 2
      || /散|忙|走|退|去|回|出|进|入|到|往|来|各自|大家|他们|你们|事|了|用|没|好|行|干|活|罢|吧/.test(targetName)
      || NOT_A_NAME.test(targetName)
    ) {
      targetName = null;
      targetWhere = null;
    }
  }

  // 3. 代词/群体称呼清洗：只清"整体就是代词或群体词"的，
  //    绝不按"名字里含全/都/各"误杀（全叔、都管仍是正常人名）
  if (targetName && (PRONOUNS.test(targetName) || GROUP_WORDS.test(targetName))) {
    targetName = null;
  }

  return { isDismiss, targetName, targetWhere };
}

/** 是否"全员/通令清场"（都出去/全退下/散了/各自回房/走吧/出去干活…） */
export function isMassDismiss(sayText) {
  const say = String(sayText || '').trim();
  // 排除单纯代词催促（如"你怎么还不走"、"她怎么还不走"不是全员通令清场）
  if (/(?:怎么|为何)?还不(?:走|退|回去|回房)/.test(say)) return false;
  return /都|全|大伙|诸位|退下|散了|各自|大家|所有人|众人|走吧|走啦|出去干活|去干活|干活去|去忙|忙去|出去忙|下去吧/.test(say);
}

/**
 * 名字 → 王宅内默认去处（纯映射，不写库；解析不到返回 null）。
 * @param {string} name 人物名
 * @param {{includeWife?:boolean, hasServantRoom?:boolean, places?:object}} opts
 */
export function homeRoomForName(name, { includeWife = false, hasServantRoom = false, places = null, role = '' } = {}) {
  const n = String(name || '');
  const r = String(role || '');

  // 1. 外院当差仆从（家丁/护院/门房/小厮/马夫/车夫）：归宿必须是王宅外院门房/值房，绝不可进正房内室或留在议事厅
  if (/家丁|护院|门房|小厮|马夫|车夫|仆役|下人/.test(r) || /常木|熊河|樊生|傅生|罗叔|盛哥|蓝郎|周山|尹木|阮汉|项郎/.test(n)) {
    if (places && typeof places === 'object') {
      const gate = Object.keys(places).find((k) => {
        const nm = String(places[k]?.name || '');
        if (!/朱漆大门|门房|外院|门头|大门|值房|下房|倒座/.test(nm)) return false;
        return k.startsWith('husband_room') || /王宅/.test(nm);
      });
      if (gate) return gate;
    }
    return 'husband_room__gate';
  }

  // 2. 后宫内眷规制：沈婉儿正妻居正房，林芸娘二房居西厢（东跨院为崔婉宁所居）
  if (n.includes('婉宁')) return 'wang_mansion_east';
  if (n.includes('芸娘')) return 'wang_mansion_west';
  if (n.includes('婉儿')) return 'husband_room';
  if (n.includes('小翠')) {
    if (places && typeof places === 'object') {
      // 只认王宅自己的下房/后罩房/耳房，绝不把丫鬟送进别家宅院
      const houzhao = Object.keys(places).find((k) => {
        const nm = String(places[k]?.name || '');
        if (!/后罩房|下房|耳房/.test(nm)) return false;
        return k.startsWith('husband_room') || /王宅/.test(nm);
      });
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
