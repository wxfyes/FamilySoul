/**
 * 红绡千面 · 动态床笫与千人千面情欲引擎 (BedChamberEngine)
 *
 * 核心法则：
 * 1. 男女平权双向判定：相公找女伴，女眷找男伴，同场谁在跟谁好；
 * 2. 千人千面性格驱动：彻底拒绝模板化，每个人的动作、荤话、娇喘完全由身份与性情决定；
 * 3. 自然生命周期与优雅退场：自适应推进节奏，一旦任何一方叫停/要走立刻体贴放行，绝不硬按强来。
 */

// 开启床笫意图：涵盖自然求欢、解衣、暗号、身体接触等，不靠单一死板正则
const BED_START_RE = /(?:^|[^0-9])123456?(?:[^0-9]|$)|脱衣服|上床|双飞|三飞|三个一起|做爱|侍寝|行房|云雨|大被同眠|欢好|一起睡|要你们|同榻|脱光|操|插|干我|弄我|要我|要你|硬了|进来|做吗|伺候.*老娘|伺候我|上榻|欢爱|舔我|含住|吃我|弄死我|干死我|想要了|快点进来/;

// 停止床笫意图：任何终止、疲乏、要走、穿衣、起榻均可自然退出，不需死背词库
const BED_STOP_RE = /(?:做完了|完事了|射了|搞完了|出来吧|收拾一下|结束了|歇息吧|好累|乏了|老虎打完了|下山了|下山|打完了|收兵|穿衣服|穿衣|擦干净|好了|滚吧|走了|回去了|回家了|回家|不做了|别弄了|放开|下榻|下床|起吧|起了|回了|停下|别动了|饶了我)/;

/**
 * 自然语义检测当前对话中的床笫意图
 */
export function evaluateBedIntent(text, wasInBed = false) {
  const t = String(text || '').trim();
  const isStopping = BED_STOP_RE.test(t);
  const isStarting = BED_START_RE.test(t);

  if (isStopping) {
    return { shouldEnd: true, inBed: false, isCode: false };
  }
  if (wasInBed || isStarting) {
    return {
      shouldEnd: false,
      inBed: true,
      isCode: /(?:^|[^0-9])123456?(?:[^0-9]|$)/.test(t),
    };
  }
  return { shouldEnd: false, inBed: false, isCode: false };
}

/**
 * 双向推导在场的欢好对象（男女双向）
 */
export function resolveBedPartner(world, viewerActorId = 'husband', sayText = '') {
  const self = world.actors?.[viewerActorId] || (viewerActorId === 'husband' ? world.actors?.husband : null);
  const myPlace = self?.location || world.actors?.husband?.location;
  if (!myPlace) return null;

  const isFemale = self?.gender === 'female';
  const targetGender = isFemale ? 'male' : 'female';

  // 1. 本轮对方台词点名了谁，且在场，直接锁定
  const hereActors = Object.values(world.actors || {}).filter(
    (a) => a && !a.dead && a.location === myPlace && a.id !== viewerActorId
  );

  const named = hereActors.find((a) => {
    if (!a.name) return false;
    const short = a.name.length > 2 ? a.name.slice(-2) : a.name;
    return sayText.includes(a.name) || sayText.includes(short);
  });
  if (named) return named;

  // 2. 当前正在与谁对话 (chatPartners) 且在场
  const partnerId = (world.chatPartners || {})[viewerActorId];
  if (partnerId && world.actors?.[partnerId]) {
    const p = world.actors[partnerId];
    if (p.location === myPlace && !p.dead) return p;
  }

  // 3. 找在场的异性伴侣（优先妻子、如夫人、正牌丈夫、相好）
  const candidates = hereActors.filter((a) => a.gender === targetGender || !a.gender);
  if (candidates.length === 1) return candidates[0];

  if (!isFemale) {
    // 相公视角：正妻沈婉儿优先，其次林芸娘、小翠、紫嫣等
    const waner = candidates.find((a) => a.id === 'waner');
    if (waner) return waner;
    const yunnia = candidates.find((a) => a.id === 'yunnia');
    if (yunnia) return yunnia;
    const xiaocui = candidates.find((a) => a.id === 'xiaocui');
    if (xiaocui) return xiaocui;
  } else {
    // 女方视角：优先丈夫（如于子归、随科），或在场的王甯
    const husband = candidates.find((a) => a.id === 'husband');
    if (husband) return husband;
    const spouse = candidates.find((a) => a.id === self?.spouse);
    if (spouse) return spouse;
  }

  return candidates[0] || hereActors[0] || null;
}

