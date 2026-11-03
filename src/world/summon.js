import { syncPartyIntent, addToParty, removeFromParty, onMemberSelfAction, getPartyMembers } from './party.js';
/**
 * 召唤与走动 —— 把"叫谁过来""我去谁那儿"落到世界账本上
 *
 * 铁律：这里只改位置（事实），不写台词、不规定她说什么。
 * 人到位之后，怎么开口由天道当场裁定。
 */
import { loadState, saveState } from './state.js';
import { isValidPlaceName } from './intent.js';

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

/** 按"最长公共片段"找一个地点，容忍「酒楼盯着」「长街买炭」这种带后缀的说法 */
function findPlace(world, text) {
  const t = String(text || '');
  let best = null;
  let bestLen = 1;
  for (const [id, p] of Object.entries(world.places || {})) {
    const nm = String(p?.name || '');
    if (nm.length < 2) continue;
    for (let n = nm.length; n >= 2; n--) {
      let hit = false;
      for (let i = 0; i + n <= nm.length; i++) {
        if (t.includes(nm.slice(i, i + n))) { hit = true; break; }
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

  // 4. ④ 缺口四：女眷带相公反向同步（"跟我去医馆"、"随我来后院"）
  if (!isHusband) {
    const hus = world.actors?.husband;
    if (hus && hus.location === me.location) {
      if (isTogether || /(相公|王掌柜|少掌柜|王甯)/.test(text)) {
        companions.push(hus);
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

  // ── 离场判断（必须放在"没提到人就返回"之前，否则"我走了"永远不生效）──
  const leaveWords = /(走了|我走|告辞|先回|回去|回家|出门|离开|散了|不坐了)/;
  const ackWords = /^(好|好的|嗯|嗯嗯|行|知道了|好嘞|成|去吧)[。！!~\s]*$/;
  const farewell = /(慢走|走好|门掩上|掩门|送出|送到门口|回头见|改日|下回|路上|仔细着)/;
  const leaving =
    mentioned.length === 0 &&
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
      me.location = home;
      saveState(dataDir, world);
      return { moved: [me.name || '相公'], summoned: [], visited: null, left: true };
    }
    // 人已经在家（比如刚回完茶坊又说一声「嗯」），也要让本轮发生转场，不能继续原地道别
    return { moved: [], summoned: [], visited: null, left: false, alreadyHome: true };
  }

  // 「去找王甯」：她去找相公，就真的走到他所在的地方
  if (selfId && selfId !== 'husband' && /(找|去|寻|见)/.test(say) && /(王甯|王掌柜|少掌柜|相公)/.test(say)) {
    const hus = world.actors?.husband;
    if (hus?.location && hus.location !== me.location) {
      me.location = hus.location;
      saveState(dataDir, world);
      return { moved: [me.name], summoned: [], visited: hus.location, left: false };
    }
  }

  // ② 待确认邀约处理：检测伴侣提议、消费与清空（防止连续说"好"重复造景）
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
    const exists = Object.entries(world.places || {}).find(([, pl]) => String(pl?.name || '').replace(/·.*$/, '').includes(wantName));
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
      // 观测点打点
      const party = [me.name || '相公', ...comers];
      console.log(`[Party] 同行名单：${party.join(' + ')}`);
      console.log(`[Move] ${me.name || '相公'} → ${pl.name}（同行：${comers.length > 0 ? comers.join('、') : '无'}）`);
      return { moved: party, summoned: [], visited: null, wentTo: pl.name };
    }
    // 没造过 → 现造一处新景，落在长街或沿江上，能进能出
    // 【军规铁律】：严禁代码正则硬塞造人！新人物必须由天道大模型根据因果自然长出！
    world.flags = world.flags || {};
    world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;
    const pid = `place_${world.flags.placeSeq}`;
    world.places[pid] = {
      name: wantName, exits: ['street'], dynamic: true, createdDay: world.clock?.day || 1,
    };
    me.location = pid;
    const comers = [];
    for (const c of companions) {
      if (c && !c.dead && c.id !== me.id) {
        c.location = pid;
        c.activity = { text: `随相公前往${wantName}`, at: world.clock?.hour || 0, day: world.clock?.day || 1 };
        comers.push(c.name);
      }
    }
    saveState(dataDir, world);
    // 观测点打点
    const party = [me.name || '相公', ...comers];
    console.log(`[Party] 同行名单：${party.join(' + ')}`);
    console.log(`[Move] ${me.name || '相公'} → ${wantName}（同行：${comers.length > 0 ? comers.join('、') : '无'}）`);
    return { moved: party, summoned: [], visited: null, wentTo: wantName, created: wantName };
  }

  // 「去X家 / X的绣坊」：认到那个人真实所在，别另建一处
  if (/(去|往|到|上|回)/.test(say)) {
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
        const hit = Object.entries(world.places || {}).find(([, pl]) => String(pl?.name || '').includes(kw));
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
  if (mentioned.length === 0 && /(去|往|到|上|回)/.test(say)) {
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

  // 「去某地」：话里带了账本里已有的地名（全名或尾两字），就把相公与同行伴侣挪过去
  if (mentioned.length === 0 && /(去|往|上|到|回|逛)/.test(say)) {
    // "回我房间/去正房"这类说法：先按别名认
    const roomAlias = { 我房间: 'husband_room', 我的房间: 'husband_room', 我房里: 'husband_room', 回房: 'husband_room', 回屋: 'husband_room', 正房: 'husband_room', 上房: 'husband_room', 卧房: 'husband_room', 寝室: 'husband_room' };
    const aliasKey = Object.keys(roomAlias).find((k) => String(say).includes(k));
    if (aliasKey && world.places?.[roomAlias[aliasKey]]) {
      const pid = roomAlias[aliasKey];
      const p = world.places[pid];
      const companions = findCompanions(world, selfId, say);
      me.location = pid;
      const comers = [];
      for (const c of companions) {
        if (c && !c.dead && c.id !== me.id) {
          c.location = pid;
          c.activity = { text: `随相公回房`, at: world.clock?.hour || 0, day: world.clock?.day || 1 };
          comers.push(c.name);
        }
      }
      saveState(dataDir, world);
      const party = [me.name || '相公', ...comers];
      console.log(`[Party] 同行名单：${party.join(' + ')}`);
      console.log(`[Move] ${me.name || '相公'} → ${p.name}（同行：${comers.length > 0 ? comers.join('、') : '无'}）`);
      return { moved: party, summoned: [], visited: null, wentTo: p.name };
    }
    const placeHit = findPlace(world, say);
    if (placeHit) {
      const [pid, p] = placeHit;
      const companions = findCompanions(world, selfId, say);
      me.location = pid;
      const comers = [];
      for (const c of companions) {
        if (c && !c.dead && c.id !== me.id) {
          c.location = pid;
          c.activity = { text: `随相公前往${p.name}`, at: world.clock?.hour || 0, day: world.clock?.day || 1 };
          comers.push(c.name);
        }
      }
      saveState(dataDir, world);
      const party = [me.name || '相公', ...comers];
      console.log(`[Party] 同行名单：${party.join(' + ')}`);
      console.log(`[Move] ${me.name || '相公'} → ${p.name}（同行：${comers.length > 0 ? comers.join('、') : '无'}）`);
      return { moved: party, summoned: [], visited: null, wentTo: p.name };
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
 * NPC 自己说要走：从回复里识别「下楼/告辞/先回/走了」，真的把她挪回自家。
 * 只认「说话那个人」的分角段落，避免把别人要走也算到头上。
 * @returns {string[]} 真的走了的人
 */
export function applyNpcDeparture(dataDir, replyText) {
  const text = String(replyText || '');
  if (!text) return [];
  const world = loadState(dataDir);
  const left = [];
  const segs = text.split(/(?=【[^】\n]{1,12}】)/).filter(Boolean);
  for (const seg of segs) {
    const m = seg.match(/^【([^】\n]{1,12})】/);
    if (!m) continue;
    const name = m[1].trim();
    const bodyOnly = seg.replace(/^【[^】\n]{1,12}】[:：]?/, '');
    if (!/(下楼|告辞|先回|回去|回铺子|回家|走了|且回去|先走了|退下)/.test(bodyOnly)) continue;
    const actor = Object.values(world.actors || {}).find(
      (a) => a && a.name && a.id !== 'husband' && (a.name === name || name.includes(a.name.slice(-2))),
    );
    if (!actor) continue;
    const home = actor.home && world.places?.[actor.home] ? actor.home : null;
    if (!home || actor.location === home) continue;
    actor.location = home;
    left.push(actor.name);
  }
  if (left.length > 0) saveState(dataDir, world);
  return left;
}