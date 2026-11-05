import io
# ① 迁移里建势力；② 时钟每日军需 + 每 7 日推演；③ 战术事件接进事件流
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'factions.js' not in s:
    first = s.find('\n', s.find('import '))
    s = s[:first+1] + "import { ensureFactions } from './factions.js';\n" + s[first+1:]
anchor = "export function migrateOwnership(world) {"
add = """export function migrateOwnership(world) {
  // 势力：朝廷、王家，以及将来天道推演出来的枭雄
  try { ensureFactions(world); } catch (e) { console.warn('[Faction] 势力初始化失败：', e.message); }"""
if anchor in s and 'ensureFactions(world)' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 迁移建势力')
