import io

p = 'src/world/state.js'
s = io.open(p, encoding='utf-8').read()

target = """    const junk = /^(院中|院子里|庭院|院里|院|屋里|屋中|房中|屋内|屋里头|厅上|堂中|门口|门外)$/;
    for (const [pid, pl] of Object.entries(world.places || {})) {
      if (!pl || !junk.test(String(pl.name || ''))) continue;
      const back = world.places?.backyard ? 'backyard' : (world.places?.tea_house ? 'tea_house' : null);
      if (!back) continue;
      delete world.places[pid];
      for (const a of Object.values(world.actors || {})) {
        if (a && a.location === pid) a.location = back;
        if (a && a.home === pid) a.home = back;
      }
      console.log(`[State] 垃圾地名「${pl.name}」已并回${world.places[back].name}`);
    }"""

replacement = """    const junk = /^(院中|院子里|庭院|院里|院|屋里|屋中|房中|屋内|屋里头|厅上|堂中|门口|门外)$/;
    for (const [pid, pl] of Object.entries(world.places || {})) {
      if (!pl || !junk.test(String(pl.name || ''))) continue;
      const exitPlace = pl.exits && pl.exits[0] && world.places?.[pl.exits[0]] ? pl.exits[0] : null;
      const defaultBack = world.places?.backyard ? 'backyard' : (world.places?.tea_house ? 'tea_house' : null);
      const back = exitPlace || defaultBack;
      if (!back) continue;
      delete world.places[pid];
      for (const a of Object.values(world.actors || {})) {
        if (a && a.location === pid) a.location = a.home && world.places?.[a.home] && !exitPlace ? a.home : back;
        if (a && a.home === pid) a.home = back;
      }
      console.log(`[State] 垃圾地名「${pl.name}」已并回${world.places[back].name}`);
    }"""

s_norm = s.replace('\r\n', '\n')
target_norm = target.replace('\r\n', '\n')
replacement_norm = replacement.replace('\r\n', '\n')

if target_norm in s_norm:
    s_norm = s_norm.replace(target_norm, replacement_norm, 1)
    if '\r\n' in s:
        s_norm = s_norm.replace('\n', '\r\n')
    io.open(p, 'w', encoding='utf-8').write(s_norm)
    print('patch_state_junk: success')
else:
    print('patch_state_junk: not found')
