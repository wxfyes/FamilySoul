import io

p = 'src/world/summon.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "  // 别名：口语里的地方，对上世界里真有的地方（医馆→回春堂药铺 之类）"
add = (
    "  // 客栈开房：要一间上房，付房钱，两个人进房，外人进不来\n"
    "  if (/(开房|开间房|要间房|要一间|住店|住一晚|开个房|上房)/.test(say)) {\n"
    "    const innEntry = Object.entries(world.places || {}).find(([, pl]) => /客栈/.test(String(pl?.name || '')));\n"
    "    if (innEntry) {\n"
    "      const [innId, innPl] = innEntry;\n"
    "      const meAtInn = me.location === innId || me.location === `${innId}_room`;\n"
    "      if (!meAtInn) {\n"
    "        me.location = innId;\n"
    "      }\n"
    "      const roomId = `${innId}_room`;\n"
    "      if (!world.places[roomId]) {\n"
    "        world.places[roomId] = { name: `${innPl.name}·上房`, exits: [innId], dynamic: true, private: true };\n"
    "      }\n"
    "      // 房钱：上房三两一晚，钱不够就住普通房一钱\n"
    "      world.assets = world.assets || {};\n"
    "      let paid = 0;\n"
    "      let roomName = world.places[roomId].name;\n"
    "      if ((Number(world.assets.silver) || 0) >= 3) {\n"
    "        world.assets.silver = Math.round(((Number(world.assets.silver) || 0) - 3) * 100) / 100;\n"
    "        paid = 3;\n"
    "      } else if ((Number(world.assets.silver) || 0) >= 0.2) {\n"
    "        world.assets.silver = Math.round(((Number(world.assets.silver) || 0) - 0.2) * 100) / 100;\n"
    "        paid = 0.2;\n"
    "        roomName = `${innPl.name}·通铺`;\n"
    "        world.places[roomId].name = roomName;\n"
    "      }\n"
    "      // 同行的人一起进房\n"
    "      const partnerId = String((world.chatPartners || {})[selfId || 'husband'] || '');\n"
    "      const partner = world.actors?.[partnerId];\n"
    "      const comers = [];\n"
    "      if (partner && !partner.dead && partner.id !== selfId) {\n"
    "        partner.location = roomId;\n"
    "        partner.activity = { text: '进房歇息', at: world.clock?.hour || 0, day: world.clock?.day || 1 };\n"
    "        comers.push(partner.name);\n"
    "      }\n"
    "      me.location = roomId;\n"
    "      saveState(dataDir, world);\n"
    "      return { moved: [me.name || '相公', ...comers], summoned: [], visited: null, wentTo: roomName, room: roomName, paid };\n"
    "    }\n"
    "  }\n\n"
    "  // 别名：口语里的地方，对上世界里真有的地方（医馆→回春堂药铺 之类）"
)
if anchor in s and '客栈开房' not in s:
    s = s.replace(anchor, add, 1)
    print('patched: inn check-in with room fee')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
