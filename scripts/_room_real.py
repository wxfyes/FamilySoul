import io
p = 'src/world/chat-actions.js'
s = io.open(p, encoding='utf-8-sig').read()
start = s.find("  // 开房住店")
end = s.find("  // 雇掌柜/伙计", start)
assert start > 0 and end > start, (start, end)
block = """  // 开房住店：真开一间上房（地点），把人挪进去
  if (/(开|要|住)(一间|间|个)?(上房|房间|房)|住店/.test(say)) {
    const curName = String(world.places?.[me.location]?.name || '');
    const innId = Object.keys(world.places || {}).find((id) => {
      const n = String(world.places[id]?.name || '');
      return /客栈/.test(n) && (curName.startsWith(n) || n.startsWith(curName.split('·')[0]));
    });
    const innName = String(world.places?.[innId]?.name || '客栈');
    const fee = 0.1;
    const purse = Number(world.assets?.silver) || 0;
    if (purse < fee) {
      notices.push(`（上房一晚 ${fee.toFixed(2)} 两，手头不够。）`);
    } else {
      // 开房：没有上房就开一间
      let roomId = Object.keys(world.places || {}).find((id) => String(world.places[id]?.name || '') === `${innName}·上房`);
      if (!roomId) {
        world.flags = world.flags || {};
        world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;
        roomId = `place_${world.flags.placeSeq}`;
        world.places[roomId] = { id: roomId, name: `${innName}·上房`, exits: innId ? [innId] : ['street'], parent: innId || null, private: true, dynamic: true };
        if (innId && world.places[innId]) {
          world.places[innId].exits = Array.isArray(world.places[innId].exits) ? world.places[innId].exits : [];
          if (!world.places[innId].exits.includes(roomId)) world.places[innId].exits.push(roomId);
        }
      }
      world.assets.silver = Math.round((purse - fee) * 100) / 100;
      world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
      world.ledger.push({ day, hour: world.clock?.hour || 0, delta: -fee, title: '客栈上房', by: 'husband', balance: world.assets.silver });
      world.flags = world.flags || {};
      world.flags.lodging = { place: roomId, day };
      const mv = moveActor(world, me.id, roomId, 'world', '开房入住');
      notices.push(`上房开好了：${world.places[roomId].name}，一晚 ${fee.toFixed(2)} 两，今夜就在此处歇下。`);
    }
  }

"""
s = s[:start] + block + s[end:]
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('开房真开房间')
