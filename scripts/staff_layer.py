import io

# ============ ① 产业在册人手：[[staff:产业名|人名|身份]] ============
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 习性：相处久了性情会变，变了要记住（[[trait:谁|哪一样|+-数]]）"
block = """    // 雇人：天道替产业点一个人，引擎把人真正立起来、派到那处去
    try {
      const staffTags = String(reply || '').match(/\\[\\[staff:([^\\]]+)\\]\\]/g);
      if (staffTags && staffTags.length) {
        const wS = loadState(this.dataDir);
        for (const tag of staffTags) {
          const m = /\\[\\[staff:([^|\\]]+)\\|([^|\\]]+)(?:\\|([^\\]]+))?\\]\\]/.exec(tag);
          if (!m) continue;
          const propName = String(m[1]).trim();
          const whoName = String(m[2]).trim();
          const roleName = String(m[3] || '伙计').trim().slice(0, 10);
          const prop = (wS.assets?.properties || []).find((x) => x && String(x.name).includes(propName));
          if (!prop) { console.log(`[Staff] 没这个产业：${propName}`); continue; }
          if (!isPlaceName(whoName)) continue;

          // 已有这个人 → 直接派去；没有 → 立一个新角色
          let a = Object.values(wS.actors || {}).find((x) => x && x.name === whoName);
          if (!a) {
            const id = `npc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            a = {
              id, name: whoName, role: roleName, gender: 'unknown',
              home: prop.placeId || 'street', work: prop.placeId || 'street',
              location: prop.placeId || 'street',
              money: 0, relations: {}, schedule: [],
              origin: 'dm_hired', createdDay: wS.clock?.day || 1,
            };
            wS.actors[id] = a;
            console.log(`[Staff] 新雇：${whoName}（${roleName}）`);
          }
          prop.staffIds = Array.isArray(prop.staffIds) ? prop.staffIds : [];
          if (!prop.staffIds.includes(a.id)) prop.staffIds.push(a.id);
          prop.staff = prop.staffIds.length;
          if (prop.placeId && wS.places?.[prop.placeId]) {
            moveActor(wS, a.id, prop.placeId, 'world', '到岗');
          }
          wS.notes = Array.isArray(wS.notes) ? wS.notes : [];
          wS.notes.push({ day: wS.clock?.day, hour: wS.clock?.hour, text: `${whoName}进了${prop.name}做${roleName}` });
        }
        wS.notes = (wS.notes || []).slice(-40);
        saveState(this.dataDir, wS);
        reply = String(reply || '').replace(/\\[\\[staff:[^\\]]+\\]\\]/g, '').trim();
      }
    } catch { /* 忽略 */ }

    // 习性：相处久了性情会变，变了要记住（[[trait:谁|哪一样|+-数]]）"""
if anchor in s and '[[staff:' not in s:
    s = s.replace(anchor, block, 1)
    print('① 加雇人落账')

# 引入 moveActor
if 'moveActor' not in s:
    s = s.replace("import { isPlaceName, extractPlaceCandidates } from './world/naming.js';",
                  "import { isPlaceName, extractPlaceCandidates } from './world/naming.js';\nimport { moveActor } from './world/position.js';", 1)
    print('② 引入 moveActor')

# 提示词：招人规矩
old = "      contextHintEarly += '（【习性规矩】"
new = """      contextHintEarly += '（【用人规矩】要开张、要添人手时，你替产业点人：[[staff:产业名|人名|身份]]，例如 [[staff:运河码头三层大酒楼|周有福|掌柜]]。没有这个人就现起一个名字，世上就真有这个人了。）\\n';
      contextHintEarly += '（【习性规矩】"""
if old in s and '【用人规矩】' not in s:
    s = s.replace(old, new, 1)
    print('③ 用人规矩')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ============ ② 自检：产业没人在岗要报 ============
p2 = 'src/world/audit.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """  for (const ap of world.appointments || []) {"""
new2 = """  // 产业有没有人在岗：开张却空无一人的，报给天道
  for (const prop of world.assets?.properties || []) {
    if (!prop || !prop.placeId) continue;
    const onDuty = Object.values(actors).filter((a) => a && !a.dead && a.location === prop.placeId && a.id !== 'husband');
    if (!onDuty.length) {
      issues.push({ kind: 'staff', who: prop.name, detail: `「${prop.name}」开着却没有一个人在岗` });
    } else if (Array.isArray(prop.staffIds)) {
      prop.staff = onDuty.length;
    }
  }

  for (const ap of world.appointments || []) {"""
if old2 in t and "kind: 'staff'" not in t:
    t = t.replace(old2, new2, 1)
    print('④ 自检加"产业无人"')
io.open(p2, 'w', encoding='utf-8-sig').write(t)
print('done')
