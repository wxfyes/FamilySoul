import io
p = 'src/world/position.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'isInnerRoom' not in s.split('export function moveActor')[0]:
    s = s.replace("import { sceneAudience } from './scene.js';", "import { sceneAudience } from './scene.js';\nimport { isInnerRoom } from './privacy.js';", 1)
old = """  if (!placeId || !world.places?.[placeId]) return { ok: false, error: '没有这个地点' };"""
new = """  if (!placeId || !world.places?.[placeId]) return { ok: false, error: '没有这个地点' };
  // 单一入口铁律：外院当差的不许进内室，任何路径都改去议事厅
  try {
    const destPlace = world.places[placeId];
    const role = String(a.role || '');
    const outerStaff = /家丁|护院|门房|小厮|马夫|车夫|脚夫/.test(role);
    if (outerStaff && isInnerRoom(destPlace) && !/当值|值房|通禀允入/.test(String(note || ''))) {
      const hall = Object.keys(world.places || {}).find((id) => /议事厅/.test(String(world.places[id]?.name || '')));
      if (hall) placeId = hall;
    }
  } catch { /* 忽略 */ }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('moveActor 内室门禁')
