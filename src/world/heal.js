import { inferAgeFromIdentity, inferMaritalStatus, inferGenderFromIdentity } from './persona.js';
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

  // ⑤ 重名地点合并
  const byName = new Map();
  for (const [id, p] of Object.entries(world.places || {})) {
    const nm = String(p?.name || '');
    if (!nm) continue;
    if (!byName.has(nm)) {
      byName.set(nm, id);
      continue;
    }
    const keep = byName.get(nm);
    for (const a of Object.values(world.actors || {})) {
      if (a?.location === id) a.location = keep;
    }
    delete world.places[id];
    fixes.push(`重名地点「${nm}」合并`);
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
  trim('memories', 120, '记忆');
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
      if (!a.marital && Number(a.age) >= 18 && a.id !== 'husband') {
        a.marital = a.household ? 'married' : inferMaritalStatus(a.name, a.role, a.age, a.gender);
      }
      if (Number(a.age) >= 50 && a.menses) {
        delete a.menses;
        a.onPeriod = false;
        fixes.push(`${a.name}绝经，清掉月事`);
      }
    }
  } catch { /* 忽略 */ }

  return fixes;
}
