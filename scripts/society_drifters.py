import io

p = 'src/world/society.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """/** 同类富集：某个地点的人是不是多得不正常 */"""
new = """/**
 * 街上闲人：站在街/巷/路口的人。
 * 摆摊挑担的本来就该在街上——所以不在这层判断，
 * 把名单交给天道，由它决定谁该回铺子、谁本来就该在街上。
 */
export function collectDrifters(world) {
  const streetIds = Object.entries(world.places || {})
    .filter(([, p]) => /街|巷|路口|市$/.test(String(p?.name || '')))
    .map(([id]) => id);
  if (!streetIds.length) return null;
  const list = Object.values(world.actors || {})
    .filter((a) => a && !a.dead && !a.humanBound && streetIds.includes(a.location) && a.id !== 'husband')
    .slice(0, 24);
  if (list.length < 3) return null;
  return {
    placeName: world.places?.[list[0].location]?.name || '街市',
    stuck: list.map((a) => ({ id: a.id, name: a.name, role: a.role || '' })),
  };
}

/** 同类富集：某个地点的人是不是多得不正常 */"""
if old in s and 'collectDrifters' not in s:
    s = s.replace(old, new, 1)
    print('① society 增加街上闲人收集')
io.open(p, 'w', encoding='utf-8').write(s)

# 服务端：heal 接口与心跳都用"闲人"兜底
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { detectDrift, buildDriftPrompt, applyPlacements, shouldHeal } from './world/society.js';",
              "import { detectDrift, collectDrifters, buildDriftPrompt, applyPlacements, shouldHeal } from './world/society.js';", 1)

# 心跳里：没有富集就查闲人
t = t.replace("""      const drift = detectDrift(world);
      if (!drift) return;
      if (!shouldHeal(world, false)) return;""",
"""      const drift = detectDrift(world) || collectDrifters(world);
      if (!drift) return;
      if (!shouldHeal(world, false)) return;""", 1)

# 诊断接口同样
t = t.replace("""        const drift = detectDrift(world);
        if (!drift) return sendJson(res, 200, { ok: true, healed: false, reason: '人没挤在一起，不用治' });""",
"""        const drift = detectDrift(world) || collectDrifters(world);
        if (!drift) return sendJson(res, 200, { ok: true, healed: false, reason: '没有该安顿的人' });""", 1)

io.open(p2, 'w', encoding='utf-8').write(t)
print('② 心跳与接口接入闲人')
print('done')
