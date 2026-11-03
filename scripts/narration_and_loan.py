import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 有台词就不要旁白（别每轮重复"就站在临江茶坊…"）
anchor = "    // 最后一道：所有后处理改的是 reply，这里同步回 assistantMsg"
block = (
    "    // 有人说正经台词了，旁白就别再占一行（它会每轮重复同一句）\n"
    "    try {\n"
    "      const lines = String(reply || '').split('\\n');\n"
    "      const hasSpeech = lines.some((l) => /^【[^】]+】/.test(l) && !/^【(天道|旁白|)[^】]*】：\\s*[^【]*(就站在|四下冷清|你到了|没人接话|没人应声)/.test(l));\n"
    "      if (hasSpeech) {\n"
    "        const kept = lines.filter((l) => !/(就站在|四下冷清|你到了|没人接话|没人应声)/.test(l));\n"
    "        const joined = kept.join('\\n').trim();\n"
    "        if (joined) reply = joined;\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    // 最后一道：所有后处理改的是 reply，这里同步回 assistantMsg"
)
if anchor in s and '旁白就别再占一行' not in s:
    s = s.replace(anchor, block, 1)
    print('patched: drop narration when speech exists')

# ② 代演不许主动提借贷
old = "账本上没有任何未了的借贷（她若说有，先别认，让她把数目和由头说清楚）"
new = "账本上没有任何未了的借贷（她若主动提起，你可以问一句；她没提，你就一个字都不许提钱和账）"
if old in s:
    s = s.replace(old, new)
    print('patched: proxy loan wording')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
