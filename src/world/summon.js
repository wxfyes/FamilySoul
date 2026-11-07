import { syncPartyIntent, addToParty, removeFromParty, onMemberSelfAction, getPartyMembers } from './party.js';
/**
 * 召唤与走动 —— 把"叫谁过来""我去谁那儿"落到世界账本上
 *
 * 铁律：这里只改位置（事实），不写台词、不规定她说什么。
 * 人到位之后，怎么开口由天道当场裁定。
 */
import { loadState, saveState } from './state.js';
import { isValidPlaceName } from './intent.js';
import { moveActor } from './position.js';
import { resolvePlaceTarget, isOuting } from './places-target.js';
import { matchActor } from './naming.js';

const SUMMON_VERBS = /(叫|请|唤|传|让|召|叫来|喊)/;
const COME_WORDS = /(过来|来一趟|来一下|来我这儿|来这里|来这儿|过来一趟|过来一趟|来见|来一趟|来|到这)/;
const GO_WORDS = /(我去|去|上|往|到)/;

function namesOf(actor) {
  const list = [actor.name];
  if (actor.name && actor.name.length > 2) list.push(actor.name.slice(-2));
  if (actor.id === 'liuwenxia' || actor.name === '刘文霞') list.push('紫嫣');
  if (actor.label) list.push(actor.label);
  return list.filter(Boolean);
}


const CORE_PLACE_MAP = [
  // 监牢类（最严格：必须显式出现“牢/狱”，否则绝不允许进入牢房！）
  { pid: 'jail_female', re: /(女牢|女监)/ },
  { pid: 'jail_male', re: /(男牢|男监|大牢|牢房|牢里|大狱|监牢|下狱)/ },

  // 官府衙门（优先级高于牢房，绝不误入男牢）
  { pid: 'yamen', re: /(县衙|衙门|官府|公堂|找知县|见知县|衙内)/ },

  // 街道（全部统领至青石板长街 street，杜绝分裂地点）
  { pid: 'street', re: /(青石板长街|青石板街|青石板|长街|大街|街上|街道|当街|街市)/ },

  // 酒肆与茶坊
  { pid: 'jiusi', re: /(于家酒肆|紫嫣酒肆|酒肆|小酒馆)/ },
  { pid: 'teahouse', re: /(临江茶坊|茶坊|茶楼|茶肆|老店)/ },

  // 酒楼与码头
  { pid: 'restaurant', re: /(运河大酒楼|码头酒楼|三层大酒楼|运河码头三层大酒楼|运河酒楼|大酒楼|酒楼)/ },
  { pid: 'dock', re: /(运河码头|江边码头|码头|渡口)/ },
];

export function resolveStandardPlace(world, selfId, text) {
  const t = String(text || '');
  const me = world.actors?.[selfId] || world.actors?.husband;

  // 0. 回家逻辑（根据角色身份回到真正归宿）
  if (/(回家|回铺子|回店|回去了|一道回家|一块回家|一起回家)/.test(t)) {
    if (selfId && selfId !== 'husband') {
      const homeId = me?.home || (selfId === 'liuwenxia' ? 'jiusi' : 'tea_house');
      if (world.places?.[homeId]) return [homeId, world.places[homeId]];
    } else {
      const homeId = me?.home || 'tea_house';
      if (world.places?.[homeId]) return [homeId, world.places[homeId]];
    }
  }

  // 1. 房间别名
  if (/(我房间|我的房间|我房里|回房|回屋|正房|上房|卧房|寝室)/.test(t)) {
    const roomId = selfId && selfId !== 'husband' ? (me?.home || 'husband_room') : 'husband_room';
    if (world.places?.[roomId]) return [roomId, world.places[roomId]];
  }

  // 2. 核心精确地点映射
  for (const item of CORE_PLACE_MAP) {
    if (item.re.test(t) && world.places?.[item.pid]) {
      return [item.pid, world.places[item.pid]];
    }
  }

  // 3. 动态地点模糊匹配
  return findPlace(world, t);
}

export function hasRealMoveVerb(text) {
  const stripped = String(text || '')
    .replace(/(到底|到处|到期|看到|听到|提到|拿到|办到|想到|说到|账到|查到|遇到|等到|到手|找到)/g, '')
    .replace(/(怎么回事|回事|回话|回答|收回|回绝|回过神|回信|回头|收不回|还回)/g, '')
    .replace(/(上头|账上|身上|看上|不上|手上|纸上|面上|心上|字据上|底册上|打上|赶上)/g, '')
    .replace(/(省去|除去|免去|褪去|失去|过去|怎么去说|信得过不去|相去|去你的|何去何从)/g, '');
  return /(去|往|移步|转到|回|逛|奔|赶往|到)/.test(stripped);
}

