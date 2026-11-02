import io

p = 'src/server.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')

# 在 "// 她自己的聊天历史" 之前插入承诺/暗涌清理
idx = None
for i, line in enumerate(lines):
    if line.strip() == '// 她自己的聊天历史' and 'let chatCleared' in lines[i+1]:
        idx = i
        break

if idx is None:
    print('WARN: insert point not found')
else:
    block = [
        "            // 承诺与暗涌也一起清：人都抹了，关于她的承诺不能留着",
        "            const prBefore = (world.promises || []).length;",
        "            const nameShort = a.name && a.name.length > 2 ? a.name.slice(-2) : a.name;",
        "            world.promises = (world.promises || []).filter((pr) => {",
        "              const t = String(pr?.text || '');",
        "              return !(t.includes(a.name) || (nameShort && t.includes(nameShort)));",
        "            });",
        "            const pdBefore = (world.pending || []).length;",
        "            world.pending = (world.pending || []).filter((pd) => {",
        "              const t = String(pd?.desc || '');",
        "              return !(t.includes(a.name) || (nameShort && t.includes(nameShort)));",
        "            });",
    ]
    lines = lines[:idx] + block + lines[idx:]
    print('inserted promise/pending cleanup')

io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('ok')
