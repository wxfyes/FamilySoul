import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { titleOf } from './world/occupation.js';",
              "import { titleOf } from './world/occupation.js';\nimport { spawnHouseholdStaff } from './world/warfare.js';", 1)
anchor = "    // 8.82 话里点到谁 + 让他走"
add = """    // 8.81 相公叫护院/家丁（集合、过来、听令）：把人真的叫到跟前，缺的按兵力补齐
    try {
      const callStaff = /(护院|家丁|私兵)(们)?/.test(String(sayText || '')) && /(集合|过来|听令|都来|到我跟前|点齐|叫来|叫人|来见我)/.test(String(sayText || ''));
      if (callStaff) {
        const wS2 = loadState(this.dataDir);
        const meS = wS2.actors?.[this._viewerActorId || 'husband'] || wS2.actors?.husband;
        const troops = Number(wS2.factions?.wangjia?.troops) || 0;
        let staff = Object.values(wS2.actors || {}).filter((a) => a && !a.dead && /家丁|护院/.test(String(a.role || a.title || '')));
        // 账上有 10 个护院，人却只有 2 个：按兵力补齐（最多补 12）
        if (staff.length < Math.min(troops, 12)) {
          const madeN = spawnHouseholdStaff(wS2, Math.min(troops, 12) - staff.length, 'retainer');
          if (madeN) { saveState(this.dataDir, wS2); staff = Object.values(wS2.actors || {}).filter((a) => a && !a.dead && /家丁|护院/.test(String(a.role || a.title || ''))); }
        }
        const names = [];
        for (const g of staff.slice(0, 12)) {
          if (!meS?.location) break;
          const mv = moveActor(wS2, g.id, meS.location, 'world', '听令集合');
          if (mv?.ok || g.location === meS.location) names.push(g.name);
        }
        if (names.length) {
          saveState(this.dataDir, wS2);
          reply = `（${names.length} 名护院应声列到跟前：${names.join('、')}。）\\n` + String(reply || '');
          console.log(`[Staff] 集合 ${names.length} 人：${names.join('、')}`);
        }
      }
    } catch (err) { console.warn('[Staff] 集合失败：', err.message); }

""" + anchor
if '听令集合' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加护院集合指令')
