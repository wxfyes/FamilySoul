import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      let cleanAsName = asName ? String(asName).trim() : null;"""
new = """      let cleanAsName = asName ? String(asName).trim() : null;
      // 真人号不许被"主动推送"代他说话（他不是 NPC）
      try {
        const wGuard = peek(this.dataDir);
        const who0 = cleanAsName
          ? (wGuard.actors?.[cleanAsName] || Object.values(wGuard.actors || {}).find((a) => a && a.name === cleanAsName))
          : null;
        if (who0 && (/^usr_/.test(String(who0.id)) || isHumanBound(wGuard, who0.id))) {
          console.log(`[Push] 跳过真人角色 ${who0.name}，不替他说话`);
          return null;
        }
      } catch { /* 忽略 */ }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 主动推送不替真人号说话')
