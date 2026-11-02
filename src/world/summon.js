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
export function applySummon(dataDir, text, lastBotSaid = '') {
  const say = String(text || '').trim();
  if (!say) return null;

  const world = loadState(dataDir);
  const me = world.actors?.husband;
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
    const home = world.places?.tea_house ? 'tea_house' : 'street';
    if (me.location !== home) {
      me.location = home;
      saveState(dataDir, world);
      return { moved: ['相公'], summoned: [], visited: null, left: true };
    }
    return { moved: [], summoned: [], visited: null, left: false };
  }

  if (mentioned.length === 0) return null;

  const hasSummonVerb = SUMMON_VERBS.test(say) && COME_WORDS.test(say);
  const hasGoVerb = GO_WORDS.test(say) && /(那|那里|那儿|房里|屋|处)/.test(say);

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
        moved.push('相公');
        visited = target.name;
      }
    }
  }

  if (moved.length === 0) return summoned.length > 0 ? { moved, summoned, visited } : null;

  saveState(dataDir, world);
  return { moved, summoned, visited };
}
