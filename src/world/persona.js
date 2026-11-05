/**
 * 世情常理：年龄、婚配、身子的单一推导。
 *
 * 三件事之所以放一处，是因为它们互相约束：
 *   叫什么（王婆/李婶/丫鬟）→ 该多大 → 该是什么婚配 → 身子该显示什么
 *
 * 前端不再自己 if (!marital) return '未婚'——缺字段就来这里推。
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** 姓名 + 身份 一起看，推一个合乎世情的岁数 */
export function inferAgeFromIdentity(name = '', role = '', gender = 'female', id = '') {
  const text = `${name} ${role}`;
  const seed = String(id || name).length;

  // 耆老：婆、嬷嬷、老太、妪、翁、老汉、老者、老道、老僧、夫子
  if (/婆|嬷嬷|老太|妪|老母|翁|老汉|老者|老仆|老道|老僧|夫子/.test(text)) {
    return 50 + (seed % 16);          // 50 ~ 65
  }
  // 中年长辈：婶、大娘、大叔、大爷、伯、鸨、巡抚、知府、尚书、侍郎、管事
  if (/婶|大娘|大叔|大爷|伯|鸨|巡抚|知府|尚书|侍郎|管事/.test(text)) {
    return 40 + (seed % 14);          // 40 ~ 53
  }
  // 青年妇人/成熟男子
  if (/嫂|妇|娘子|当家|捕快|镖师|典吏|县丞|掌柜/.test(text)) {
    return 26 + (seed % 12);          // 26 ~ 37
  }
  // 少男少女：丫鬟、丫头、侍女、小厮、书童、学子、学徒、伙计
  if (/丫鬟|丫头|侍女|小厮|书童|学子|学徒|伙计/.test(text)) {
    return 16 + (seed % 6);           // 16 ~ 21
  }
  // 孩童
  if (/婴|童|幼/.test(text)) {
    return 5 + (seed % 9);            // 5 ~ 13
  }
  return 22 + (seed % 14);            // 兜底 22 ~ 35
}

/** 古代婚配状态推导：老妇不会"待字闺中" */
export function inferMaritalStatus(name = '', role = '', age = 20, gender = 'female') {
  const text = `${name} ${role}`;
  if (/寡|孀|亡夫|先夫/.test(text)) return 'widowed';
  if (/妾|二房|小妾|姨娘|通房|侍妾/.test(text)) return 'concubine';

  const a = num(age);
  if (a >= 45) {
    // 长者：四成孀居，六成老伴在堂（按名字定，稳定不随机）
    return (String(name).length % 10 < 4) ? 'widowed' : 'married';
  }
  if (a >= 24) return 'married';
  if (/丫鬟|丫头|姑娘|少女/.test(text) || a < 20) return 'single';
  return 'married';
}

/**
 * 身子的说法（中文，一句话）
 * 不给前端留白，也不许 61 岁还来月事。
 */
export function mensesStatusText(a) {
  if (!a || a.gender !== 'female') return '—';
  const age = num(a.age);
  if (a.pregnancy && !a.pregnancy.born) {
    const months = Math.max(1, Math.floor(num(a.pregnancy.days) / 30));
    return `身怀六甲 · 孕${months}月`;
  }
  if (age >= 50) return '年长绝经 · 子息已毕';
  if (age > 0 && age < 14) return '金钗幼女 · 尚未破瓜';
  if (a.onPeriod) return '月事方至';
  const day = num(a.menses?.cycleDay) || num(a.menses?.dayInCycle) || 1;
  const fertile = day >= 10 && day <= 16;
  return fertile ? `月事周期第 ${day} 天 · 易受孕期` : `月事周期第 ${day} 天`;
}

/** 婚配显示（看板/人物志共用） */
export function maritalTextOf(a, spouseName = '') {
  if (!a) return '—';
  if (a.id === 'husband') return '已婚 · 妻妾在侧';
  if (spouseName) return `已婚 · ${spouseName}`;
  const guessed = a.marital || inferMaritalStatus(a.name, a.role, a.age, a.gender);
  switch (guessed) {
    case 'married': return a.household ? '已婚 · 府内眷属' : '已婚';
    case 'widowed': return '寡居 · 操持营生';
    case 'concubine': return '妾室';
    case 'single': return '未婚 · 待字闺中';
    default: return '未婚 · 待字闺中';
  }
}
