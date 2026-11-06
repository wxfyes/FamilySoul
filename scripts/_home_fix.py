import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：城里阶级人物被暗号误结算成\"相好\"的，归零"
add = """      // 一次性：阶级人物被挪进王宅/住错府的，按 id 归回本家府邸
      try {
        if (!world.flags?.classHomeFixV1) {
          const moved = [];
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.origin !== 'city_class') continue;
            if (a.spouse === 'husband') continue;
            const m = String(a.id).match(/^(.+?)_(gentry|servant)_(\\d+)_/);
            if (!m) continue;
            const estateId = `${m[1]}_estate_${m[3]}`;
            if (!world.places?.[estateId]) continue;
            if (a.home === estateId && a.location === estateId) continue;
            moved.push(`${a.name}:${world.places?.[a.location]?.name || a.location}→${world.places?.[estateId]?.name || estateId}`);
            a.home = estateId;
            a.location = estateId;
          }
          // 内眷被挪到别处的，归回王宅正房
          const consorts = Object.values(world.actors || {}).filter((a) => a && !a.dead
            && /正妻|如夫人|二房|通房/.test(String(a.role || '')) && world.places?.husband_room);
          for (const a of consorts) {
            if (a.home === 'husband_room' && a.location === 'husband_room') continue;
            moved.push(`${a.name}→正房`);
            a.home = 'husband_room';
            a.location = 'husband_room';
          }
          world.flags = world.flags || {};
          world.flags.classHomeFixV1 = { at: Date.now(), moved };
          if (moved.length) console.log(`[Space] 归位 ${moved.length} 人：${moved.slice(0, 6).join('、')}`);
        }
      } catch { /* 忽略 */ }

"""
if 'classHomeFixV1' not in s and anchor in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('归位迁移')
