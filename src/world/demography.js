/**
 * 人口：城里要有人可遇。
 *
 * 规则只做一件事：当"年轻未婚的人"太少时，市井自然会补进来。
 * （卖花的、绣坊帮工、酒肆新来的、医馆学徒——都是真实存在的活人，不是为谁准备的）
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const SURNAMES = '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦许何吕施张孔曹严华金魏陶姜谢邹苏潘葛范彭鲁韦马苗方俞任袁柳史唐薛雷贺倪汤罗毕郝安常傅康伍余顾孟黄萧尹姚邵汪毛戴宋庞熊纪舒屈项祝董梁杜阮蓝季贾江童颜郭梅盛林钟徐邱骆高夏蔡田樊胡凌霍虞万卢莫房裘解应宗丁宣邓郁单杭洪包诸左石崔吉龚程邢裴陆荣翁荀羊惠甄曲封芮储靳段巫焦巴牧山谷车侯全班秋仲伊宫宁仇栾暴甘厉祖武符刘景詹束龙叶幸司黎薄印宿白怀蒲邰从鄂索咸籍赖卓蔺屠蒙池乔阴胥能苍双闻莘党翟谭贡劳姬申扶堵冉宰郦雍桑桂濮牛寿通边扈燕冀浦尚农温别庄晏柴瞿阎慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡国文寇广禄阙东欧沃利蔚越隆师巩聂晁勾敖融冷訾辛阚简饶空曾沙养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公'.split('');

const GIVEN_F = ['月','兰','荷','蓉','莲','桃','杏','梅','竹','菊','云','霞','霜','雪','玲','琴','棋','书画','诗','词','绣','锦','素','青','黛','嫣','婵','婉','姝'];
const GIVEN_M = ['安','平','远','山','河','川','木','石','金','玉','文','武','行','舟','客','生','义','信','忠','孝','仁','礼','智','勇','诚','实','江','海','松','柏'];

const ROLES_F = ['卖花女', '绣坊帮工', '酒肆新来的帮佣', '医馆学徒', '巷口洗衣女', '茶摊看摊的'];
const ROLES_M = ['新来的伙计', '脚夫', '书铺学徒', '船工', '走街货郎', '药铺抓药的'];

const STREETS = ['street', 'long_street', 'qingshi_street'];

/**
 * 补几个市井新人（每月补人与初始播种共用）
 * @returns {string[]} 新增名字
 */
export function addUnmarried(world, want, events, nextEvent, tag = 'newcomer') {
  const added = [];
  for (let i = 0; i < Math.max(0, want); i += 1) {
    const female = Math.random() < 0.75;
    const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
    const given = (female ? GIVEN_F : GIVEN_M)[Math.floor(Math.random() * (female ? GIVEN_F.length : GIVEN_M.length))];
    const name = `${surname}${given}`;
    if (Object.values(world.actors || {}).some((a) => a && a.name === name)) continue;
    const id = `npc_demo_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const role = (female ? ROLES_F : ROLES_M)[Math.floor(Math.random() * (female ? ROLES_F.length : ROLES_M.length))];
    const street = STREETS[Math.floor(Math.random() * STREETS.length)];
    world.actors[id] = {
      id,
      name,
      role,
      gender: female ? 'female' : 'male',
      age: 16 + Math.floor(Math.random() * 9),
      money: Math.round((1 + Math.random() * 4) * 10) / 10,
      home: street,
      location: street,
      marital: 'single',
      origin: 'spawned',
      relations: { husband: { trust: 10, desire: 0, fear: 0, grievance: 0 } },
      schedule: [],
      createdDay: Number(world.clock?.day) || 1,
    };
    added.push(name);
  }
  if (added.length && events && nextEvent) {
    events.push(nextEvent(world, {
      action: tag, actor: 'system', place: null,
      payload: { text: `市井又来了几张新面孔：${added.join('、')}` }, isPublic: true,
    }));
  }
  return added;
}

/** 每月：年轻未婚的人太少就补几个 */
export function runDemography(world, nextEvent, events) {
  const day = Number(world.clock?.day) || 1;
  if (day % 30 !== 0) return [];

  // 只看"未婚女子池"：市井里该有可遇见的姑娘，而不是全城人妇
  const pool = Object.values(world.actors || {}).filter(
    (a) => a && !a.dead && a.gender === 'female' && a.age >= 16 && a.age <= 28 && (!a.marital || a.marital === 'single'),
  );
  if (pool.length >= 18) return [];

  const want = Math.min(5, 18 - pool.length);
  const added = [];
  for (let i = 0; i < want; i += 1) {
    const female = Math.random() < 0.75;
    const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
    const given = (female ? GIVEN_F : GIVEN_M)[Math.floor(Math.random() * (female ? GIVEN_F.length : GIVEN_M.length))];
    const name = `${surname}${given}`;
    if (Object.values(world.actors || {}).some((a) => a && a.name === name)) continue;

    const id = `npc_demo_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const role = (female ? ROLES_F : ROLES_M)[Math.floor(Math.random() * (female ? ROLES_F.length : ROLES_M.length))];
    const street = STREETS[Math.floor(Math.random() * STREETS.length)];
    world.actors[id] = {
      id,
      name,
      role,
      gender: female ? 'female' : 'male',
      age: 16 + Math.floor(Math.random() * 9),   // 16 ~ 24
      money: Math.round((1 + Math.random() * 4) * 10) / 10,
      home: street,
      location: street,
      marital: 'single',
      origin: 'spawned',
      relations: { husband: { trust: 10, desire: 0, fear: 0, grievance: 0 } },
      schedule: [],
      createdDay: day,
    };
    added.push(name);
  }

  if (added.length) {
    events?.push(nextEvent(world, {
      action: 'newcomer', actor: 'system', place: null,
      payload: { text: `市井又来了几张新面孔：${added.join('、')}` }, isPublic: true,
    }));
  }
  return added;
}

/** 初始播种：开局市井就该有可遇见的未婚姑娘（一次性） */
export function seedUnmarriedPool(world, target = 14) {
  const pool = Object.values(world.actors || {}).filter(
    (a) => a && !a.dead && a.gender === 'female' && a.age >= 16 && a.age <= 28 && (!a.marital || a.marital === 'single'),
  );
  const need = Math.max(0, target - pool.length);
  if (!need) return [];
  return addUnmarried(world, need, null, null);
}
