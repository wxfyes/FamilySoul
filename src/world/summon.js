/**
 * 召唤与走动 —— 把"叫谁过来""我去谁那儿"落到世界账本上
 *
 * 铁律：这里只改位置（事实），不写台词、不规定她说什么。
 * 人到位之后，怎么开口由天道当场裁定。
 */
import { loadState, saveState } from './state.js';

const SUMMON_VERBS = /(叫|请|唤|传|让|召|叫来|喊)/;
const COME_WORDS = /(过来|来一趟|来一下|来我这儿|来这里|来这儿|过来一趟|过来一趟|来见|来一趟|来|到这)/;
const GO_WORDS = /(我去|去|上|往|到)/;

function namesOf(actor) {
  const list = [actor.name];
  if (actor.name && actor.name.length > 2) list.push(actor.name.slice(-2));
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
    if (selfId && selfId !== 'husband' && __husbandHome) {
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

  // 提到一个世上没有的地方：天道现造一处（医馆、茶楼、银楼、镖局…）
  if (mentioned.length === 0) {
    const mPlace = say.match(/(?:去|往|到|上|回|进)([一-龥]{1,6}?(?:馆|铺|楼|坊|堂|店|院|阁|斋|局|行|庄|园|寺|庵|祠|码头|渡口|桥|街|巷|市|集|仓|监|牢|营|寨))/);
    if (mPlace) {
      const wantName = mPlace[1];
      const exists = Object.entries(world.places || {}).find(([, pl]) => String(pl?.name || '').replace(/·.*$/, '').includes(wantName));
      if (exists) {
        const [pid, pl] = exists;
        if (me.location !== pid) {
          me.location = pid;
          saveState(dataDir, world);
        }
        return { moved: [me.name || '相公'], summoned: [], visited: null, wentTo: pl.name };
      }
      // 没造过 → 造一处，落在长街上，能进能出
      world.flags = world.flags || {};
      world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;
      const pid = `place_${world.flags.placeSeq}`;
      world.places[pid] = {
        name: wantName, exits: ['street'], dynamic: true, createdDay: world.clock?.day || 1,
      };
      me.location = pid;
      // 顺手配个人：造了铺子就得有掌柜/郎中/镖头，别是空屋
      try {
        const KEEPER = [
          { re: /医馆|药铺|药堂|医/, role: '郎中', given: ['郎中', '大夫', '先生'] },
          { re: /银楼|金铺|当铺/, role: '掌柜', given: ['掌柜'] },
          { re: /镖局/, role: '镖头', given: ['镖头'] },
          { re: /酒楼|饭庄|客栈|茶楼|茶馆/, role: '掌柜', given: ['掌柜'] },
          { re: /布庄|衣庄|绣坊|绣楼/, role: '掌柜', given: ['掌柜'] },
          { re: /铁铺|铁匠|银楼/, role: '匠人', given: ['师傅'] },
          { re: /赌坊|青楼/, role: '管事', given: ['管事'] },
        ];
        const hitK = KEEPER.find((x) => x.re.test(wantName));
        const SUR = '陈王李周柳秦赵钱孙吴郑冯褚卫蒋沈韩杨朱许何吕施张孔曹严华金魏陶姜苏潘葛范彭鲁韦马方任袁柳唐薛雷贺倪汤罗毕郝安常傅齐康伍余顾孟黄萧尹姚邵汪毛戴宋庞熊纪舒项董梁杜阮蓝闵季麻贾路娄江童颜郭梅盛林钟徐邱骆高夏蔡田樊胡凌霍虞万柯卢莫房裘解应宗丁邓单杭洪包左石崔龚程邢裴陆荣翁荀惠甄曲封芮储靳段富巫乌焦巴牧山谷车侯全班秋仲伊宫宁仇甘厉祖武符刘景詹龙叶黎薄印宿白怀蒲从鄂索咸赖卓蔺屠蒙池乔翟谭贡劳姬申扶冉雍桑桂牛边燕浦尚温庄晏柴瞿阎慕连茹艾鱼容向古易慎戈廖庾终居衡步都耿满弘匡国文寇广禄阙东欧沃利越师巩聂晁敖冷辛简饶曾沙鞠丰巢关蒯查后荆红游竺权盖益桓';
        const sur = SUR[Math.floor(Math.random() * SUR.length)];
        const given = hitK ? hitK.given[Math.floor(Math.random() * hitK.given.length)] : '掌柜';
        const nm = `${sur}${given}`;
        const dup = Object.values(world.actors || {}).some((a) => a && a.name === nm);
        if (!dup) {
          world.flags.npcSeq = (Number(world.flags.npcSeq) || 0) + 1;
          const kid = `npc_${world.flags.npcSeq}`;
          world.actors[kid] = {
            id: kid, name: nm, role: `${wantName}${hitK ? hitK.role : '掌柜'}`,
            gender: 'male', origin: 'spawned', age: 40 + Math.floor(Math.random() * 15),
            home: pid, location: pid, activity: { text: '守铺子', at: world.clock?.hour || 0, day: world.clock?.day || 1 },
            relations: { husband: { trust: 25, desire: 0, fear: 0, grievance: 0 } }, schedule: [],
          };
          console.log(`[World] 顺手造了个人「${nm}」（${world.actors[kid].role}）`);
        }
      } catch (err) { console.warn('[World] 配人失败：', err.message); }
      saveState(dataDir, world);
      console.log(`[World] 天道造了一处「${wantName}」`);
      return { moved: [me.name || '相公'], summoned: [], visited: null, wentTo: wantName, created: wantName };
    }
  }

  // 「去X家 / X的绣坊」：认到那个人真实所在，别另建一处
  if (mentioned.length === 0 && /(去|往|到|上|回)/.test(say)) {
    const homeHit = Object.values(world.actors || {}).find((a) => {
      if (!a || !a.name || a.id === selfId || a.id === 'husband') return false;
      return new RegExp(`${a.name}(家|的|处)`).test(say);
    });
    if (homeHit && world.places?.[homeHit.location]) {
      if (me.location !== homeHit.location) {
        me.location = homeHit.location;
        saveState(dataDir, world);
        return { moved: [me.name || '相公'], summoned: [], visited: null, wentTo: world.places[homeHit.location].name };
      }
      return { moved: [], summoned: [], visited: null, wentTo: world.places[homeHit.location].name, alreadyThere: true };
    }
  }

  // 客栈开房：要一间上房，付房钱，两个人进房，外人进不来
  if (/(开房|开间房|要间房|要一间|住店|住一晚|开个房|上房)/.test(say)) {
    const innEntry = Object.entries(world.places || {}).find(([, pl]) => /客栈/.test(String(pl?.name || '')));
    if (innEntry) {
      const [innId, innPl] = innEntry;
      const meAtInn = me.location === innId || me.location === `${innId}_room`;
      if (!meAtInn) {
        me.location = innId;
      }
      const roomId = `${innId}_room`;
      if (!world.places[roomId]) {
        world.places[roomId] = { name: `${innPl.name}·上房`, exits: [innId], dynamic: true, private: true };
      }
      // 房钱：上房三两一晚，钱不够就住普通房一钱
      world.assets = world.assets || {};
      let paid = 0;
      let roomName = world.places[roomId].name;
      if ((Number(world.assets.silver) || 0) >= 3) {
        world.assets.silver = Math.round(((Number(world.assets.silver) || 0) - 3) * 100) / 100;
        paid = 3;
      } else if ((Number(world.assets.silver) || 0) >= 0.2) {
        world.assets.silver = Math.round(((Number(world.assets.silver) || 0) - 0.2) * 100) / 100;
        paid = 0.2;
        roomName = `${innPl.name}·通铺`;
        world.places[roomId].name = roomName;
      }
      // 同行的人一起进房
      const partnerId = String((world.chatPartners || {})[selfId || 'husband'] || '');
      const partner = world.actors?.[partnerId];
      const comers = [];
      if (partner && !partner.dead && partner.id !== selfId) {
        partner.location = roomId;
        partner.activity = { text: '进房歇息', at: world.clock?.hour || 0, day: world.clock?.day || 1 };
        comers.push(partner.name);
      }
      me.location = roomId;
      saveState(dataDir, world);
      return { moved: [me.name || '相公', ...comers], summoned: [], visited: null, wentTo: roomName, room: roomName, paid };
    }
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
          if (me.location !== pid) {
            me.location = pid;
            saveState(dataDir, world);
          }
          return { moved: [me.name || '相公'], summoned: [], visited: null, wentTo: pl.name };
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
      if (me.location !== pid) {
        me.location = pid;
        saveState(dataDir, world);
        return { moved: [me.name || '相公'], summoned: [], visited: null, wentTo: streetName, city: cityHit };
      }
      return { moved: [], summoned: [], visited: null, wentTo: streetName, alreadyThere: true, city: cityHit };
    }
  }

  // 「去某地」：话里带了账本里已有的地名（全名或尾两字），就把相公挪过去
  if (mentioned.length === 0 && /(去|往|上|到|回|逛)/.test(say)) {
    // "回我房间/去正房"这类说法：先按别名认
    const roomAlias = { 我房间: 'husband_room', 我的房间: 'husband_room', 我房里: 'husband_room', 回房: 'husband_room', 回屋: 'husband_room', 正房: 'husband_room', 上房: 'husband_room', 卧房: 'husband_room', 寝室: 'husband_room' };
    const aliasKey = Object.keys(roomAlias).find((k) => String(say).includes(k));
    if (aliasKey && world.places?.[roomAlias[aliasKey]]) {
      const pid = roomAlias[aliasKey];
      const p = world.places[pid];
      if (me.location !== pid) {
        me.location = pid;
        // 到了从没去过的城 → 让天道把这条街补出来
        try {
          const cityName = Object.keys(world.cities || {}).find((c) => String(p.name || '').includes(c) || String(c).includes(String(p.name || '')));
          if (cityName) {
            world.cityShops = world.cityShops || {};
            const rec = world.cityShops[cityName];
            const count = typeof rec === 'number' ? rec : (rec && rec.count) || 0;
            if (count < 12) {
              world.flags = world.flags || {};
              world.flags.pendingCityShop = cityName;
            }
          }
        } catch { /* 忽略 */ }
        saveState(dataDir, world);
        return { moved: [me.name || '相公'], summoned: [], visited: null, wentTo: p.name };
      }
      return { moved: [], summoned: [], visited: null, wentTo: p.name, alreadyThere: true };
    }
    const placeHit = findPlace(world, say);
    if (placeHit) {
      const [pid, p] = placeHit;
      if (me.location !== pid) {
        me.location = pid;
        saveState(dataDir, world);
        return { moved: [me.name || '相公'], summoned: [], visited: null, wentTo: p.name };
      }
      return { moved: [], summoned: [], visited: null, wentTo: p.name, alreadyThere: true };
    }
  }

  if (mentioned.length === 0) return null;

  const hasSummonVerb = SUMMON_VERBS.test(say) && COME_WORDS.test(say);
  const hasGoVerb = GO_WORDS.test(say) && /(那|那里|那儿|房里|屋|处)/.test(say);

  // 「让/叫/派 X 去 Y」→ 把 X 派到 Y，并给她一天的"外派"豁免，免得日程立刻把她拉回
  const sendMatch = String(say).match(/(?:让|叫|派|打发)?\s*([^\s，。]{1,8}?)\s*[，,]?\s*你?\s*(?:去|往|到|回)\s*([^\s，。]{1,10})/);
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
  } else if (mentioned.length === 1) {
    // 「找 X / X 在吗 / 我去 X 那」→ 相公挪到 X 所在处（而不是把 X 凭空叫来）
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