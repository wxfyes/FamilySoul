import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 待办：进行中的要能看见
old = """            place: ap.place || '', placeName: ''"""
# 不用这个锚点，改 todos 里加 status

old1 = """            place: apTargetPlace(world, ap) || '',"""
new1 = """            place: apTargetPlace(world, ap) || '',
            status: ap.engaged ? 'engaged' : 'open',"""
if old1 in s:
    s = s.replace(old1, new1, 1)
    print('① 约定带状态')

old2 = """            place: '', placeName: '', overdue: Number(pr.due) < (Number(world.clock?.day) || 1),"""
new2 = """            place: '', placeName: '', overdue: Number(pr.due) < (Number(world.clock?.day) || 1),
            status: pr.engaged ? 'engaged' : 'open',"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 承诺带状态')

# ③ do：只启程，不销账
old3 = """        } else if (action === 'do') {
          if (apt) {
            const pid = apTargetPlace(world, apt);
            if (pid && world.places?.[pid]) {
              me.location = pid;
              line = `（你去了「${world.places[pid].name}」赴约。）`;
            } else {
              line = '（这桩约当初没记地点，先记在心上。）';
            }
            world.appointments = (world.appointments || []).filter((x) => x !== apt);
            world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${me?.name || '相公'}去赴了${apt.name || '人'}的约` });
          } else {
            for (const pr of (world.promises || [])) {
              const key = pr.id || String(pr.text || '').slice(0, 20);
              if (key === id) { pr.done = true; line = '（这件事办了，记下了。）'; }
            }
          }
        } else {"""
new3 = """        } else if (action === 'do') {
          // 启程去办：只把人送过去、记成"进行中"；成不成由天道在后面判
          if (apt) {
            const pid = apTargetPlace(world, apt);
            if (pid && world.places?.[pid]) {
              me.location = pid;
              line = `（你动身去了「${world.places[pid].name}」。）`;
            } else {
              line = '（你动身去办这事了，地点还没个准。）';
            }
            apt.engaged = { day: world.clock?.day || 1, hour: world.clock?.hour || 0 };
            world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${me?.name || '相公'}已去赴${apt.name || '人'}的约（${String(apt.text || '').slice(0, 20)}），能不能成没说定` });
          } else {
            for (const pr of (world.promises || [])) {
              const key = pr.id || String(pr.text || '').slice(0, 20);
              if (key === id) {
                pr.engaged = { day: world.clock?.day || 1, hour: world.clock?.hour || 0 };
                line = '（你动身去办这桩事了，办没办成另说。）';
                world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${me?.name || '相公'}动身去办一桩旧诺（${String(pr.text || '').slice(0, 20)}），结果未定` });
              }
            }
          }
        } else {"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    print('③ do 改成只启程')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
