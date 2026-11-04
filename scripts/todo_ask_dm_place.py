import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 加一个"当场问天道要地点"的异步函数（放在 apTargetPlace 之后）
anchor = "    // 约定的地点：优先记下的地点，否则就是对方此刻所在（老记录没 actorId 就按名字找）"
old_fn_end = """      const byName = Object.values(w.actors || {}).find((a) => a && a.name === ap.name);
      return byName?.location || null;
    };"""
new_fn_end = """      const byName = Object.values(w.actors || {}).find((a) => a && a.name === ap.name);
      return byName?.location || null;
    };

    // 约定没地点时：当场请天道从"世上已有的地方"里挑一个（它挑，引擎不猜）
    const askDmForPlace = async (world, ap) => {
      try {
        if (!llmClient.isReady()) return null;
        const places = Object.entries(world.places || {})
          .filter(([, pl]) => pl && pl.name && !pl.private)
          .map(([, pl]) => pl.name)
          .slice(0, 80)
          .join('、');
        const sys = '你是这个世界的天道。只输出一个地点名，别的都不许写。';
        const usr = [
          `第${world.clock?.day}日 ${world.clock?.hour}时，有一桩约要去赴：`,
          `与${ap.name || '某人'}：${String(ap.text || '').slice(0, 40)}`,
          `世上现有的地方：${places}`,
          '这桩约最合场景是在哪？只回一个上面列表里的地点名。',
        ].join('\\n');
        const out = await llmClient.complete({ system: sys, messages: [{ role: 'user', content: usr }], temperature: 0.2, maxTokens: 40 });
        const text = typeof out === 'string' ? out : (out?.text || out?.content || out?.reply || '');
        const name = String(text || '').trim().split(/[\\s，。,.、\\n]/)[0];
        const hit = Object.entries(world.places || {}).find(([, pl]) => pl && String(pl.name) === name);
        if (hit) {
          ap.place = hit[0];
          world.notes = Array.isArray(world.notes) ? world.notes : [];
          world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `与${ap.name || '人'}的约定定在「${name}」` });
          console.log(`[Place] 天道定下地点：${name}`);
          return hit[0];
        }
        console.log(`[Place] 天道给的「${name}」不在名册里，不用`);
      } catch (err) {
        console.warn('[Place] 问地点失败：', err.message);
      }
      return null;
    };"""
if anchor in s and 'askDmForPlace' not in s:
    s = s.replace(old_fn_end, new_fn_end, 1)
    print('① 加 askDmForPlace')

# ② do：没地点先问天道，然后真的走动
old = """          if (apt) {
            const pid = apTargetPlace(world, apt);
            if (pid && world.places?.[pid]) {"""
new = """          if (apt) {
            let pid = apTargetPlace(world, apt);
            if (!pid) pid = await askDmForPlace(world, apt);   // 没有地点就当场请天道定
            if (pid && world.places?.[pid]) {"""
if old in s:
    s = s.replace(old, new, 1)
    print('② 去做时先问地点')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
