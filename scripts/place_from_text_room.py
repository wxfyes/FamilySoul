import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """    const placeFromText = (world, text) => {
      const t = String(text || '');
      if (!t) return null;
      let best = null;
      for (const [id, pl] of Object.entries(world.places || {})) {
        const nm = String(pl?.name || '');
        if (nm.length < 2) continue;
        if (!t.includes(nm)) continue;
        if (!best || nm.length > best.nm.length) best = { id, nm };
      }
      return best ? best.id : null;
    };"""
new = """    const placeFromText = (world, text, fallbackParent) => {
      const t = String(text || '');
      if (!t) return null;
      // ① 原话里点了世上已有的地名 → 就去那儿
      let best = null;
      for (const [id, pl] of Object.entries(world.places || {})) {
        const nm = String(pl?.name || '');
        if (nm.length < 2) continue;
        if (!t.includes(nm)) continue;
        if (!best || nm.length > best.nm.length) best = { id, nm };
      }
      if (best) return best.id;

      // ② 原话点了一个"雅阁/暖房/西厢"这类具体的屋，世上还没有 → 照原话把它立起来
      //    （这不是乱起名，是剧情里已经说定的地方，只是还没入册）
      const m = t.match(/([\\u4e00-\\u9fa5]{2,4})(阁|房|间|轩|堂|园|楼|居|斋|厅)/);
      if (m) {
        const full = m[0];
        world.places = world.places || {};
        world.flags = world.flags || {};
        world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;
        const id = `place_${world.flags.placeSeq}`;
        const parent = fallbackParent && world.places[fallbackParent] ? fallbackParent : 'street';
        world.places[id] = {
          id, name: full, exits: [parent], dynamic: true, private: true,
          desc: '剧情里说定的地方，记录在册',
          createdDay: world.clock?.day || 1,
        };
        world.dynamicPlaces = world.dynamicPlaces || {};
        world.dynamicPlaces[id] = world.places[id];
        console.log(`[Place] 原话里的「${full}」入册`);
        return id;
      }
      return null;
    };"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 原话里的屋也能立起来')

# 调用处传入"当事人所在"作为父地点
s = s.replace("        const fromText = placeFromText(world, ap?.text);",
              "        const otherActor = Object.values(world.actors || {}).find((a) => a && a.name === ap?.name);\n        const fromText = placeFromText(world, ap?.text, otherActor?.location);", 1)
print('② 传入当事人所在')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
