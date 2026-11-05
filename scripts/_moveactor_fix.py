import io
# ③ 乔迁改走唯一入口 moveActor（真人角色会被拒绝世界移动，这正是保护）
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

if "from './position.js'" not in s:
    first = s.find('\n', s.find('import '))
    s = s[:first+1] + "import { moveActor } from './position.js';\n" + s[first+1:]
    print('引入 moveActor')

pairs = [
    ("      hus.location = 'husband_room';", "      try { moveActor(world, 'husband', 'husband_room', 'world', '乔迁'); } catch { /* 忽略 */ }"),
    ("      wan.location = hus?.location === 'husband_room' ? 'husband_room' : 'husband_room';", "      try { moveActor(world, 'waner', 'husband_room', 'world', '乔迁'); } catch { /* 忽略 */ }"),
    ("      yun.location = hus?.location === 'husband_room' ? 'husband_room' : 'wang_mansion_east';", "      try { moveActor(world, 'yunnia', 'wang_mansion_east', 'world', '乔迁'); } catch { /* 忽略 */ }"),
    ("      cui.location = hus?.location === 'husband_room' ? 'husband_room' : 'wang_mansion_west';", "      try { moveActor(world, 'xiaocui', 'wang_mansion_west', 'world', '乔迁'); } catch { /* 忽略 */ }"),
]
for old, new in pairs:
    if old in s:
        s = s.replace(old, new, 1)
        print('  改一处:', old.strip()[:40])
io.open(p, 'w', encoding='utf-8-sig').write(s)
