import io
p = 'src/world/apply.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { addToParty, removeFromParty, onMemberSelfAction } from './party.js';",
              "import { addToParty, removeFromParty, onMemberSelfAction } from './party.js';\nimport { materializeRoom } from './residence.js';", 1)
old = """      if (!finalTargetId) {
        const found = Object.entries(world.places).find"""
new = """      // 目标是"某宅·某院"（还没展开成地点）→ 先展开再走
      if (!finalTargetId && String(targetPlaceName).includes('__')) {
        const [parentId, key] = String(targetPlaceName).split('__');
        const made = materializeRoom(world, parentId, key);
        if (made) finalTargetId = made;
      }
      if (!finalTargetId) {
        const found = Object.entries(world.places).find"""
if old in s and 'materializeRoom(world, parentId' not in s:
    s = s.replace(old, new, 1)
    print('⑥ apply 支持展开房间')
io.open(p, 'w', encoding='utf-8-sig').write(s)
