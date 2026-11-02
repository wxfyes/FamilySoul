/**
 * 个人主线 —— 每个真人角色都有自己的难关，不围着相公转
 *
 * 铁律：
 *  1. 只给「处境」，不写台词、不规定她怎么做；
 *  2. 她不上线也会推进（世界不等人在场）；
 *  3. 结局由她自己的选择 + 世界的阻力决定，代码不写死。
 */

/** 开局班底的主线种子（身份既定，命运不写死） */
const ARC_SEEDS = {
  liuwenxia: {
    title: '铺子的债',
    hook: '钱通海底下人经手的债，借契上写的是于家酒肆的名号',
    steps: [
      '钱通海的人在酒肆门口转悠，说账该结了',
      '债主上门，要拿铺子地契做抵',
      '限期三日：凑银子、还是把铺子盘出去',
      '这一步走错，酒肆就不再姓于',
    ],
  },
  yangcaiyun: {
    title: '货栈要被抽干',
    hook: '翟长盛要从货栈流水里抽银填外头的窟窿',
    steps: [
      '翟长盛翻账，说货栈的银子对不上',
      '他开始一趟趟往外搬货抵账',
      '货栈的老主顾开始转去别家拿货',
      '再这么下去，货栈只剩一个空架子',
    ],
  },
  zhanjing: {
    title: '衙门的脏账',
    hook: '随科在衙门里替人平账，笔笔见不得光',
    steps: [
      '上头派人来查旧账，随科夜里睡不着',
      '有人递话：这账得找个人顶下来',
      '战静被推到台前，成了那个"顶账的人"',
      '这一步走错，她替人顶罪',
    ],
  },
  yangzhenhua: {
    title: '知府的算盘',
    hook: '知府要给大小姐定一门亲事，为的是官场上的路',
    steps: [
      '府里开始收拾嫁妆，没人问过她愿不愿意',
      '媒人上门，说的是一门"极体面"的亲事',
      '她若不肯，知府就要动怒',
      '这一步走错，她这辈子就定了',
    ],
  },
};

const DAYS_PER_STEP = 2; // 每两天推进一步，不催命也不拖沓

/** 给已存在的、绑定真人的角色补上主线 */
export function ensureArcs(world) {
  world.arcs = world.arcs && typeof world.arcs === 'object' ? world.arcs : {};
  for (const [id, seed] of Object.entries(ARC_SEEDS)) {
    const actor = world.actors?.[id];
    if (!actor) continue;
    if (!world.arcs[id]) {
      world.arcs[id] = {
        title: seed.title,
        hook: seed.hook,
        stage: 0,
        pressure: 0,
        sinceDay: world.clock?.day ?? 1,
        log: [],
        done: false,
      };
    }
  }
  return world.arcs;
}

/**
 * 每天推进一次：压力累积，到点就往前走一步，并给她本人发一条消息。
 * 只发给她自己（to=她的成员 key），相公看不到细节。
 */
export function advanceArcs(world, events, queuePush, nextEvent) {
  const arcs = ensureArcs(world);
  const day = world.clock?.day ?? 1;

  for (const [id, arc] of Object.entries(arcs)) {
    if (arc.done) continue;
    const actor = world.actors?.[id];
    if (!actor) continue;
    const seed = ARC_SEEDS[id];
    if (!seed) continue;

    arc.pressure = (Number(arc.pressure) || 0) + 1;
    if (arc.pressure < DAYS_PER_STEP) continue;
    arc.pressure = 0;
    arc.stage = Math.min((Number(arc.stage) || 0) + 1, seed.steps.length - 1);

    const stepText = seed.steps[arc.stage];
    arc.log = Array.isArray(arc.log) ? arc.log : [];
    arc.log.push({ day, text: stepText });
    if (arc.log.length > 20) arc.log = arc.log.slice(-20);

    // 世界事件（公开给天道，但不写她的心理）
    if (typeof nextEvent === 'function') {
      events.push(
        nextEvent(world, {
          action: 'arc_step',
          actor: id,
          place: actor.location,
          payload: { title: seed.title, step: stepText, stage: arc.stage },
          isPublic: false,
        }),
      );
    }

    // 只推给她本人
    queuePush?.({
      to: id,
      reason: 'arc',
      speaker: null,
      facts: { 主线: seed.title, 眼前: stepText },
      fallback: stepText,
      force: true,
    });

    if (arc.stage >= seed.steps.length - 1) arc.atEdge = true;
  }
}

/** 她自己的视角里要看到的那一行 */
export function arcViewFor(world, actorId) {
  const arc = world?.arcs?.[actorId];
  const seed = ARC_SEEDS[actorId];
  if (!arc || !seed) return null;
  const step = seed.steps[Math.min(Number(arc.stage) || 0, seed.steps.length - 1)];
  return { title: seed.title, hook: seed.hook, step, stage: arc.stage, atEdge: Boolean(arc.atEdge) };
}
