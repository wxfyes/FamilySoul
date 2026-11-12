import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "            // 深度抹除：连\"她说过的话 / 与她的约定 / 关于她的事件\"一起清，像从没发生过\n"
if anchor not in s:
    print('WARN: deep wipe anchor not found')
else:
    add = (
        "            // 承诺也一起清：人都抹了，关于她的承诺不能留着\n"
        "            const prBefore = (world.promises || []).length;\n"
        "            world.promises = (world.promises || []).filter((pr) => {\n"
        "              const t = String(pr?.text || '');\n"
        "              const short = a.name && a.name.length > 2 ? a.name.slice(-2) : a.name;\n"
        "              return !(t.includes(a.name) || (short && t.includes(short)));\n"
        "            });\n"
        "            const pdBefore = (world.pending || []).length;\n"
        "            world.pending = (world.pending || []).filter((pd) => {\n"
        "              const t = String(pd?.desc || '');\n"
        "              const short = a.name && a.name.length > 2 ? a.name.slice(-2) : a.name;\n"
        "              return !(t.includes(a.name) || (short && t.includes(short)));\n"
        "            });\n"
    )
    s = s.replace(anchor, add + anchor, 1)
    print('patched: deep wipe also removes promises/pending')
io.open(p, 'w', encoding='utf-8').write(s)

# 把清掉的条数写进回执
s = io.open(p, encoding='utf-8-sig').read()
old_done = "              `${a.name} 深度抹除（原话 -${qBefore - (world.quotes || []).length}，约定 -${apBefore - (world.appointments || []).length}，事件 -${evRemoved}，对话 -${chatCleared}，痕迹 -${scrubbed}）`,"
new_done = "              `${a.name} 深度抹除（原话 -${qBefore - (world.quotes || []).length}，约定 -${apBefore - (world.appointments || []).length}，承诺 -${prBefore - (world.promises || []).length}，暗涌 -${pdBefore - (world.pending || []).length}，事件 -${evRemoved}，对话 -${chatCleared}，痕迹 -${scrubbed}）`,"
if old_done in s:
    s = s.replace(old_done, new_done)
    print('patched: receipt shows promise count')
else:
    print('WARN: receipt line not found')
io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
