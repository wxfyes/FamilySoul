/**
 * 人口流动：人要因为"有缘由"才来，不能按配额凭空补。
 *
 * 来由只有几种（全部由世界状态决定）：
 *   ① 邻道灾荒       → 逃荒流民入城
 *   ② 本城开产业/招工 → 外乡人来投工
 *   ③ 商路兴旺       → 行商、脚夫、货郎往来
 *   ④ 婚嫁/投亲      → 外地姑娘嫁入、投亲靠友
 *
 * 引擎只负责"来几个人、什么身份"；他们叫什么、有什么过往，可以交给天道去编。
 * 没有哪个理由是"未婚女子不够了"——那是结果，不是原因。
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const SURNAMES = '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦许何吕施张孔曹严华金魏陶姜谢邹苏潘葛范彭鲁韦马苗方俞任袁柳史唐薛雷贺倪汤罗毕郝安常傅康伍余顾孟黄萧尹姚邵汪毛戴宋庞熊纪舒屈项祝董梁杜阮蓝季贾江童颜郭梅盛林钟徐邱骆高夏蔡田樊胡凌霍虞万卢莫房裘解应宗丁宣邓郁单杭洪包诸左石崔吉龚程邢裴陆荣翁荀羊惠甄曲封芮储靳段巫焦巴牧山谷车侯全班秋仲伊宫宁仇栾暴甘厉祖武符刘景詹束龙叶幸司黎薄印宿白怀蒲邰从鄂索咸籍赖卓蔺屠蒙池乔阴胥能苍双闻莘党翟谭贡劳姬申扶堵冉宰郦雍桑桂濮牛寿通边扈燕冀浦尚农温别庄晏柴瞿阎慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡国文寇广禄阙东欧沃利蔚越隆师巩聂晁勾敖融冷訾辛阚简饶空曾沙养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公'.split('');

const GIVEN_F = ['月','兰','荷','蓉','莲','桃','杏','梅','竹','菊','云','霞','霜','雪','玲','琴','棋','绣','锦','素','青','黛','嫣','婵','婉','姝','苹','荇'];
const GIVEN_M = ['安','平','远','山','河','川','木','石','金','玉','文','武','行','舟','客','生','义','信','忠','孝','仁','礼','智','勇','诚','实','江','海','松','柏'];

const ROLES_REFUGEE = ['逃荒来的妇人', '带着孩子的流民', '逃荒的汉子', '流落此地的老妇'];
const ROLES_WORKER_F = ['绣坊帮工', '酒肆帮佣', '医馆学徒', '巷口洗衣女', '茶摊看摊的'];
const ROLES_WORKER_M = ['新来的伙计', '脚夫', '书铺学徒', '药铺抓药的', '走街货郎'];
const ROLES_MERCHANT = ['行商', '贩布的客商', '收山货的行商', '贩盐的客商'];
const ROLES_BRIDE = ['投亲的姑娘', '嫁到城里的新妇', '随兄嫂迁来的姑娘'];

const STREETS = ['street', 'long_street', 'qingshi_street'];

function makeName(world, female) {
  for (let i = 0; i < 8; i += 1) {
    const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
    const pool = female ? GIVEN_F : GIVEN_M;
    const given = pool[Math.floor(Math.random() * pool.length)];
    const name = `${surname}${given}`;
    if (!Object.values(world.actors || {}).some((a) => a && a.name === name)) return name;
  }
  return null;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 造一个人进来（唯一入口） */
export function addMigrant(world, { role, gender, moneyBase }) {
  const female = gender === 'female';
  const name = makeName(world, female);
  if (!name) return null;
  const id = `npc_mig_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const street = pick(STREETS);
  const age = /老妇/.test(role) ? 52 + Math.floor(Math.random() * 10)
    : /妇人|新妇|嫁/.test(role) ? 20 + Math.floor(Math.random() * 10)
      : 17 + Math.floor(Math.random() * 12);
  world.actors[id] = {
    id,
    name,
    role,
    gender: female ? 'female' : 'male',
    age,
    money: Math.round(((moneyBase ?? 1) + Math.random() * 2) * 100) / 100,
    home: street,
    location: street,
    marital: /新妇|嫁/.test(role) ? 'married' : 'single',
    origin: 'spawned',
    relations: { husband: { trust: 10, desire: 0, fear: 0, grievance: 0 } },
    schedule: [],
    createdDay: Number(world.clock?.day) || 1,
  };
  return name;
}

/**
 * 每月人口流动：由世界状态决定来由与人数
 * @returns {{names:string[], reasons:string[]}}
 */
export function runMigration(world, nextEvent, events) {
  const day = Number(world.clock?.day) || 1;
  if (day % 30 !== 0) return { names: [], reasons: [] };

  const names = [];
  const reasons = [];

  // ① 邻道灾荒 → 逃荒流民
  const recentDisaster = (events || []).some((e) => e && e.action === 'disaster')
    || (world.climate?.lastDisasterDay && day - world.climate.lastDisasterDay <= 3);
  if (recentDisaster || Math.random() < 0.15) {
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i += 1) {
      const role = pick(ROLES_REFUGEE);
      const nm = addMigrant(world, { role, gender: /汉子/.test(role) ? 'male' : 'female', moneyBase: 0.1 });
      if (nm) names.push(nm);
    }
    if (names.length) reasons.push('邻道有灾，逃荒的人进城讨口饭吃');
  }

  // ② 城里有产业在招工 → 外乡人来投工
  const props = Array.isArray(world.assets?.properties) ? world.assets.properties : [];
  if (props.length >= 3 && Math.random() < 0.6) {
    const female = Math.random() < 0.6;
    const nm = addMigrant(world, {
      role: female ? pick(ROLES_WORKER_F) : pick(ROLES_WORKER_M),
      gender: female ? 'female' : 'male',
      moneyBase: 0.5,
    });
    if (nm) { names.push(nm); reasons.push('城里几家铺子在招人，外乡来投工'); }
  }

  // ③ 商路兴旺 → 行商客旅
  const richCity = Object.values(world.cities || {}).some((ct) => ct && num(ct.wealth) >= 55 && num(ct.unrest) <= 30);
  if (richCity && Math.random() < 0.5) {
    const nm = addMigrant(world, { role: pick(ROLES_MERCHANT), gender: 'male', moneyBase: 8 });
    if (nm) { names.push(nm); reasons.push('商路太平，行商往来频繁'); }
  }

  // ④ 婚嫁/投亲：城里稳当，才有姑娘嫁进来
  const peaceful = Object.values(world.cities || {}).every((ct) => !ct || num(ct.unrest) <= 35);
  if (peaceful && Math.random() < 0.35) {
    const nm = addMigrant(world, { role: pick(ROLES_BRIDE), gender: 'female', moneyBase: 1 });
    if (nm) { names.push(nm); reasons.push('城里太平，有姑娘投亲嫁进来'); }
  }

  if (names.length) {
    events?.push(nextEvent(world, {
      action: 'migrant', actor: 'system', place: null,
      payload: { text: `${reasons.join('；')}：${names.join('、')}` }, isPublic: true,
    }));
  }
  return { names, reasons };
}
