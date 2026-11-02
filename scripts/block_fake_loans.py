import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# 在拿到代演台词后：账本没有借贷，就不许出现承认借贷的话
old = (
    "            const line = wrapProxyLine(husPost?.name || '王甯', r?.text);\n"
    "            if (line) {"
)
new = (
    "            let line = wrapProxyLine(husPost?.name || '王甯', r?.text);\n"
    "            // 账本没有借贷时，任何“承认借过/给过钱”的话都替换掉\n"
    "            try {\n"
    "              const hasLoan = (wPost.promises || []).some((pr) => pr && pr.loan && !pr.done);\n"
    "              const moneyTalk = /(借|欠|交到你手上|交给你|到期|还你|这二十两|银子我认)/;\n"
    "              if (line && !hasLoan && moneyTalk.test(line)) {\n"
    "                console.log('[Proxy] 账本无借贷，已拦下：' + line.slice(0, 40));\n"
    "                line = `【${husPost?.name || '王甯'}】：这话我听不明白——我账上没有这笔。`;\n"
    "              }\n"
    "            } catch { /* 忽略 */ }\n"
    "            if (line) {"
)
if old in s:
    s = s.replace(old, new)
    print('added hard block for fake loans')
else:
    print('WARN: wrapProxyLine block not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
