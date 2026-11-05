import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "            if (pl.residence) ensureGatekeeper(world, pid);"
new = """            if (pl.residence) {
              const g = ensureGatekeeper(world, pid);
              if (g && !g.ok) console.log(`[Duty] ${pid} 没有门房：${g.reason}`);
            }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 加失败原因日志')
