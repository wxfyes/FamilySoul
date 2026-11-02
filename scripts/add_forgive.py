import io

# ① forgive：免债，承诺关闭，但钱不退
p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      } else if (kind === 'collect') {"
inject = (
    "      } else if (kind === 'forgive') {\n"
    "        // 免债：钱不收回，凭证作废（这是\"送她\"，不是\"取消\"）\n"
    "        const who = resolveActor(world, args.who || args.to);\n"
    "        const target = (world.promises || []).find(\n"
    "          (pr) => !pr.done && pr.loan && (!who || pr.loan.to === who),\n"
    "        );\n"
    "        if (!target) {\n"
    "          applied.push('免债:没有可免的借款');\n"
    "          continue;\n"
    "        }\n"
    "        target.done = true;\n"
    "        target.doneDay = world.clock.day;\n"
    "        target.forgiven = true;\n"
    "        const debtor = target.loan.to;\n"
    "        const creditor = target.loan.from;\n"
    "        world.memories = Array.isArray(world.memories) ? world.memories : [];\n"
    "        world.memories.push({\n"
    "          text: `${world.actors?.[creditor]?.name || creditor}免了${world.actors?.[debtor]?.name || debtor}${target.loan.amount}两的债`,\n"
    "          day: world.clock.day,\n"
    "          at: Date.now(),\n"
    "          about: [debtor, creditor].filter(Boolean),\n"
    "          visible: 'private',\n"
    "        });\n"
    "        const rel = world.actors?.[debtor]?.relations?.husband;\n"
    "        if (rel && typeof rel.trust === 'number') rel.trust = Math.min(100, rel.trust + 5);\n"
    "        applied.push(`免债:${target.loan.amount}两 已勾销`);\n"
    "      } else if (kind === 'collect') {"
)
if anchor in s and "kind === 'forgive'" not in s:
    s = s.replace(anchor, inject, 1)
    print('added forgive op')
else:
    print('WARN: collect anchor not found')
io.open(p, 'w', encoding='utf-8').write(s)

# ② 记账员学会
p2 = 'src/pet-service.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
old2 = "        '还钱：[[world:repay who=liuwenxia amount=20]] —— 借的人还钱时用它，钱回到出借人手里。',"
new2 = old2 + "\n        '免债：[[world:forgive who=liuwenxia]] —— 相公说\"那钱不用还了/算我送她\"时用它：钱不收回，凭证作废。',"
if old2 in s2 and 'world:forgive' not in s2:
    s2 = s2.replace(old2, new2)
    print('taught bookkeeper forgive')
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
