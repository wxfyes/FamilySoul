import io

# ① 逾期 7 天：强行扣还
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "    if (day - Number(pr.overdueDay) >= 3 && !pr.failed) {\n"
    "      pr.failed = true;\n"
    "      pr.done = true;\n"
    "      world.memories = Array.isArray(world.memories) ? world.memories : [];\n"
    "      world.memories.push({ text: `${name}赖了一笔账没还`, day, at: Date.now(), about: [borrower], visible: 'private' });\n"
    "      events.push(nextEvent(world, { action: 'loan_default', actor: borrower, place: null, payload: { text: `${name}赖账` }, isPublic: false }));\n"
    "      queuePush?.({ to: borrower, reason: 'loan', facts: { 借款: '已赖账' }, fallback: `那笔银子到底没还上，街面上开始有人说了。`, force: true });\n"
    "    }"
)
new = (
    "    if (day - Number(pr.overdueDay) >= 3 && !pr.failed) {\n"
    "      pr.failed = true;\n"
    "      world.memories = Array.isArray(world.memories) ? world.memories : [];\n"
    "      world.memories.push({ text: `${name}赖了一笔账没还`, day, at: Date.now(), about: [borrower], visible: 'private' });\n"
    "      events.push(nextEvent(world, { action: 'loan_default', actor: borrower, place: null, payload: { text: `${name}赖账` }, isPublic: false }));\n"
    "      queuePush?.({ to: borrower, reason: 'loan', facts: { 借款: '已赖账' }, fallback: `那笔银子到底没还上，街面上开始有人说了。`, force: true });\n"
    "    }\n"
    "    // 逾期 7 天：出借人不再等，直接从她账上扣\n"
    "    if (day - Number(pr.overdueDay) >= 7 && !pr.done) {\n"
    "      const owed = round2((Number(pr.loan.amount) || 0) - (Number(pr.repaid) || 0));\n"
    "      const purse = Number(world.wallets?.[borrower]) || 0;\n"
    "      const take = Math.min(purse, owed);\n"
    "      if (take > 0) {\n"
    "        world.wallets = world.wallets || {};\n"
    "        world.wallets[borrower] = round2(purse - take);\n"
    "        const lender = pr.loan.from || 'husband';\n"
    "        if (lender === 'husband') world.assets.silver = round2((Number(world.assets.silver) || 0) + take);\n"
    "        else world.wallets[lender] = round2((Number(world.wallets[lender]) || 0) + take);\n"
    "        pr.repaid = round2((Number(pr.repaid) || 0) + take);\n"
    "        events.push(nextEvent(world, { action: 'loan_collected', actor: borrower, place: null, payload: { text: `强行扣还${name}${take}两` }, isPublic: false }));\n"
    "        queuePush?.({ to: borrower, reason: 'loan', facts: { 借款: '被强行扣还' }, fallback: `那笔旧账被人从你账上直接划走了 ${take} 两。`, force: true });\n"
    "      }\n"
    "      if ((Number(pr.repaid) || 0) >= (Number(pr.loan.amount) || 0)) {\n"
    "        pr.done = true;\n"
    "        pr.doneDay = day;\n"
    "      }\n"
    "    }"
)
if old in s:
    s = s.replace(old, new)
    print('added forced collection after 7 days')
else:
    print('WARN: due block not found')
io.open(p, 'w', encoding='utf-8').write(s)

# ② 手动讨债
p2 = 'src/world/dispatch.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
anchor = "      } else if (kind === 'spend') {"
inject = (
    "      } else if (kind === 'collect') {\n"
    "        // 讨债：当场从她账上扣\n"
    "        const who = resolveActor(world, args.who || args.to);\n"
    "        if (!who) continue;\n"
    "        const loan = (world.promises || []).find((pr) => !pr.done && pr.loan && pr.loan.to === who);\n"
    "        if (!loan) {\n"
    "          applied.push('讨债:没有欠账');\n"
    "          continue;\n"
    "        }\n"
    "        const owed = round2((Number(loan.loan.amount) || 0) - (Number(loan.repaid) || 0));\n"
    "        const purse = Number(world.wallets?.[who]) || 0;\n"
    "        const take = Math.min(purse, owed);\n"
    "        if (take <= 0) {\n"
    "          applied.push('讨债:她账上没钱');\n"
    "          continue;\n"
    "        }\n"
    "        world.wallets = world.wallets || {};\n"
    "        world.wallets[who] = round2(purse - take);\n"
    "        const lender = loan.loan.from || 'husband';\n"
    "        if (lender === 'husband') world.assets.silver = round2((Number(world.assets.silver) || 0) + take);\n"
    "        else world.wallets[lender] = round2((Number(world.wallets[lender]) || 0) + take);\n"
    "        loan.repaid = round2((Number(loan.repaid) || 0) + take);\n"
    "        if ((Number(loan.repaid) || 0) >= (Number(loan.loan.amount) || 0)) {\n"
    "          loan.done = true;\n"
    "          loan.doneDay = world.clock.day;\n"
    "        }\n"
    "        applied.push(`讨债:收回${take}两`);\n"
    "      } else if (kind === 'spend') {"
)
if anchor in s2 and "kind === 'collect'" not in s2:
    s2 = s2.replace(anchor, inject, 1)
    print('added collect op')
else:
    print('WARN: spend anchor not found')
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
