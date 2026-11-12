import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "            // ③ 他自己账号里跟她的对话（排除别的女人的私话）"
inject = (
    "            // 借贷备忘：以账本为准，别被聊天带偏\n"
    "            try {\n"
    "              const loans = (wPost.promises || []).filter((pr) => pr && pr.loan && !pr.done);\n"
    "              if (loans.length === 0) {\n"
    "                promiseFacts.push('账本上没有任何未了的借贷（她若说有，先别认，让她把数目和由头说清楚）');\n"
    "              } else {\n"
    "                for (const pr of loans) {\n"
    "                  const fromName = wPost.actors?.[pr.loan.from]?.name || pr.loan.from;\n"
    "                  const toName = wPost.actors?.[pr.loan.to]?.name || pr.loan.to;\n"
    "                  promiseFacts.push(`${fromName}借给${toName}${pr.loan.amount}两，欠钱的是${toName}，第${pr.due}日该还`);\n"
    "                }\n"
    "              }\n"
    "            } catch { /* 忽略 */ }\n\n"
    "            // ③ 他自己账号里跟她的对话（排除别的女人的私话）"
)
if anchor in s and '账本上没有任何未了的借贷' not in s:
    s = s.replace(anchor, inject, 1)
    print('added loan ledger fact')
else:
    print('WARN: anchor not found')
io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
