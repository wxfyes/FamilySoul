import io
p = 'src/world/goals.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("    if (a.name === '沈婉儿') console.log(`[Goal] 婉儿：${g ? g.text + ' 去' + g.place : '没生成'}`);\n", "")
s = s.replace("    if (a.name === '沈婉儿') console.log(`[Goal] 婉儿推进：place=${g.place} loc=${a.location} hour=${hour} due=${g.due}`);\n", "")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('清理婉儿调试日志')

p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
start = t.find("      let dbg = null;")
end = t.find("      return sendJson(res, 200, { ok: true, tick, goalsInfo, dbg,", start)
if start > 0 and end > 0:
    t = t[:start] + t[end:]
    t = t.replace("return sendJson(res, 200, { ok: true, tick, goalsInfo, dbg,", "return sendJson(res, 200, { ok: true, tick, goalsInfo,")
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('去掉调试字段')
