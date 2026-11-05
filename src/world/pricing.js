/**
 * 物价：按史料定，不靠谁随口说。
 *
 * 单位：两（银）。参照明代中后期物价（1 石米 ≈ 0.6 两）。
 * 天道在聊天里报价时，引擎会用这里的区间把它夹回人情之内——
 * 既不让一晚上房钱要三两，也不许白住。
 */

export const PRICES = {
  // 食宿
  inn_room: { min: 0.02, max: 0.1, typical: 0.05, unit: '日', name: '客栈上房' },
  inn_bed: { min: 0.005, max: 0.04, typical: 0.02, unit: '日', name: '客栈通铺' },
  meal: { min: 0.005, max: 0.05, typical: 0.02, unit: '顿', name: '一顿饭' },
  wine: { min: 0.02, max: 0.2, typical: 0.05, unit: '壶', name: '一壶酒' },

  // 行头与军械
  weapon: { min: 0.3, max: 1.2, typical: 0.6, unit: '件', name: '腰刀' },
  armor: { min: 1.0, max: 3.0, typical: 1.8, unit: '件', name: '棉甲' },
  horse: { min: 10, max: 30, typical: 12, unit: '匹', name: '战马' },
  siege: { min: 20, max: 80, typical: 40, unit: '架', name: '攻城器械' },

  // 人力
  wage_day: { min: 0.02, max: 0.08, typical: 0.04, unit: '日', name: '短工工钱' },
  servant_month: { min: 0.3, max: 0.8, typical: 0.5, unit: '月', name: '仆役月钱' },

  // 大件（买产业/宅子用，天道报价时夹在这里）
  shop: { min: 50, max: 3000, typical: 400, unit: '处', name: '一间铺面' },
  mansion: { min: 200, max: 3000, typical: 450, unit: '处', name: '一座宅院' },
};

/** 把"天道随口报的价"夹回人间 */
export function sanePrice(key, requested) {
  const t = PRICES[key];
  if (!t) return Math.max(0, Number(requested) || 0);
  const v = Number(requested);
  if (!Number.isFinite(v) || v <= 0) return t.typical;
  return Math.round(Math.max(t.min, Math.min(t.max, v)) * 100) / 100;
}

export function priceOf(key) {
  return PRICES[key]?.typical ?? 0;
}

/** 给天道看的价目（只给它参考，不替它定价） */
export function priceHint() {
  return Object.entries(PRICES)
    .map(([k, v]) => `${v.name} (${k})：约 ${v.typical} 两/${v.unit}（${v.min}~${v.max}）`)
    .join('；');
}
