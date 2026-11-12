import { trimMemories } from './memory.js';
import { ensureResidence } from './residence.js';
import { inferAgeFromIdentity, inferMaritalStatus, inferGenderFromIdentity } from './persona.js';
import { isPropertyOperational, getPropertyNominalIncome } from './employment.js';
/**
 * 世界自愈 —— 不靠人管，账本坏了它自己修
 *
 * 原则：
 *  1. 只修「确定是错」的东西（越界、失效、堆积、重名），**不猜剧情**；
 *  2. 每处修复都返回一句人话，写进日志，方便回查；
 *  3. 幂等：健康的账本调用它什么都不会变。
 */

const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n) || 0));

const HOME_FALLBACK = 'backyard';

/**
 * @param {object} world 会被就地修改
 * @returns {string[]} 修复记录（空数组 = 本来就没病）
 */
export function healWorld(world) {
  const fixes = [];
  if (!world || typeof world !== 'object') return fixes;

  // ① 现银不能为负
  if (!(Number(world.assets?.silver) >= 0)) {
    fixes.push(`现银 ${world.assets?.silver} → 0`);
    world.assets = world.assets || {};
    world.assets.silver = 0;
  }

  // ② 产业收入不能为负、不能是 NaN
  for (const p of world.assets?.properties || []) {
    if (!(Number(p?.incomePerDay) >= 0)) {
      fixes.push(`${p.name} 日入 ${p.incomePerDay} → 0`);
      p.incomePerDay = 0;
    }
  }

  // ③ 关系数值夹紧到 0~100
  for (const a of Object.values(world.actors || {})) {
    const rel = a?.relations?.husband;
    if (!rel) continue;
    for (const f of ['trust', 'desire', 'fear', 'grievance']) {
      if (typeof rel[f] !== 'number' || !Number.isFinite(rel[f])) {
        fixes.push(`${a.name}.${f} 非法 → 0`);
        rel[f] = 0;
      } else if (rel[f] < 0 || rel[f] > 100) {
        const before = rel[f];
        rel[f] = clamp(rel[f], 0, 100);
        fixes.push(`${a.name}.${f} ${before} → ${rel[f]}`);
      }
    }
  }

  // ④ 人物位置失效 → 送回住处
  for (const a of Object.values(world.actors || {})) {
    if (!a?.location) continue;
    if (world.places?.[a.location]) continue;
    const home = a.home && world.places?.[a.home] ? a.home : HOME_FALLBACK;
    if (world.places?.[home]) {
      fixes.push(`${a.name} 位置失效(${a.location}) → ${world.places[home].name}`);
      a.location = home;
    } else {
      const first = Object.keys(world.places || {})[0];
      if (first) {
        fixes.push(`${a.name} 无家可归 → ${world.places[first].name}`);
        a.location = first;
      }
    }
  }

  // ⑤ 重名地点合并（保留有 rooms、出口更全或有人员资产的真实实体，合并 exits）
  const byName = new Map();
  for (const [id, p] of Object.entries(world.places || {})) {
    const nm = String(p?.name || '');
    if (!nm) continue;
    if (!byName.has(nm)) {
      byName.set(nm, id);
      continue;
    }
    const oldId = byName.get(nm);
    const oldPl = world.places[oldId];
    // 智能选择保留哪个：优先保留标准前缀实体（如 xinyage/place_*），杜绝 project_* 临时自增 ID
    const isStd = (key) => !key.startsWith('project_');
    const oldScore = (oldPl?.rooms ? 10 : 0) + (Array.isArray(oldPl?.exits) ? oldPl.exits.length : 0) + (isStd(oldId) ? 50 : 0);
    const newScore = (p?.rooms ? 10 : 0) + (Array.isArray(p?.exits) ? p.exits.length : 0) + (isStd(id) ? 50 : 0);
    const keep = newScore > oldScore ? id : oldId;
    const drop = newScore > oldScore ? oldId : id;
    const keepPl = world.places[keep];
    const dropPl = world.places[drop];

    if (keepPl) {
      keepPl.exits = Array.isArray(keepPl.exits) ? keepPl.exits : [];
      for (const ex of (dropPl?.exits || [])) {
        if (!keepPl.exits.includes(ex) && ex !== keep) keepPl.exits.push(ex);
      }
    }
    for (const a of Object.values(world.actors || {})) {
      if (a?.location === drop) a.location = keep;
    }
    delete world.places[drop];
    byName.set(nm, keep);
    fixes.push(`重名地点「${nm}」合并（保留 ${keep}，合并清理 ${drop}）`);
  }

  // ⑤.5 非法/口语误伤地点清理（如"就行"、"不行"、"什么铺"等）
  const junkPlaceRe = /^(?:院中|院子里|庭院|院里|院|屋里|屋中|房中|屋内|屋里头|厅上|堂中|门口|门外|就行|不行|可行|成行|得行|行不行|过去|过去看|过去坐|应付|对付|应付过去|看看|看一下|商量一下|知会一声)$/;
  for (const [id, pl] of Object.entries(world.places || {})) {
    if (!pl) continue;
    const nm = String(pl.name || '').trim();
    if (junkPlaceRe.test(nm)) {
      delete world.places[id];
      fixes.push(`清理垃圾地点「${nm}」(${id})`);
      for (const a of Object.values(world.actors || {})) {
        if (a && a.location === id) {
          a.location = a.id === 'husband' ? 'husband_room' : 'tea_house';
        }
      }
    }
  }

  // ⑥ 数组上限
  const trim = (key, max, label) => {
    if (Array.isArray(world[key]) && world[key].length > max) {
      const over = world[key].length - max;
      world[key] = world[key].slice(-max);
      fixes.push(`${label}超出上限，丢弃最旧 ${over} 条`);
    }
  };
  trim('pending', 8, '暗涌');
  trim('proactive', 8, '推送');
  const memDropped = trimMemories(world);
  if (memDropped > 0) fixes.push(`记忆按留存规则清理 ${memDropped} 条（先清公告）`);
  trim('clues', 60, '线索');
  trim('appointments', 20, '约定');

  // ⑦ 陈旧约定（逾期超过两天）→ 当作失约处理，别永远挂着
  const nowHour = (Number(world.clock?.day) || 1) * 24 + (Number(world.clock?.hour) || 0);
  const stale = (world.appointments || []).filter(
    (a) => a && Number(a.day) * 24 + Number(a.hour) < nowHour - 48,
  );
  if (stale.length > 0) {
    world.appointments = (world.appointments || []).filter((a) => !stale.includes(a));
    fixes.push(`清理 ${stale.length} 条逾期两天以上的旧约定`);
  }

  // ⑦.5 承诺/暗涌的日期不能离谱（曾出现「还有 118 天」这种）
  const today = Number(world.clock?.day) || 1;
  for (const pr of world.promises || []) {
    const d = Number(pr.due);
    if (!Number.isFinite(d) || d < 0 || d > today + 30) {
      fixes.push(`承诺日期 ${pr.due} → ${today + 3}（${String(pr.text || '').slice(0, 10)}）`);
      pr.due = today + 3;
    }
  }
  for (const pd of world.pending || []) {
    const d = Number(pd.due);
    if (!Number.isFinite(d) || d < 0 || d > today + 30) {
      fixes.push(`暗涌日期 ${pd.due} → ${today + 7}`);
      pd.due = today + 7;
    }
  }

  // ⑧ 记忆净化与去重（消除前20字符重复的陈旧记忆）
  if (Array.isArray(world.memories)) {
    const before = world.memories.length;
    world.memories = world.memories.filter((m) => m && String(m.text || '').trim());
    const seenMem = new Map();
    const dedupedMem = [];
    let dupCount = 0;
    for (const m of world.memories) {
      const key = String(m.text || '').trim().slice(0, 20);
      if (seenMem.has(key)) {
        dupCount += 1;
        const old = seenMem.get(key);
        if (String(m.text || '').length > String(old.text || '').length) {
          const idx = dedupedMem.indexOf(old);
          if (idx !== -1) dedupedMem[idx] = m;
          seenMem.set(key, m);
        }
      } else {
        seenMem.set(key, m);
        dedupedMem.push(m);
      }
    }
    world.memories = dedupedMem;
    if (dupCount > 0) fixes.push(`记忆去重：清理并合并 ${dupCount} 条重复记忆`);
  }

  // ⑧.1 地点归属自愈（酒楼、院落子房间继承 owner，公共设施补齐 public 属性）
  if (world.places && typeof world.places === 'object') {
    for (const [id, p] of Object.entries(world.places)) {
      if (!p) continue;
      // 公共场所补齐 public
      if (/长街|街|码头|城门|公堂|牢|大牢|衙门|寺|桥|驿站|客栈大堂|集市|市井/.test(p.name || id)) {
        if (!p.public) p.public = true;
        continue;
      }
      // 大酒楼子房间归属相公
      if (id.startsWith('place_44__') || p.parent === 'place_44') {
        if (!p.owner) { p.owner = 'husband'; fixes.push(`地点归属：补全大酒楼房间「${p.name || id}」归相公`); }
        continue;
      }
      // 鑫雅阁子房间归属苏迎雪
      if (id.startsWith('res_xinyage__') || p.parent === 'res_xinyage') {
        if (!p.owner) { p.owner = world.places.res_xinyage?.owner || 'suyingxue'; fixes.push(`地点归属：补全鑫雅阁房间「${p.name || id}」归苏迎雪`); }
        continue;
      }
      // 通用父地点继承
      if (p.parent && world.places[p.parent]?.owner && !p.owner) {
        p.owner = world.places[p.parent].owner;
        fixes.push(`地点归属：补全「${p.name || id}」归属 ${p.owner}`);
      }
    }
  }

  // ⑨ 居所不变量守护：随科与静儿的家为随家小院，绝不可将县衙当作家
  for (const a of Object.values(world.actors || {})) {
    if (!a) continue;
    if (a.id === 'zhanjing' || a.id === 'npc_4' || a.name === '随科') {
      if (a.home === 'yamen' || !a.home) {
        a.home = 'suijia_house';
        fixes.push(`纠正 ${a.name} 住处为随家小院`);
      }
    }
  }

  // ⑩ 客栈私密客房退房：相公不在上房时，伴侣自动退房回自家铺子，严禁当钉子户
  const husbandLoc = world.actors?.husband?.location;
  if (husbandLoc !== 'inn_room') {
    for (const a of Object.values(world.actors || {})) {
      if (a && a.id !== 'husband' && a.location === 'inn_room') {
        const home = (a.home && world.places?.[a.home]) ? a.home : 'wine_shop';
        a.location = home;
        fixes.push(`相公已离客栈，${a.name}退房归位至${world.places?.[home]?.name || home}`);
      }
    }
  }

  // ⑪ 夜间作息不变量守护（21:00 - 06:00 亥时至卯时）
  const hour = Number(world.clock?.hour) || 0;
  const isNight = hour >= 21 || hour < 6;
  if (isNight) {
    for (const a of Object.values(world.actors || {})) {
      if (!a || a.dead || a.id === 'husband') continue;
      // 王府内眷各安其所：正房大娘子在正房，二房芸娘在西厢房，侧室婉宁在东跨院
      if (a.id === 'yunnia' || a.name === '林芸娘') {
        const dest = world.places?.wang_mansion_west ? 'wang_mansion_west' : 'husband_room';
        if (a.location !== dest && a.location !== husbandLoc) {
          fixes.push(`内眷归位：二房芸娘回西厢房歇息`);
          a.location = dest;
          a.home = dest;
        }
      } else if (a.name === '崔婉宁') {
        const dest = world.places?.wang_mansion_east ? 'wang_mansion_east' : 'husband_room';
        if (a.location !== dest && a.location !== husbandLoc) {
          fixes.push(`内眷归位：侧室崔婉宁回东跨院歇息`);
          a.location = dest;
          a.home = dest;
        }
      } else if (a.household || ['waner', 'xiaocui'].includes(a.id)) {
        const isSafeHome = ['backyard', 'husband_room'].includes(a.location);
        if (!isSafeHome && a.location !== husbandLoc) {
          const dest = world.places?.husband_room ? 'husband_room' : 'backyard';
          fixes.push(`夜深露重，内眷${a.name}从${world.places?.[a.location]?.name || a.location}归宅安歇`);
          a.location = dest;
        }
      }
      // 市井良家女眷（静儿、杨采云）：深夜绝不滞留官府公堂或街头
      if (['zhanjing', 'yangcaiyun'].includes(a.id)) {
        if (['yamen', 'street'].includes(a.location)) {
          const home = (a.home && world.places?.[a.home]) ? a.home : (a.id === 'zhanjing' ? 'suijia_house' : 'goods_shop');
          fixes.push(`夜深闭市，${a.name}回${world.places?.[home]?.name || home}安歇`);
          a.location = home;
        }
      }
    }
  }

  // ⑫ 清洗历史遗留查账/暗账污染线索与陈旧任务（必须同时匹配 text 与 desc）
  const auditPollutionRe = /(账册|底册|底账|暗账|税册|沈家账本|私改月息|查账|理账|脏账|高利贷|底档|旧卷房|流水誊抄|按手印|对清账目|盘账|对好的账|铺账|对出账目|送对清)/;
  if (Array.isArray(world.clues)) {
    const beforeClues = world.clues.length;
    world.clues = world.clues.filter((c) => !auditPollutionRe.test(c?.text || c?.desc || ''));
    if (world.clues.length !== beforeClues) {
      fixes.push(`清洗 ${beforeClues - world.clues.length} 条陈旧查账污染线索`);
    }
  }
  if (Array.isArray(world.promises)) {
    const beforePromises = world.promises.length;
    world.promises = world.promises.filter((p) => !/(翟家底账|县衙脏账|高利贷字据|拾掇高利贷|随科画押|私改月息|对清账目|查账|送与相公)/.test(p?.text || ''));
    if (world.promises.length !== beforePromises) {
      fixes.push(`清洗 ${beforePromises - world.promises.length} 条陈旧查账差事`);
    }
  }

  // ⑮ 正房寝堂门禁铁律：正房（husband_room）及内室（wang_mansion_west, wang_mansion_east）严禁伙计、跑堂、家丁及外人逗留
  try {
    for (const a of Object.values(world.actors || {})) {
      if (!a || a.dead) continue;
      const loc = String(a.location || '');
      const isChamber = loc === 'husband_room' || loc === 'wang_mansion_west' || loc === 'wang_mansion_east';
      if (!isChamber) continue;
      const isMasterFamily = a.id === 'husband'
        || ['waner', 'yunnia', 'xiaocui'].includes(a.id)
        || /正妻|二房|如夫人|侧室|侍妾|通房/.test(String(a.role || ''));
      if (!isMasterFamily) {
        let dest = world.places?.tea_house ? 'tea_house' : 'street';
        if (/伙计|跑堂/.test(String(a.role || ''))) {
          dest = world.places?.tea_house ? 'tea_house' : (world.places?.['place_44__f1'] ? 'place_44__f1' : 'street');
          if (a.home === 'husband_room') a.home = 'tea_house';
          if (a.work === 'husband_room') a.work = 'tea_house';
        } else if (/家丁|护院|门房/.test(String(a.role || ''))) {
          dest = world.places?.['husband_room__gate'] ? 'husband_room__gate' : 'street';
        }
        fixes.push(`正房门禁自愈：${a.name}（${a.role}）移出寝堂，归位于${world.places?.[dest]?.name || dest}`);
        a.location = dest;
        delete a.activity;
      }
    }
  } catch { /* 忽略 */ }

  // ⑭ 世情自愈：姓名带"婆/嬷/老/翁"却是少年岁数的，按称谓改正；绝经者清月事
  try {
    for (const a of Object.values(world.actors || {})) {
      if (!a || a.dead) continue;
      // 明显男子名却被当成女子 → 纠正
      if (a.gender === 'female' && /彪|虎|龙|刚|强|勇|铁|钢|军|武|雄|豪|霸|峰|磊|鹏|豹|骏|驹/.test(String(a.name || ''))) {
        a.gender = 'male';
        fixes.push(`${a.name}性别校正为男（名字是男子名）`);
      }
      // 性别不许留 unknown：看不出女子特征就当男子
      if (!a.gender || a.gender === 'unknown') {
        a.gender = inferGenderFromIdentity(a.name, a.role, 'male');
        fixes.push(`${a.name}性别校正为${a.gender === 'male' ? '男' : '女'}`);
      }
      const text = `${a.name || ''} ${a.role || ''}`;
      const looksOld = /婆|嬷嬷|老太|妪|翁|老汉|老者/.test(text);
      if (looksOld && Number(a.age) < 45) {
        const before = Number(a.age) || 0;
        a.age = inferAgeFromIdentity(a.name, a.role, a.gender, a.id);
        fixes.push(`${a.name}（原${before}岁）校正为${a.age}岁`);
        if (a.age >= 50) { delete a.menses; a.onPeriod = false; }
      }
      // 名分纠正：通房/侍妾/姨娘一律是妾室，不能被当成"已婚"或"待字闺中"
      if (/通房|侍妾|小妾|姨娘/.test(String(a.role || '')) && a.marital !== 'concubine') {
        a.marital = 'concubine';
        fixes.push(`${a.name}名分校正为妾室`);
      }
      // 少爷小姐才女：没成亲就是未婚，不能因为"住在府里"就算已婚
      const isChild = /小姐|公子|才女|少爷|姑娘/.test(String(a.role || ''));
      if (isChild && a.marital === 'married' && !a.spouse) {
        a.marital = 'single';
        fixes.push(`${a.name}名分校正为未婚`);
      }

      // ⑯ 红颜羁绊与相好名分自愈：
      // 信任 >= 80 且欲望 >= 70，或身怀相公骨肉，或已有私情密约（柳如烟/紫嫣/静儿等）：确立相好与已行房事实
      if (a.gender === 'female' && a.id !== 'husband') {
        const rel = a.relations?.husband || {};
        const t = Number(rel.trust) || 0;
        const d = Number(rel.desire) || 0;
        const hasBaby = Boolean(a.pregnancy && a.pregnancy.father === 'husband');
        if ((t >= 80 && d >= 70) || hasBaby || a.name === '柳如烟' || a.id === 'yangcaiyun') {
          a.intimacy = a.intimacy || {};
          if (!a.intimacy.consummated) {
            a.intimacy.consummated = true;
            if (!(a.intimacy.level > 0)) a.intimacy.level = 1;
            a.bondsWithHusband = '相好';
            fixes.push(`红颜相好确立：${a.name}（信${t}/欲${d}）正式立为相好羁绊`);
          }
        }
      }
      if (!a.marital && Number(a.age) >= 18 && a.id !== 'husband') {
        a.marital = isChild ? 'single' : (a.spouse ? 'married' : (a.household ? 'married' : inferMaritalStatus(a.name, a.role, a.age, a.gender)));
      }
      if (Number(a.age) >= 50 && a.menses) {
        delete a.menses;
        a.onPeriod = false;
        fixes.push(`${a.name}绝经，清掉月事`);
      }
    }
  } catch { /* 忽略 */ }

  // ⑮ 运河大酒楼单一真实地点自愈、天字阁房间实例化与真实人物落地
  try {
    world.places = world.places || {};
    world.actors = world.actors || {};

    // 1. 确立 place_44 为大酒楼唯一真实物理实体，彻底清理幽灵空壳 canal_restaurant
    const p44 = world.places['place_44'];
    const pCanal = world.places['canal_restaurant'];
    if (p44 && pCanal) {
      // 将 canal_restaurant 的出入口与引用并入 place_44
      for (const ex of (pCanal.exits || [])) {
        if (!p44.exits.includes(ex) && ex !== 'place_44') p44.exits.push(ex);
      }
      delete world.places['canal_restaurant'];
      fixes.push('彻底清理运河码头大酒楼幽灵空壳 canal_restaurant，统归真实实体 place_44');
    }

    const restPlaceId = p44 ? 'place_44' : 'canal_restaurant';
    const restPlace = world.places[restPlaceId];
    if (restPlace) {
      restPlace.name = '运河码头三层大酒楼';
      restPlace.owner = 'husband';
      restPlace.use = 'restaurant';
      restPlace.access = 'public_shop';

      // 2. 真实实例化三层天字阁、二层雅阁、清幽雅间与内账房物理房间
      const f3Id = `${restPlaceId}__f3`;
      if (!world.places[f3Id]) {
        world.places[f3Id] = {
          id: f3Id,
          name: '运河码头三层大酒楼·三层天字阁',
          parent: restPlaceId,
          floor: 3,
          use: 'shop_floor',
          access: 'public_shop',
          desc: '三层最顶格至尊包席雅间，朱漆雕栏、红木八仙桌，凭窗饱览千里运河千帆竞渡，乃扬州盐商汪总商包席办寿宴之要所。',
          exits: [restPlaceId, `${restPlaceId}__f2`],
        };
        fixes.push(`生成真实房间实体：${world.places[f3Id].name}`);
      }

      const f2Id = `${restPlaceId}__f2`;
      if (!world.places[f2Id]) {
        world.places[f2Id] = {
          id: f2Id,
          name: '运河码头三层大酒楼·二层雅阁',
          parent: restPlaceId,
          floor: 2,
          use: 'shop_floor',
          access: 'public_shop',
          desc: '酒楼二层临河雅座，茶香酒暖，常有两淮过往客商在此饮酒议事。',
          exits: [restPlaceId, `${restPlaceId}__f1`, f3Id],
        };
        fixes.push(`生成真实房间实体：${world.places[f2Id].name}`);
      }

      const privateId = `${restPlaceId}__private`;
      if (!world.places[privateId]) {
        world.places[privateId] = {
          id: privateId,
          name: '运河码头三层大酒楼·清幽雅间',
          parent: restPlaceId,
          floor: 2,
          use: 'shop_floor',
          access: 'public_shop',
          desc: '酒楼二层深处独立清幽小筑，隔音极佳，珠帘半卷，焚有沉香，乃东家私会红颜、拉人单独密谈商道机要之雅间单间。',
          exits: [restPlaceId, f2Id],
        };
        fixes.push(`生成真实房间实体：${world.places[privateId].name}`);
      }

      const officeId = `${restPlaceId}__office`;
      if (!world.places[officeId]) {
        world.places[officeId] = {
          id: officeId,
          name: '运河码头三层大酒楼·内账房',
          parent: restPlaceId,
          floor: 1,
          use: 'shop_floor',
          access: 'public_shop',
          desc: '大酒楼一层内进账房重地，设红木算盘与账簿柜架，周账房常年在此核对席面银钱流水。',
          exits: [restPlaceId],
        };
        fixes.push(`生成真实房间实体：${world.places[officeId].name}`);
      }

      const f1Id = `${restPlaceId}__f1`;
      if (!world.places[f1Id]) {
        world.places[f1Id] = {
          id: f1Id,
          name: '运河码头三层大酒楼·一层大堂',
          parent: restPlaceId,
          floor: 1,
          use: 'shop_floor',
          access: 'public_shop',
          desc: '一楼迎宾散座与柜台账房，青石铺地，伙计穿梭跑堂，热气腾腾。',
          exits: [restPlaceId, 'dock', f2Id, officeId],
        };
        fixes.push(`生成真实房间实体：${world.places[f1Id].name}`);
      }

      // 确保父建筑 exits 包含所有楼层与单间
      restPlace.exits = Array.isArray(restPlace.exits) ? restPlace.exits : [];
      for (const eid of ['dock', f1Id, f2Id, f3Id, privateId, officeId]) {
        if (!restPlace.exits.includes(eid)) restPlace.exits.push(eid);
      }

      // 确保子房间 exits 互相连通
      if (world.places[f1Id] && !world.places[f1Id].exits.includes(f2Id)) world.places[f1Id].exits.push(f2Id);
      if (world.places[f2Id]) {
        if (!world.places[f2Id].exits.includes(f1Id)) world.places[f2Id].exits.push(f1Id);
        if (!world.places[f2Id].exits.includes(f3Id)) world.places[f2Id].exits.push(f3Id);
        if (!world.places[f2Id].exits.includes(privateId)) world.places[f2Id].exits.push(privateId);
      }
      if (world.places[f3Id] && !world.places[f3Id].exits.includes(f2Id)) world.places[f3Id].exits.push(f2Id);
      if (world.places[privateId] && !world.places[privateId].exits.includes(f2Id)) world.places[privateId].exits.push(f2Id);

      restPlace.rooms = restPlace.rooms || {};
      restPlace.rooms.f1 = { id: f1Id, name: '一层大堂', floor: 1, use: 'shop_floor', access: 'public_shop' };
      restPlace.rooms.f2 = { id: f2Id, name: '二层雅阁', floor: 2, use: 'shop_floor', access: 'public_shop' };
      restPlace.rooms.f3 = { id: f3Id, name: '三层天字阁', floor: 3, use: 'shop_floor', access: 'public_shop' };
      restPlace.rooms.private = { id: privateId, name: '清幽雅间', floor: 2, use: 'shop_floor', access: 'public_shop' };
      restPlace.rooms.office = { id: officeId, name: '内账房', floor: 1, use: 'shop_floor', access: 'public_shop' };

      // 3. 确立大酒楼资产状态为「正常营业」，绝不许残留「筹备开张」
      const canalProp = (world.assets?.properties || []).find((p) => p && (p.id === 'canal_restaurant' || String(p.name || '').includes('酒楼')));
      if (canalProp) {
        if (canalProp.status !== '正常营业') {
          canalProp.status = '正常营业';
          fixes.push('修正运河码头大酒楼产业状态为【正常营业】');
        }
        if (!canalProp.incomePerDay || canalProp.incomePerDay <= 0) {
          canalProp.incomePerDay = 124.1;
        }
      }

      // 3. 真实落地：账房先生（周有财）与扬州盐帮汪总商（汪德润）
      let hasAccountant = Object.values(world.actors).some(
        (a) => a && !a.dead && a.location === restPlaceId && /账房/.test(String(a.role || ''))
      );
      if (!hasAccountant) {
        world.actors['npc_accountant_zhou'] = {
          id: 'npc_accountant_zhou',
          name: '周有财',
          role: '账房先生',
          title: '账房',
          gender: 'male',
          age: 42,
          location: restPlaceId,
          home: restPlaceId,
          origin: 'hired',
          goals: ['精打细算核清酒楼流水', '为东家打理两淮商海进项', '将汪总商五十两寿宴定金妥善入库'],
          relations: { husband: { trust: 80, desire: 0, fear: 10, grievance: 0 } },
          money: 5.2,
          desc: '运河大酒楼当值账房先生，长衫算盘，为人精明稳重，专司核对大席银钱。',
        };
        fixes.push('生成真实人物实体：运河大酒楼·账房先生·周有财');
      }

      if (!world.actors['wang_zongshang']) {
        world.actors['wang_zongshang'] = {
          id: 'wang_zongshang',
          name: '汪德润',
          role: '扬州盐帮总商',
          title: '汪总商',
          gender: 'male',
          age: 49,
          location: f3Id, // 人就真实坐在三层天字阁里
          home: 'inn_room',
          origin: 'merchant',
          goals: ['在运河大酒楼三层天字阁办五十两寿宴', '结识江南茶商大东家王甯', '打通两淮运河商道'],
          relations: { husband: { trust: 55, desire: 0, fear: 0, grievance: 0 } },
          money: 8000,
          desc: '两淮盐帮总商，家资巨万，富甲一方，今在运河大酒楼天字阁连包两日大办寿宴。',
        };
        fixes.push('生成真实人物实体：扬州盐帮汪总商·汪德润（位于三层天字阁）');
      }
    }
  } catch (err) {
    console.warn('[Heal] 酒楼天字阁与人物落地失败：', err.message);
  }

  // ⑯ 鑫雅阁风雅会所单一真实地点自愈、房间落地与钱书办大掌柜职责确立
  try {
    world.places = world.places || {};
    world.actors = world.actors || {};
    world.assets = world.assets || {};
    world.assets.properties = Array.isArray(world.assets.properties) ? world.assets.properties : [];

    // 1. 确保鑫雅阁物理空间存在
    let pXin = world.places['xinyage'];
    if (!pXin) {
      world.places['xinyage'] = {
        id: 'xinyage',
        name: '临江·鑫雅阁',
        exits: ['street'],
        owner: 'husband',
        kind: '雅阁',
        use: 'restaurant',
        access: 'public_shop',
        desc: '相公斥资三百两由侧室崔婉宁筹备置办的风雅楼阁，知县文达亲验关防，专供官商名流雅集，密织临江消息网。',
        rooms: {
          hall: { id: 'xinyage__hall', name: '一层·品茗大堂', exits: ['xinyage', 'xinyage__f2_tian', 'xinyage__f2_di', 'xinyage__secret'], access: 'public_outer', use: 'hall' },
          f2_tian: { id: 'xinyage__f2_tian', name: '二层·天字雅间', exits: ['xinyage__hall'], access: 'guest_main', use: 'room', reserved: false },
          f2_di: { id: 'xinyage__f2_di', name: '二层·地字雅间', exits: ['xinyage__hall'], access: 'guest_main', use: 'room' },
          secret: { id: 'xinyage__secret', name: '内堂·消息账房', exits: ['xinyage__hall'], access: 'guest_main', use: 'office' },
        },
      };
      pXin = world.places['xinyage'];
      fixes.push('生成真实建筑实体：临江·鑫雅阁');
    }

    // 实例化各个子房间
    for (const [rid, r] of Object.entries(pXin.rooms || {})) {
      const fullId = r.id || `xinyage__${rid}`;
      if (!world.places[fullId]) {
        world.places[fullId] = {
          id: fullId,
          name: `临江·鑫雅阁·${r.name}`,
          parent: 'xinyage',
          use: r.use || 'shop_floor',
          access: r.access || 'public_shop',
          exits: ['xinyage', 'xinyage__hall'],
        };
        fixes.push(`生成真实房间实体：${world.places[fullId].name}`);
      }
      pXin.exits = Array.isArray(pXin.exits) ? pXin.exits : [];
      if (!pXin.exits.includes(fullId)) pXin.exits.push(fullId);
    }

    // 2. 确保 assets.properties 中登记鑫雅阁
    let propXin = world.assets.properties.find((p) => p && (p.id === 'xinyage' || p.name === '鑫雅阁' || p.name === '临江·鑫雅阁'));
    if (!propXin) {
      world.assets.properties.push({
        id: 'xinyage',
        keeper: 'npc_49',
        owner: 'husband',
        name: '临江·鑫雅阁',
        status: '筹备开张',
        incomePerDay: 5.0,
        costSilver: 300,
        placeId: 'xinyage',
        desc: '相公斥资三百两由侧室崔婉宁筹备置办的风雅楼阁，知县文达亲验关防，钱书办任大掌柜兼账房主管，专织临江消息网与笼络官商名流。',
      });
      fixes.push('资产登记：临江·鑫雅阁（相公出资三百两，钱书办任掌柜）');
    } else {
      propXin.keeper = 'npc_49';
      propXin.placeId = 'xinyage';
    }

    // 3. 确立钱书办（npc_49）为鑫雅阁大掌柜兼消息主事
    const qian = world.actors['npc_49'] || Object.values(world.actors).find((a) => a && a.name === '钱书办');
    if (qian) {
      qian.role = '鑫雅阁大掌柜兼消息主事';
      qian.location = 'xinyage';
      qian.home = 'xinyage';
      qian.desc = '县衙书办出身，深谙官府律令掌故与钱谷名册，由知县周文达大人亲荐至鑫雅阁任大掌柜，专管歌舞契纸名册与内堂密阁，替相公将鑫雅阁打造成刺探临江消息网、笼络各路达官显贵的清雅会所。';
      qian.relations = qian.relations || {};
      qian.relations.husband = qian.relations.husband || { trust: 50, desire: 30, fear: 0, grievance: 0 };
      qian.relations.husband.trust = Math.max(Number(qian.relations.husband.trust || 0), 50);
      fixes.push('正名归位：钱书办确立为鑫雅阁大掌柜兼消息主事，坐镇临江·鑫雅阁');
    }

    // 4. 彻底清理历史遗留旧鑫雅阁（project_1*）幽灵节点，将人员与出入口统归 xinyage 唯一实体
    for (const [id, pl] of Object.entries(world.places || {})) {
      if (id.startsWith('project_1') || (pl && String(pl.name || '').includes('鑫雅阁') && !id.startsWith('xinyage'))) {
        const destId = id.includes('f2') ? 'xinyage__f2' : (id.includes('f1') ? 'xinyage__hall' : 'xinyage');
        for (const a of Object.values(world.actors || {})) {
          if (a && a.location === id) {
            a.location = destId;
            fixes.push(`将 ${a.name} 从旧节点 ${id} 迁移至唯一真实实体 ${destId}`);
          }
        }
        delete world.places[id];
        fixes.push(`清理旧鑫雅阁节点：${id}`);
      }
    }
    // 确保 xinyage__f2 实体存在并命名为 临江·鑫雅阁·二层雅间
    if (!world.places['xinyage__f2']) {
      world.places['xinyage__f2'] = {
        id: 'xinyage__f2',
        name: '临江·鑫雅阁·二层雅间',
        parent: 'xinyage',
        use: 'shop_floor',
        access: 'guest_main',
        exits: ['xinyage', 'xinyage__hall'],
      };
      fixes.push('实例化唯一真实实体：临江·鑫雅阁·二层雅间 (xinyage__f2)');
    }
    // 确保相公与周文达若在鑫雅阁，位置精确锁定为 xinyage__f2
    const hus = world.actors?.husband;
    const wenda = world.actors?.county_magistrate;
    if (hus && String(hus.location || '').includes('xinyage') && hus.location !== 'xinyage__f2') {
      hus.location = 'xinyage__f2';
    }
    if (wenda && String(wenda.location || '').includes('xinyage') && wenda.location !== 'xinyage__f2') {
      wenda.location = 'xinyage__f2';
    }
  } catch (err) {
    console.warn('[Heal] 鑫雅阁自愈异常：', err.message);
  }

  // ㉒ 运河大船队编制与资产正名自愈（1大3小共4艘船，20名船工编制，赵水生坐镇）
  try {
    const shipProp = (world.assets?.properties || []).find(
      (p) => p && (p.kind === 'ship' || String(p.name || '').includes('船') || String(p.id || '').includes('ship'))
    );
    if (shipProp) {
      if (shipProp.name !== '王家运河大船队（一大三小）') {
        fixes.push(`资产正名：${shipProp.name} → 王家运河大船队（一大三小）`);
        shipProp.name = '王家运河大船队（一大三小）';
      }
      shipProp.costSilver = Math.max(Number(shipProp.costSilver) || 0, 730);
      shipProp.capital = Math.max(Number(shipProp.capital) || 0, 730);
      shipProp.incomePerDay = Math.max(Number(shipProp.incomePerDay) || 0, 43.8);
      shipProp.status = '正常起航';
      shipProp.staff = 20;
      shipProp.desc = '王家名下运河船队。旗舰三丈两桅大货船一艘（扬帆号，四百石长途大宗）、一丈八驳船三艘（利水、顺风、安澜，各百五十石，机动直供两淮与各铺茶栈）。配备总船老大赵水生与二十名得力水手船工；自运茶粮免外包运费，余舱常年承揽两淮客商拼船带货捎货，每日漕运水路进账结余丰厚。';
      shipProp.todayHighlight = '王家船队（一大三小）顺流破浪，满载两淮客商托运丝茶粮饷，水路利银与漕运分润尽皆入账！';
      shipProp.floors = 3;
      shipProp.floorNames = ['大船主甲板', '深水大货舱', '船工宿舱'];

      const plId = shipProp.placeId || 'project_4';
      if (world.places && world.places[plId]) {
        world.places[plId].name = '王家运河大船队';
        world.places[plId].desc = shipProp.desc;
        world.places[plId].rooms = {
          deck: { id: `${plId}__deck`, name: '大船主甲板' },
          cargo: { id: `${plId}__cargo`, name: '深水大货舱' },
          cabin: { id: `${plId}__cabin`, name: '船工宿舱' },
        };
      }

      // 确立总船老大赵水生
      let zhao = Object.values(world.actors || {}).find((a) => a && a.name === '赵水生');
      if (!zhao && world.actors) {
        const zhaoId = 'npc_captain_zhao';
        world.actors[zhaoId] = {
          id: zhaoId,
          name: '赵水生',
          role: '王家船队总把式兼大船老大',
          location: plId,
          home: plId,
          desc: '两淮漕运老把式，熟悉运河每一道闸口与吃水暗礁，掌舵沉稳经验丰富，受相公重金聘请总管王家一大三小四艘大船队。',
          relations: { husband: { trust: 65, desire: 20, fear: 0, grievance: 0 } },
        };
        fixes.push('正名归位：赵水生确立为王家船队总把式兼大船老大');
      } else if (zhao) {
        zhao.role = '王家船队总把式兼大船老大';
        zhao.desc = '两淮漕运老把式，熟悉运河每一道闸口与吃水暗礁，掌舵沉稳经验丰富，受相公重金聘请总管王家一大三小四艘大船队。';
      }
    }
  } catch (err) {
    console.warn('[Heal] 运河船队自愈异常：', err.message);
  }

  // ㉓ 知府千金杨采儿正名与年龄归正（杜绝被当成官员或老年知府）
  try {
    const caier = world.actors?.yangzhenhua || Object.values(world.actors || {}).find((a) => a && (a.name === '杨采儿' || a.id === 'yangzhenhua'));
    if (caier) {
      if (caier.name !== '杨采儿') {
        fixes.push(`大小姐正名：${caier.name} → 杨采儿`);
        caier.name = '杨采儿';
      }
      if (caier.role !== '知府千金') {
        fixes.push(`身份正名：${caier.role} → 知府千金`);
        caier.role = '知府千金';
      }
      caier.label = '知府千金';
      caier.gender = 'female';
      if (!caier.age || caier.age > 25) {
        fixes.push(`年龄归位：杨采儿 ${caier.age}岁 → 19岁芳华`);
        caier.age = 19;
      }
      caier.desc = '临江知府杨慎之大人的掌上明珠千金闺秀，性子英姿飒爽、傲娇清高又聪慧过人，自称用我/本姑娘/采儿，称相公少掌柜/王甯。';
      caier.relations = caier.relations || {};
      const mine = (caier.relations.husband = caier.relations.husband || { trust: 55, desire: 35, fear: 0, grievance: 0 });
      if (Number(mine.trust || 0) < 55) {
        fixes.push(`杨采儿相知底子校准：信任 ${mine.trust} → 55`);
        mine.trust = 55;
      }
      if (Number(mine.desire || 0) < 35) {
        fixes.push(`杨采儿情愫底子校准：情愫 ${mine.desire} → 35`);
        mine.desire = 35;
      }
    }
  } catch (err) {
    console.warn('[Heal] 杨采儿正名自愈异常：', err.message);
  }

  // ㉕ 杨府（知府私宅）等第七进自愈与门禁房间健全
  try {
    world.places = world.places || {};
    if (!world.places.yang_mansion) {
      world.places.yang_mansion = { name: '杨府', exits: ['street'], owner: 'yangzhenhua', city: '临江府' };
    }
    const yangMansion = world.places.yang_mansion;
    yangMansion.id = 'yang_mansion';
    yangMansion.name = '杨府';
    yangMansion.owner = yangMansion.owner || 'yangzhenhua';
    yangMansion.city = yangMansion.city || '临江府';
    ensureResidence(world, 'yang_mansion', { grade: 7, ownerId: yangMansion.owner });
    yangMansion.residence = true;
    fixes.push('私宅自愈：杨府确立为七进显贵名门私宅，门禁房间齐备');
  } catch (err) {
    console.warn('[Heal] 杨府私宅自愈异常：', err.message);
  }

  // ㉔ 临江知府杨慎之大人实体人物自愈、官职归正与父女羁绊自愈（彻底取消杨振华名字）
  try {
    world.actors = world.actors || {};
    world.court = world.court || {};
    world.court.offices = world.court.offices || {};
    world.places = world.places || {};

    const govPlace = 'gov_临江府';
    if (!world.places[govPlace]) {
      world.places[govPlace] = { name: '临江府府衙', exits: ['street'], owner: 'court', dynamic: false };
    }

    let prefect = world.actors.yangshenzhi;
    if (!prefect) {
      prefect = {
        id: 'yangshenzhi',
        name: '杨慎之',
        label: '知府大人',
        role: '临江知府',
        gender: 'male',
        age: 46,
        kind: 'official',
        office: 'prefect',
        household: false,
        home: 'yang_mansion',
        location: govPlace,
        alias: ['知府大人', '杨知府', '杨大人', '临江知府', '杨老大人', '采儿父亲', '采儿她爹', '岳父大人', '岳父', '岳丈'],
        daughter: 'yangzhenhua',
        relations: {
          husband: { trust: 40, desire: 0, fear: 0, grievance: 0 },
        },
        goals: ['考察王家少掌柜是否堪配采儿', '整饬两淮茶盐漕运防范亏空', '查清沈家旧案留下底档'],
        secret: '当年沈侍郎被权相诬陷时暗中留存了卷宗副本；看好相公的经商担当与胆识，但身为正三品封疆重臣，绝不会轻易把独生女许配给市井白丁，需看聘礼规矩与真才实学',
        desc: '大乾正三品临江知府杨慎之大人，杨采儿之父。为人沉稳威严、为官清正精明，深谙两淮漕运官商之道，极疼爱独生女采儿。',
        schedule: [
          { at: 7, do: '乘轿前往临江府衙升堂', place: govPlace },
          { at: 8, do: '在临江府衙升堂理事', place: govPlace },
          { at: 12, do: '在府衙后堂批阅商税公文', place: govPlace },
          { at: 17, do: '乘轿回杨府', place: 'yang_mansion' },
          { at: 18, do: '在杨府后堂用晚膳休憩', place: 'yang_mansion' },
          { at: 22, do: '在杨府书斋安歇', place: 'yang_mansion' },
        ],
      };
      world.actors.yangshenzhi = prefect;
      fixes.push('岳父归位：临江知府杨慎之大人实体入世');
    } else {
      if (prefect.dead) {
        prefect.dead = false;
        delete prefect.deadDay;
        fixes.push('岳父归位：临江知府杨慎之大人正名为存活并回朝主政');
      }
      if (!prefect.location || prefect.location === '') {
        prefect.location = govPlace;
      }
      if (prefect.name !== '杨慎之') {
        prefect.name = '杨慎之';
        fixes.push('知府正名：彻底取消杨振华，正名为杨慎之');
      }
      prefect.role = '临江知府';
      prefect.label = '知府大人';
      prefect.home = 'yang_mansion';
      prefect.daughter = 'yangzhenhua';
      prefect.desc = '大乾正三品临江知府杨慎之大人，杨采儿之父。为人沉稳威严、为官清正精明，深谙两淮漕运官商之道，极疼爱独生女采儿。';
      prefect.relations = prefect.relations || {};
      prefect.relations.husband = prefect.relations.husband || { trust: 40, desire: 0, fear: 0, grievance: 0 };
      if ((Number(prefect.relations.husband.trust) || 0) < 40) {
        prefect.relations.husband.trust = 40;
      }
      prefect.alias = ['知府大人', '杨知府', '杨大人', '临江知府', '杨老大人', '采儿父亲', '采儿她爹', '岳父大人', '岳父', '岳丈'];
      if (!Array.isArray(prefect.schedule) || prefect.schedule.length === 0) {
        prefect.schedule = [
          { at: 7, do: '乘轿前往临江府衙升堂', place: govPlace },
          { at: 8, do: '在临江府衙升堂理事', place: govPlace },
          { at: 12, do: '在府衙后堂批阅商税公文', place: govPlace },
          { at: 17, do: '乘轿回杨府', place: 'yang_mansion' },
          { at: 18, do: '在杨府后堂用晚膳休憩', place: 'yang_mansion' },
          { at: 22, do: '在杨府书斋安歇', place: 'yang_mansion' },
        ];
      }
    }

    // 🛡️ 全局人物无死角正名：全城所有人物中，凡是身为临江知府（或姓名叫杨振华且非千金者），100% 绝对正名为「杨慎之」！
    for (const [id, a] of Object.entries(world.actors || {})) {
      if (!a) continue;
      if (a.name === '杨振华' || a.role === '临江知府' || id === 'yangshenzhi') {
        if (/千金|大小姐|小姐|闺秀/.test(String(a.role || '')) || /采儿/.test(String(a.name || ''))) {
          if (a.name !== '杨采儿') {
            a.name = '杨采儿';
            fixes.push('知府千金正名：杨采儿');
          }
          a.role = '知府千金';
        } else {
          if (a.name !== '杨慎之') {
            a.name = '杨慎之';
            fixes.push('临江知府正名：彻底取消杨振华，正名为杨慎之');
          }
          a.role = '临江知府';
          a.label = '知府大人';
        }
      }
      // 凡是采儿（无论 id 是什么），彻底解除市井路人婚配，恢复清白名节与待字闺中
      if (a.name === '杨采儿' || id === 'yangzhenhua' || id === 'yangcaier') {
        if (a.spouse && a.spouse !== 'husband') {
          const wrongSpouseId = a.spouse;
          const wrongSpouse = world.actors?.[wrongSpouseId];
          if (wrongSpouse) {
            wrongSpouse.spouse = null;
            wrongSpouse.spouseId = null;
            wrongSpouse.spouseName = null;
            wrongSpouse.marital = 'single';
            wrongSpouse.maritalText = '未婚';
          }
          delete a.spouse;
          a.spouseId = null;
          a.spouseName = null;
          a.marital = 'single';
          a.maritalText = '未婚 · 待字闺中';
          if (world.bonds?.[id]?.[wrongSpouseId]) delete world.bonds[id][wrongSpouseId];
          if (wrongSpouseId && world.bonds?.[wrongSpouseId]?.[id]) delete world.bonds[wrongSpouseId][id];
          fixes.push(`名节归位：解除知府千金杨采儿与路人${wrongSpouse?.name || wrongSpouseId}的荒唐婚配，重归未婚待字闺中`);
        }
      }
    }

    // 绑定采儿与父亲的亲情关系
    const caier = world.actors?.yangzhenhua || Object.values(world.actors || {}).find(a => a.name === '杨采儿');
    if (caier) {
      caier.name = '杨采儿';
      caier.father = 'yangshenzhi';
      caier.family = caier.family || {};
      caier.family.father = 'yangshenzhi';
      caier.home = 'yang_mansion';
      if (!caier.location || caier.location === 'yang_mansion') {
        caier.location = 'yang_mansion__hall';
        fixes.push('人物归位：知府千金杨采儿归位杨府中堂大厅');
      }
      caier.desc = '临江知府杨慎之大人的掌上明珠千金闺秀，性子英姿飒爽、傲娇清高又聪慧过人，自称用我/本姑娘/采儿，称相公少掌柜/王甯。';
    }

    // 官职权威归正：临江知府大位归杨慎之，清除/退休路人知府许元朗
    world.court.offices.prefect = { title: '临江知府', holder: 'yangshenzhi', vacant: false };
    world.court.offices['city:临江府'] = { title: '临江知府', holder: 'yangshenzhi', vacant: false, city: '临江府' };

    const fakeOff = world.actors['off_临江府'];
    if (fakeOff && fakeOff.name === '许元朗') {
      delete world.actors['off_临江府'];
      fixes.push('官职归位：移除误占临江知府之职的路人许元朗');
    }
  } catch (err) {
    console.warn('[Heal] 知府杨慎之自愈异常：', err.message);
  }

  // ⑬ 大事记自愈与知府千金杨采儿正名（彻底清洗杨振华）
  try {
    if (Array.isArray(world.milestones)) {
      world.milestones = world.milestones.map((m) => {
        if (typeof m !== 'string') return m;
        let res = m;
        if (res.includes('杨振华')) {
          res = res
            .replace(/知府千金杨振华/g, '知府千金杨采儿')
            .replace(/知府杨振华大小姐/g, '知府千金杨采儿小姐')
            .replace(/杨振华大小姐/g, '知府千金杨采儿')
            .replace(/杨振华知府/g, '知府杨慎之')
            .replace(/知府杨振华/g, '知府杨慎之')
            .replace(/杨振华大人/g, '知府杨慎之大人')
            .replace(/杨振华/g, '知府杨慎之');
          fixes.push('大事记正名：彻底将杨振华清洗为杨采儿（千金）或杨慎之（知府）');
        }
        return res;
      });
      // 检查是否包含置办船队的大事，若无且产业中有货船，则自动归入大事记
      const hasShipMilestone = world.milestones.some((m) => typeof m === 'string' && m.includes('运河大货船队'));
      const hasShipProperty = (world.assets?.properties || []).some((p) => p && String(p.name || '').includes('运河货船'));
      if (!hasShipMilestone && hasShipProperty) {
        fixes.push('大事记归档：相公置办王家运河大船队开辟水运商路');
        world.milestones.unshift('【置办运河大货船队开辟水运商路】：相公斥资数百两置办运河双桅大货船与吃水驳船共四艘组建王家船队，招募老练水手船工，开辟临江至扬州水运货运航道，为天下两淮茶盐客商承揽押运并稳赚水脚银。');
      }
    }
  } catch (err) {
    console.warn('[Heal] 大事记自愈异常：', err.message);
  }

  // ㉘ 产业核定基准日入与营运状态自愈（彻底解决日入缩水腰斩与大船队被误判为 0 的问题）
  try {
    world.assets = world.assets || {};
    world.assets.properties = Array.isArray(world.assets.properties) ? world.assets.properties : [];
    for (const p of world.assets.properties) {
      if (!p) continue;
      const nm = String(p.name || '');
      const id = String(p.id || '');

      // 1. 运河码头三层大酒楼（军规铁律：相公全款510两盘下盛大开业，日入过百两，基准124.1两）
      if (id === 'canal_restaurant' || /运河码头三层大酒楼|运河大酒楼/.test(nm)) {
        if (p.status !== '正常营业') {
          p.status = '正常营业';
          fixes.push('大酒楼自愈：状态纠正为「正常营业」');
        }
        p.costSilver = Math.max(Number(p.costSilver) || 0, 510);
        p.capital = Math.max(Number(p.capital) || 0, 626);
        const curInc = Number(p.incomePerDay) || 0;
        if (curInc < 124.1) {
          fixes.push(`大酒楼自愈：额定日入从 ${curInc} 两恢复为 124.1 两（日入过百两铁律）`);
          p.incomePerDay = 124.1;
        }
        p.baseIncome = 124.1;
      }

      // 2. 王家运河大船队（一大三小，20船工编制，起航漕运，基准43.8两）
      else if (/王家运河大船队/.test(nm)) {
        if (!/正常起航|营运中|已开张/.test(String(p.status || ''))) {
          p.status = '正常起航';
          fixes.push('大船队自愈：营运状态纠正为「正常起航」');
        }
        p.costSilver = Math.max(Number(p.costSilver) || 0, 730);
        p.capital = Math.max(Number(p.capital) || 0, 730);
        const curInc = Number(p.incomePerDay) || 0;
        if (curInc < 43.8) {
          fixes.push(`大船队自愈：额定日入从 ${curInc} 两恢复为 43.8 两`);
          p.incomePerDay = 43.8;
        }
        p.baseIncome = 43.8;
      }

      // 3. 码头盐铺（两淮官盐专营暴利商行，补齐300两成本与24.5两额定日入）
      else if (/盐铺/.test(nm)) {
        p.costSilver = Math.max(Number(p.costSilver) || 0, 300);
        p.capital = Math.max(Number(p.capital) || 0, 300);
        const curInc = Number(p.incomePerDay) || 0;
        if (curInc < 24.5) {
          fixes.push(`盐铺自愈：码头官盐商行日入从 ${curInc} 两提升恢复为 24.5 两`);
          p.incomePerDay = 24.5;
        }
        p.baseIncome = 24.5;
        if (!isPropertyOperational(p)) p.status = '已开张';
      }

      // 4. 其他产业：核定基准兜底，防缩水
      else if (isPropertyOperational(p)) {
        const nominal = getPropertyNominalIncome(p);
        const curInc = Number(p.incomePerDay) || 0;
        if (curInc < nominal) {
          fixes.push(`产业基准自愈：${p.name} 日入从 ${curInc} 两调整为基准 ${nominal} 两`);
          p.incomePerDay = nominal;
        }
        p.baseIncome = nominal;
      }
    }
  } catch (err) {
    console.warn('[Heal] 产业日入自愈异常：', err.message);
  }

  // ⑭ 酒楼管事与大掌柜权威归位
  try {
    const zhouCai = world.actors?.npc_accountant_zhou || Object.values(world.actors || {}).find(a => a.name === '周有财');
    if (zhouCai && (!zhouCai.location || zhouCai.location === 'place_44')) {
      zhouCai.location = 'place_44__f1';
      fixes.push('人物归位：酒楼大掌柜周有财归位一层大堂');
    }
    const zhouFu = world.actors?.npc_1793788798472_568 || Object.values(world.actors || {}).find(a => a.name === '周有福');
    if (zhouFu && (!zhouFu.location || zhouFu.location === 'place_44')) {
      zhouFu.location = 'place_44__f1';
      fixes.push('人物归位：酒楼总管周有福归位一层大堂');
    }
  } catch (err) {
    console.warn('[Heal] 酒楼人物自愈异常：', err.message);
  }

  return fixes;
}
