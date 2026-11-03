/**
 * Intent 意图归一模块 —— 七层管道的第一层
 * 
 * 职责：
 * 1. 将语言、点选按钮、定时器事件统一抽象为标准的 Intent 对象
 * 2. 赋予全局唯一的 actionId，保证全链路可观测与后续幂等
 * 3. 严格只做归一化与解析，绝不碰 state，绝不替天道下判决
 */

export const VERBS = {
  MOVE: 'MOVE',           // 走动、前往、转场、开房、歇宿、回家
  INTIMATE: 'INTIMATE',   // 私密行房、闺房调情、暗号解禁
  TRADE: 'TRADE',         // 交易买卖、结账、付房钱、借贷
  REPORT: 'REPORT',       // 报官、告状、击鼓
  GIFT: 'GIFT',           // 赏赐、赠送、礼物
  COURT: 'COURT',         // 结纳、纳妾、开脸、迎娶
  CHAT: 'CHAT',           // 日常闲聊、商榷家事、打探消息
};

// 规范地点后缀：行必须为复合词（商行/营造行/布行），严禁单字"行"误伤日常口语（如"就行"）
const PLACE_SUFFIXES = '(?:馆|铺|楼|坊|堂|店|院|阁|斋|局|商行|车马行|营造行|布行|钱行|洋行|庄|园|寺|庵|祠|码头|渡口|桥|街|巷|市|集|仓|监|牢|营|寨|摊|亭|棚|舍|榭|居|筑|别苑|别院|小筑|雅间|厢房|客房|客栈|栈|雅座|雅阁|画舫|渡船|酒肆|茶肆|小摊|茶摊|药铺)';

const INVALID_PLACE_WORDS = /^(?:就行|不行|可行|成行|得行|行不行|过去|过去看|过去坐|应付|对付|应付过去|看看|看一下|商量一下|知会一声)$/;

export function isValidPlaceName(name) {
  if (!name || typeof name !== 'string') return false;
  const s = name.trim();
  if (s.length <= 1 || s.length > 10) return false;
  if (INVALID_PLACE_WORDS.test(s)) return false;
  if (/(?:就行|不行|不便|不可|没有|算了|应付)/.test(s)) return false;
  return true;
}

function generateActionId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `act_${ts}_${rand}`;
}

/**
 * 解析输入并归一为标准 Intent
 * @param {object} params
 * @param {string} params.text 用户输入文本
 * @param {string} params.actorId 发起者身份 ('husband' / 'liuwenxia' 等)
 * @param {object} params.world 当前世界账本快照
 * @param {string} [params.lastBotSaid] 对方上一句话（用于承接提议）
 * @param {string} [params.clientActionId] 客户端可选传入的幂等 id
 * @returns {object} 标准 Intent
 */
