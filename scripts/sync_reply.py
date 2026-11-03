import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "    return {\n      ok: true,\n      reply: assistantMsg,"
new = (
    "    // 最后一道：所有后处理改的是 reply，这里同步回 assistantMsg\n"
    "    try {\n"
    "      if (assistantMsg && typeof reply === 'string' && reply !== assistantMsg.text) {\n"
    "        assistantMsg.text = reply;\n"
    "      }\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    return {\n      ok: true,\n      reply: assistantMsg,"
)
if old in s and '同步回 assistantMsg' not in s:
    s = s.replace(old, new, 1)
    print('patched: sync reply into assistantMsg')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
