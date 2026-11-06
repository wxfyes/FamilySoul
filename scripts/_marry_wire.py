import io
# ① 每城补媒婆；每日民间结亲
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { ensureCityBase, ensureAllCityBases, ensureCityExtras, streetOfCity } from './city.js';",
              "import { ensureCityBase, ensureAllCityBases, ensureCityExtras, streetOfCity } from './city.js';\nimport { ensureMatchmaker, dailyMarriages } from './marriage.js';", 1)
old = """      // 老城补配套：差事表 + 乡绅/衙役"""
new = """      // 老城补配套：差事表 + 乡绅/衙役 + 媒婆
      try {
        for (const cn of Object.keys(world.flags?.cityBase || {})) ensureMatchmaker(world, cn);
      } catch { /* 忽略 */ }
      try { dailyMarriages(world); } catch { /* 忽略 */ }
      // 老城补配套：差事表 + 乡绅/衙役"""
if old in s and 'dailyMarriages' not in s.split('ensureCityExtras')[0]:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 巡检补媒婆/结亲')

# ② 相公说亲指令
p2 = 'src/pet-service.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { spawnHouseholdStaff } from './world/warfare.js';",
              "import { spawnHouseholdStaff } from './world/warfare.js';\nimport { proposeMarriage, isMarriageable } from './world/marriage.js';", 1)
anchor = "    // 8.80 营生三件事"
add = """    // 8.79 说亲：话里点名"娶/提亲/说亲/纳"某人，真去说媒
    try {
      const mMarry = /(?:娶|提亲|说亲|迎娶|纳)\\s*([\\u4e00-\\u9fa5]{2,4})/.exec(String(sayText || ''));
      if (mMarry) {
        const wM = loadState(this.dataDir);
        const meM = wM.actors?.[this._viewerActorId || 'husband'] || wM.actors?.husband;
        const who = Object.values(wM.actors || {}).find((a) => a && a.name === mMarry[1]);
        if (who) {
          const r = proposeMarriage(wM, meM.id, who.id, 2);
          if (r.ok) {
            try { wM.assets.silver = Math.round(((Number(wM.assets.silver) || 0) - 2) * 100) / 100; } catch { /* 忽略 */ }
            saveState(this.dataDir, wM);
          }
          reply += `\\n${r.line}`;
          console.log(`[Marriage] 说亲：${meM.name} → ${who.name}：${r.ok ? '成' : '未成'}`);
        }
      }
    } catch (err) { console.warn('[Marriage] 说亲失败：', err.message); }

""" + anchor
if '说亲：话里点名' not in t:
    t = t.replace(anchor, add, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 说亲指令')
