import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      // 先清洗正文（去掉机器标记），再落历史，免得标记被存下来反复显示"""
new = """      // 天道没写"过门人"：就从街上叫一个真邻居过来串门（不凭空造人）
      if (!spawnedName) {
        try {
          const neighbors = Object.values(world.actors || {}).filter((x) => x && !x.dead
            && !x.household && !String(x.id).startsWith('usr_') && x.id !== actorId
            && (x.home === a.home || /街|巷|坊|院/.test(String(world.places?.[x.location]?.name || ''))));
          if (neighbors.length) {
            const pick = neighbors[Math.floor(Math.random() * Math.min(neighbors.length, 8))];
            moveActor(world, pick.id, a.location, 'world', '邻人过门');
            spawnedName = pick.name;
            console.log(`[Opening] 天道没立人，叫了街坊 ${pick.name} 过来`);
          }
        } catch { /* 忽略 */ }
      }

      // 先清洗正文（去掉机器标记），再落历史，免得标记被存下来反复显示"""
if old in s and '叫了街坊' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 无过门人时叫街坊来')
