import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      // 天道没写"过门人"：就从街上叫一个真邻居过来串门（不凭空造人）"""
new = """      // 不管天道写没写，先把这一场里的人挪到玩家眼前（否则下一句没人接）
      try {
        for (const nm of [spawnedName, '柳婶']) {
          if (!nm) continue;
          const who = Object.values(world.actors || {}).find((x) => x && !x.dead && x.name === nm);
          if (who && who.location !== a.location) {
            moveActor(world, who.id, a.location, 'world', '开场邻人过门');
            console.log(`[Opening] ${nm} 挪到 ${a.name} 眼前`);
          }
        }
      } catch { /* 忽略 */ }

      // 天道没写"过门人"：就从街上叫一个真邻居过来串门（不凭空造人）"""
if old in s and '挪到' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 开场把邻人挪到眼前')