/** 按"最长公共片段"找一个地点，容忍「酒楼盯着」「长街买炭」这种带后缀的说法 */
function findPlace(world, text) {
  const t = String(text || '');
  let best = null;
  let bestLen = 1;
  for (const [id, p] of Object.entries(world.places || {})) {
    // 牢房严格保护：若输入没有"牢/狱"，绝不匹配牢房！
    if ((id.startsWith('jail') || /牢|狱/.test(p?.name || '')) && !/牢|狱/.test(t)) {
      continue;
    }
    const nm = String(p?.name || '');
    if (nm.length < 2) continue;
    for (let n = nm.length; n >= 2; n--) {
      let hit = false;
      for (let i = 0; i + n <= nm.length; i++) {
        const seg = nm.slice(i, i + n);
        const idx = t.indexOf(seg);
        if (idx !== -1) {
          // 防人物/物件/事务误伤：若匹配的是姓氏前缀（如"翟家"），后面紧跟人或物词汇，不算地点
          const after = t.slice(idx + seg.length, idx + seg.length + 4);
          if (/(老板|掌柜|管事|下人|伙计|娘子|大娘子|姑娘|少爷|夫人|老爷|字据|银子|借条|借契|文书|暗账|账|事|案子|人|钱)/.test(after)) {
            continue;
          }
          hit = true;
          break;
        }
      }
      if (hit) {
        if (n > bestLen) { bestLen = n; best = [id, p]; }
        break;
      }
    }
  }
  return best;
}

/** 在文本里找提到的人（非真人 actor，排除相公本人） */
function findMentioned(world, text) {
  const hits = [];
  for (const [id, a] of Object.entries(world.actors || {})) {
    if (!a?.name || id === 'husband' || a.kind === 'human') continue;
    if (namesOf(a).some((n) => text.includes(n))) hits.push(id);
  }
  return hits;
}

