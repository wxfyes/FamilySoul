import io
# ① 统一"被请走"的状态：awayUntil（唯一事实），写进单一写入口
p = 'src/world/position.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  // 在押犯人：服刑期间严禁常规走动与作息闲逛，只能在狱中或提审"""
new = """  // 刚被主人请走的人：几个时辰内不许自己回来（送客本人除外）
  try {
    const aw = a.awayUntil;
    if (aw && !String(note || '').includes('送客')) {
      const day = Number(world.clock?.day) || 1;
      const hour = Number(world.clock?.hour) || 0;
      const until = Number(aw.day) === day ? Number(aw.hour) : (Number(aw.day) > day ? 99 : hour);
      if (until > hour) return { ok: false, error: '刚被请走，暂不回来' };
      delete a.awayUntil;
    }
  } catch { /* 忽略 */ }

  // 在押犯人：服刑期间严禁常规走动与作息闲逛，只能在狱中或提审"""
if old in s and 'awayUntil' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① moveActor 认 awayUntil')

# ② 送客时用 awayUntil
p2 = 'src/pet-service.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("""              a.dismissedUntil = { day: wF.clock?.day || 1, hour: ((Number(wF.clock?.hour) || 0) + 4) % 24 };""",
"""              a.awayUntil = { day: wF.clock?.day || 1, hour: ((Number(wF.clock?.hour) || 0) + 4) % 24 };""", 1)
t = t.replace("""            const mv = wF.places?.[back] ? moveActor(wF, a.id, back, 'world', '告辞离场') : { ok: false };""",
"""            const mv = wF.places?.[back] ? moveActor(wF, a.id, back, 'world', '送客离场') : { ok: false };""", 1)
io.open(p2, 'w', encoding='utf-8-sig').write(t)
print('② 送客写 awayUntil')

# ③ 日程与摊子认 awayUntil
p3 = 'src/world/clock.js'
u = io.open(p3, encoding='utf-8-sig').read()
u = u.replace("if (actor.dismissedUntil) {", "if (actor.awayUntil) {", 1)
u = u.replace("const d = actor.dismissedUntil;", "const d = actor.awayUntil;", 1)
u = u.replace("delete actor.dismissedUntil;", "delete actor.awayUntil;", 1)
io.open(p3, 'w', encoding='utf-8-sig').write(u)
p4 = 'src/world/stalls.js'
v = io.open(p4, encoding='utf-8-sig').read()
v = v.replace("if (!a?.dismissedUntil) continue;", "if (!a?.awayUntil) continue;", 1)
v = v.replace("const d = a.dismissedUntil;", "const d = a.awayUntil;", 1)
v = v.replace("delete a.dismissedUntil;", "delete a.awayUntil;", 1)
io.open(p4, 'w', encoding='utf-8-sig').write(v)
print('③ 日程/摊子认 awayUntil')
