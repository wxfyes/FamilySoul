import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 约定：只取"归我"的（我发起的，或我是当事人）
old1 = """        for (const ap of (world.appointments || [])) {
          if (!ap) continue;
          todos.push({"""
new1 = """        const viewerTodoOwner = actorId || 'husband';
        const mineTodo = (x) => {
          if (!x) return false;
          const owner = x.owner || 'husband';
          if (owner === viewerTodoOwner) return true;
          // 约定里另一方也算当事人
          if (x.actorId && x.actorId === viewerTodoOwner) return true;
          return false;
        };
        for (const ap of (world.appointments || [])) {
          if (!ap) continue;
          if (!mineTodo(ap)) continue;
          todos.push({"""
if old1 in s:
    s = s.replace(old1, new1, 1)
    print('① 约定按归属过滤')

# ② 承诺
old2 = """        for (const pr of (world.promises || [])) {
          if (!pr || pr.done) continue;
          todos.push({"""
new2 = """        for (const pr of (world.promises || [])) {
          if (!pr || pr.done) continue;
          if (!mineTodo(pr)) continue;
          todos.push({"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 承诺按归属过滤')

# ③ 差事：只给"我的"（actorId 是我，或是我派的人）
old3 = """        for (const t of (world.tasks || [])) {
          if (!t || t.status !== 'doing') continue;
          todos.push({"""
new3 = """        for (const t of (world.tasks || [])) {
          if (!t || t.status !== 'doing') continue;
          const ownerOk = (t.owner || t.by || 'husband') === viewerTodoOwner || t.actorId === viewerTodoOwner;
          if (!ownerOk) continue;
          todos.push({"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    print('③ 差事按归属过滤')
io.open(p, 'w', encoding='utf-8-sig').write(s)