export function parseIntent({ text = '', actorId = 'husband', world = null, lastBotSaid = '', clientActionId = null } = {}) {
  const id = clientActionId || generateActionId();
  const rawText = String(text || '').trim();
  const actor = actorId || 'husband';

  // 1. 动词判定 (Verb Resolution)
  let verb = VERBS.CHAT;
  let target = null;
  const params = {};
  const companions = [];

  const isAgreeingWord = /^(?:好|好的|行|成|好啊|嗯|成啊|好嘞|听你的|依你)?[，,\s]*(?:走|走吧|去吧|同去|咱们走|动身|走着|听你的|依你)[。！!~\s]*$/.test(rawText) ||
                         /^(?:好|好的|行|成|去吧|听你的|好啊|嗯|成啊|好嘞)[。！!~\s]*$/.test(rawText);
  const isRejectingWord = /(不去|算了|改天|不走|没空|不想去|改日|且慢|稍后)/.test(rawText);

  const isMoveCandidate = /(去|往|到|上|回|进|移步|转到|走吧|开房|歇息|回房|回家)/.test(rawText) ||
                          (Boolean(world?.pendingInvitation) && isAgreeingWord);
  const isIntimateCandidate = /(12345|123456|行房|云雨|做爱|操你|肉棒|口交|自慰|舔舔|撅起来|插进去|射满|打老虎|快活)/.test(rawText);
  const isTradeCandidate = /(付钱|多少钱|买|卖|结账|付账|借银|银两|铜钱|开价|还债)/.test(rawText);
  const isReportCandidate = /(报官|告状|击鼓|伸冤|见官|官府抓人)/.test(rawText);
  const isCourtCandidate = /(纳妾|迎娶|开脸|收房|做妾|过门|提亲|做小)/.test(rawText);
  const isGiftCandidate = /(赏你|赏银|赠你|送你|收下这个)/.test(rawText);

  if (isIntimateCandidate) {
    verb = VERBS.INTIMATE;
  } else if (isReportCandidate) {
    verb = VERBS.REPORT;
  } else if (isCourtCandidate) {
    verb = VERBS.COURT;
  } else if (isTradeCandidate) {
    verb = VERBS.TRADE;
  } else if (isMoveCandidate) {
    verb = VERBS.MOVE;
  }

  // 队伍脱队指令检测（全局生效，无论 MOVE 还是 CHAT 都可下令脱队）
  const isLeaveParty = /(?:你留下|留在这|别跟|看好店|看好铺子|先回铺子|先回去|回你的铺子|回你家|不用陪|别来了|自己去|不用跟着|退下|留步|你先回)/.test(rawText);
  if (isLeaveParty) {
    let lTarget = 'all';
    for (const [aId, a] of Object.entries(world?.actors || {})) {
      if (aId !== 'husband' && (
        (a?.name && rawText.includes(a.name)) ||
        (aId === 'liuwenxia' && (rawText.includes('紫嫣') || rawText.includes('文霞'))) ||
        (aId === 'waner' && rawText.includes('婉儿')) ||
        (aId === 'yunnia' && rawText.includes('芸娘')) ||
        (aId === 'xiaocui' && rawText.includes('小翠'))
      )) {
        lTarget = aId;
        break;
      }
    }
    params.leaveParty = lTarget;
  }

  // 2. 目标与伴侣提取 (Target & Companions)
  let isConsensus = false;
  let rejectPending = false;
  const pending = world?.pendingInvitation;

  if (pending && (pending.to === actor || !pending.to)) {
    if (isAgreeingWord) {
      target = pending.target;
      isConsensus = true;
      verb = VERBS.MOVE;
    } else if (isRejectingWord) {
      rejectPending = true;
    }
  }

  if (verb === VERBS.MOVE) {
    let foundPersonId = null;

    // 0. 去某某家 / 去某某那儿 / 到某某屋里 / 某某处（优先解析人物真实归宿）
    const mPersonHome = rawText.match(/(?:去|到|往|回|上|移步|转到)\s*([\u4e00-\u9fa5]{2,4}?)(?:的)?(?:家|那儿|屋里|房里|屋子|屋中|处|那|住处)/);
    if (!target && mPersonHome && world?.actors) {
      const pName = mPersonHome[1].trim();
      for (const [aId, a] of Object.entries(world.actors)) {
        if (!a || a.dead) continue;
        const hit = (a.name && (a.name === pName || a.name.includes(pName) || pName.includes(a.name))) ||
                    (pName.includes('苏娘') && (aId.includes('suniang') || (a.name && a.name.includes('苏娘')))) ||
                    (pName.includes('紫嫣') && (aId === 'liuwenxia' || (a.name && a.name.includes('刘文霞')))) ||
                    (pName.includes('婉儿') && (aId === 'waner' || (a.name && a.name.includes('婉儿')))) ||
                    (pName.includes('芸娘') && (aId === 'yunnia' || (a.name && a.name.includes('芸娘')))) ||
                    (pName.includes('小翠') && (aId === 'xiaocui' || (a.name && a.name.includes('小翠'))));
        if (hit) {
          foundPersonId = aId;
          const locId = (a.home && world.places?.[a.home]) ? a.home : a.location;
          if (locId && world.places?.[locId]) {
            target = world.places[locId].name || locId;
            break;
          }
        }
      }
    }

    // 提取目标地点
    const mPlace = rawText.match(new RegExp(`(?:去|往|到|上|回|进|移步|转到|随我到|跟我到)([一-龥]{1,8}${PLACE_SUFFIXES})`));
    if (mPlace && isValidPlaceName(mPlace[1])) {
      target = mPlace[1];
    } else if (/(开房|客房|上[房方]|住店)/.test(rawText)) {
      target = '临江客栈·天字上房';
    } else if (isAgreeingWord && !target) {
      // 承接伴侣上一句话中的提议
      const mPrev = String(lastBotSaid || '').match(new RegExp(`(?:去|到|往|上|移步|转到)([一-龥]{1,8}${PLACE_SUFFIXES})`));
      if (mPrev && isValidPlaceName(mPrev[1])) {
        target = mPrev[1];
        isConsensus = true;
      }
    } else if (/(回家|回后院|回房|回屋)/.test(rawText)) {
      // 一行原则：回家取该人物自己的归宿，绝不可让紫嫣回家走错门进了相公后院
      if (actor === 'husband') {
        target = /(后院)/.test(rawText) ? '后院暖阁' : '正房';
      } else {
        const aObj = world?.actors?.[actor];
        const hId = aObj?.home;
        const hName = hId ? (world?.places?.[hId]?.name || hId) : null;
        if (actor === 'liuwenxia') {
          target = hName || '于家酒肆';
        } else if (actor === 'waner') {
          target = '后院暖阁';
        } else if (actor === 'yunnia') {
          target = hName || '临江茶坊老店';
        } else {
          target = hName || (/(后院)/.test(rawText) ? '后院暖阁' : '正房');
        }
      }
    }


    const mFindPerson = rawText.match(/(?:去找|去见|去看|特意去寻|特意去看|前去寻|去找找)\s*([一-龥]{2,4})/);
    if (!target && mFindPerson && world?.actors) {
      const pName = mFindPerson[1].trim();
      for (const [aId, a] of Object.entries(world.actors)) {
        if (!a || a.dead || aId === actor) continue;
        const hit = (a.name && (a.name === pName || pName.includes(a.name))) ||
                    (aId === 'liuwenxia' && (pName.includes('紫嫣') || pName.includes('文霞'))) ||
                    (aId === 'waner' && pName.includes('婉儿')) ||
                    (aId === 'yunnia' && pName.includes('芸娘')) ||
                    (aId === 'xiaocui' && pName.includes('小翠'));
        if (hit) {
          foundPersonId = aId;
          if (a.location) {
            let locName = world.places?.[a.location]?.name || a.location;
            // 外妇/客人找相公：若相公身处私密内宅（正房/后院），目标地点必须是公共产业【临江茶坊】
            if (aId === 'husband' && actor !== 'husband') {
              const isInner = ['husband_room', 'backyard'].includes(a.location);
              const meActor = world.actors?.[actor];
              const isHousehold = Boolean(meActor?.household) || ['waner', 'yunnia', 'xiaocui'].includes(actor);
              if (isInner && !isHousehold) {
                locName = '临江茶坊';
                params.meetHusbandAtTeaHouse = true;
              }
            }
            target = locName;
            break;
          }
        }
      }
    }

    // 若未解析出合法目的地，且非纯位移动词，降级为日常闲聊 CHAT，绝不盲目位移
    if (!target) {
      verb = VERBS.CHAT;
    }

    // 提取同行意向伴侣（仅限真位移时有效，严禁日常闲聊提人误当成同行伴侣）
    if (verb === VERBS.MOVE && target && world && world.actors) {
      const me = world.actors[actor] || world.actors.husband;
      const curLoc = me?.location;
      const isTogether = /(我们|咱们|一起|一块|同去|同行|带上|一道|陪我|走吧|跟我|随我|快随我|快跟我)/.test(rawText);

      // 若为承接伴侣邀约，自动将该邀约发起人加入同行人
      if (isConsensus && pending?.from && world.actors[pending.from]) {
        const inviter = world.actors[pending.from];
        companions.push({ id: pending.from, name: inviter.name });
      }

      // 显式点名（无论同房还是同宅，相公指名要带谁，意图即忠实记录）
      for (const [aId, a] of Object.entries(world.actors)) {
        if (!a || a.dead || aId === actor) continue;
        // 🛡️ 铁律：被相公专门前去寻找的目标对象，绝不能当成跟随在身边的同行人！
        if (foundPersonId && aId === foundPersonId) continue;
        const hit = (a.name && rawText.includes(a.name)) ||
                    ((aId === 'liuwenxia' || a.id === 'liuwenxia') && (rawText.includes('紫嫣') || rawText.includes('文霞'))) ||
                    ((aId === 'waner' || a.id === 'waner') && rawText.includes('婉儿')) ||
                    ((aId === 'yunnia' || a.id === 'yunnia') && rawText.includes('芸娘'));
        if (hit && !companions.some((c) => c.id === aId)) {
          companions.push({ id: aId, name: a.name });
        }
      }

      // 队伍持久化伴侣：若相公是队长，队内在场成员自动跟随
      const isLeaveParty = /(?:你留下|留在这|别跟|看好店|看好铺子|先回铺子|先回去|回你的铺子|回你家|不用陪|别来了|自己去|不用跟着|退下|留步|你先回)/.test(rawText);
      if (actor === 'husband' && !isLeaveParty && world?.party?.husband) {
        const pList = Array.isArray(world.party.husband) ? world.party.husband : [];
        for (const pId of pList) {
          if (pId === 'husband') continue;
          if (foundPersonId && pId === foundPersonId) continue;
          const pActor = world.actors?.[pId];
          if (pActor && !pActor.dead && pActor.location === curLoc) {
            if (!companions.some((c) => c.id === pId)) {
              companions.push({ id: pId, name: pActor.name });
            }
          }
        }
      }
      if (isLeaveParty) {
        let lTarget = 'all';
        for (const [aId, a] of Object.entries(world.actors || {})) {
          if (aId !== 'husband' && a?.name && rawText.includes(a.name)) {
            lTarget = aId;
            break;
          }
        }
        params.leaveParty = lTarget;
      }

      // 缺口④：反向伴随与默契同场伴随
      // 若是伴侣对相公说“跟我去/随我去”，或相公对伴侣表达同去
      if (companions.length === 0 && isTogether && curLoc) {
        if (actor !== 'husband' && world.actors.husband) {
          // 伴侣带相公
          companions.push({ id: 'husband', name: world.actors.husband.name || '王甯' });
        } else {
          // 相公带身旁亲近红颜
          for (const [aId, a] of Object.entries(world.actors)) {
            if (!a || a.dead || aId === actor) continue;
            if (a.location === curLoc && (['liuwenxia', 'yunnia', 'yangcaiyun', 'zhanjing'].includes(aId) || a.household || a.gender === 'female')) {
              companions.push({ id: aId, name: a.name });
              break;
            }
          }
        }
      }
    }

    params.isConsensus = isConsensus;
    params.rejectPending = rejectPending;
  }

  return {
    id,
    actor,
    verb,
    target,
    params,
    companions,
    origin: 'text',
    rawText,
    createdAt: Date.now(),
  };
}

