import io
p = 'src/world/audit.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    if (String(id).startsWith('npc_') && !a.hiredBy && !a.sourceTask && a.origin !== 'dm_hired') {"""
new = """    // 只查"被雇的人"：普通居民有自己的住处就是来历，不必有雇工记录
    const employed = Boolean(a.employer && a.workplace) || Boolean(a.sourceTask);
    if (employed && !a.hiredBy && !a.sourceTask) {"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('孤儿规则收窄：只查被雇的人')
