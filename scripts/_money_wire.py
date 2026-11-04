import io
# ① /api/me 用 getMoney
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'money.js' not in s:
    s = s.replace("import { recentLedger, spendSilver } from './world/ledger.js';",
                  "import { recentLedger, spendSilver } from './world/ledger.js';\nimport { getMoney, setMoney, spendMoney, syncMoney } from './world/money.js';", 1)
    if 'money.js' not in s:
        s = s.replace("import { spendSilver, recentLedger } from './world/ledger.js';",
                      "import { spendSilver, recentLedger } from './world/ledger.js';\nimport { getMoney, setMoney, spendMoney, syncMoney } from './world/money.js';", 1)
    print('引入 money')

old = "        silver: isHusband ? Number(world.assets?.silver) || 0 : Number(world.wallets?.[actorId]) || 0,"
new = "        silver: getMoney(world, actorId),"
if old in s:
    s = s.replace(old, new, 1)
    print('/api/me 改用 getMoney')

# 付款时成员的钱也走 spendMoney
old2 = """        const silver = actorId === 'husband' ? (Number(world.assets?.silver) || 0) : (Number(world.wallets?.[actorId]) || 0);"""
new2 = """        const silver = getMoney(world, actorId);"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('付款读钱改用 getMoney')

old3 = """        } else {
          world.wallets = { ...(world.wallets || {}), [actorId]: Math.round((silver - price) * 100) / 100 };
        }"""
new3 = """        } else {
          const spent2 = spendMoney(world, actorId, price, `${pend.title || '花销'}·${opt?.label || ''}`);
          if (!spent2.ok) return sendJson(res, 200, { ok: false, error: spent2.error });
        }"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    print('成员付款走 spendMoney')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ② 迁移里同步钱包
p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
anchor = "export function migrateOwnership(world) {"
if 'syncMoney(world)' not in t:
    t = t.replace(anchor, anchor + "\n  // 银两对齐：actor.money 与 wallets 只留一个真相\n  try { syncMoney(world); } catch { /* 忽略 */ }", 1)
    if "from './money.js'" not in t:
        idx = t.find('\n', t.find('import '))
        t = t[:idx+1] + "import { syncMoney } from './money.js';\n" + t[idx+1:]
    print('迁移里对齐银两')
io.open(p2, 'w', encoding='utf-8-sig').write(t)
