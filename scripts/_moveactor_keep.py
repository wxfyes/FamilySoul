import io
# 修正：保留原语义——相公在正房时家眷在正房陪伴，否则回自己院子
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace(
  "      try { moveActor(world, 'yunnia', 'wang_mansion_east', 'world', '乔迁'); } catch { /* 忽略 */ }",
  "      try { moveActor(world, 'yunnia', hus?.location === 'husband_room' ? 'husband_room' : 'wang_mansion_east', 'world', '乔迁'); } catch { /* 忽略 */ }")
s = s.replace(
  "      try { moveActor(world, 'xiaocui', 'wang_mansion_west', 'world', '乔迁'); } catch { /* 忽略 */ }",
  "      try { moveActor(world, 'xiaocui', hus?.location === 'husband_room' ? 'husband_room' : 'wang_mansion_west', 'world', '乔迁'); } catch { /* 忽略 */ }")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('保留陪伴语义')
