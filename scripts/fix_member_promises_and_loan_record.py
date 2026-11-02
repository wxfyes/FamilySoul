import io

# ① 她的号：能看到"关于她"的承诺（含借款）
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "        // 承诺是\"相公许下的\"，不属于她的待办；她的号一条都不看\n"
    "        if (!isHusband) continue;"
)
new = (
    "        // 她的号：只看\"关于她\"的承诺（借款、她许下的事）\n"
    "        if (!isHusband) {\n"
    "          const about = Array.isArray(pr.about) ? pr.about : [];\n"
    "          if (!about.includes(actorId)) continue;\n"
    "        }"
)
if old in s:
    s = s.replace(old, new)
    print('patched: member sees her own promises')
else:
    print('WARN: promise filter not found')

# 借款显示成"借款"而不是"承诺"
old2 = "        todos.push({ kind: \"承诺\", text: pr.text || \"\", day: pr.due });"
new2 = "        todos.push({ kind: pr.loan ? '借款' : '承诺', text: pr.text || '', day: pr.due });"
if old2 in s:
    s = s.replace(old2, new2)
    print('patched: loan labeled')

# ② 记一笔借款（不转账），用于对账
anchor = "    // 9.27 三道自检 GET /api/admin/audit"
inject = (
    "    // 9.26d 记一笔借款但不转账 POST /api/admin/loan/record {from,to,amount,due}\n"
    "    if (req.method === 'POST' && pathname === '/api/admin/loan/record') {\n"
    "      try {\n"
    "        const body = await parseJsonBody(req, 64 * 1024);\n"
    "        const world = peek(DATA_DIR);\n"
    "        const from = String(body.from || 'husband');\n"
    "        const to = String(body.to || '');\n"
    "        const amount = Math.round((Number(body.amount) || 0) * 100) / 100;\n"
    "        if (!to || amount <= 0) return sendJson(res, 400, { ok: false, error: '参数不全' });\n"
    "        const day = Number(world.clock?.day) || 1;\n"
    "        const due = Number(body.due) > 0 ? Number(body.due) : day + 30;\n"
    "        const fromName = world.actors?.[from]?.name || from;\n"
    "        const toName = world.actors?.[to]?.name || to;\n"
    "        world.promises = Array.isArray(world.promises) ? world.promises : [];\n"
    "        world.promises.push({\n"
    "          text: `${fromName}借给${toName}${amount}两（${toName}欠${fromName}），第${due}日还清`,\n"
    "          due,\n"
    "          at: day,\n"
    "          done: false,\n"
    "          about: [to],\n"
    "          loan: { from, to, amount },\n"
    "        });\n"
    "        saveState(DATA_DIR, world);\n"
    "        console.log(`[Loan] 补记借款 ${fromName}→${toName} ${amount}两 第${due}日`);\n"
    "        return sendJson(res, 200, { ok: true, text: world.promises[world.promises.length - 1].text });\n"
    "      } catch (err) {\n"
    "        return sendJson(res, 500, { ok: false, error: err.message });\n"
    "      }\n"
    "    }\n\n"
    "    // 9.27 三道自检 GET /api/admin/audit"
)
if anchor in s and '/api/admin/loan/record' not in s:
    s = s.replace(anchor, inject, 1)
    print('added loan record endpoint')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
