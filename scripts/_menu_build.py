import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'ensureResidence' not in s:
    s = s.replace("import { visiblePropertiesOf } from './world/employment.js';",
                  "import { visiblePropertiesOf } from './world/employment.js';\nimport { ensureResidence } from './world/residence.js';")
    print('引入 ensureResidence')

anchor = "        // 全城名册都算可去：有人的排前面，其次按名字排；私密房间（客栈房）不进公共列表"
add = """        // 读菜单时顺手把自己的宅子补齐（有院子的立刻跳过）
        try {
          const myHomeId = world.actors?.[actorId]?.home;
          if (myHomeId) {
            const r = ensureResidence(world, myHomeId);
            if (r.built) { ensureMarket(world); saveState(DATA_DIR, world); }
          }
        } catch { /* 忽略 */ }

""" + anchor
if '读菜单时顺手把自己的宅子补齐' not in s:
    s = s.replace(anchor, add, 1)
    print('菜单读时补宅子')
io.open(p, 'w', encoding='utf-8-sig').write(s)
