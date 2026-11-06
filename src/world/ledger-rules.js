/**
 * 入账资格：什么能进哪个账，先定清楚，再写入口。
 *
 * 四本账：
 *   地点账 world.places    —— 只收"地方"（铺面、房间、宅院、街巷），不收"付3两"这种话
 *   产业账 world.assets.properties —— 只收铺号（必须能做生意），不收客房、宅院卧室
 *   人物账 world.actors    —— 只收有人名、有身份、有住处的人；差事名分按行当
 *   银钱账 world.ledger    —— 只收有来路的银两进出（类别白名单）
 */

/** 客房/卧房：是地点，不是产业 */
export const ROOM_WORDS = /上房|客房|房间|厢房|卧房|雅间|寝室|卧房|偏房/;

/** 不是地方的话（付款、数量、动作） */
export const JUNK_PLACE = /付\s*[\d一二三四五六七八九十百]+两|付[一二三四五六七八九十]+两|^[\d一二三四五六七八九十百]+两$|几个|多少|若干|随便|一些|那个|这个/;

/** 产业名：必须是铺号，不能是量词/房间/账单 */
export function isBusinessName(name) {
  const n = String(name || '').trim();
  if (!n || n.length < 2 || n.length > 12) return false;
  if (ROOM_WORDS.test(n)) return false;
  if (JUNK_PLACE.test(n)) return false;
  return /铺|号|栈|坊|楼|店|行|庄|堂|馆|局|肆|轩|斋|园|场/.test(n);
}

/** 地点名：允许房间，但不允许账单/数量 */
export function isPlaceNameOk(name) {
  const n = String(name || '').trim();
  if (!n || n.length > 20) return false;
  if (JUNK_PLACE.test(n)) return false;
  return true;
}

/** 银钱类别白名单（title 归类用） */
export const MONEY_CATEGORIES = {
  income: ['进账', '产业进项', '卖米', '走货回银', '赌坊赢钱', '缴获', '俸禄', '赏赐', '收租'],
  expense: ['买米', '走货本钱', '赌坊输钱', '打点官府', '客栈上房', '雇佣', '工钱', '房租', '租铺', '开销', '税', '罚银', '采购', '军械', '募兵', '聘礼', '抚恤'],
};

/** 这枚铜钱该归哪一类 */
export function moneyCategory(title, delta) {
  const t = String(title || '');
  const pool = Number(delta) >= 0 ? MONEY_CATEGORIES.income : MONEY_CATEGORIES.expense;
  const hit = pool.find((k) => t.includes(k));
  return hit || (Number(delta) >= 0 ? '进账' : '开销');
}
