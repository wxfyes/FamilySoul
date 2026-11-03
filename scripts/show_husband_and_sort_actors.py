import io, re

# ---------- ① 服务端：把「王甯」也放进 actors，看板才看得到他的行踪 ----------
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "        const actors = Object.entries(world.actors || {})\n          .filter(([key]) => key !== 'husband')"
new = "        const actors = Object.entries(world.actors || {})\n          // 相公本人也放进列表，看板才能看到他的行踪"
if old in s:
    s = s.replace(old, new, 1)
    # 修正缩进：原 map 链缩进是 12 空格，去掉 filter 行后需保持
    s = s.replace("          // 相公本人也放进列表，看板才能看到他的行踪\n          .map(([key, a]) => ({",
                  "          // 相公本人也放进列表，看板才能看到他的行踪\n          .map(([key, a]) => ({")
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① 服务端 actors 已包含相公')
else:
    print('WARN: actors filter 未找到')

# ---------- ② 看板人物卡：相关的人靠前 ----------
p2 = 'web/dashboard.html'
lines = io.open(p2, encoding='utf-8').read().split('\n')
idx = None
for i, l in enumerate(lines):
    if ".sort((a,b)=> (a.id==='husband'?-1:0)-(b.id==='husband'?-1:0));" in l:
        idx = i
        break
if idx is None:
    print('WARN: 人物排序行未找到')
else:
    lines[idx] = (
        "    .sort((a,b) => {\n"
        "      // 相关的人靠前：相公 → 府内 → 相好/高信任 → 其他\n"
        "      const rank = (a) => {\n"
        "        if (a.id === 'husband') return 0;\n"
        "        if (a.household) return 1;\n"
        "        const t = Number(a.relations?.trust) || 0;\n"
        "        const cons = a.intimacy && a.intimacy.consummated;\n"
        "        if (cons || t >= 50) return 2;\n"
        "        return 3;\n"
        "      };\n"
        "      const ra = rank(a), rb = rank(b);\n"
        "      if (ra !== rb) return ra - rb;\n"
        "      const ta = Number(a.relations?.trust) || 0, tb = Number(b.relations?.trust) || 0;\n"
        "      if (tb !== ta) return tb - ta;\n"
        "      return String(a.name || '').localeCompare(String(b.name || ''), 'zh');\n"
        "    });"
    )
    io.open(p2, 'w', encoding='utf-8').write('\n'.join(lines))
    print('② 人物卡已按关系亲疏排序')

print('done')
