import io
p = 'src/world/warfare.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          ensureGatekeeper(world, homeId);"""
new = """          const gk = ensureGatekeeper(world, homeId);
          console.log(`[Duty] 招募后派门房：${gk.ok ? (gk.name || '已有人') : gk.reason}（宅=${homeId} 在册=${Object.keys(world.actors || {}).length}）`);"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 招募处加派差日志')
