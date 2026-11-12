import io

# ① 借钱落账：钱真转，承诺真记
p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "      } else if (kind === 'spend') {"
inject = (
    "      } else if (kind === 'loan') {\n"
    "        // 借钱：钱真的从一方到另一方，同时立一条还款承诺\n"
    "        const fromId = String(args.from || 'husband');\n"
    "        const toId = resolveActor(world, args.to || args.who);\n"
    "        const amount = round2(Number(args.amount) || 0);\n"
    "        if (!toId || amount <= 0) continue;\n"
    "        world.wallets = world.wallets || {};\n"
    "        const payerIsHusband = fromId === 'husband';\n"
    "        const payerBalance = payerIsHusband ? (Number(world.assets.silver) || 0) : (Number(world.wallets[fromId]) || 0);\n"
    "        if (payerBalance < amount) {\n"
    "          applied.push(`借钱失败:${world.actors[fromId]?.name || fromId}只有${payerBalance}两`);\n"
    "          continue;\n"
    "        }\n"
    "        if (payerIsHusband) world.assets.silver = round2(payerBalance - amount);\n"
    "        else world.wallets[fromId] = round2(payerBalance - amount);\n"
    "        world.wallets[toId] = round2((Number(world.wallets[toId]) || 0) + amount);\n"
    "        world.flags = world.flags || {};\n"
    "        world.flags.loanSeq = (Number(world.flags.loanSeq) || 0) + 1;\n"
    "        const dueDay = Number(args.due) > 0 ? Number(args.due) : (Number(world.clock.day) || 1) + 30;\n"
    "        world.promises.push({\n"
    "          text: `${world.actors[toId]?.name || '她'}借${world.actors[fromId]?.name || '相公'}${amount}两，约定第${dueDay}日归还`,\n"
    "          due: dueDay,\n"
    "          at: world.clock.day,\n"
    "          done: false,\n"
    "          about: [toId],\n"
    "          loan: { from: fromId, to: toId, amount },\n"
    "        });\n"
    "        world.memories = Array.isArray(world.memories) ? world.memories : [];\n"
    "        world.memories.push({ text: `${world.actors[fromId]?.name || '相公'}借给${world.actors[toId]?.name || '她'}${amount}两`, day: world.clock.day, at: Date.now(), about: [toId], visible: 'private' });\n"
    "        applied.push(`借款:${amount}两 已到账（${world.actors[toId]?.name || toId}）`);\n"
    "      } else if (kind === 'spend') {"
)
if anchor in s and "kind === 'loan'" not in s:
    s = s.replace(anchor, inject, 1)
    print('added loan op')
else:
    print('WARN: spend anchor not found')
io.open(p, 'w', encoding='utf-8').write(s)

# ② 记账员学会 loan
p2 = 'src/pet-service.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
old2 = "        '花销：[[world:spend amount=32 unit=文 reason=\"买茶\"]] —— **凡是付账、买东西、打赏、雇人，必须记这一笔**；不记就等于白拿。',"
new2 = old2 + "\n        '借钱：[[world:loan to=liuwenxia amount=20 due=第40日]] —— 相公答应借钱给别人时用这个，钱会真的转过去；不记就等于空口许诺。',"
if old2 in s2 and 'world:loan' not in s2:
    s2 = s2.replace(old2, new2)
    print('taught bookkeeper loan')
else:
    print('WARN: spend rule line not found')
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
