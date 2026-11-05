import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
strip = """    // 9. 最终兜底：剔除任何未识别的英文系统标签，绝不向客户端吐裸露英文 [[...]]
    reply = reply.replace(/\\[\\[[a-zA-Z0-9_]+:[^\\]]*\\]\\]/g, '').replace(/\\[\\[[^\\]]*\\]\\]/g, '');

    // 10. NPC 告辞离场：识别离场并走单一移动入口规范挪回自家或长街
    try {
      applyNpcDeparture(dataDir, reply, sayText);
    } catch (err) {
      console.warn('[Departure] 离场处理失败：', err.message);
    }
"""
fixed = """    // 9. NPC 告辞离场：先照 [[depart:谁|去哪]] 把真位移走完，再清标签
    try {
      applyNpcDeparture(dataDir, reply, sayText);
    } catch (err) {
      console.warn('[Departure] 离场处理失败：', err.message);
    }

    // 10. 最终兜底：剔除任何未识别的系统标签，绝不向客户端吐裸露 [[...]]
    reply = reply.replace(/\\[\\[[a-zA-Z0-9_]+:[^\\]]*\\]\\]/g, '').replace(/\\[\\[[^\\]]*\\]\\]/g, '');
"""
if strip in s:
    s = s.replace(strip, fixed, 1)
    print('① 离场先于标签清洗')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ② clock：到点收回 away/activity
p2 = 'src/world/clock.js'
t = io.open(p2, encoding='utf-8-sig').read()
if 'sweepAway' not in t:
    anchor = "function advanceHour(world, events, nowMs) {"
    fn = '''/** 到点收回"在外办差"的状态：away 过期就销账，别让人永远挂着出差 */
function sweepAway(world) {
  const day = Number(world.clock?.day) || 1;
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || !a.away) continue;
    if (Number(a.away.untilDay) >= day) continue;
    delete a.away;
    if (a.activity && /差|去|离|办/.test(String(a.activity.text || ''))) {
      a.activity = null;
    }
  }
}

''' + anchor
    if anchor in t:
        t = t.replace(anchor, fn, 1)
        # 每天翻篇时调用一次
        hook = """  world.clock.hour += 1;
  // 每小时：私宅巡检"""
        if hook in t:
            t = t.replace(hook, """  world.clock.hour += 1;
  try { sweepAway(world); } catch { /* 忽略 */ }
  // 每小时：私宅巡检""", 1)
            print('② 时钟收回过期 away')
        io.open(p2, 'w', encoding='utf-8-sig').write(t)
