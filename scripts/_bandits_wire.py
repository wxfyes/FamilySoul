import io

# ① 时钟：每月匪患生态
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'bandits.js' not in s:
    s = s.replace("import { runMigration, settleMigrants } from './migration.js';",
                  "import { runMigration, settleMigrants } from './migration.js';\nimport { maybeSpawnBandits, runBanditEcosystem } from './bandits.js';")
    anchor = """  // 每月：人口流动（灾荒逃难、招工投奔、商旅往来、投亲嫁娶——由事出人，不按配额）"""
    add = """  // 每月：全天下匪患（民怨地方自生，官府能剿则剿，剿不了就坐大）
  try {
    maybeSpawnBandits(world, events, nextEvent);
    runBanditEcosystem(world, events, nextEvent);
  } catch (err) {
    console.warn('[Bandit] 匪患推演失败：', err.message);
  }

""" + anchor
    if anchor in s:
        s = s.replace(anchor, add, 1)
        io.open(p, 'w', encoding='utf-8-sig').write(s)
        print('① 时钟接匪患')

# ② server：剿匪动作 + 负载
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
if 'quellBandits' not in t:
    t = t.replace("import { materializeMigrant, fallbackName } from './world/migration.js';",
                  "import { materializeMigrant, fallbackName } from './world/migration.js';\n"
                  "import { quellBandits, banditStrengthTotal } from './world/bandits.js';")
    old = "        else if (act === 'pay_arrears') result = payArrears(world, fid);"
    new = """        else if (act === 'pay_arrears') result = payArrears(world, fid);
        else if (act === 'quell_bandits') result = quellBandits(world, String(body.banditId || ''), Number(body.troops) || 0, String(body.city || ''));"""
    if old in t:
        t = t.replace(old, new, 1)
        print('② 接口加剿匪')
    # 负载：匪患列表
    t = t.replace("        goods: goodsSnapshot(world),",
                  "        goods: goodsSnapshot(world),\n"
                  "        bandits: Object.values(world.bandits || {}).map((b) => ({\n"
                  "          id: b.id, name: b.name, kind: b.kind, tier: b.tier,\n"
                  "          strength: Number(b.strength) || 0, leader: b.leader, city: b.homeCity,\n"
                  "          silver: Number(b.silver) || 0, grain: Number(b.grain) || 0,\n"
                  "        })),\n"
                  "        banditsTotal: banditStrengthTotal(world),", 1)
    print('③ 负载带匪患')
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
