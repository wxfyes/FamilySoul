import io
p = 'src/world/posts.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("    if (String(a.home || '') !== String(home.id)) return false;",
              "    if (String(a.home || '') !== String(residenceId)) return false;", 1)
s = s.replace("    (a) => a && !a.dead && a.duty && a.duty.post === 'gate' && String(a.duty.home || '') === String(home.id),",
              "    (a) => a && !a.dead && a.duty && a.duty.post === 'gate' && String(a.duty.home || '') === String(residenceId),", 1)
s = s.replace("  pick.duty = { post: 'gate', home: String(home.id), since: num(world.clock?.day) || 1 };",
              "  pick.duty = { post: 'gate', home: String(residenceId), since: num(world.clock?.day) || 1 };", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('按 residenceId 比对，不再依赖 home.id')
