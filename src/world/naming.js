/**
 * 命名规则：什么样的词才算"地名"
 *
 * 以前是在各处 if 里堆黑名单（"上方""旁边"…），那是补丁：
 * 每遇到一个新毛病就加一条，永远加不完。
 * 现在把判断收成一条规则，造物门、原文认地点、自检都调这里。
 *
 * 规则：
 *   ① 2~6 个汉字
 *   ② 不含疑问/指示/数量词（什么、哪里、某、一个…）
 *   ③ 不以方位词开头（上/下/里/外/前/后/旁/中/边/内）
 *   ④ 不是纯方位词或代词
 *   ⑤ 不是动词短语（去/来/走/到/找/说/看 开头）
 */

const FORBIDDEN_ANYWHERE = /(什么|哪里|哪儿|这里|那里|怎么|如何|是否|到底|多少|几个)/;
const LOCATIVE_HEAD = /^[上下里外前后旁中边内左右]/;
const PURE_LOCATIVE = /^(上方|下方|上面|下面|左边|右边|旁边|中间|里头|外头|前面|后面|里面|外面|上头|下头|这|那|这处|那处|此处|彼处)$/;
const VERB_HEAD = /^[去来往到找说看走跑回进出入拿抬搬]/;
const PLACE_SUFFIX = /(府|县|州|城|镇|村|街|巷|路|桥|坊|铺|店|楼|阁|轩|堂|园|院|房|屋|厅|馆|肆|栈|仓|码头|渡口|山|寺|庙|观|庵|亭|台|池|塘|庄|园|局|衙|门|坊|市|集|驿|馆)$/;

export const GENERIC_ADDRESS = ['掌柜', '东家', '老板', '老板娘', '夫人', '娘子', '小姐', '公子', '老爷', '婆婆', '婶子', '公公', '伙计', '小二', '跑堂', '客官', '大娘子', '先生', '师父'];

/** 这个词是通称还是人名（通称不当人名匹配） */
export function isGenericAddress(word) {
  const w = String(word || '').trim();
  if (!w) return false;
  return GENERIC_ADDRESS.includes(w);
}

export function isPlaceName(name) {
  const n = String(name || '').replace(/\s/g, '');
  if (!/^[\u4e00-\u9fa5]{2,6}$/.test(n)) return { ok: false, why: '名字长度不对' };
  if (FORBIDDEN_ANYWHERE.test(n)) return { ok: false, why: '含疑问或指示词' };
  if (PURE_LOCATIVE.test(n)) return { ok: false, why: '纯方位词不是地名' };
  if (LOCATIVE_HEAD.test(n)) return { ok: false, why: '方位词开头不像地名' };
  if (VERB_HEAD.test(n)) return { ok: false, why: '动词开头不像地名' };
  return { ok: true, why: '', looksLikePlace: PLACE_SUFFIX.test(n) };
}

/** 规范古风地名映射表（彻底消灭英文幽灵地名） */
export const EN_PLACE_MAP = {
  clinic: '回春医馆',
  workshop: '百工坊',
  dock: '运河码头',
  granary: '临江官仓',
  school: '临江书院',
  tea_house: '临江茶坊老店',
  canal_restaurant: '运河码头三层大酒楼',
  wine_shop: '于家酒肆',
  husband_room: '后宅正房',
  study_room: '东厢书房',
  guest_room: '客房',
  garden: '后院花园',
  kitchen: '庖厨',
  jail: '临江府大牢',
};

/**
 * 统一获取地点对外展示的典雅古风中文名（拒绝任何裸露英文标识）
 */
export function getPlaceDisplayName(world, placeId) {
  if (!placeId) return '别处';
  const cleanId = String(placeId).trim().toLowerCase();
  const p = world?.places?.[placeId] || world?.places?.[cleanId];
  const name = String(p?.name || '').trim();
  if (name && !/^[a-zA-Z0-9_ -]+$/.test(name)) {
    return name;
  }
  if (EN_PLACE_MAP[cleanId]) return EN_PLACE_MAP[cleanId];
  return '别处';
}

/** 从一句话里摘出"像是地名"的片段（给"原话认地点"用） */
export function extractPlaceCandidates(text) {
  const t = String(text || '');
  const out = [];
  const re = /(?:到|去|往|在|回|进|于|至)([\u4e00-\u9fa5]{2,6})/g;
  let m;
  while ((m = re.exec(t))) {
    const cand = m[1];
    if (isPlaceName(cand).ok) out.push(cand);
  }
  return out;
}