/** 寻找与当前行动者同行的伴侣（必须满足在场前置：同处一地） */
function findCompanions(world, selfId, say) {
  const me = world.actors?.[selfId] || world.actors?.husband;
  if (!me) return [];
  const companions = [];
  const isHusband = !selfId || selfId === 'husband';
  const text = String(say || '');

  // 0. 排除明确拒绝/排斥同行的口令："我自己去"、"你留在这"、"看好铺子"、"别跟来"
  if (/(我自己|独自|一个人|你留|你在|别跟|看好|不用陪)/.test(text)) {
    return [];
  }

  // 1. 文本明确指明同行：比如"我们/咱们/同去/一块/一起/带上/一道/陪我/走吧/跟我来/随我"
  const isTogether = /(我们|咱们|一起|一块|同去|同行|带上|陪我|一道|走吧|跟我|随我)/.test(text);

  // 2. 显式点名同行：文本明确提到具体某人（"和紫嫣/带紫嫣/跟婉儿"）
  const explicitlyMentioned = [];
  for (const [id, a] of Object.entries(world.actors || {})) {
    if (!a || a.dead || id === selfId || (isHusband && id === 'husband')) continue;
    if (namesOf(a).some((n) => text.includes(n))) {
      explicitlyMentioned.push(a);
    }
  }

  if (explicitlyMentioned.length > 0) {
    for (const a of explicitlyMentioned) {
      // ① 缺口一【在场判定】：必须同处一地！不在场坚决不走同行
      if (a.location === me.location) {
        companions.push(a);
      }
    }
    // 既然显式点名了具体人，无论她在不在场，绝不再顺手抓别人同行！
    return companions;
  }

  // 2.5 队伍持久伴随：已经在队里的在场成员，只要没被脱队排除，默认继续跟随！
  if (isHusband) {
    const pMembers = getPartyMembers(world, 'husband');
    for (const pId of pMembers) {
      const pActor = world.actors?.[pId];
      if (pActor && !pActor.dead && pActor.location === me.location) {
        if (!companions.some((c) => c.id === pId)) {
          companions.push(pActor);
        }
      }
    }
  }

  // 3. 伴侣同场默契：相公没有点具体人名，但明确表达了同行意向（"我们/咱们/一起/走吧/一块"）
  if (isHusband && isTogether) {
    const curLoc = me.location;
    for (const [id, a] of Object.entries(world.actors || {})) {
      if (!a || a.dead || id === 'husband') continue;
      // ① 缺口一：必须同处一地
      if (a.location !== curLoc) continue;
      if (['liuwenxia', 'yunnia', 'yangcaiyun', 'zhanjing'].includes(id) || a.household || a.gender === 'female') {
        companions.push(a);
        break; // 默契同行只带当前跟前那一位，避免整屋人捆绑
      }
    }
  }

  // 4. 女眷带伴侣/同行人同步（"跟我去医馆"、"赶紧弄完一起回家"）
  if (!isHusband) {
    const curLoc = me.location;
    const spouseId = me.spouse;
    const isWifeOfHusband = !spouseId || spouseId === 'husband';
    if (isWifeOfHusband) {
      // 府中妻妾（婉儿、芸娘）：相公是王甯
      const hus = world.actors?.husband;
      if (hus && hus.location === curLoc && (isTogether || /(相公|王掌柜|少掌柜|王甯)/.test(text))) {
        companions.push(hus);
      }
    } else {
      // 外室相好（如紫嫣）：正牌丈夫是于子归，提相公带于子归
      const realSpouse = world.actors?.[spouseId] || Object.values(world.actors || {}).find((a) => /于子归|于杰/.test(a?.name || ''));
      if (realSpouse && realSpouse.location === curLoc && (isTogether || /(相公|当家的|丈夫|我男人|子归)/.test(text))) {
        if (!companions.some((c) => c.id === realSpouse.id)) companions.push(realSpouse);
      }
      // 只有明确提到王掌柜/王甯时，才带情郎王甯
      const hus = world.actors?.husband;
      if (hus && hus.location === curLoc && /(王掌柜|少掌柜|王甯)/.test(text)) {
        companions.push(hus);
      }
    }
    if (isTogether) {
      const partnerId = (world.chatPartners || {})[selfId];
      for (const [id, a] of Object.entries(world.actors || {})) {
        if (!a || a.dead || id === selfId || id === 'husband') continue;
        if (a.location !== curLoc) continue;
        if (id === partnerId || id === spouseId || /于子归|于杰/.test(a.name || '') || a.spouse === selfId) {
          if (!companions.some((c) => c.id === id)) {
            companions.push(a);
            break;
          }
        }
      }
    }
  }

  return companions;
}

/**
 * @returns {{moved:string[], summoned:string[], visited:string|null}|null}
 */
export function applySummon(dataDir, text, lastBotSaid = '', selfId = 'husband') {
  // 记住相公原本在哪：她走动时绝不顺带把他挪走
  const __husbandHome = (() => {
    try { return loadState(dataDir)?.actors?.husband?.location || null; } catch { return null; }
  })();
  const __result = __applySummonInner(dataDir, text, lastBotSaid, selfId);
  try {
    const calledHusband = /(王甯|相公|少掌柜|王掌柜|我们|咱们|一起|一块|同去)/.test(text);
    if (selfId && selfId !== 'husband' && __husbandHome && !calledHusband) {
      const w2 = loadState(dataDir);
      const hus = w2.actors?.husband;
      const me = w2.actors?.[selfId];
      if (hus && me && hus.location !== __husbandHome && hus.location === me.location) {
        hus.location = __husbandHome;
        saveState(dataDir, w2);
        console.log(`[Scene] 守住：${me.name}走动没有把相公带走（相公仍在原处）`);
      }
    }
  } catch { /* 忽略 */ }
  return __result;
}

