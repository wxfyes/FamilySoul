import io
# ③ 阶级名字去重：同名的，保留第一个，其余改成唯一姓名（id 不变）
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { ensureMatchmaker, dailyMarriages, maybeOfferAlliance } from './marriage.js';",
              "import { ensureMatchmaker, dailyMarriages, maybeOfferAlliance } from './marriage.js';\nimport { fallbackName } from './migration.js';", 1)
old = "      // 一次性：清掉\"成过事却没记日子\"的误标"
new = """      // 一次性：阶级生成时重名的，改成唯一姓名（按 id 保留先后）
      try {
        if (!world.flags?.nameDedupeV1) {
          const seen = new Set();
          const renamed = [];
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead || !a.name) continue;
            if (!seen.has(a.name)) { seen.add(a.name); continue; }
            if (!a.id || !/gentry|tycoon|poetess|local|notable|matchmaker|servant/.test(String(a.id))) continue;
            const nm = fallbackName(world, a.gender === 'female' ? 'female' : 'male');
            if (!nm || seen.has(nm)) continue;
            renamed.push(`${a.name}→${nm}`);
            a.name = nm;
            seen.add(nm);
          }
          world.flags = world.flags || {};
          world.flags.nameDedupeV1 = { at: Date.now(), renamed: renamed.length };
          if (renamed.length) console.log(`[Name] 重名改正 ${renamed.length} 人：${renamed.slice(0, 6).join('、')}…`);
        }
      } catch { /* 忽略 */ }

      // 一次性：清掉"成过事却没记日子"的误标"""
if old in s and 'nameDedupeV1' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('③ 重名迁移')
