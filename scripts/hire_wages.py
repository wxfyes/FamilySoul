import io

# ① 雇人/辞人
p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "      } else if (kind === 'forgive') {"
inject = (
    "      } else if (kind === 'hire') {\n"
    "        // 雇人/辞人：staff 增减，工钱按日结\n"
    "        const nameHit = String(args.property || args.shop || args.text || '').trim();\n"
    "        const list = world.assets?.properties || [];\n"
    "        const prop = nameHit ? list.find((x) => x && String(x.name || '').includes(nameHit)) : null;\n"
    "        if (!prop) { applied.push('雇工:没找到那间产业'); continue; }\n"
    "        const delta = Math.round(Number(args.count ?? args.delta ?? 1));\n"
    "        if (!Number.isFinite(delta) || delta === 0) continue;\n"
    "        const cur = Number(prop.staff) || 0;\n"
    "        prop.staff = Math.max(0, Math.min(60, cur + delta));\n"
    "        applied.push(`雇工:${prop.name} ${prop.staff}人`);\n"
    "      } else if (kind === 'forgive') {"
)
if anchor in s and "kind === 'hire'" not in s:
    s = s.replace(anchor, inject, 1)
    print('added hire op')

io.open(p, 'w', encoding='utf-8').write(s)

# ② 每天发工钱；发不出就有人辞工
p2 = 'src/world/clock.js'
s2 = io.open(p2, encoding='utf-8-sig').read()

old = "    const gain = dailyIncomeOf(world, p);"
new = (
    "    const gain = dailyIncomeOf(world, p);\n"
    "    // 工钱：每人每日 0.12 两，从掌柜/东家账上扣；扣不出就有人辞工\n"
    "    const staff = Number(p.staff) || 0;\n"
    "    if (staff > 0) {\n"
    "      const wage = Math.round(staff * 0.12 * 100) / 100;\n"
    "      const payer = (p.keeper && p.keeper !== 'husband' && world.actors?.[p.keeper]) ? p.keeper : 'husband';\n"
    "      const purse = payer === 'husband' ? (Number(world.assets.silver) || 0) : (Number(world.wallets?.[payer]) || 0);\n"
    "      if (purse >= wage) {\n"
    "        if (payer === 'husband') world.assets.silver = round2(purse - wage);\n"
    "        else world.wallets[payer] = round2(purse - wage);\n"
    "      } else {\n"
    "        p.staff = Math.max(0, staff - 1);\n"
    "        p.morale = Math.max(0, (Number(p.morale) || 50) - 8);\n"
    "        console.log(`[Wage] ${p.name}发不出工钱，走了一个人（剩 ${p.staff}）`);\n"
    "      }\n"
    "    }"
)
if old in s2:
    s2 = s2.replace(old, new, 1)
    print('patched: wages')

io.open(p2, 'w', encoding='utf-8').write(s2)

# ③ 记账员学会雇人
p3 = 'src/pet-service.js'
s3 = io.open(p3, encoding='utf-8-sig').read()
old3 = "        '免债：[[world:forgive who=liuwenxia]] —— 相公说\"那钱不用还了/算我送她\"时用它：钱不收回，凭证作废。',"
new3 = old3 + "\n        '雇人：[[world:hire property=\"运河码头三层大酒楼\" count=3]] —— 说\"雇几个伙计/添人手\"时用；每人每日工钱 0.12 两。',"
if old3 in s3 and 'world:hire' not in s3:
    s3 = s3.replace(old3, new3)
    print('taught bookkeeper hire')
io.open(p3, 'w', encoding='utf-8').write(s3)
print('ok')