function __applySummonInner(dataDir, text, lastBotSaid = '', selfId = 'husband') {
  const say = String(text || '').trim();
  if (!say) return null;

  const world = loadState(dataDir);
  const me = world.actors?.[selfId] || world.actors?.husband;
  if (!me) return null;

  // 同步队伍意图（加队 / 脱队）
  if (selfId === 'husband') {
    syncPartyIntent(world, say, 'husband');
  } else {
    // 成员自己单独行动：脱队
    onMemberSelfAction(world, selfId);
  }

  // 光提名字不算"去找"：必须有动作词才算
  const hasMoveVerb = /(去|往|找|寻|见|到|过来|叫|请|来|上|回)/.test(say);
  const mentioned = hasMoveVerb ? findMentioned(world, say) : [];


  const moved = [];
  const summoned = [];
  let visited = null;

  // ── 离场判断（严格区分纯离场短指令 vs 复杂言辞/日常台词）──
  const isComplexChat = /(?:你|您|老娘|他妈|凭什么|为何|怎么|研究|改字据|坑|私改|蛀虫|对个明白|发毛|空响|听说|改的|算账|这事|这桩|空口|凭据)/.test(say) || say.length > 12;
  const leaveWords = /^(?:走了|我走|告辞|先回|回去|回家|出门|离开|散了|不坐了)[。！!~]*$/;
  const ackWords = /^(好|好的|嗯|嗯嗯|行|知道了|好嘞|成|去吧)[。！!~\s]*$/;
  const farewell = /(慢走|走好|门掩上|掩门|送出|送到门口|回头见|改日|下回|路上|仔细着)/;
  const leaving =
    mentioned.length === 0 &&
    !isComplexChat &&
    (leaveWords.test(say) || (ackWords.test(say) && farewell.test(String(lastBotSaid || ''))));

  if (leaving) {
    const isHusband = !selfId || selfId === 'husband';
    const exits = world.places?.[me.location]?.exits || [];
    const goingHome = /(回家|回去|回房|回屋|回后院)/.test(say);
    // 相公"回家" = 回正房；"走了/出门" = 上街
    const home = isHusband
      ? (goingHome
        ? (world.places?.husband_room ? 'husband_room' : (world.places?.backyard ? 'backyard' : (world.places?.tea_house ? 'tea_house' : 'street')))
        : (exits.includes('street') ? 'street' : (world.places?.husband_room ? 'husband_room' : exits[0] || 'street')))
      : ((me.home && world.places?.[me.home] ? me.home : null) || (world.places?.tea_house ? 'tea_house' : 'street'));
    if (me.location !== home) {
      const companions = findCompanions(world, selfId, say);
      me.location = home;
      const comers = [];
      for (const c of companions) {
        if (c && !c.dead && c.id !== me.id) {
          c.location = home;
          comers.push(c.name);
        }
      }
      saveState(dataDir, world);
      return { moved: [me.name || '相公', ...comers], summoned: [], visited: null, left: true };
    }
    // 人已经在家（比如刚回完茶坊又说一声「嗯」），也要让本轮发生转场，不能继续原地道别
    return { moved: [], summoned: [], visited: null, left: false, alreadyHome: true };
  }

  // 「去找王甯」：她去找相公，若相公在私密内宅，外人止步于临江茶坊前堂相见
  if (selfId && selfId !== 'husband' && /(找|去|寻|见)/.test(say) && /(王甯|王掌柜|少掌柜|相公)/.test(say)) {
    const hus = world.actors?.husband;
    if (hus) {
      const isInnerHome = ['husband_room', 'backyard'].includes(hus.location);
      const isHouseholdFemale = me.household || ['waner', 'yunnia', 'xiaocui'].includes(selfId);
      let targetLoc = hus.location;
      if (isInnerHome && !isHouseholdFemale) {
        // 外妇/客人绝不能私闯相公夫妻正房寝居与后院，会面止步于临江茶坊前堂
        targetLoc = 'tea_house';
        hus.location = 'tea_house';
      }
      if (me.location !== targetLoc) {
        me.location = targetLoc;
      }
      saveState(dataDir, world);
      return { moved: [me.name], summoned: [], visited: targetLoc, left: false };
    }
  }
  // 严格地名后缀：排除单字"行"，避免"就行/不行"误伤；增加合法地名校验
  const PLACE_SUFFIXES = '(?:馆|铺|楼|坊|堂|店|院|阁|斋|局|商行|车马行|营造行|布行|钱行|洋行|庄|园|寺|庵|祠|码头|渡口|桥|街|巷|市|集|仓|监|牢|营|寨|摊|亭|棚|舍|榭|居|筑|别苑|别院|小筑|雅间|厢房|客房|雅座|雅阁|画舫|渡船|酒肆|茶肆|小摊|茶摊|药铺)';
  const mPlace = say.match(new RegExp(`(?:去|往|到|上|回|进|移步|转到)([一-龥]{1,6}?${PLACE_SUFFIXES})`));
  let wantName = (mPlace && isValidPlaceName(mPlace[1])) ? mPlace[1] : null;

  // 对方上一句若有提议，且尚未记录待确认邀约，挂载之
  const mPrev = String(lastBotSaid || '').match(new RegExp(`(?:去|到|往|上|移步|转到)([一-龥]{1,6}?${PLACE_SUFFIXES})`));
  if (mPrev && isValidPlaceName(mPrev[1]) && !world.pendingInvitation) {
    world.pendingInvitation = {
      placeName: mPrev[1],
      atDay: world.clock?.day || 1,
      atHour: world.clock?.hour || 0,
    };
  }

  // 用户回复同意 vs 拒绝
  const isAccept = /^(好|好的|行|走|走吧|成|去吧|听你的|好啊|嗯|成啊|好嘞|走着)[。！!~\s]*$/.test(say);
  const isReject = /^(不去|算了|改日|改天|不去了|改期|下次|先不去|没空|不走)[。！!~\s]*$/.test(say);

  if (world.pendingInvitation) {
    if (isAccept) {
      wantName = world.pendingInvitation.placeName;
      delete world.pendingInvitation; // 消费后立刻清空
      saveState(dataDir, world);
    } else if (isReject) {
      delete world.pendingInvitation; // 拒绝后立刻清空，不造景、不转场
      saveState(dataDir, world);
      console.log(`[Party] 相公推脱了同行提议，待确认邀约已清空`);
      return { moved: [], summoned: [], visited: null, rejected: true };
    }
  }

  // 提到一个要去的地方（医馆、茶楼、小茶摊、银楼、镖局、画舫…）：天道就地造景或前往
  if (wantName && isValidPlaceName(wantName)) {
    // 找到同行伴侣（如紫嫣、芸娘），共同转场
    const companions = findCompanions(world, selfId, say);
    // 普通前往优先排除牢房（除非明确说坐牢/牢房/劫狱）
    const isJailWant = /(牢|监|狱)/.test(wantName);
    const exists = Object.entries(world.places || {}).find(([pid, pl]) => {
      if (!isJailWant && pid.startsWith('jail_')) return false;
      return String(pl?.name || '').replace(/·.*$/, '').includes(wantName);
    });
    if (exists) {
      const [pid, pl] = exists;
      me.location = pid;
      const comers = [];
      for (const c of companions) {
        if (c && !c.dead && c.id !== me.id) {
          c.location = pid;
          c.activity = { text: `随相公移步${pl.name}`, at: world.clock?.hour || 0, day: world.clock?.day || 1 };
          comers.push(c.name);
        }
      }
      saveState(dataDir, world);
      const party = [me.name || '相公', ...comers];
      console.log(`[Party] 同行名单：${party.join(' + ')}`);
      console.log(`[Move] ${me.name || '相公'} → ${pl.name}（同行：${comers.length > 0 ? comers.join('、') : '无'}）`);
      return { moved: party, summoned: [], visited: null, wentTo: pl.name };
    }
    // 【架构铁律】：代码绝不盲目造景瞬移相公！未知地点保持相公原处不动，交由天道大模型与后续交互系统裁定
  }

  // 「去X家 / X的绣坊」：认到那个人真实所在，别另建一处
  if (hasRealMoveVerb(say)) {
    const homeHit = Object.values(world.actors || {}).find((a) => {
      if (!a || !a.name || a.id === selfId || (selfId === 'husband' && a.id === 'husband')) return false;
      return new RegExp(a.name + '(?:的)?(?:家|那儿|屋里|房里|处|那|住处|铺子|绣坊)').test(say);
    });
    if (homeHit) {
      const targetLoc = (homeHit.home && world.places?.[homeHit.home]) ? homeHit.home : homeHit.location;
      if (targetLoc && world.places?.[targetLoc]) {
        if (me.location !== targetLoc) {
          me.location = targetLoc;
          saveState(dataDir, world);
          return { moved: [me.name || '相公'], summoned: [], visited: null, wentTo: world.places[targetLoc].name };
        }
        return { moved: [], summoned: [], visited: null, wentTo: world.places[targetLoc].name, alreadyThere: true };
      }
    }
  }

  // 客栈开房：要一间上房/上方/开房/住店，支持错别字“上方”，付房钱，男女主一同进房
  if (/(?:开|要|订|定|住|歇)[一1个间条]*?(?:上[房方]|客房|厢房|雅间|房间|房|客栈|通铺)|(?:住[一1]?晚|开房|打尖住店|睡觉)/i.test(say)) {
    // 优先找现有客栈，没有就动态创建临江客栈
    let innEntry = Object.entries(world.places || {}).find(([, pl]) => /客栈|客舍|旅店|客房/.test(String(pl?.name || '')));
    if (!innEntry) {
      world.places = world.places || {};
      world.places.inn = { name: '临江客栈', exits: ['street'], dynamic: true };
      innEntry = ['inn', world.places.inn];
    }
    const [innId, innPl] = innEntry;
    const roomId = `${innId}_room`;
    if (!world.places[roomId]) {
      world.places[roomId] = { name: `${innPl.name}·天字上房`, exits: [innId], dynamic: true, private: true };
    }

    // 房钱：扣除 3 两现银（若用户说“王甯付钱”或相公付，扣相公资产；否则扣真人钱包）
    world.assets = world.assets || {};
    let paid = 0;
    const roomName = world.places[roomId].name;
    const isHusbandPay = /王甯|相公|王掌柜|少掌柜|王东家/.test(say) || selfId === 'husband';
    if (isHusbandPay) {
      const curSilver = Number(world.assets.silver) || 0;
      if (curSilver >= 3) {
        world.assets.silver = Math.round((curSilver - 3) * 100) / 100;
        paid = 3;
      } else if (curSilver > 0) {
        paid = curSilver;
        world.assets.silver = 0;
      }
    } else {
      world.wallets = world.wallets || {};
      const curW = Number(world.wallets[selfId]) || 0;
      if (curW >= 3) {
        world.wallets[selfId] = Math.round((curW - 3) * 100) / 100;
        paid = 3;
      }
    }

    // 同行伴侣一起进房（支持当前在场红颜紫嫣/芸娘，或真人提及相公）
    const companions = findCompanions(world, selfId, say);
    const comers = [];
    for (const c of companions) {
      if (c && !c.dead && c.id !== me.id) {
        c.location = roomId;
        c.activity = { text: '上房歇息相伴', at: world.clock?.hour || 0, day: world.clock?.day || 1 };
        comers.push(c.name);
      }
    }
    const partnerId = /(王甯|相公|少掌柜)/.test(say) && selfId !== 'husband'
      ? 'husband'
      : String((world.chatPartners || {})[selfId || 'husband'] || '');
    const partner = world.actors?.[partnerId];
    if (partner && !partner.dead && partner.id !== me.id && !comers.includes(partner.name)) {
      partner.location = roomId;
      partner.activity = { text: '上房歇息相伴', at: world.clock?.hour || 0, day: world.clock?.day || 1 };
      comers.push(partner.name);
    }
    me.location = roomId;
    me.activity = { text: '上房歇息', at: world.clock?.hour || 0, day: world.clock?.day || 1 };
    saveState(dataDir, world);
    // 观测点打点
    const party = [me.name || '相公', ...comers];
    console.log(`[Party] 同行名单：${party.join(' + ')}`);
    console.log(`[Move] ${me.name || '相公'} → ${roomName}（同行：${comers.length > 0 ? comers.join('、') : '无'}）`);
    return { moved: party, summoned: [], visited: null, wentTo: roomName, room: roomName, paid };
  }

  // 别名：口语里的地方，对上世界里真有的地方（医馆→回春堂药铺 之类）
  const SYNONYMS = {
    药铺: ['回春堂', '药堂'],
    酒楼: ['酒楼', '大酒楼'],
    客栈: ['客栈'],
    赌坊: ['赌坊'],
    青楼: ['万花楼', '青楼'],
    茶坊: ['茶坊', '茶馆'],
    茶馆: ['茶坊', '茶馆'],
    衙门: ['衙门', '县衙'],
    县衙: ['衙门', '县衙'],
    书院: ['书院'],
    庙: ['城隍庙', '庙'],
    庙会: ['城隍庙', '庙'],
    当铺: ['当铺'],
    铁匠铺: ['铁铺', '铁匠'],
  };
  if (mentioned.length === 0) {
    const asked = Object.keys(SYNONYMS).find((k) => say.includes(k));
    if (asked && !Object.values(world.places || {}).some((pl) => String(pl?.name || '').includes(asked))) {
      for (const kw of SYNONYMS[asked]) {
        const hit = Object.entries(world.places || {}).find(([pid, pl]) => {
          if (!/(牢|监|狱)/.test(kw) && pid.startsWith('jail_')) return false;
          return String(pl?.name || '').includes(kw);
        });
        if (hit) {
          const [pid, pl] = hit;
          const companions = findCompanions(world, selfId, say);
          me.location = pid;
          const comers = [];
          for (const c of companions) {
            if (c && !c.dead && c.id !== me.id) {
              c.location = pid;
              c.activity = { text: `随相公移步${pl.name}`, at: world.clock?.hour || 0, day: world.clock?.day || 1 };
              comers.push(c.name);
            }
          }
          saveState(dataDir, world);
          const party = [me.name || '相公', ...comers];
          console.log(`[Party] 同行名单：${party.join(' + ')}`);
          console.log(`[Move] ${me.name || '相公'} → ${pl.name}（同行：${comers.length > 0 ? comers.join('、') : '无'}）`);
          return { moved: party, summoned: [], visited: null, wentTo: pl.name };
        }
      }
    }
  }

  // 「去某城」：城里没有长街就先修一条（不能把人塞进府衙）
  if (mentioned.length === 0 && hasRealMoveVerb(say)) {
    const cityHit = Object.keys(world.cities || {}).find((c) => String(say).includes(c));
    if (cityHit) {
      const streetName = `${cityHit}·长街`;
      let pid = Object.keys(world.places || {}).find((k) => world.places[k]?.name === streetName);
      if (!pid) {
        world.flags = world.flags || {};
        world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;
        pid = `place_${world.flags.placeSeq}`;
        const gov = Object.keys(world.places || {}).find((k) => String(k).startsWith('gov_') && String(world.places[k]?.name || '').includes(cityHit));
        world.places[pid] = { name: streetName, exits: ['street', ...(gov ? [gov] : [])], dynamic: true, city: cityHit };
      }
      const companions = findCompanions(world, selfId, say);
      me.location = pid;
      const comers = [];
      for (const c of companions) {
        if (c && !c.dead && c.id !== me.id) {
          c.location = pid;
          c.activity = { text: `随相公前往${streetName}`, at: world.clock?.hour || 0, day: world.clock?.day || 1 };
          comers.push(c.name);
        }
      }
      saveState(dataDir, world);
      const party = [me.name || '相公', ...comers];
      console.log(`[Party] 同行名单：${party.join(' + ')}`);
      console.log(`[Move] ${me.name || '相公'} → ${streetName}（同行：${comers.length > 0 ? comers.join('、') : '无'}）`);
      return { moved: party, summoned: [], visited: null, wentTo: streetName, city: cityHit };
    }
  }



  // 「回房/回正房」：相公自己回正房（单人回房，绝不偷听拉同行人覆盖）
  if (mentioned.length === 0 && !isComplexChat && /(?:回|去)(?:我)?(?:房|屋|房间|正房)/.test(String(say).trim())) {
    const pid = 'husband_room';
    if (world.places?.[pid]) {
      if (me.location !== pid) {
        me.location = pid;
        saveState(dataDir, world);
        return { moved: [me.name || '相公'], summoned: [], visited: null, wentTo: world.places[pid].name };
      }
      return { moved: [], summoned: [], visited: null, wentTo: world.places[pid].name, alreadyThere: true };
    }
  }

  if (mentioned.length === 0) return null;

  const hasSummonVerb = SUMMON_VERBS.test(say) && COME_WORDS.test(say);
  const hasGoVerb = GO_WORDS.test(say) && /(那|那里|那儿|房里|屋|处)/.test(say);

  // 「让/叫/派 X 去 Y」→ 把 X 派到 Y，并给她一天的"外派"豁免，免得日程立刻把她拉回
  const sendMatch = String(say).match(/^(?:让|叫|派|打发)\s*([^\s，。]{1,8}?)\s*[，,]?\s*你?\s*(?:去|往|到|回)\s*([^\s，。]{1,10})/);
  if (sendMatch) {
    const whoName = sendMatch[1];
    const destName = sendMatch[2];
    const who = Object.values(world.actors || {}).find(
      (a) => a?.name && a.id !== 'husband' && (a.name === whoName || whoName.includes(a.name.slice(-2))),
    );
    const dest = findPlace(world, destName) || Object.entries(world.places || {}).find(([, p]) => String(p?.name || '') === destName);
    if (who && dest) {
      who.location = dest[0];
      who.away = { place: dest[0], untilDay: (Number(world.clock.day) || 1) + 1 };
      saveState(dataDir, world);
      return { moved: [who.name], summoned: [], visited: null, sent: who.name, to: dest[1].name };
    }
  }

  // 「婉儿、芸娘，都过来」→ 点到的人都真的走过来
  if (mentioned.length >= 1 && /(过来|都来|叫|唤|请|来一趟|来一下)/.test(say)) {
    const movedIn = [];
    for (const id of mentioned.slice(0, 3)) {
      const a = world.actors[id];
      if (!a || a.dead || a.location === me.location) continue;
      a.location = me.location;
      a.activity = { text: '应声赶来', at: world.clock?.hour || 0, day: world.clock?.day || 1 };
      movedIn.push(a.name);
    }
    if (movedIn.length) {
      saveState(dataDir, world);
      return { moved: movedIn, summoned: mentioned.map((id) => world.actors[id]?.name).filter(Boolean), visited: null, cameToMe: true };
    }
  }

  if (hasSummonVerb) {
    // 叫 X 过来 → X 挪到相公所在处
    for (const id of mentioned) {
      const a = world.actors[id];
      if (a.location !== me.location) {
        a.location = me.location;
        moved.push(a.name);
      }
      summoned.push(a.name);
    }
  } else if (mentioned.length === 1 && /(?:去找|去见|去寻|去看|特意找|找找)\s*[^，,。！？!\s]{1,4}/.test(say)) {
    // 必须有明确「去找X/去见X」句式才位移，严禁日常闲聊提第三人（如"小翠胡言乱语"）误瞬移相公
    const target = world.actors[mentioned[0]];
    if (target) {
      summoned.push(target.name);
      if (me.location !== target.location) {
        me.location = target.location;
        moved.push(me.name || '相公');
        visited = target.name;
      }
    }
  }

  if (moved.length === 0) return summoned.length > 0 ? { moved, summoned, visited } : null;

  saveState(dataDir, world);
  return { moved, summoned, visited };
}

