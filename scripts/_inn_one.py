import io
# ① 流水自动归类（写盘前补齐 category）
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'moneyCategory' not in s.split('export function saveState')[0]:
    s = s.replace("import { fallbackName } from './migration.js';",
                  "import { fallbackName } from './migration.js';\nimport { moneyCategory } from './ledger-rules.js';", 1)
old = "  const file = statePath(dataDir);\n  fs.mkdirSync(worldDir(dataDir), { recursive: true });"
new = """  // 流水归类：老条目没有 category 的，写盘前补上
  try {
    if (Array.isArray(world.ledger)) {
      for (const e of world.ledger) {
        if (e && !e.category) e.category = moneyCategory(e.title, e.delta);
      }
    }
  } catch { /* 忽略 */ }
  const file = statePath(dataDir);
  fs.mkdirSync(worldDir(dataDir), { recursive: true });"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 流水归类')

# ② 客栈前店柜台并入客栈：人挪回客栈，柜台隐藏
anchor = "      // 一次性：客栈掌柜站到前店柜台"
add = """      // 一次性：客栈只留一条门路——柜台并入客栈，人挪回客栈里
      try {
        if (!world.flags?.innOneEntryV1) {
          let moved = 0;
          let hidden = 0;
          for (const [pid, pl] of Object.entries(world.places || {})) {
            if (!pl?.name || !/客栈.*前店柜台|前店柜台/.test(String(pl.name))) continue;
            const innId = pl.parent && world.places?.[pl.parent] ? pl.parent : Object.keys(world.places || {}).find((id) => /客栈/.test(String(world.places[id]?.name || '')) && !/柜台/.test(String(world.places[id]?.name || '')) && String(world.places[id]?.name || '') === String(pl.name).split('·')[0]);
            if (!innId) continue;
            for (const a of Object.values(world.actors || {})) {
              if (a && !a.dead && a.location === pid) { a.location = innId; moved += 1; }
            }
            pl.hidden = true;
            hidden += 1;
          }
          world.flags = world.flags || {};
          world.flags.innOneEntryV1 = { at: Date.now(), moved, hidden };
          console.log(`[Inn] 柜台并入客栈：挪 ${moved} 人，隐藏 ${hidden} 处`);
        }
      } catch { /* 忽略 */ }

""" + anchor
if 'innOneEntryV1' not in s and anchor in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('② 柜台并入')
