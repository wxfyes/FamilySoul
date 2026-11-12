import io

# ① repay：还钱
p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      } else if (kind === 'spend') {"
inject = (
    "      } else if (kind === 'repay') {\n"
    "        // 还钱：钱回到出借人手里，承诺作废\n"
    "        const who = resolveActor(world, args.who || args.from);\n"
    "        const amount = round2(Number(args.amount) || 0);\n"
    "        if (!who || amount <= 0) continue;\n"
    "        world.wallets = world.wallets || {};\n"
    "        const have = Number(world.wallets[who]) || 0;\n"
    "        if (have < amount) {\n"
    "          applied.push(`还钱失败:${world.actors[who]?.name || who}只有${have}两`);\n"
    "          continue;\n"
    "        }\n"
    "        world.wallets[who] = round2(have - amount);\n"
    "        const loan = (world.promises || []).find((pr) => !pr.done && pr.loan && pr.loan.to === who);\n"
    "        const lender = loan?.loan?.from || 'husband';\n"
    "        if (lender === 'husband') world.assets.silver = round2((Number(world.assets.silver) || 0) + amount);\n"
    "        else world.wallets[lender] = round2((Number(world.wallets[lender]) || 0) + amount);\n"
    "        if (loan) {\n"
    "          loan.done = true;\n"
    "          loan.doneDay = world.clock.day;\n"
    "        }\n"
    "        applied.push(`还款:${amount}两 已到账`);\n"
    "      } else if (kind === 'spend') {"
)
if anchor in s and "kind === 'repay'" not in s:
    s = s.replace(anchor, inject, 1)
    print('added repay op')
else:
    print('WARN: spend anchor not found')
io.open(p, 'w', encoding='utf-8').write(s)

# ② 每天检查逾期：名声掉、记赖账、通知她
p2 = 'src/world/clock.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
anchor2 = "function consumeSupplies(world) {"
inject2 = (
    "function runLoanDues(world, events, queuePush) {\n"
    "  const day = Number(world.clock?.day) || 1;\n"
    "  for (const pr of world.promises || []) {\n"
    "    if (!pr || !pr.loan || pr.done) continue;\n"
    "    const due = Number(pr.due) || 0;\n"
    "    if (!due || day <= due) continue;\n"
    "    const borrower = pr.loan.to;\n"
    "    const name = world.actors?.[borrower]?.name || borrower;\n"
    "    if (!pr.overdueDay) {\n"
    "      pr.overdueDay = day;\n"
    "      world.reputation = Math.max(0, (Number(world.reputation) || 50) - 3);\n"
    "      events.push(nextEvent(world, { action: 'loan_overdue', actor: borrower, place: world.actors?.[borrower]?.location || null, payload: { text: `${name}借的银子过了期没还` }, isPublic: false }));\n"
    "      queuePush?.({ to: borrower, reason: 'loan', facts: { 借款: '已逾期' }, fallback: `借的银子到期了还没还——名声会受影响。`, force: true });\n"
    "      continue;\n"
    "    }\n"
    "    if (day - Number(pr.overdueDay) >= 3 && !pr.failed) {\n"
    "      pr.failed = true;\n"
    "      pr.done = true;\n"
    "      world.memories = Array.isArray(world.memories) ? world.memories : [];\n"
    "      world.memories.push({ text: `${name}赖了一笔账没还`, day, at: Date.now(), about: [borrower], visible: 'private' });\n"
    "      events.push(nextEvent(world, { action: 'loan_default', actor: borrower, place: null, payload: { text: `${name}赖账` }, isPublic: false }));\n"
    "      queuePush?.({ to: borrower, reason: 'loan', facts: { 借款: '已赖账' }, fallback: `那笔银子到底没还上，街面上开始有人说了。`, force: true });\n"
    "    }\n"
    "  }\n"
    "}\n\n"
    "function consumeSupplies(world) {"
)
if anchor2 in s2 and 'runLoanDues' not in s2:
    s2 = s2.replace(anchor2, inject2, 1)
    print('added loan dues tick')
else:
    print('WARN: consumeSupplies anchor not found')

s2 = s2.replace(
    "  consumeSupplies(world);",
    "  consumeSupplies(world);\n  try {\n    runLoanDues(world, events, (o) => queueProactive(world, { type: 'loan', ...o }));\n  } catch (err) {\n    console.warn('[Loan] 借还款结算失败：', err.message);\n  }",
    1,
)
io.open(p2, 'w', encoding='utf-8').write(s2)

# ③ 记账员学 repay
p3 = 'src/pet-service.js'
s3 = io.open(p3, encoding='utf-8-sig').read()
old3 = "        '借钱：[[world:loan to=liuwenxia amount=20 due=第40日]] —— 相公答应借钱给别人时用这个，钱会真的转过去；不记就等于空口许诺。',"
new3 = old3 + "\n        '还钱：[[world:repay who=liuwenxia amount=20]] —— 借的人还钱时用它，钱回到出借人手里。',"
if old3 in s3 and 'world:repay' not in s3:
    s3 = s3.replace(old3, new3)
    print('taught bookkeeper repay')
io.open(p3, 'w', encoding='utf-8').write(s3)
print('ok')
