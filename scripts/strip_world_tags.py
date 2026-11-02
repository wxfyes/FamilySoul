import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# 回执标签绝不能出现在回复里
old = "    // 有人应过声，就别再留\"没人接话\""
new = (
    "    // 回执标签绝不能出现在回复里\n"
    "    try {\n"
    "      if (reply) reply = String(reply).replace(/\\[\\[world:[\\s\\S]*?\\]\\]/g, '').replace(/\\n{2,}/g, '\\n').trim();\n"
    "    } catch { /* 忽略 */ }\n\n"
    "    // 有人应过声，就别再留\"没人接话\""
)
if old in s and '回执标签绝不能出现' not in s:
    s = s.replace(old, new, 1)
    print('patched: strip world tags from reply')
else:
    print('WARN: anchor not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
