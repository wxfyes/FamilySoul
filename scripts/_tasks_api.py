import io
# /api/me 与 menu 都带上差事，App 的待办里就能看到
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        pendingAction: world.pendingAction || null,"""
new = """        pendingAction: world.pendingAction || null,
        tasks: (world.tasks || []).filter((t) => t && t.status === 'doing').map((t) => ({
          id: t.id, who: t.name, what: t.what,
          dueDay: t.dueDay, last: (t.log || []).slice(-1)[0]?.text || '',
        })),"""
if old in s and 'tasks: (world.tasks' not in s:
    s = s.replace(old, new, 1)
    print('① /api/me 带差事')

old2 = """        // 天道最近该知道的事（你的决定会记在这里）"""
new2 = """        // 仆人手上的差事
        for (const t of (world.tasks || [])) {
          if (!t || t.status !== 'doing') continue;
          todos.push({
            kind: '差事',
            id: t.id,
            when: `第${t.dueDay}日办完`,
            who: t.name,
            text: `${t.what}${(t.log || []).slice(-1)[0]?.text ? '（' + (t.log || []).slice(-1)[0].text + '）' : ''}`,
            place: '', placeName: '', status: 'engaged',
          });
        }

        // 天道最近该知道的事（你的决定会记在这里）"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② menu 里显示差事')
io.open(p, 'w', encoding='utf-8').write(s)