/**
 * 人物匹配规则：按名字、昵称、去词缀根字统一匹配世界人物
 * 遵循规则以「类别」表达：
 * 自动识别常见古风称呼前缀（小/老/大/二/三/四/五）与后缀（儿/娘/姐/妹/哥/爷/婆/娘子/掌柜/老板娘）
 */
export function matchActor(actors, searchName) {
  if (!searchName) return null;
  const s = String(searchName).trim().replace(/^【|】$/g, '');
  // 支持分角标头格式：【身份·名字】（如【正妻·婉儿】、【二房·芸娘】）
  const parts = s.split(/[·•]/);
  const coreName = parts[parts.length - 1].trim();

  // 尊称与别名类别映射
  if (s === '正妻' || s === '大娘子' || s === '少夫人') {
    const hit = actors?.waner || Object.values(actors || {}).find(a => a.role === '正妻' || a.label === '正妻');
    if (hit) return hit;
  }
  if (s === '二房' || s === '二娘子' || s === '如夫人' || s === '侧妾') {
    const hit = actors?.yunnia || Object.values(actors || {}).find(a => a.role?.includes('二房') || a.label === '侧妾');
    if (hit) return hit;
  }
  if (s === '丫鬟' || s === '通房丫鬟' || s === '大丫鬟') {
    const hit = actors?.xiaocui || Object.values(actors || {}).find(a => a.servant);
    if (hit) return hit;
  }

  const root = coreName.replace(/^[小老大二三四五]|(?:儿|娘|姐|妹|哥|爷|婆|娘子|大娘子|二娘子|姑娘|掌柜|老板娘|老板|大人|典吏|书吏|知府|知县)$/g, '');
  return Object.values(actors || {}).find((a) => {
    if (!a || !a.name || a.id === 'husband') return false;
    if (a.name === s || a.id === s || a.name === coreName || a.id === coreName) return true;
    if ((s === '紫嫣' || coreName === '紫嫣') && (a.id === 'liuwenxia' || a.name === '刘文霞')) return true;
    if (a.label && (a.label === s || a.label === coreName)) return true;
    if (a.role && (a.role === s || a.role === coreName)) return true;
    if (a.name.includes(coreName) || coreName.includes(a.name)) return true;
    if (root && root.length >= 1 && a.name.includes(root)) return true;
    return false;
  });
}

/**
 * 从一句话中识别相公正在呼唤或针对对话的目标人物（Target Addressee）
 * 规则以「类别」表达：全名优先 > 古风尊称（姓+娘子/老板/掌柜/大人）> 根字昵称（字+儿/娘）
 */
export function findTargetActorInText(actors, text) {
  if (!text) return null;
  const str = String(text);
  // 1. 全名直接命中优先
  for (const a of Object.values(actors || {})) {
    if (!a || !a.name || a.id === 'husband') continue;
    if (str.includes(a.name)) return a;
    if (a.id === 'liuwenxia' && str.includes('紫嫣')) return a;
  }
  // 2. 古风称谓组合命中（姓氏/名首字 + 尊称后缀）
  const honorificRe = /([\u4e00-\u9fa5]{1,2})(娘子|大娘子|二娘子|姑娘|掌柜|老板娘|老板|姐姐|妹妹|大人|典吏|书吏|知县|知府|千金|公子)/g;
  let m;
  while ((m = honorificRe.exec(str)) !== null) {
    const prefix = m[1];
    const hit = Object.values(actors || {}).find((a) => {
      if (!a || !a.name || a.id === 'husband') return false;
      return a.name.startsWith(prefix) || a.name.includes(prefix);
    });
    if (hit) return hit;
  }
  // 3. 根字昵称命中（如静儿、婉儿、芸娘、小翠）
  const nicknameRe = /([\u4e00-\u9fa5]{1,2})(?:儿|娘)/g;
  while ((m = nicknameRe.exec(str)) !== null) {
    const prefix = m[1];
    const hit = Object.values(actors || {}).find((a) => {
      if (!a || !a.name || a.id === 'husband') return false;
      return a.name.includes(prefix);
    });
    if (hit) return hit;
  }
  return null;
}
