/**
 * 产业领域服务（Property Domain Service）
 *
 * 全系统关于铺子、船队、酒楼等产业的唯一真相源与计算入口：
 * 1. 营运状态单一规范定义：isPropertyOperational
 * 2. 额定基准日入单一锚定：getPropertyNominalIncome
 * 3. 每日结算收益单一计算：calculateDailyIncome
 * 4. 视角可见性过滤：visiblePropertiesOf
 * 5. 产业数据完整性对齐：ensurePropertiesSanity
 *
 * 彻底禁止任何外部文件私自发明 floor、open 判定或覆盖冲刷额定日入！
 */

/**
 * 产业是否处于正常营运产生收益的状态（单一规范判定）
 * 包含：正常营业、已开张、正常起航、起航中、营运中、出海中、运营中等
 * 排除：自住府邸、筹备中、筹建中、未开张、歇业、查封、停业
 */
export function isPropertyOperational(prop) {
  if (!prop) return false;
  const st = String(prop.status || '').trim();
  if (['自住府邸', '筹备中', '筹建中', '未开张', '歇业', '查封', '停业'].includes(st)) return false;
  if (/正常营业|已开张|开张|起航|营运|出海|运营|航行/.test(st)) return true;
  // 兜底：如果 status 为空但已有 incomePerDay > 0 且不是府邸住宅，视为营业中
  return Number(prop.incomePerDay) > 0 && !/宅|府邸|后院/.test(String(prop.name || ''));
}

/**
 * 产业额定基准日入（单一出处，防缩水与日入稳定性锚点）
 */
export function getPropertyNominalIncome(prop) {
  if (!prop) return 0;
  const nm = String(prop.name || '');
  const id = String(prop.id || '');

  // 1. 核心重点产业基准锚定（依据军规大事记与既定契纸）
  if (id === 'canal_restaurant' || /运河码头三层大酒楼|运河大酒楼/.test(nm)) {
    return 124.1; // 军规铁律：相公全资盘下盛大开业，日进斗金（日入过百两）
  }
  if (id === 'xinyage' || /鑫雅阁/.test(nm)) {
    return 102.6; // 达官名流清贵雅阁
  }
  if (/新铺/.test(nm)) {
    return 80.7;
  }
  if (/王家运河大船队/.test(nm)) {
    return 43.8; // 旗舰加三艘驳船与二十船工
  }
  if (/码头盐铺/.test(nm)) {
    return 24.5; // 两淮特许官盐专营，暴利商行
  }
  if (/运河茶栈/.test(nm)) {
    return 19.8;
  }
  if (/两条货船及船工安家银/.test(nm)) {
    return 19.1;
  }
  if (/码头茶栈/.test(nm)) {
    return 14.7;
  }
  if (/东跨院杂货铺/.test(nm)) {
    return 14.7;
  }
  if (id === 'tea_house' || /临江茶坊老店/.test(nm)) {
    return 12.4; // 祖传茶坊名点
  }
  if (/运河货船/.test(nm)) {
    return 8.4;
  }
  if (id === 'wine_shop' || /于家酒肆/.test(nm)) {
    return 7.4; // 紫嫣陈酿直供
  }
  if (/王记花店/.test(nm)) {
    return 6.2;
  }
  if (/苏州阊门小茶栈/.test(nm)) {
    return 4.7;
  }
  if (/临街花铺/.test(nm)) {
    return 4.7;
  }
  if (/王记粮铺/.test(nm)) {
    return 4.0;
  }

  // 2. 泛化保底：已有核定收入或按购入本金的 5% 估算，最低不低于 1.5 两
  const cur = Number(prop.incomePerDay) || 0;
  const cost = Number(prop.costSilver) || 0;
  const base = Number(prop.baseIncome) || 0;
  return Math.max(cur, base, Math.round(cost * 0.05 * 10) / 10, 1.5);
}

/**
 * 谁看得见哪些产业（唯一出处）。
 * 相公：自己名下、自己管的、以及无主的老铺；
 * 其他人：只看得见自己名下或自己管的。
 */
export function visiblePropertiesOf(world, actorId) {
  const props = Array.isArray(world?.assets?.properties) ? world.assets.properties : [];
  const id = actorId || 'husband';
  return props.filter((p) => {
    if (!p) return false;
    if (id === 'husband') {
      return p.owner === 'husband' || p.keeper === 'husband' || (!p.owner && !p.keeper);
    }
    return p.owner === id || p.keeper === id;
  });
}

/**
 * 产业日进项结算计算（Single Mutator）
 */
