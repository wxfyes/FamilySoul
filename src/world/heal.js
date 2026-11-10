import { trimMemories } from './memory.js';
﻿import { inferAgeFromIdentity, inferMaritalStatus, inferGenderFromIdentity } from './persona.js';
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

  // ⑧ 记忆里空文本
  if (Array.isArray(world.memories)) {
    const before = world.memories.length;
    world.memories = world.memories.filter((m) => m && String(m.text || '').trim());
    if (world.memories.length !== before) fixes.push(`清理 ${before - world.memories.length} 条空记忆`);
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
      // 王府内眷（婉儿、芸娘、小翠）：夜间必须在宅内安歇，严禁深夜公堂或市井游荡
      if (a.household || ['waner', 'yunnia', 'xiaocui'].includes(a.id)) {
        const isSafeHome = ['backyard', 'husband_room'].includes(a.location);
        if (!isSafeHome && a.location !== husbandLoc) {
          const dest = world.places?.backyard ? 'backyard' : 'husband_room';
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

  return fixes;
}
