import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """          } else {
            for (const pr of (world.promises || [])) {
              const key = pr.id || String(pr.text || '').slice(0, 20);
              if (key === id) {
                pr.engaged = { day: world.clock?.day || 1, hour: world.clock?.hour || 0 };
                line = '（你动身去办这桩事了，办没办成另说。）';
                world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${me?.name || '相公'}动身去办一桩旧诺（${String(pr.text || '').slice(0, 20)}），结果未定` });
              }
            }
          }"""
new = """          } else {
            for (const pr of (world.promises || [])) {
              const key = pr.id || String(pr.text || '').slice(0, 20);
              if (key !== id) continue;
              pr.engaged = { day: world.clock?.day || 1, hour: world.clock?.hour || 0 };
              // 承诺也得动身：去哪儿由天道定
              const fakeAp = { name: '', text: pr.text, place: pr.place || null };
              let pid2 = apTargetPlace(world, fakeAp);
              if (!pid2) pid2 = await askDmForPlace(world, fakeAp);
              if (pid2 && world.places?.[pid2]) {
                me.location = pid2;
                line = `（你动身去了「${world.places[pid2].name}」，去办这桩事。）`;
              } else {
                line = '（你动身去办这桩事了，去处还没定准。）';
              }
              world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${me?.name || '相公'}动身去办一桩旧诺（${String(pr.text || '').slice(0, 20)}），结果未定` });
            }
          }"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 承诺也能动身')

# 找不到时给句话，别静默
old2 = """        world.notes = world.notes.slice(-40);
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, line });"""
new2 = """        world.notes = world.notes.slice(-40);
        saveState(DATA_DIR, world);
        if (!line) line = '（没找到这件事，可能已经了了。）';
        return sendJson(res, 200, { ok: true, line });"""
if old2 in s and '没找到这件事' not in s:
    s = s.replace(old2, new2, 1)
    print('② 找不到时回话')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
