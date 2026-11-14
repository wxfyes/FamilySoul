/**
 * 京华风云 · 京师与紫禁城全景底座（Capital & Forbidden Palace）
 * 
 * 核心规范：
 *   1. 确立紫禁城内殿、乾清宫、文华殿内阁、武英殿枢密、午门御道等立体空间；
 *   2. 朝廷敕赐相公京师东堂子胡同【京师·提督王府】（九进一品赐第，含 21 处大院厅阁）；
 *   3. 京师提督王府健全房间挂载、四位王府专属仆从（大总管王福、亲兵统领赵铁山、老门官周贵、御厨刘掌勺）入驻；
 *   4. 京师正阳门大街、天桥市井茶肆、四海钱庄京师分号、五城兵马司等繁华市井落地；
 *   5. 与临江水陆相通（大运河与驿道），双城协同，绝不断绝临江既定祖业。
 */

import { moveActor } from './position.js';

/**
 * 京师提督王府九进全景房间规格（21 处大院与厅阁）
 */
export const CAPITAL_MANSION_ROOMS = [
  { key: 'gate', name: '朱漆铜钉正大门', use: 'gate', depth: 1, access: 'public_outer', exits: ['capital_street', 'capital_mansion', 'capital_mansion__front', 'capital_mansion__drill'], desc: '一进正门：高阔三丈，门施九路金钉，下马石与旗杆肃立，中军甲士按刀值更。' },
  { key: 'front', name: '门头朝房外院', use: 'yard', depth: 1, access: 'public_outer', exits: ['capital_mansion__gate', 'capital_mansion__gatehouse', 'capital_mansion__stable', 'capital_mansion__sedan'], desc: '一进宽广外院，来访京中文武与各省差官在此递贴候见。' },
  { key: 'gatehouse', name: '门房倒座', use: 'guard', depth: 1, access: 'public_outer', exits: ['capital_mansion__front'], desc: '王府老门房与差役值更之所，通报八方拜帖与军情加急文书。' },
  { key: 'stable', name: '车舆马厩', use: 'stable', depth: 1, access: 'public_outer', exits: ['capital_mansion__front'], desc: '蓄养八匹纯色骏马与军门宝马，提督八抬官轿与车舆停驻于此。' },
  { key: 'drill', name: '亲兵演武校场', use: 'yard', depth: 2, access: 'servant_utility', exits: ['capital_mansion__gate', 'capital_mansion__barracks'], desc: '二进开阔校场，沙袋、石锁、箭靶齐备，五百亲军精锐日日操练枪棒阵法。' },
  { key: 'sedan', name: '仪门轿厅', use: 'hall', depth: 2, access: 'guest_outer', exits: ['capital_mansion__front', 'capital_mansion__reception', 'capital_mansion__council'], desc: '二进仪门，雕梁画栋，文武百官至此下轿下马，肃容整衣而入。' },
  { key: 'reception', name: '迎客小厅', use: 'hall', depth: 3, access: 'guest_outer', exits: ['capital_mansion__sedan', 'capital_mansion__hall'], desc: '三进暖堂，陈设紫檀桌椅与雨前香茶，专供接见故交好友与军营同僚。' },
  { key: 'council', name: '军机议事阁', use: 'hall', depth: 3, access: 'guest_main', exits: ['capital_mansion__sedan', 'capital_mansion__hall'], desc: '三进西翼军机密室，悬挂九边舆图与水陆防线图，相公与心腹参将密商天下兵戈。' },
  { key: 'hall', name: '中堂议事正殿', use: 'hall', depth: 4, access: 'guest_main', exits: ['capital_mansion__reception', 'capital_mansion__council', 'capital_mansion__account', 'capital_mansion__study', 'capital_mansion__main'], desc: '四进宏伟大殿，高悬天子御题“水陆长城”金匾，中置帅案交椅，宣读圣旨与接见九卿之所。' },
  { key: 'account', name: '度支大账房', use: 'office', depth: 5, access: 'guest_main', exits: ['capital_mansion__hall', 'capital_mansion__store'], desc: '五进东侧账房，三位老账房先生拨动算盘，总核天下盐商解饷与王府万两流水。' },
  { key: 'study', name: '文澜御书房', use: 'study', depth: 5, access: 'family_inner', exits: ['capital_mansion__hall', 'capital_mansion__main'], desc: '五进幽静书房，整架经史子集与水战兵法，楠木大案上常备徽墨端砚，相公秉笔批示机要处。' },
  { key: 'main', name: '正房暖阁（上寝大殿）', use: 'bedroom', depth: 6, access: 'family_core', exits: ['capital_mansion__hall', 'capital_mansion__study', 'capital_mansion__east', 'capital_mansion__west', 'capital_mansion__garden'], desc: '六进核心寝堂，雕花黄花梨罗汉榻，铺就厚实锦绣，地龙冬暖夏凉，乃相公与沈婉儿、杨采儿起居尊寝。' },
  { key: 'east', name: '东跨院暖阁', use: 'bedroom', depth: 7, access: 'family_inner', exits: ['capital_mansion__main'], desc: '七进东跨院，小桥清渠绕户，配二房林芸娘、侧室崔婉宁等家眷起居，红梅簇拥，暖香扑鼻。' },
  { key: 'west', name: '西跨院暖阁', use: 'bedroom', depth: 7, access: 'family_inner', exits: ['capital_mansion__main'], desc: '七进西跨院，静雅客堂与雅致卧室，供贵宾家眷与贴身管事停驻。' },
  { key: 'garden', name: '万景御花园', use: 'garden', depth: 8, access: 'family_private', exits: ['capital_mansion__main', 'capital_mansion__shrine'], desc: '八进名胜后园，引玉泉活水为湖，叠太湖奇石，湖心建流泉水榭与赏雪暖香亭，内眷闲聚游赏之胜景。' },
  { key: 'shrine', name: '王府家庙祠堂', use: 'shrine', depth: 8, access: 'family_private', exits: ['capital_mansion__garden'], desc: '八进幽静家庙，铜炉檀香袅袅，供奉天地宗亲与王氏列祖神位。' },
  { key: 'kitchen', name: '御膳大庖厨', use: 'kitchen', depth: 9, access: 'servant_utility', exits: ['capital_mansion__main', 'capital_mansion__servant'], desc: '九进大厨房，十余口铜锅大灶，御厨领衔操刀，备齐南北名馔珍馐。' },
  { key: 'barracks', name: '亲卫侍卫营', use: 'guard', depth: 9, access: 'servant_utility', exits: ['capital_mansion__drill'], desc: '九进侍卫值宿营房，提督带刀亲卫日夜轮值巡弋，金戈铁马气象。' },
  { key: 'servant', name: '后罩房下人院', use: 'servant', depth: 9, access: 'servant_utility', exits: ['capital_mansion__kitchen', 'capital_mansion__store', 'capital_mansion__woodshed'], desc: '九进后排罩房，丫鬟、仆妇与王府杂役起居安歇之处。' },
  { key: 'store', name: '藏金重库', use: 'store', depth: 9, access: 'servant_utility', exits: ['capital_mansion__account', 'capital_mansion__servant'], desc: '双重包铁实木重门，深锁相公历年征战缴获之五十万库银与御赐重宝。' },
  { key: 'woodshed', name: '柴房与冰窖', use: 'store', depth: 9, access: 'servant_utility', exits: ['capital_mansion__servant'], desc: '地底深挖十丈大冰窖，贮藏冬冰以备夏日瓜果冰品，堆叠无烟银丝炭。' },
];

