import io

# ============ ① employment：雇人必须留"来历"（谁招的、因为哪桩差事） ============
p = 'src/world/employment.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """export function hireStaff(world, { propName = '', name = '', role = '伙计', via = 'dm' } = {}) {"""
new = """export function hireStaff(world, { propName = '', name = '', role = '伙计', via = 'dm', hiredBy = null, taskId = null } = {}) {"""
if old in s:
    s = s.replace(old, new, 1)
    print('① hireStaff 接收来历')

old2 = """  a.employer = prop.owner || 'husband';"""
new2 = """  // 来历：谁招进来的、因为哪桩差事。没有来历的人在世界里站不住
  a.employer = prop.owner || 'husband';
  a.hiredBy = a.hiredBy || hiredBy || null;
  a.sourceTask = a.sourceTask || taskId || null;
  a.hiredDay = a.hiredDay || (world.clock?.day || 1);
  world.events = world.events || [];
  world.events.push({
    day: world.hiredDay === undefined ? (world.clock?.day || 1) : (world.clock?.day || 1),
    hour: world.clock?.hour || 0,
    text: `${a.hiredBy ? (world.actors?.[a.hiredBy]?.name || '府里') + '替' : ''}${prop.name}请了${a.name}做${a.role}`,
  });"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 雇人写进事件流')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ============ ② 自检：没有来历的人要报（让天道补因果，或清掉） ============
p2 = 'src/world/audit.js'
t = io.open(p2, encoding='utf-8-sig').read()
old3 = """  // 产业有没有人在岗：开张却空无一人的，报给天道"""
new3 = """  // 没有来历的人：世界里的每个人都有出处，孤儿要被认领或清掉
  for (const [id, a] of Object.entries(actors)) {
    if (!a || !a.name || a.dead || a.id === 'husband') continue;
    if (String(id).startsWith('npc_') && !a.hiredBy && !a.sourceTask && a.origin !== 'dm_hired') {
      issues.push({ kind: 'orphan', who: a.name, id, detail: `${a.name}（${a.role || '来路不明'}）没有来历` });
    }
  }

  // 产业有没有人在岗：开张却空无一人的，报给天道"""
if old3 in t and "'orphan'" not in t:
    t = t.replace(old3, new3, 1)
    print('③ 自检加"无来历的人"')
io.open(p2, 'w', encoding='utf-8-sig').write(t)
print('done')
