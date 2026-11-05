import io
# ① 城市数据里落 port 字段（一次性，按类别：水运枢纽）
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """export function ensureCities(world) {
  world.cities = world.cities && typeof world.cities === 'object' ? world.cities : {};"""
new = """export function ensureCities(world) {
  world.cities = world.cities && typeof world.cities === 'object' ? world.cities : {};
  // 水运枢纽：一次性打上 port 标记（此后只认字段，不再靠名字猜）
  try {
    world.flags = world.flags || {};
    if (!world.flags.portBackfillDone) {
      let marked = 0;
      for (const [cityName, ct] of Object.entries(world.cities || {})) {
        if (!ct) continue;
        if (ct.port === undefined) {
          ct.port = /(运河|码头|水运|江南|淮|漕|临江)/.test(`${cityName} ${ct.region || ''}`);
          if (ct.port) marked += 1;
        }
      }
      world.flags.portBackfillDone = { day: world.clock?.day || 1, marked };
      if (marked) console.log(`[City] 标记 ${marked} 座水运枢纽城（port=true）`);
    }
  } catch { /* 忽略 */ }"""
if old in s and 'portBackfillDone' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 城市落 port 字段')