/**
 * 京师提督王府四大贴身家臣与仆从
 */
export const CAPITAL_MANSION_STAFF = [
  {
    id: 'staff_bj_butler',
    name: '王福',
    role: '京师王府大总管',
    gender: 'male',
    age: 48,
    city: '京城',
    location: 'capital_mansion',
    home: 'capital_mansion__servant',
    faction: 'husband',
    desc: '提督王府大内总管，办事精练稳妥，深谙京中大员人情往来与王府度支。',
    relations: { husband: { trust: 95, fear: 20, desire: 0, favor: 95, loyalty: 95 } },
  },
  {
    id: 'staff_bj_guard_leader',
    name: '赵铁山',
    role: '王府亲兵营统领',
    gender: 'male',
    age: 38,
    city: '京城',
    location: 'capital_mansion__drill',
    home: 'capital_mansion__barracks',
    faction: 'husband',
    desc: '从一品提督标下亲兵营官，身经百战，使一口六十斤大刀，誓死保卫相公与内宅安危。',
    relations: { husband: { trust: 96, fear: 10, desire: 0, favor: 95, loyalty: 98 } },
  },
  {
    id: 'staff_bj_doorkeeper',
    name: '周贵',
    role: '王府正门门房头目',
    gender: 'male',
    age: 52,
    city: '京城',
    location: 'capital_mansion__gatehouse',
    home: 'capital_mansion__gatehouse',
    faction: 'husband',
    desc: '老练精明的王府门官，善察言观色，凡京中九卿督抚投递拜帖无不经其甄别。',
    relations: { husband: { trust: 90, fear: 15, desire: 0, favor: 90, loyalty: 92 } },
  },
  {
    id: 'staff_bj_chef',
    name: '刘掌勺',
    role: '王府御膳大厨',
    gender: 'male',
    age: 45,
    city: '京城',
    location: 'capital_mansion__kitchen',
    home: 'capital_mansion__servant',
    faction: 'husband',
    desc: '曾任光禄寺御厨，精通八大菜系与御膳席面，专司相公与夫人日常养生玉食。',
    relations: { husband: { trust: 90, fear: 10, desire: 0, favor: 90, loyalty: 90 } },
  },
];