export function calculateDailyIncome(world, prop) {
  // 筹备中的铺子：给两天装修期，到期自动开张（不靠谁去点）
  try {
    const day0 = Number(world.clock?.day) || 1;
    const st = String(prop.status || '');
    if (st === '筹备中' || st === '筹建中' || st === '未开张') {
      const since = Number(prop.openedDay ?? prop.createdDay ?? day0);
      if (day0 - since >= 2) {
        prop.status = /船/.test(String(prop.name || '')) ? '正常起航' : '已开张';
        prop.openedDay = day0;
        console.log(`[Shop] ${prop.name} 装修备齐，自动开张营业`);
      }
    }
  } catch { /* 忽略 */ }

  // 只有真正营运产生收益的才进账：自住府邸、筹建中、歇业一律不进项
  if (!isPropertyOperational(prop)) {
    prop.incomePerDay = 0;
    return 0;
  }

  // 本金
  let capital = Number(prop.capital);
  if (!(capital > 0)) {
    const buy = Number(prop.costSilver);
    const est = getPropertyNominalIncome(prop);
    capital = buy > 0 ? buy : Math.max(100, est * 80);
    prop.capital = Math.round(capital * 100) / 100;
  }

  const city = world.cities?.[prop.city] || Object.values(world.cities || {}).find((c) => c && c.name === prop.city);
  const price = Number(city?.price) || 100;
  const unrest = Number(city?.unrest) || 0;
  const keeper = world.actors?.[prop.keeper];
  const trust = Number(keeper?.relations?.husband?.trust ?? 30);
  const staffCount = Number(prop.staff) || 0;
  const curDay = Number(world.clock?.day) || 1;
  const daysOpen = prop.openedDay != null ? Math.max(1, curDay - Number(prop.openedDay) + 1) : 1;

  // 基础安全底线：严格遵守相公产业基准（绝不缩水）
  const safeBase = getPropertyNominalIncome(prop);

  // 景气系数（以 1.0 为基准微调上下浮动，绝不向下斩断收入）
  let marketFactor = 1.0;
  marketFactor *= 0.85 + Math.min(0.3, (price / 100) * 0.15);
  marketFactor *= 1 - Math.min(0.1, unrest / 500);
  marketFactor *= 0.95 + Math.min(0.2, trust / 300);
  if (staffCount > 0) marketFactor *= 1 + Math.min(0.25, staffCount * 0.05);
  marketFactor *= 1 + Math.min(0.15, (daysOpen - 1) * 0.005);

  delete prop.todayHighlight;
  let eventBonus = 0;

  if (prop.id === 'canal_restaurant' || /运河码头三层大酒楼|运河大酒楼/.test(String(prop.name || ''))) {
    const roll = Math.random();
    if (roll < 0.28) {
      eventBonus = Math.round((35 + Math.random() * 55) * 100) / 100;
      prop.todayHighlight = '两淮盐商汪总商包下二楼天字阁连开七桌水席，进项暴增';
    } else if (roll < 0.48) {
      eventBonus = Math.round((25 + Math.random() * 45) * 100) / 100;
      prop.todayHighlight = '知府设官宴宴请两江巡按，点名运河大酒楼掌勺与紫嫣陈酿';
    } else if (roll < 0.65) {
      eventBonus = Math.round((20 + Math.random() * 35) * 100) / 100;
      prop.todayHighlight = '江南文人雅士包下三楼观景阁斗诗品茗，满堂喝彩';
    } else if (roll < 0.78) {
      eventBonus = Math.round((25 + Math.random() * 40) * 100) / 100;
      prop.todayHighlight = '南北客商在大堂斗酒争彩，于家酒肆特供陈酿售罄';
    }
  } else if (/鑫雅阁|雅阁|雅集/.test(String(prop.name || ''))) {
    const roll = Math.random();
    if (roll < 0.35) {
      eventBonus = Math.round((30 + Math.random() * 50) * 100) / 100;
      prop.todayHighlight = '金陵世家公子包下二层清幽雅阁大摆文墨雅宴，赏银流水进账';
    } else if (roll < 0.60) {
      eventBonus = Math.round((20 + Math.random() * 35) * 100) / 100;
      prop.todayHighlight = '江南名士雅集开宴，点名品鉴阁中上等香茗与珍馐，满座皆惊';
    }
  } else if (prop.id === 'tea_house' || /临江茶坊老店/.test(String(prop.name || ''))) {
    if (Math.random() < 0.35) {
      eventBonus = Math.round((4 + Math.random() * 8) * 100) / 100;
      prop.todayHighlight = '二房如夫人芸娘新制春茶糕出笼，街坊门前排起长龙售罄';
    }
  } else if (/茶栈/.test(String(prop.name || ''))) {
    if (Math.random() < 0.30) {
      eventBonus = Math.round((8 + Math.random() * 18) * 100) / 100;
      prop.todayHighlight = '两淮大茶船靠岸码头，客商大宗清盘数百担头春茶';
    }
  } else if (/船队|货船|漕运/.test(String(prop.name || ''))) {
    if (Math.random() < 0.35) {
      eventBonus = Math.round((10 + Math.random() * 25) * 100) / 100;
      prop.todayHighlight = '顺风顺水，两淮商帮急件货单交船队全权押运，多收两成押金运脚水脚银！';
    }
  } else if (prop.id === 'wine_shop' || /于家酒肆/.test(String(prop.name || ''))) {
    if (Math.random() < 0.30) {
      eventBonus = Math.round((3 + Math.random() * 8) * 100) / 100;
      prop.todayHighlight = '于家酒肆起坛二十坛陈年金桂酿，供大酒楼客席一抢而空';
    }
  } else if (/盐铺/.test(String(prop.name || ''))) {
    if (Math.random() < 0.35) {
      eventBonus = Math.round((8 + Math.random() * 16) * 100) / 100;
      prop.todayHighlight = '官盐引岸拨发新盐引，四乡八镇商号争抢批销，盐铺白银流水入账！';
    }
  }

  // 夜市加成
  try {
    if (prop.nightBoost && (Number(world.clock?.day) || 1) <= Number(prop.nightBoost.untilDay)) {
      marketFactor *= 1 + (Number(prop.nightBoost.rate) || 0.3);
    }
  } catch { /* 忽略 */ }

  let gain = Math.round((Math.max(safeBase * marketFactor, safeBase) + eventBonus) * 100) / 100;
  if (gain < safeBase) gain = safeBase;

  const reinvest = isPropertyOperational(prop) ? 0.25 : 0;
  if (reinvest > 0) prop.capital = Math.round((capital + gain * reinvest) * 100) / 100;

  // 核心铁律：只增不减
  prop.incomePerDay = Math.round(Math.max(Number(prop.incomePerDay) || 0, safeBase, gain) * 100) / 100;
  prop.baseIncome = safeBase;
  return gain;
}

