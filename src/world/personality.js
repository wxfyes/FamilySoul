/**
 * 性格生成器：给每个人一副稳定的脾气，不靠模板一句话糊弄。
 *
 * 规则：
 *  - 同一人物永远生成同一副性格（按 id/姓名/身份做种子，稳定不随机）；
 *  - 身份决定候选范围（正妻不会生成"怯懦怕事"，家丁不会生成"清高要强"）；
 *  - 生成结果落库：personality（给天道看的一句白描）+ traits（可被 [[trait]] 长期改变）。
 */

const WIFE = [
  { k: '温婉', t: '外柔内刚' }, { k: '精明', t: '精明有度' }, { k: '嘴硬', t: '嘴硬心软' },
  { k: '要强', t: '要强爱面子' }, { k: '护短', t: '护短重情' },
];
const CONCUBINE = [
  { k: '温顺', t: '温顺里带精明' }, { k: '怯懦', t: '怯生生怕出错' }, { k: '多疑', t: '多疑善察' },
  { k: '嘴硬', t: '嘴硬心软' }, { k: '护短', t: '护短念旧' },
];
const MAID = [
  { k: '怯懦', t: '胆小却忠心' }, { k: '麻利', t: '手脚麻利' }, { k: '憨直', t: '憨直藏不住话' },
  { k: '细心', t: '心细记性好' }, { k: '嘴甜', t: '嘴甜会来事' },
];
const SERVANT = [
  { k: '木讷', t: '木讷寡言' }, { k: '忠厚', t: '忠厚老实' }, { k: '爽利', t: '爽利干脆' },
  { k: '圆滑', t: '圆滑世故' }, { k: '护短', t: '护短讲义气' },
];
const MERCHANT = [
  { k: '精明', t: '精明会算' }, { k: '圆滑', t: '圆滑世故' }, { k: '豪爽', t: '豪爽敢押注' },
  { k: '多疑', t: '多疑善察' }, { k: '要强', t: '要强不服输' },
];
const OFFICIAL = [
  { k: '谨慎', t: '谨慎怕担责' }, { k: '圆滑', t: '圆滑打太极' }, { k: '刚直', t: '刚直不阿' },
  { k: '贪利', t: '贪利短视' }, { k: '多疑', t: '多疑善察' },
];
const COMMON = [
  { k: '爽利', t: '爽利干脆' }, { k: '木讷', t: '木讷寡言' }, { k: '憨直', t: '憨直热心' },
  { k: '精明', t: '精明会算' }, { k: '怯懦', t: '胆小怕事' }, { k: '圆滑', t: '圆滑世故' },
];

const STYLE = [
  '说话直来直去', '话里总留半句', '先笑再开口', '急起来语速快', '慢条斯理',
  '爱用反问', '客气得生分', '嘴上不饶人', '爱把话说满', '习惯先应下再想法子',
];
const FLAW = [
  '遇事爱自己扛', '容易心软', '记仇', '怕欠人情', '爱面子',
  '藏不住话', '疑心重', '耳根子软', '认死理', '吃软不吃硬',
];

function hash(str) {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function categoryOf(role = '') {
  const r = String(role);
  if (/正妻|发妻|大娘子|夫人/.test(r)) return WIFE;
  if (/二房|如夫人|侧室|妾|通房|姨娘/.test(r)) return CONCUBINE;
  if (/丫鬟|侍女|丫头|婢/.test(r)) return MAID;
  if (/家丁|护院|小厮|仆|门房|车夫|马夫/.test(r)) return SERVANT;
  if (/掌柜|东家|商人|老板|伙计/.test(r)) return MERCHANT;
  if (/知府|知县|县丞|典吏|书吏|官|尚书|巡抚|捕快/.test(r)) return OFFICIAL;
  return COMMON;
}

/**
 * 生成一副稳定性格。
 * @returns {{text:string, traits:Object<string,number>, category:string}}
 */
export function generatePersonality(actor = {}) {
  const pool = categoryOf(actor.role);
  const seed = hash(`${actor.id || ''}|${actor.name || ''}|${actor.role || ''}`);
  const a = pool[seed % pool.length];
  const b = pool[(seed >>> 5) % pool.length];
  const style = STYLE[(seed >>> 9) % STYLE.length];
  const flaw = FLAW[(seed >>> 13) % FLAW.length];
  const traits = {
    [a.k]: 58 + (seed % 23),           // 58~80
    [b.k]: 52 + ((seed >>> 3) % 25),   // 52~76
  };
  const text = `${a.t}，${b.t}；${style}；${flaw}。`;
  return { text, traits, category: 'generated' };
}

/** 缺性格的人补上；已有的一律不动（性格一旦长成，不因重启改脾气） */
export function ensurePersonalities(world) {
  let made = 0;
  for (const actor of Object.values(world?.actors || {})) {
    if (!actor || actor.dead) continue;
    if (actor.personality && typeof actor.personality === 'string' && actor.personality.trim()) continue;
    const p = generatePersonality(actor);
    actor.personality = p.text;
    actor.traits = { ...(actor.traits || {}), ...p.traits };
    actor.personalitySource = 'generated';
    made += 1;
  }
  return made;
}
