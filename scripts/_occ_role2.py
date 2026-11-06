import io
p = 'src/world/occupation.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    if (a.title !== next) {
      a.title = next;
      changed += 1;
      // 玩家与摆摊的，连 role 一起对齐；老 NPC 的 role 保留（可能是"账房先生"这种细称）
      if (String(a.id).startsWith('usr_') || a.id === 'husband' || a.stall) a.role = next;
    }"""
new = """    if (a.title !== next) {
      a.title = next;
      changed += 1;
    }
    // 玩家与摆摊的，role 始终跟着营生走；老 NPC 的 role 保留（可能是"账房先生"这种细称）
    const syncRole = String(a.id).startsWith('usr_') || a.id === 'husband' || Boolean(a.stall);
    if (syncRole && a.role !== next) {
      a.role = next;
      changed += 1;
    }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① role 始终跟着身份走')
