import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

start = s.find("      // 只认\"到/去/往/在/回/进/于 + 名 + 屋\"这种说法")
end = s.find("      if (m) {", start)
# 找到整个判定段的结尾（下一个 return null; 之后）
tail = s.find("      return null;\n    };", start)
if start < 0 or tail < 0:
    print('WARN: 没找到屋名判定段')
else:
    seg_end = tail + len("      return null;")
    new_seg = """      // 只认"到/去/往/在/回/进/于/至 + 名 + 屋"，或"名 + 屋"两字名
      const SUF = '(阁|房|间|轩|堂|园|楼|居|斋|厅)';
      let roomName = null;
      const m1 = t.match(new RegExp(`(?:到|去|往|在|回|进|于|至)([\\\\u4e00-\\\\u9fa5]{1,3}?)${SUF}`));
      if (m1) roomName = m1[1] + m1[2];
      if (!roomName) {
        const m2 = t.match(new RegExp(`([\\\\u4e00-\\\\u9fa5]{2})${SUF}`));
        if (m2) roomName = m2[0];
      }
      if (roomName) {
        world.places = world.places || {};
        world.flags = world.flags || {};
        world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;
        const id = `place_${world.flags.placeSeq}`;
        const parent = fallbackParent && world.places[fallbackParent] ? fallbackParent : 'street';
        world.places[id] = {
          id, name: roomName, exits: [parent], dynamic: true, private: true,
          desc: '剧情里说定的地方，记录在册',
          createdDay: world.clock?.day || 1,
        };
        world.dynamicPlaces = world.dynamicPlaces || {};
        world.dynamicPlaces[id] = world.places[id];
        console.log(`[Place] 原话里的「${roomName}」入册`);
        return id;
      }
      return null;"""
    s = s[:start] + new_seg + s[seg_end:]
    io.open(p, 'w', encoding='utf-8').write(s)
    print('已重写屋名判定')

print('done')
