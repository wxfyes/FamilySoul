import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()

# 统一收尾：按模板把已有的房间名/属性纠正一遍（吃在最后，最稳）
old = """      if (!p.exits.includes(rid)) p.exits.push(rid);
      built += 1;
    }
  }
  return built;
}

/**
 * 官府衙署层级（幂等）"""
new = """      if (!p.exits.includes(rid)) p.exits.push(rid);
      built += 1;
    }
    // 收尾：按模板把名字与楼层纠正（老存档里可能叫"灶房""院门"）
    for (const room of spec) {
      const rec = p.rooms[room.key];
      const rp = rec && places[rec.id];
      if (!rp) continue;
      rec.name = room.name;
      rec.use = room.use;
      rec.floor = room.floor;
      rp.name = `${base}·${room.name}`;
      rp.use = room.use;
      rp.floor = room.floor;
    }
  }
  return built;
}

/**
 * 官府衙署层级（幂等）"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 酒楼收尾改名')

old2 = """      p.rooms[room.key] = { id: rid, name: room.name, use: room.use, depth: room.depth, access: room.access };
      if (!p.exits.includes(rid)) p.exits.push(rid);
      built += 1;
    }
  }
  return built;
}"""
new2 = """      p.rooms[room.key] = { id: rid, name: room.name, use: room.use, depth: room.depth, access: room.access };
      if (!p.exits.includes(rid)) p.exits.push(rid);
      built += 1;
    }
    for (const room of COURT) {
      const rec = p.rooms[room.key];
      const rp = rec && places[rec.id];
      if (!rp) continue;
      rec.name = room.name;
      rp.name = `${base}·${room.name}`;
      rp.use = room.use;
      rp.depth = room.depth;
      rp.access = room.access;
    }
  }
  return built;
}"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 衙署收尾改名')
io.open(p, 'w', encoding='utf-8-sig').write(s)
