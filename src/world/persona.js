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

/** 性别：名字与身份推导（遵循古风现实逻辑，绝不乱套性别） */
export function inferGenderFromIdentity(name = '', role = '', fallback = 'male') {
  const text = `${name} ${role}`;

  // 1. 男性最高强特征排除：职务、外号与男子常用字（严禁土匪头子、水鬼、统领、举子、税吏变成女子）
  if (/水鬼|统领|副将|将军|参将|总兵|提督|都司|守备|把总|千总|捕头|捕快|衙役|仵作|知府|知县|县令|书办|典吏|牢头|狱卒|税吏|差吏|吏员|师爷|幕僚|举子|秀才|生员|举人|进士|贡生|书生|儒生|文人|掌柜|东家|伙计|小二|跑堂|小厮|书童|更夫|更练|车夫|马夫|铁匠|木匠|石匠|屠户|裁缝|账房|教头|武师|镖头|镖师|船户|船夫|艄公|舵手|纤夫|脚夫|挑夫|力夫|和尚|道士|僧|道|寨主|头目|匪首|水贼|响马|强盗|汉子|老汉|老伯|大爷|大叔|二哥|三弟|郎君|相公|少爷|老爷|公子|夫子|先生/.test(text)) {
    return 'male';
  }

  // 名字里带这些字，铁定是男子
  if (/彪|虎|龙|刚|强|勇|铁|钢|山|川|军|武|雄|豪|霸|峰|磊|鹏|豹|骏|驹|锤|刀|箭|棍|海|松|柏|栋|梁|富|贵|福|寿|康|宁|禄|祥|奎|魁|鬼|鬼头|水鬼/.test(String(name || ''))) {
    return 'male';
  }

  // 2. 女性特征判定
  if (/[娘婆姑嫂妹姐氏妇母女妮媛嫣娟婷妍嫦娥姬妃嫔秀玉香兰翠菊梅莲凤英蓉雪琴珠娇仙微静云采婉霞]/.test(String(name || ''))) return 'female';
  if (/丫鬟|丫头|侍女|婢女|通房|婆子|妇人|寡妇|稳婆|媒婆|绣娘|织女|尼姑|女尼|道姑|妾|二房|如夫人|姨娘|侧室|平妻|正妻|大娘子|主母|王妃|公主|小姐|闺秀|名媛|才女|千金|清倌|花魁|名妓|头牌|歌姬|琴娘|舞姬|女侠|女捕/.test(text)) return 'female';

  return fallback;
}

/** 检测人名是否为机翻怪名、动宾短语或系统残留垃圾 */
export function isOddOrInvalidName(name = '') {
  const s = String(name || '').trim();
  if (!s || s.length < 2 || s.length > 5) return true;
  // 裸露英文 ID、包含下划线或数字
  if (/[a-zA-Z0-9_]/.test(s)) return true;
  // 动宾短语怪名（如：别家散、别人听、听他说、翟六等）
  if (/^(别家|别人|听他|看他|某某|这个|那个|什么|不知|没有|为何|如何)/.test(s)) return true;
  if (/散$|听$|说$|看$|去$|来$|走$|吃$|喝$|买$|卖$|打$/.test(s)) return true;
  // 单字后直接跟数字（如翟六、李四原本是外号，但在名媛佳丽里不合适）
  return false;
}

/** 单一入口：判断一个人物是否符合真正的【天下佳丽】鉴真标准 */
export function isEligibleBeauty(actor) {
  if (!actor || actor.dead) return false;
  if (actor.id === 'husband') return false;
  if (actor.gender !== 'female') return false;

  const name = String(actor.name || '');
  const role = String(actor.role || '');
  const text = `${name} ${role}`;

  // 1. 绝对剔除男性职官、举子秀才、胥吏走卒、机翻怪名与裸露英文
  if (isOddOrInvalidName(name)) return false;
  if (/水鬼|统领|副将|将军|总兵|提督|都司|守备|把总|捕头|捕快|衙役|仵作|知府|知县|县令|官员|税吏|差吏|吏员|书办|典吏|牢头|狱卒|师爷|幕僚|举子|秀才|举人|进士|生员|贡生|书生|儒生|文人|掌柜|东家|伙计|小二|小厮|更夫|更练|车夫|马夫|铁匠|木匠|石匠|屠户|裁缝|账房|教头|武师|镖头|镖师|船户|船夫|艄公|舵手|纤夫|脚夫|挑夫|力夫|和尚|道士|僧|道|寨主|头目|匪|盗|贼|汉|爷|哥|叔|伯|六/.test(text)) {
    return false;
  }
  // 名字中无任何女性柔美字眼且为典型男子名者排除
  if (!/[娘妹姐氏妇母女妮媛嫣娟婷妍嫦娥姬妃嫔秀玉香兰翠菊梅莲凤英蓉雪琴珠娇仙微静云采婉霞月灵珍春秋素红青莹纤蝉怜]/.test(name)) {
    if (/白|瑞|博|轩|浩|杰|俊|峰|涛|健|斌|宇|松|柏|栋|梁|宏|伟|刚|强|勇|毅|诚|谦|德|贤|仁|义|忠|良|成|达|业|功|胜|利|昌|盛|泰|康|平|安|邦|民/.test(name)) {
      return false;
    }
  }

  // 2. 剔除长辈、老妪与仆从粗妇
  if (/(老妪|老太|大娘|大婶|婆婆|王婆|李婶|嬷嬷|稳婆|媒婆|老妇|老母|姑子|师太)/.test(text)) {
    return false;
  }

  return true;
}

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
  const g = String(gender || 'female');
  const seed = String(name || '').length;

  // 长者：四成孀居、六成老伴在堂
  if (a >= 45) return (seed % 10 < 4) ? 'widowed' : 'married';

  // 三十以上：大多已婚（少数寡居）
  if (a >= 30) return (seed % 10 < 1) ? 'widowed' : 'married';

  // 二十四到二十九：一半已婚、一半未许人家（按名字定，稳定不随机）
  if (a >= 24) {
    if (/娘子|嫂|妇人|婶|娘/.test(text)) return 'married';
    return (seed % 10 < 5) ? 'married' : 'single';
  }

  // 十八到二十三：女孩多未出阁；男丁多未娶
  if (a >= 18) {
    if (/娘子|嫂|妇人|婶/.test(text)) return 'married';
    return (seed % 10 < 7) ? 'single' : 'married';
  }

  // 十八以下：除非已有婚约（丫头/通房），一律未婚
  if (/通房|侍妾|妾/.test(text)) return 'concubine';
  return 'single';
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
  if (/千金|小姐|闺秀|公子|才女|少爷|姑娘|贵女/.test(String(a.role || '')) && !a.spouse) {
    return a.gender === 'male' ? '未婚 · 尚未娶亲' : '未婚 · 待字闺中';
  }
  const guessed = a.marital || inferMaritalStatus(a.name, a.role, a.age, a.gender);
  switch (guessed) {
    case 'married': return a.household ? '已婚 · 府内眷属' : '已婚';
    case 'widowed': return '寡居 · 操持营生';
    case 'concubine': return '妾室';
    case 'single': return a.gender === 'male' ? '未婚 · 尚未娶亲' : '未婚 · 待字闺中';
    default: return '未婚 · 待字闺中';
  }
}