/**
 * NPC 自己说要走或相公吩咐回去：从台词中识别「这就走/告辞/先回/走了」，通过统一移动入口规范挪回自家/长街。
 * 只认「说话那个人」的分角段落，避免把别人要走也算到头上。
 * @returns {string[]} 真的走了的人
 */
export function applyNpcDeparture(dataDir, replyText, sayText = '') {
  const text = String(replyText || '');
  if (!text) return [];

  // 只有天道明确写了 [[depart:谁|去哪儿]] 才动身。
  // 台词里出现"退下""这就去"这类词，一律只当台词，不再由正则偷听触发位移。
  const tags = [...text.matchAll(/\[\[depart:\s*([^|\]]+?)\s*\|\s*([^\]]+?)\s*\]\]/g)];
  if (!tags.length) return [];

  const world = loadState(dataDir);
  const left = [];

  for (const m of tags) {
    const name = String(m[1] || '').trim();
    const hint = String(m[2] || '').trim();
    const actor = matchActor(world.actors, name);
    if (!actor) continue;

    const from = actor.location;
    let dest = resolvePlaceTarget(world, hint, { nearId: from, actor });
    // 家眷离场保护：如果是去王宅内部的房间（东厢/西厢/书房/花园等），完全放行；
    // 只有当被误指派到府外非住宅（如长街/集市），且不是出门办差时，才兜底改回自家庭院
    const isKin = String(actor.spouse || '') === 'husband' || /正妻|如夫人|二房|侧室|妾|通房|丫鬟|婆子|嬷嬷/.test(String(actor.role || ''));
    if (isKin) {
      const curRoot = String(world.places?.[from]?.parent || from);
      const destRoot = String(world.places?.[dest]?.parent || dest);
      const isInsideMansion = dest && (destRoot === curRoot || destRoot === 'husband_room' || dest.startsWith('wang_mansion_'));
      if (!isInsideMansion && !/街|铺|店|楼|栈/.test(hint)) {
        const home = actor.home && world.places?.[actor.home] ? actor.home : null;
        if (home) dest = home;
      }
    }
    if (!dest || dest === from) continue;

    const moved = moveActor(world, actor.id, dest, 'world', `离场：${hint.slice(0, 10)}`);
    if (!moved?.ok) {
      console.warn(`[Departure] ${actor.name} 没能去「${hint}」：${moved?.error || '无去处'}`);
      continue;
    }

    actor.activity = {
      text: `去了${world.places?.[dest]?.name || '别处'}`,
      at: world.clock?.hour || 0,
      day: world.clock?.day || 1,
    };
    if (isOuting(world, from, dest)) {
      actor.away = { place: dest, untilDay: (Number(world.clock?.day) || 1) + 1, hint };
    } else {
      delete actor.away;
    }
    left.push(actor.name);
    console.log(`[Departure] ${actor.name}(${actor.id}) → ${world.places?.[dest]?.name || dest}`);
  }

  if (left.length > 0) saveState(dataDir, world);
  return left;
}
