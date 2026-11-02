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
  const say = String(text || '').trim();
  if (!say) return null;

  const world = loadState(dataDir);
  const me = world.actors?.[selfId] || world.actors?.husband;
  if (!me) return null;

  const mentioned = findMentioned(world, say);

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
    // 相公说"走了" = 离开这里上街；她自己说"回家" = 回自己家
    const isHusband = !selfId || selfId === 'husband';
    const exits = world.places?.[me.location]?.exits || [];
    const home = isHusband
      ? (exits.includes('street') ? 'street' : exits[0] || 'street')
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

  // 「去某地」：话里带了账本里已有的地名（全名或尾两字），就把相公挪过去
  if (mentioned.length === 0 && /(去|往|上|到|回|逛)/.test(say)) {
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