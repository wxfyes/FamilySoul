import io
p = 'src/world/employment.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "    day: world.hiredDay === undefined ? (world.clock?.day || 1) : (world.clock?.day || 1),"
new = "    day: world.clock?.day || 1,"
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('修事件日期写法')

# ============ 迁移：孤儿雇工一律补上"府里代办"的来历（一般规则，不是个案） ============
p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
anchor = "export function migrateOwnership(world) {"
mig = """export function migrateOwnership(world) {
  // 孤儿雇工：有雇主、却没记录是谁招的——一律归到"府里代办"的差事上，
  // 从此世界记得这批人是怎么来的（谁办的、哪天办的），不再是凭空出现的人。
  try {
    const boss = world.actors?.waner ? 'waner' : (world.actors?.yunnia ? 'yunnia' : null);
    const orphans = Object.values(world.actors || {}).filter(
      (a) => a && !a.dead && a.employer && !a.hiredBy && !a.sourceTask && a.workplace,
    );
    if (orphans.length) {
      world.tasks = Array.isArray(world.tasks) ? world.tasks : [];
      const taskId = `task_hire_${world.clock?.day || 1}`;
      let task = world.tasks.find((t) => t && t.id === taskId);
      if (!task) {
        task = {
          id: taskId,
          actorId: boss || 'husband',
          name: world.actors?.[boss]?.name || '府里',
          what: `替${orphans[0].workplace || '产业'}等添置人手`,
          status: 'done',
          startDay: Math.max(1, (world.clock?.day || 1) - 1),
          dueDay: world.clock?.day || 1,
          doneDay: world.clock?.day || 1,
          result: `请到${orphans.map((a) => a.name).join('、')}`,
          log: [{ day: world.clock?.day || 1, hour: world.clock?.hour || 0, text: '人已到岗' }],
        };
        world.tasks.push(task);
      }
      for (const a of orphans) {
        a.hiredBy = boss || 'husband';
        a.sourceTask = taskId;
        a.hiredDay = a.hiredDay || (world.clock?.day || 1);
      }
      world.notes = Array.isArray(world.notes) ? world.notes : [];
      world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${task.name}办妥了添置人手的事` });
      console.log(`[Employ] 为 ${orphans.length} 位雇工补上来历（${task.name}经办）`);
    }
  } catch { /* 忽略 */ }"""
if anchor in t and '孤儿雇工' not in t:
    t = t.replace(anchor, mig, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('加孤儿雇工来历迁移')
