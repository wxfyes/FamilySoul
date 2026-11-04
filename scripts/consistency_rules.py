import io

# ============ ① 自愈不许把在岗的人调走（否则店里又空了，自检再报，来回打架）============
p = 'src/world/society.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """  let changed = 0;
  const notes = [];
  for (const item of list) {
    const a = byName.get(String(item?.name || ''));
    const placeId = nameToId.get(String(item?.place || ''));
    if (!a || !placeId || a.dead || a.id === 'husband' || a.humanBound) continue;
    if (a.intimacy?.ritual === 'unlocked') continue;"""
new = """  // 在岗的人不归自愈管：店里不能因为"人挤在街上"就把伙计全抽走
  const onDuty = new Set();
  for (const prop of world.assets?.properties || []) {
    for (const id of prop?.staffIds || []) onDuty.add(id);
  }

  let changed = 0;
  const notes = [];
  for (const item of list) {
    const a = byName.get(String(item?.name || ''));
    const placeId = nameToId.get(String(item?.place || ''));
    if (!a || !placeId || a.dead || a.id === 'husband' || a.humanBound) continue;
    if (a.intimacy?.ritual === 'unlocked') continue;
    if (onDuty.has(a.id)) continue;   // 当值的人不动"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 自愈跳过在岗者')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ============ ② 自检：只有"名册里压根没人"才报，不因临时外出反复喊 ============
p2 = 'src/world/audit.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """    const onDuty = Object.values(actors).filter((a) => a && !a.dead && a.location === prop.placeId && a.id !== 'husband');
    if (!onDuty.length) {
      issues.push({ kind: 'staff', who: prop.name, detail: `「${prop.name}」开着却没有一个人在岗` });
    } else if (Array.isArray(prop.staffIds)) {
      prop.staff = onDuty.length;
    }"""
new2 = """    const roster = Array.isArray(prop.staffIds) ? prop.staffIds.filter((id) => actors[id] && !actors[id].dead) : [];
    const onDuty = roster.filter((id) => actors[id].location === prop.placeId);
    if (!roster.length && prop.status === '已开张') {
      // 名册里一个人都没有 = 真的还没请人；只是临时外出不算
      issues.push({ kind: 'staff', who: prop.name, detail: `「${prop.name}」开着却还没请人` });
    } else {
      prop.staff = onDuty.length;
    }"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    print('② 自检只报"没请人"，不报"临时出门"')
io.open(p2, 'w', encoding='utf-8-sig').write(t)
print('done')