/**
 * 为不同身份和性格的角色生成独特的床笫指引
 */
export function buildBedChamberPrompt({ initiator, partner, inBed, shouldEnd, isCode = false }) {
  if (shouldEnd) {
    return [
      '（【红绡事毕 · 温存放行】：欢好已毕或对方已明确叫停。',
      '1. 必须体贴放行：若对方说要走、要回家、乏了想歇息，当家之人必须温柔放行并关切照料，绝对严禁继续强按硬脱！',
      '2. 温柔事后打理：取温热香帕/汗巾替对方仔细擦拭清理隐私处与身子，温柔帮着穿戴好裙裤衣衫，端温水伺候，言语体贴宠溺，安抚对方好生休歇。）',
    ].join('\n');
  }

  if (!inBed) return '';

  const partnerName = partner?.name || '伴侣';
  const partnerRole = partner?.role || '';
  const isInitiatorFemale = initiator?.gender === 'female';

  // ──【心防门禁 · 拒绝白给与男女大防判定】──
  const rel = partner?.relations?.husband || partner?.relations?.[initiator?.id] || {};
  const trust = Number(rel.trust || 0);
  const desire = Number(rel.desire || 0);
  const isWife = Boolean(partner?.household || initiator?.spouse === partner?.id || partner?.spouse === initiator?.id);
  const isConsummated = Boolean(partner?.intimacy?.consummated);
  const isReady = isWife || isConsummated || (trust >= 75 && desire >= 60);

  if (!isReady && !isCode) {
    // 心防未破：恪守礼法与男女大防，严厉拒绝或惊羞退后！
    return [
      `（【心防坚固 · 严词拒绝求欢】：${partnerName}与你并非合法夫妻，亦未曾私定终身（好感信任未满）！`,
      '1. 【严禁白给迎合】：面对突如其来的动手动脚或轻浮言语，她惊怒交加、立刻后退拉开距离，整理衣裙严肃斥责或冷声制止；',
      '2. 【恪守名节】：她有自身名节与戒备，直言“请自重，男女授受不亲，莫要辱了彼此名声”；绝不宽衣、绝不上榻！）',
    ].join('\n');
  }

  // ═══════════════ 女方各具特色承欢风格 ═══════════════
  const femaleStyles = {
    // 1. 沈婉儿：名门正妻，端庄破防，极度娇媚
    waner: [
      '【名门正妻·沈婉儿专属床笫反差】：沈婉儿平日端庄雍容、知书达礼主持中馈，但在这隐秘锦帐之中彻底为相公破防！',
      '- 表现：满脸飞红、星眸迷离、玉腿主动缠紧相公腰肢，娇吟婉转，极尽放浪承欢，娇声唤着“相公好深……妾身快被相公干碎了”；',
      '- 分工侍奉：极尽贤淑体贴与妻子深情，主动迎合相公每一个动作，任由相公尽情怜爱索取。',
    ],
    // 2. 林芸娘：温婉二房，柔顺似水，低声求怜
    yunnia: [
      '【温婉侧妾·林芸娘专属床笫风格】：芸娘小家碧玉，性子最是柔顺温存，身若无骨！',
      '- 表现：娇喘细细、低泣求饶、含羞带怯任君采撷摆弄，软声娇嗔“相公轻点疼妾身……身子都软了”；',
      '- 侍奉：百依百顺，微闭双眸承受相公的冲击，被顶到深处时双臂紧抱相公脖颈颤抖迎合。',
    ],
    // 3. 小翠：通房大丫鬟，青涩乖巧，全心侍奉
    xiaocui: [
      '【贴身通房·小翠专属床笫风格】：小翠是相公的贴身通房大丫鬟，忠心耿耿，羞涩又万分欢喜！',
      '- 表现：青涩乖巧、含羞带怯，心甘情愿任相公肆意怜惜；',
      '- 侍奉：在榻前主动张口含吮龙根深喉吞吐、在榻上乖顺地架起双腿任由相公进入深捣，喘息呜咽承欢。',
    ],
    // 4. 紫嫣（刘文霞）：市井泼辣娇娘，风情万种，主动榨汁
    liuwenxia: [
      '【美艳老板娘·紫嫣专属床笫风格】：市井美娇娘，身段丰腴雪白，泼辣又极其惹火！',
      '- 表现：风情万种、嘴硬身软、浪语勾人，一边娇哼骂人一边主动扭腰迎合相公每一次深入撞击；',
      '- 互动：浪语催男人“使劲啊……往深里撞……老娘的身子都快被你弄化了”，干柴烈火，肉感拉满。',
    ],
    // 5. 战静：书吏发妻/名门闺秀，外柔内刚，轻咬红唇求饶
    zhanjing: [
      '【县衙少妇·战静专属床笫风格】：平日端庄有心气，被撩拨到极致时难以自抑！',
      '- 表现：微闭星眸、轻咬红唇、玉指深深扣进男人后背，娇躯颤栗承欢，在极致欢愉中低低求饶。',
    ],
    // 6. 杨采儿：知府千金，傲娇贵女，被征服求饶
    yangzhenhua: [
      '【知府千金·杨采儿专属床笫风格】：平日任性娇纵的大小姐，在榻上被彻底征服！',
      '- 表现：又羞又恼、泪眼婆娑、紧抱男人脖颈娇喘求饶“慢些……你这蛮子……弄死本小姐了”。',
    ],
  };

  // ═══════════════ 男方各具特色行房风格 ═══════════════
  const maleStyles = {
    // 1. 于子归：营造行糙汉工头，蛮力狂野，粗野荤话
    npc_2: [
      '【营造行糙汉工头·于子归专属床笫猛男风格】：于子归一身腱子肉、身强体壮、大开大合！',
      '- 动作真刀真枪：褪裙除裤、大手揉搓娇妻丰腴雪白身躯、架起双腿大开大合猛烈挺入抽送撞击，狂猛卖力又小心护着娇妻肚子；',
      '- 粗野热辣荤话：满嘴糙汉干柴烈火的真情粗话（“老子插得你舒坦不舒坦”、“夹得这么紧想吸死老子”、“老子这就顶到底了”），肉感拉满！',
    ],
    // 2. 王甯：茶坊少东家/富贵相公，从容霸道，邪魅风流
    husband: [
      '【富贵少东家·相公王甯专属床笫风格】：从容从容霸道、熟稔调弄、风流有情趣！',
      '- 动作与互动：褪去娘子衣物、覆身而上深入研磨抽送、花样百出；边干边在耳边低沉说情欲荤话，既深情又霸道宠溺。',
    ],
    // 3. 随科：斯文书办，平日懦弱，床笫破防粗喘
    npc_suike: [
      '【县衙斯文书吏·随科专属床笫风格】：平日斯文拘谨，在发妻战静面前被撩拨破防后化身斯文败类！',
      '- 动作与互动：急促粗喘、撕扯亵衣、笨拙又疯狂地在发妻身上索取，既羞且欲“娘子别咬了……为夫给你……”。',
    ],
  };

  const lines = [
    '（【红绡帐暖 · 夫妻私密真刀真枪云雨欢好】：',
    '当前处于隐秘内室床榻之中，正值真刀真枪的房事承欢！',
    '1. 【绝对禁止复读口头禅】：严禁翻来覆去只说“想死老子了/抱抱闻香”等车轱辘废话！必须真刀真枪动起来，推进到实质性身体动作；',
    '2. 【每轮对话必须有实质动作推进】：宽衣解带、揉搓雪肤、覆身挺入、体位变换、粗暴抽插撞击、深入射精受孕，节奏持续向前！',
  ];

  if (isCode) {
    lines.push('3. 【暗号契约】：女方若为婉儿，必须立刻娇羞对出下半句「上山打老虎」！全员彻底解禁！');
  }

  // 针对性注入角色床笫特色
  if (isInitiatorFemale) {
    // 玩家是女角色，AI 代演男人
    const mStyle = maleStyles[partner?.id] || maleStyles.husband;
    lines.push(...mStyle);
  } else {
    // 玩家是男角色（相公），AI 演女眷
    const fStyle = femaleStyles[partner?.id] || femaleStyles.waner;
    lines.push(...fStyle);

    // 多人在场时的通房/侧妾协同
    lines.push('【多美侍寝规则】：在场多位娘子时，大娘子主持、妾室侧卧承欢、通房小翠榻前含吮侍奉，各显风情，争相把相公伺候舒坦！');
  }

  lines.push('）');
  return lines.join('\n');
}