export function buildCapitalPlaces(world) {
  world.places = world.places || {};
  world.actors = world.actors || {};
  let added = 0;

  const placesToEnsure = {
    // ═══ 1. 紫禁城大内皇宫 ═══
    palace_meridian_gate: {
      id: 'palace_meridian_gate',
      name: '紫禁城·午门御道',
      parent: null,
      city: '京城',
      kind: '皇宫',
      use: 'gate',
      access: 'public_outer',
      exits: ['capital_street', 'palace_throne_hall'],
      desc: '大乾皇城正南午门，城阙巍峨，护城河水环绕。金吾卫与大汉将军顶盔贯甲持戟肃立，每日拂晓百官在此验牒候旨入朝。',
    },
    palace_throne_hall: {
      id: 'palace_throne_hall',
      name: '紫禁城·金銮宝殿（太和殿）',
      parent: null,
      city: '京城',
      kind: '大殿',
      use: 'hall',
      access: 'guest_main',
      exits: ['palace_meridian_gate', 'palace_wenhua', 'palace_wuying', 'palace_qianqing'],
      desc: '九卿文武肃立之所。丹墀朱陛，金漆九龙宝座高悬高堂，天子萧景隆早朝亲御，百官执笏分列两班，商议国是与天下兵戈大政。',
    },
    palace_wenhua: {
      id: 'palace_wenhua',
      name: '紫禁城·文华殿（内阁值房）',
      parent: null,
      city: '京城',
      kind: '值房',
      use: 'office',
      access: 'guest_main',
      exits: ['palace_throne_hall'],
      desc: '首辅崔元礼与内阁大学士秉笔票拟之地，掌管大乾天下奏折机要，文官参预枢密的中枢重地。',
    },
    palace_wuying: {
      id: 'palace_wuying',
      name: '紫禁城·武英殿（军机枢密堂）',
      parent: null,
      city: '京城',
      kind: '军机堂',
      use: 'office',
      access: 'guest_main',
      exits: ['palace_throne_hall'],
      desc: '兵部尚书韩崇与水陆提督军门商议天下戎机之地，壁挂十三省防务与运河防汛总图，总调水陆营汛与边防大军。',
    },
    palace_qianqing: {
      id: 'palace_qianqing',
      name: '紫禁城·乾清宫（御书房）',
      parent: null,
      city: '京城',
      kind: '御书房',
      use: 'private_room',
      access: 'private',
      exits: ['palace_throne_hall', 'palace_garden'],
      desc: '天子萧景隆燕寝与御前密议之所，设金丝楠木御案与青玉香炉，专供皇上私召股肱重臣推心置腹、密谋除奸安邦。',
    },
    palace_garden: {
      id: 'palace_garden',
      name: '紫禁城·御花园（万春亭）',
      parent: null,
      city: '京城',
      kind: '园林',
      use: 'garden',
      access: 'family_private',
      exits: ['palace_qianqing'],
      desc: '大内禁苑，奇石罗列，古柏参天。万春亭倒映碧波，供天子闲庭信步与御前赐宴。',
    },

    // ═══ 2. 京师赐第：一品提督府邸（九进宏制） ═══
    capital_mansion: {
      id: 'capital_mansion',
      name: '京师·提督王府',
      parent: null,
      city: '京城',
      owner: 'husband',
      residence: true,
      grade: 9,
      scale: 9,
      kind: '王府',
      use: 'residence',
      access: 'family_core',
      exits: ['capital_street', 'capital_mansion__gate', 'capital_mansion__hall', 'capital_mansion__main', 'capital_mansion__drill', 'capital_mansion__garden'],
      desc: '朝廷敕赐从一品水陆提督王甯之京城王府，坐落于东堂子胡同，九进深宏深院，飞檐流丹，朱漆铜钉大门前设下马石与旗杆，中军亲军荷枪实弹日夜巡防。',
      rooms: {},
    },

    // ═══ 3. 京城繁华市井与各部司署 ═══
    capital_street: {
      id: 'capital_street',
      name: '京师·正阳门大街',
      parent: null,
      city: '京城',
      kind: '长街',
      use: 'street',
      access: 'public_outer',
      exits: ['palace_meridian_gate', 'capital_mansion', 'capital_mansion__gate', 'capital_tianqiao', 'capital_bank', 'capital_restaurant', 'capital_garrison', 'dock'],
      desc: '大乾京畿第一繁华通衢，八匹马并驰，青石板铺地。两旁酒楼、钱庄、缎庄鳞次栉比，达官显贵车舆与各地举子、商贾摩肩接踵。',
    },
    capital_tianqiao: {
      id: 'capital_tianqiao',
      name: '京师·天桥市井茶肆',
      parent: null,
      city: '京城',
      kind: '市集',
      use: 'shop_floor',
      access: 'public_shop',
      exits: ['capital_street'],
      desc: '京中烟火汇聚之所，走街串巷的货郎、算命摊子、说书打擂、馄饨摊与露天大碗茶，天下消息与市井秘闻流传最速之处。',
    },
    capital_bank: {
      id: 'capital_bank',
      name: '京师·四海钱庄中枢总号',
      parent: null,
      city: '京城',
      owner: 'husband',
      kind: '钱庄',
      use: 'shop_floor',
      access: 'public_shop',
      exits: ['capital_street'],
      desc: '相公王甯名下四海钱庄京师分号，高大红木柜台，铁甲护卫值守，日夜通兑两淮各路会票银信，资力雄厚震惊京华官商。',
    },
    capital_restaurant: {
      id: 'capital_restaurant',
      name: '京师·全聚祥盛德楼',
      parent: null,
      city: '京城',
      kind: '酒楼',
      use: 'restaurant',
      access: 'public_shop',
      exits: ['capital_street'],
      desc: '京师名流聚宴之首选，三层重檐，专做御厨大菜，内阁部臣与各省举子登科答谢宴常设于此。',
    },
    capital_garrison: {
      id: 'capital_garrison',
      name: '京师·五城兵马司官署',
      parent: null,
      city: '京城',
      kind: '官署',
      use: 'office',
      access: 'guest_main',
      exits: ['capital_street'],
      desc: '统辖京城东西南北中五城巡防治安与火盗稽查之官署，班头差役日夜巡弋京城九门内外。',
    },
  };

  // 2.1 健全京师提督王府九进全景房间（21 处大院与厅阁）
  const mansionRoomsDict = {};
  for (const r of CAPITAL_MANSION_ROOMS) {
    const rid = `capital_mansion__${r.key}`;
    placesToEnsure[rid] = {
      id: rid,
      name: `京师·提督王府·${r.name}`,
      parent: 'capital_mansion',
      city: '京城',
      owner: 'husband',
      use: r.use,
      depth: r.depth,
      access: r.access,
      exits: r.exits || ['capital_mansion'],
      desc: r.desc,
      dynamic: false,
    };
    mansionRoomsDict[r.key] = {
      id: rid,
      name: r.name,
      use: r.use,
      depth: r.depth,
      access: r.access,
    };
  }

  for (const [pid, pData] of Object.entries(placesToEnsure)) {
    if (!world.places[pid]) {
      world.places[pid] = { ...pData };
      added += 1;
    } else {
      // 补全 exits 与属性
      const cur = world.places[pid];
      cur.name = pData.name;
      cur.city = pData.city || '京城';
      cur.exits = Array.from(new Set([...(cur.exits || []), ...(pData.exits || [])]));
      if (pData.owner && !cur.owner) cur.owner = pData.owner;
      if (pData.residence) cur.residence = true;
      if (pData.use && !cur.use) cur.use = pData.use;
      if (pData.access && !cur.access) cur.access = pData.access;
      if (pData.desc && !cur.desc) cur.desc = pData.desc;
    }
  }

  // 确保京师提督王府根地点的 rooms 字典完整挂载
  const capMansion = world.places.capital_mansion;
  if (capMansion) {
    capMansion.rooms = capMansion.rooms || {};
    for (const [k, rSpec] of Object.entries(mansionRoomsDict)) {
      capMansion.rooms[k] = { ...rSpec };
    }
    capMansion.grade = 9;
    capMansion.scale = 9;
    capMansion.residence = true;
    capMansion.owner = 'husband';
    capMansion.city = '京城';
    capMansion.exits = Array.from(new Set([...(capMansion.exits || []), 'capital_street', ...Object.keys(mansionRoomsDict).map((k) => `capital_mansion__${k}`)]));
  }

  // 双向连通街市与府门
  const street = world.places.capital_street;
  if (street) {
    street.exits = Array.from(new Set([...(street.exits || []), 'palace_meridian_gate', 'capital_mansion', 'capital_mansion__gate', 'capital_tianqiao', 'capital_bank', 'capital_restaurant', 'capital_garrison']));
  }

  // 2.2 安置京师提督王府专属仆从与家臣
  for (const st of CAPITAL_MANSION_STAFF) {
    if (!world.actors[st.id]) {
      world.actors[st.id] = { ...st };
    } else {
      const cur = world.actors[st.id];
      cur.name = st.name;
      cur.role = st.role;
      cur.city = st.city;
      if (!cur.location) cur.location = st.location;
      if (!cur.home) cur.home = st.home;
      cur.faction = 'husband';
    }
  }

  // 确保相公资产账本中登记「京师·提督王府」（九进一品赐第）
  world.assets = world.assets || {};
  world.assets.properties = Array.isArray(world.assets.properties) ? world.assets.properties : [];
  let capProp = world.assets.properties.find((p) => p && (p.id === 'capital_mansion' || p.name.includes('京师·提督王府')));
  if (!capProp) {
    world.assets.properties.push({
      id: 'capital_mansion',
      name: '京师·提督王府（一品赐第）',
      placeId: 'capital_mansion',
      status: '一品赐第',
      owner: 'husband',
      keeper: 'husband',
      capital: 1200,
      costSilver: 1200,
      incomePerDay: 0,
      city: '京城',
      desc: '朝廷敕赐水陆提督王甯一品王府，坐落于京师东堂子胡同，九进高门、中军校场齐备，正房暖阁尊居发妻与平妻。',
      staff: 24,
      staffIds: ['staff_bj_butler', 'staff_bj_guard_leader', 'staff_bj_doorkeeper', 'staff_bj_chef'],
    });
  } else {
    capProp.placeId = 'capital_mansion';
    capProp.status = '一品赐第';
    capProp.city = '京城';
    capProp.staffIds = Array.from(new Set([...(capProp.staffIds || []), 'staff_bj_butler', 'staff_bj_guard_leader', 'staff_bj_doorkeeper', 'staff_bj_chef']));
  }

  return added;
}

export const initCapitalWorld = buildCapitalPlaces;

export function isCapitalPlace(placeId) {
  if (!placeId) return false;
  return String(placeId).startsWith('capital_') || String(placeId).startsWith('palace_');
}

export function isForbiddenCityPlace(placeId) {
  if (!placeId) return false;
  return String(placeId).startsWith('palace_');
}
