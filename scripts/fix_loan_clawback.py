import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "        } else {\n"
    "          const before = (world.promises || []).length;\n"
    "          world.promises = (world.promises || []).filter((x) => String(x?.text || '') !== text);\n"
    "          removed = before - world.promises.length;\n"
    "        }"
)
new = (
    "        } else {\n"
    "          const before = (world.promises || []).length;\n"
    "          const target = (world.promises || []).find((x) => String(x?.text || '') === text);\n"
    "          // 借款凭证不能\"删了就白拿\"：先把钱退回去，再删凭证\n"
    "          if (target && target.loan && !target.done) {\n"
    "            const { from, to, amount } = target.loan;\n"
    "            const owed = Math.max(0, Number(amount) - (Number(target.repaid) || 0));\n"
    "            const purse = Number(world.wallets?.[to]) || 0;\n"
    "            const take = Math.min(purse, owed);\n"
    "            if (take > 0) {\n"
    "              world.wallets = world.wallets || {};\n"
    "              world.wallets[to] = Math.round((purse - take) * 100) / 100;\n"
    "              if (from === 'husband') world.assets.silver = Math.round(((Number(world.assets.silver) || 0) + take) * 100) / 100;\n"
    "              else world.wallets[from] = Math.round(((Number(world.wallets[from]) || 0) + take) * 100) / 100;\n"
    "              reclaimed = take;\n"
    "            }\n"
    "          }\n"
    "          world.promises = (world.promises || []).filter((x) => String(x?.text || '') !== text);\n"
    "          removed = before - world.promises.length;\n"
    "        }"
)
if old in s:
    s = s.replace(old, new)
    print('patched: clawback on deleting loan promise')
else:
    print('WARN: promise removal block not found')

# 声明 reclaimed 并写进返回
s = s.replace(
    "        let removed = 0;",
    "        let removed = 0;\n        let reclaimed = 0;",
)
s = s.replace(
    "        return sendJson(res, 200, { ok: true, removed });",
    "        return sendJson(res, 200, { ok: true, removed, reclaimed });",
)

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
