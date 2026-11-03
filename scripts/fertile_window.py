import io

# ① 服务端：下发 fertile（易孕窗口）
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'fertile:' not in s:
    old = "            onPeriod: Boolean(a.menses?.on),"
    new = ("            onPeriod: Boolean(a.menses?.on),\n"
           "            fertile: (() => {\n"
           "              const m = a.menses;\n"
           "              if (!m || typeof m.cycleDay !== 'number' || m.on) return false;\n"
           "              // 28 天周期：第 9~16 天为易孕期（排卵前后）\n"
           "              return m.cycleDay >= 9 && m.cycleDay <= 16;\n"
           "            })(),")
    s = s.replace(old, new, 1)
    print('① 接口下发 fertile')
io.open(p, 'w', encoding='utf-8').write(s)

# ② 受孕概率：按易孕期调整
p2 = 'src/pet-service.js'
d = io.open(p2, encoding='utf-8-sig').read()
old2 = "                const chance = age <= 30 ? 0.55 : 0.35;"
new2 = ("                const inWindow = Number(who.menses?.cycleDay) >= 9 && Number(who.menses?.cycleDay) <= 16;\n"
        "                const chance = inWindow ? 0.8 : 0.25;")
if old2 in d:
    d = d.replace(old2, new2, 1)
    print('② 受孕概率按易孕期/安全期')
io.open(p2, 'w', encoding='utf-8').write(d)

# ③ 看板：家宅行显示 易孕 / 安全 标签（神视角）
p3 = 'web/dashboard.html'
h = io.open(p3, encoding='utf-8').read()
old3 = "${a.onPeriod ? '<span class=\"tag\" style=\"margin-left:4px\">月事</span>' : ''}"
new3 = ("${a.onPeriod ? '<span class=\"tag\" style=\"margin-left:4px\">月事</span>' : ''}"
        "${a.fertile ? '<span class=\"tag good\" style=\"margin-left:4px\">易孕</span>' : ''}")
if old3 in h:
    h = h.replace(old3, new3, 1)
    print('③ 家宅显示易孕标签')
io.open(p3, 'w', encoding='utf-8').write(h)
print('done')
