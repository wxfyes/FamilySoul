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
  xinyage: '临江·鑫雅阁',
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
    if (Array.isArray(a.alias) && a.alias.some((al) => al === s || al === coreName)) return true;
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
  const list = (Array.isArray(actors) ? actors : Object.values(actors || {})).filter(
    (a) => a && a.name && !a.dead && a.id !== 'husband',
  );

  const candidates = [];

  // 1. 全名直接命中
  for (const a of list) {
    let pos = str.indexOf(a.name);
    if (pos >= 0) candidates.push({ actor: a, pos, score: 100 });
    if (a.id === 'liuwenxia' && str.includes('紫嫣')) {
      candidates.push({ actor: a, pos: str.indexOf('紫嫣'), score: 95 });
    }
    if (Array.isArray(a.alias)) {
      for (const al of a.alias) {
        if (al && str.includes(al)) {
          candidates.push({ actor: a, pos: str.indexOf(al), score: 90 });
        }
      }
    }
  }

  // 2. 三字姓名之双字名精准命中（如“采儿”命中“杨采儿”、“婉儿”命中“沈婉儿”、“婉宁”命中“崔婉宁”、“映雪”命中“苏映雪”）
  for (const a of list) {
    if (a.name.length >= 3) {
      const given2 = a.name.slice(-2);
      if (given2 && !isGenericAddress(given2) && str.includes(given2)) {
        candidates.push({ actor: a, pos: str.indexOf(given2), score: 85 });
      }
    }
  }

  // 3. 古风称谓组合精准命中（姓氏/名首字 + 尊称后缀，按古代官阶身份分类对齐）
  const honorificRe = /([\u4e00-\u9fa5]{1,2})(大人|知府|知县|府尹|知州|通判|同知|巡抚|总兵|提督|都司|参将|太守|道台|使君|官爷|老爷|千金|大小姐|二小姐|小姐|姑娘|闺秀|娘子|大娘子|二娘子|夫人|少夫人|太太|掌柜|大掌柜|老板娘|老板|朝奉|大厨|管事|头领|姐姐|妹妹|公子|少爷|典吏|书吏)/g;
  let m;
  while ((m = honorificRe.exec(str)) !== null) {
    const prefix = m[1];
    const suffix = m[2];

    const isOfficialHonorific = /大人|知府|知县|府尹|知州|通判|同知|巡抚|总兵|提督|都司|参将|太守|道台|使君|官爷|老爷|典吏|书吏/.test(suffix);
    const isMaidenHonorific = /千金|大小姐|二小姐|小姐|姑娘|闺秀/.test(suffix);
    const isWifeHonorific = /娘子|大娘子|二娘子|夫人|少夫人|太太/.test(suffix);
    const isMerchantHonorific = /掌柜|大掌柜|老板娘|老板|朝奉|大厨|管事|头领/.test(suffix);

    // 第一优先：姓氏匹配 且 身份分类100%相符（高优先级命中国家印绶命官/名门闺秀/主母掌柜）
    const exactCategoryHit = list.find((a) => {
      const nameMatch = a.name.startsWith(prefix) || a.name.includes(prefix);
      if (!nameMatch) return false;
      const roleStr = `${a.role || ''} ${a.title || ''}`;
      if (isOfficialHonorific) {
        // 官场尊称：必须是官员/命官/衙门长官，绝对严禁将千金小姐或家眷认作“大人”
        const isOfficial = /知府|知县|官员|府尹|通判|同知|巡抚|总兵|提督|都司|参将|太守|道台|布政使|按察使|县令|县丞|主簿|典吏|书吏|书办|捕头|官|大人/.test(roleStr);
        const isDaughter = /千金|大小姐|小姐|闺秀|丫鬟|侍女/.test(roleStr);
        return isOfficial && !isDaughter;
      }
      if (isMaidenHonorific) {
        // 闺秀千金尊称：必须是名门千金、小姐、未婚闺秀，严禁命中官员老父
        return /千金|大小姐|小姐|姑娘|闺秀/.test(roleStr);
      }
      if (isWifeHonorific) {
        // 内宅主母妻妾尊称
        return /妻|妾|如夫人|侧室|娘子|大娘子|二娘子|夫人|主母/.test(roleStr);
      }
      if (isMerchantHonorific) {
        // 商贾掌柜管事尊称
        return /掌柜|老板|朝奉|大厨|管事|头领|东家/.test(roleStr);
      }
      return (a.role || '').includes(suffix);
    });

    if (exactCategoryHit) {
      candidates.push({ actor: exactCategoryHit, pos: m.index, score: 92 });
      continue;
    }

    // 第二优先：普通角色名称包含 suffix
    const roleSubHit = list.find((a) => (a.name.startsWith(prefix) || a.name.includes(prefix)) && (a.role || '').includes(suffix));
    if (roleSubHit) {
      candidates.push({ actor: roleSubHit, pos: m.index, score: 80 });
      continue;
    }

    // 第三优先（保底兜底）：仅当未命中特殊排他尊称（大人/千金/小姐）时才允许弱匹配前缀，防止把杨大人匹配给杨采儿
    if (!isOfficialHonorific && !isMaidenHonorific) {
      const weakHit = list.find((a) => a.name.startsWith(prefix) || a.name.includes(prefix));
      if (weakHit) {
        candidates.push({ actor: weakHit, pos: m.index, score: 60 });
      }
    }
  }

  // 4. 根字昵称命中（如静儿、婉儿、芸娘、小翠）
  const nicknameRe = /([\u4e00-\u9fa5]{1,2})(?:儿|娘)/g;
  while ((m = nicknameRe.exec(str)) !== null) {
    const fullNick = m[0];
    const prefix = m[1];
    const exactHit = list.find((a) => a.name.includes(fullNick));
    if (exactHit) {
      candidates.push({ actor: exactHit, pos: m.index, score: 65 });
    } else {
      const rootHit = list.find((a) => a.name.includes(prefix));
      if (rootHit) {
        candidates.push({ actor: rootHit, pos: m.index, score: 50 });
      }
    }
  }

  if (candidates.length === 0) return null;

  // 排序原则：文本中越早出现的人（pos 越小）优先！
  // 比如“采儿，把婉儿叫来”：“采儿”在最前（pos=0），采儿是对话主语，婉儿是被叫来的第三人！
  candidates.sort((x, y) => {
    if (x.pos !== y.pos) return x.pos - y.pos;
    return y.score - x.score;
  });

  return candidates[0].actor;
}
