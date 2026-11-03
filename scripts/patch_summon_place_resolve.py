with open('src/world/summon.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. 在 findPlace 之前插入 resolveStandardPlace
core_resolver = '''
const CORE_PLACE_MAP = [
  // 监牢类（最严格：必须显式出现“牢/狱”，否则绝不允许进入牢房！）
  { pid: 'jail_female', re: /(女牢|女监)/ },
  { pid: 'jail_male', re: /(男牢|男监|大牢|牢房|牢里|大狱|监牢|下狱)/ },

  // 官府衙门（优先级高于牢房，绝不误入男牢）
  { pid: 'yamen', re: /(县衙|衙门|官府|公堂|找知县|见知县|衙内)/ },

  // 街道（全部统领至青石板长街 street，杜绝分裂地点）
  { pid: 'street', re: /(青石板长街|青石板街|青石板|长街|大街|街上|街道|当街|街市)/ },

  // 酒肆与茶坊
  { pid: 'jiusi', re: /(于家酒肆|紫嫣酒肆|酒肆|小酒馆)/ },
  { pid: 'teahouse', re: /(临江茶坊|茶坊|茶楼|茶肆|老店)/ },

  // 酒楼与码头
  { pid: 'restaurant', re: /(运河大酒楼|码头酒楼|三层大酒楼|运河码头三层大酒楼|运河酒楼|大酒楼|酒楼)/ },
  { pid: 'dock', re: /(运河码头|江边码头|码头|渡口)/ },
];

export function resolveStandardPlace(world, selfId, text) {
  const t = String(text || '');
  const me = world.actors?.[selfId] || world.actors?.husband;

  // 0. 回家逻辑（根据角色身份回到真正归宿）
  if (/(回家|回铺子|回店|回去了|一道回家|一块回家|一起回家)/.test(t)) {
    if (selfId && selfId !== 'husband') {
      const homeId = me?.home || (selfId === 'liuwenxia' ? 'jiusi' : 'tea_house');
      if (world.places?.[homeId]) return [homeId, world.places[homeId]];
    } else {
      const homeId = me?.home || 'tea_house';
      if (world.places?.[homeId]) return [homeId, world.places[homeId]];
    }
  }

  // 1. 房间别名
  if (/(我房间|我的房间|我房里|回房|回屋|正房|上房|卧房|寝室)/.test(t)) {
    const roomId = selfId && selfId !== 'husband' ? (me?.home || 'husband_room') : 'husband_room';
    if (world.places?.[roomId]) return [roomId, world.places[roomId]];
  }

  // 2. 核心精确地点映射
  for (const item of CORE_PLACE_MAP) {
    if (item.re.test(t) && world.places?.[item.pid]) {
      return [item.pid, world.places[item.pid]];
    }
  }

  // 3. 动态地点模糊匹配
  return findPlace(world, t);
}
'''

# 替换 findPlace 内部的防护：绝不让包含"牢"的地点误匹配没有"牢"的输入
old_find_place = '''/** 按"最长公共片段"找一个地点，容忍「酒楼盯着」「长街买炭」这种带后缀的说法 */
function findPlace(world, text) {
  const t = String(text || '');
  let best = null;
  let bestLen = 1;
  for (const [id, p] of Object.entries(world.places || {})) {
    const nm = String(p?.name || '');
    if (nm.length < 2) continue;
    for (let n = nm.length; n >= 2; n--) {
      let hit = false;
      for (let i = 0; i + n <= nm.length; i++) {
        if (t.includes(nm.slice(i, i + n))) { hit = true; break; }
      }
      if (hit) {
        if (n > bestLen) { bestLen = n; best = [id, p]; }
        break;
      }
    }
  }
  return best;
}'''

new_find_place = '''/** 按"最长公共片段"找一个地点，容忍「酒楼盯着」「长街买炭」这种带后缀的说法 */
function findPlace(world, text) {
  const t = String(text || '');
  let best = null;
  let bestLen = 1;
  for (const [id, p] of Object.entries(world.places || {})) {
    // 牢房严格保护：若输入没有"牢/狱"，绝不匹配牢房！
    if ((id.startsWith('jail') || /牢|狱/.test(p?.name || '')) && !/牢|狱/.test(t)) {
      continue;
    }
    const nm = String(p?.name || '');
    if (nm.length < 2) continue;
    for (let n = nm.length; n >= 2; n--) {
      let hit = false;
      for (let i = 0; i + n <= nm.length; i++) {
        if (t.includes(nm.slice(i, i + n))) { hit = true; break; }
      }
      if (hit) {
        if (n > bestLen) { bestLen = n; best = [id, p]; }
        break;
      }
    }
  }
  return best;
}'''

if old_find_place in text:
    text = text.replace(old_find_place, core_resolver + '\n' + new_find_place)
    print("Successfully replaced findPlace and added resolveStandardPlace")
else:
    print("Warning: old_find_place not found")

# 在 applySummon 中把房间别名和 findPlace 调用统统替换为 resolveStandardPlace
old_summon_call = '''    const aliasKey = Object.keys(roomAlias).find((k) => String(say).includes(k));
    if (aliasKey && world.places?.[roomAlias[aliasKey]]) {
      const pid = roomAlias[aliasKey];
      const p = world.places[pid];
      const companions = findCompanions(world, selfId, say);
      me.location = pid;
      const comers = [];
      for (const c of companions) {
        if (c && !c.dead && c.id !== me.id) {
          c.location = pid;
          c.activity = { text: `随相公回房`, at: world.clock?.hour || 0, day: world.clock?.day || 1 };
          comers.push(c.name);
        }
      }
      saveState(dataDir, world);
      const party = [me.name || '相公', ...comers];
      console.log(`[Party] 同行名单：${party.join(' + ')}`);
      console.log(`[Move] ${me.name || '相公'} → ${p.name}（同行：${comers.length > 0 ? comers.join('、') : '无'}）`);
      return { moved: party, summoned: [], visited: null, wentTo: p.name };
    }
    const placeHit = findPlace(world, say);'''

new_summon_call = '''    const placeHit = resolveStandardPlace(world, selfId, say);'''

if old_summon_call in text:
    text = text.replace(old_summon_call, new_summon_call)
    print("Successfully replaced summon roomAlias & findPlace with resolveStandardPlace")
else:
    print("Warning: old_summon_call not found")

with open('src/world/summon.js', 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated src/world/summon.js")
