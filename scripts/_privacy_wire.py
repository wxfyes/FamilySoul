import io

# ① 统一在移动入口把关：外人进不了别人家的后宅
p = 'src/world/apply.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { hasPass } from './visit.js';",
              "import { hasPass } from './visit.js';\nimport { isInnerRoom, homeOf, belongsTo, invitedToday } from './privacy.js';", 1)
old = """      // 门禁：别人的私宅，外人不许直接进正房内院——先到大门/门房"""
new = """      // 后宅门第：别人的正房/厢房/后院，外人止步（本家、当日请帖除外）
      try {
        const destRoom = world.places?.[finalTargetId];
        if (destRoom && isInnerRoom(destRoom)) {
          const home = homeOf(world, destRoom);
          if (home && !belongsTo(world, actor, home) && !invitedToday(world, actor, home)) {
            const fallback = home.rooms?.hall?.id || home.rooms?.gate?.id || home.id;
            if (fallback && fallback !== finalTargetId) {
              console.log(`[Gate] ${actor.name} 进不了${home.name || home.id}后宅，改到${world.places?.[fallback]?.name || fallback}`);
              finalTargetId = fallback;
            }
          }
        }
      } catch { /* 忽略 */ }

      // 门禁：别人的私宅，外人不许直接进正房内院——先到大门/门房"""
if old in s and '后宅门第' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 移动入口加后宅门第')

# ② 巡检清人（每 60 秒一次，自愈）
p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { ensureGatekeeper } from './posts.js';",
              "import { ensureGatekeeper } from './posts.js';\nimport { evictOutsiders } from './privacy.js';", 1)
old2 = """      const collapsed = collapseRoomPlaces(world);   // 房间收回账上，不再各占一个地点"""
new2 = """      const evicted = evictOutsiders(world);          // 混进后宅的外人，请出去
      const collapsed = collapseRoomPlaces(world);   // 房间收回账上，不再各占一个地点"""
if old2 in t and 'evictOutsiders(world)' not in t:
    t = t.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 巡检清人')
