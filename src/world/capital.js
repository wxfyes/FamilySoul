/**
 * 京华风云 · 京师与紫禁城全景底座（Capital & Forbidden Palace）
 * 
 * 核心规范：
 *   1. 确立紫禁城内殿、乾清宫、文华殿内阁、武英殿枢密、午门御道等立体空间；
 *   2. 朝廷敕赐相公京师东堂子胡同【京师·提督王府】（九进一品赐第），亲兵校场与正房暖阁齐备；
 *   3. 京师前门大街、天桥市井茶肆、四海钱庄京师分号、五城兵马司等繁华市井落地；
 *   4. 与临江水陆相通（大运河与驿道），双城协同，绝不断绝临江既定祖业。
 */

import { moveActor } from './position.js';

export function buildCapitalPlaces(world) {
  world.places = world.places || {};
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

    // ═══ 2. 京师赐第：一品提督府邸 ═══
    capital_mansion: {
      id: 'capital_mansion',
      name: '京师·提督王府',
      parent: null,
      city: '京城',
      owner: 'husband',
      residence: true,
      grade: 7,
      kind: '王府',
      use: 'residence',
      access: 'family_core',
      exits: ['capital_street', 'capital_mansion__hall', 'capital_mansion__drill', 'capital_mansion__main'],
      desc: '朝廷敕赐从一品水陆提督王甯之京城王府，坐落于东堂子胡同，九进深宏深院，飞檐流丹，朱漆铜钉大门前设下马石与旗杆，中军亲军荷枪实弹日夜巡防。',
    },
    capital_mansion__hall: {
      id: 'capital_mansion__hall',
      name: '京师·提督王府·中堂议事大厅',
      parent: 'capital_mansion',
      city: '京城',
      use: 'hall',
      access: 'guest_main',
      exits: ['capital_mansion', 'capital_mansion__main'],
      desc: '王府前堂迎客议事大殿，高悬御赐“水陆长城”金字大匾，两列楠木交椅，专供接见京中百官、部将禀事及宣读诏书。',
    },
    capital_mansion__main: {
      id: 'capital_mansion__main',
      name: '京师·提督王府·正房暖阁',
      parent: 'capital_mansion',
      city: '京城',
      use: 'bedroom',
      access: 'family_core',
      exits: ['capital_mansion', 'capital_mansion__hall', 'capital_mansion__east', 'capital_mansion__garden'],
      desc: '王府后宅核心寝堂，雕花罗汉榻，锦缎铺陈、地龙温暖，乃相公与正妻沈婉儿、并嫡平妻杨采儿共同起居安歇之处。',
    },
    capital_mansion__east: {
      id: 'capital_mansion__east',
      name: '京师·提督王府·东跨院暖阁',
      parent: 'capital_mansion',
      city: '京城',
      use: 'bedroom',
      access: 'family_inner',
      exits: ['capital_mansion__main'],
      desc: '王府东跨院雅致小院，配二房林芸娘、侧室崔婉宁等家眷起居，曲栏回廊，花木扶疏。',
    },
    capital_mansion__drill: {
      id: 'capital_mansion__drill',
      name: '京师·提督王府·亲兵演武场',
      parent: 'capital_mansion',
      city: '京城',
      use: 'yard',
      access: 'servant_utility',
      exits: ['capital_mansion'],
      desc: '王府侧院亲兵校场，设箭靶、石锁与兵器架，驻扎水陆提督五百亲军精锐护卫，铁甲森严。',
    },
    capital_mansion__garden: {
      id: 'capital_mansion__garden',
      name: '京师·提督王府·后花园流泉阁',
      parent: 'capital_mansion',
      city: '京城',
      use: 'garden',
      access: 'family_private',
      exits: ['capital_mansion__main'],
      desc: '王府后园引玉泉水入池，小桥曲折，内设风雅戏台与茶亭，内眷闲聚游赏之所。',
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
      exits: ['palace_meridian_gate', 'capital_mansion', 'capital_tianqiao', 'capital_bank', 'capital_restaurant', 'capital_garrison', 'dock'],
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

  for (const [pid, pData] of Object.entries(placesToEnsure)) {
    if (!world.places[pid]) {
      world.places[pid] = { ...pData };
      added += 1;
    } else {
      // 补全 exits 与属性
      const cur = world.places[pid];
      cur.name = pData.name;
      cur.city = pData.city;
      cur.exits = Array.from(new Set([...(cur.exits || []), ...(pData.exits || [])]));
      if (pData.owner && !cur.owner) cur.owner = pData.owner;
      if (pData.residence) cur.residence = true;
    }
  }

  // 双向连通街市与府门
  const street = world.places.capital_street;
  if (street) {
    street.exits = Array.from(new Set([...(street.exits || []), 'palace_meridian_gate', 'capital_mansion', 'capital_tianqiao', 'capital_bank']));
  }

  // 确保相公资产账本中登记「京师·提督王府」
  world.assets = world.assets || {};
  world.assets.properties = Array.isArray(world.assets.properties) ? world.assets.properties : [];
  let capProp = world.assets.properties.find((p) => p && (p.id === 'capital_mansion' || p.name.includes('京师·提督王府')));
  if (!capProp) {
    world.assets.properties.push({
      id: 'capital_mansion',
      name: '京师·提督王府（一品赐第）',
      placeId: 'capital_mansion__main',
      status: '一品赐第',
      owner: 'husband',
      keeper: 'husband',
      capital: 1200,
      costSilver: 1200,
      incomePerDay: 0,
      city: '京城',
      desc: '朝廷敕赐水陆提督王甯一品王府，坐落于京师东堂子胡同，九进高门、中军校场齐备，正房暖阁尊居发妻与平妻。',
      staff: 24,
      staffIds: [],
    });
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
