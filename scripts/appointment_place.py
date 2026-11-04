import io

# ① dispatch：约定没写地点 → 就约在她现在待的地方
p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "          place: resolvePlace(world, args.place) || world.actors?.husband?.location || null, // 约在哪见"
new = "          place: resolvePlace(world, args.place) || actor?.location || world.actors?.husband?.location || null, // 没写地点就约在她此刻所在"
if old in s:
    s = s.replace(old, new, 1)
    print('① 约定默认地点=对方所在')
io.open(p, 'w', encoding='utf-8').write(s)

# ② menu：旧约定没地点 → 用对方现在的位置兜底
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """            place: ap.place || '', placeName: ap.place ? (world.places?.[ap.place]?.name || '') : '',"""
new2 = """            place: ap.place || (world.actors?.[ap.actorId]?.location || ''),
            placeName: (() => {
              const pid = ap.place || world.actors?.[ap.actorId]?.location;
              return pid ? (world.places?.[pid]?.name || '') : '';
            })(),"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    print('② menu 里旧约定补地点')

# ③ 去做：没地点就用对方此刻位置
old3 = """          if (apt) {
            if (apt.place && world.places?.[apt.place]) {
              me.location = apt.place;
              line = `（你去了「${world.places[apt.place].name}」赴约。）`;
            } else {
              line = '（这桩约当初没记地点，先记在心上。）';
            }"""
new3 = """          if (apt) {
            const pid = apTargetPlace(world, apt);
            if (pid && world.places?.[pid]) {
              me.location = pid;
              line = `（你去了「${world.places[pid].name}」赴约。）`;
            } else {
              line = '（这桩约当初没记地点，先记在心上。）';
            }"""
if old3 in t:
    t = t.replace(old3, new3, 1)
    print('③ 去做时兜底地点')

# 加个取地点的小函数（放在 routes 之前）
anchor = "    // ═══ 交互层：去哪 / 找人 / 约定（只读 + 走同一条管道） ═══"
helper = """    // 约定的地点：优先记下的地点，否则就是对方此刻所在
    const apTargetPlace = (w, ap) => ap?.place || w.actors?.[ap?.actorId]?.location || null;

"""
if anchor in t and 'apTargetPlace = ' not in t:
    t = t.replace(anchor, helper + anchor, 1)
    print('④ 加 apTargetPlace')

io.open(p2, 'w', encoding='utf-8').write(t)
print('done')
