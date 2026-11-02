import io

p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "  const pool = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.id !== 'husband' && !a.jailed && !a.playerControlled);"
)
new = (
    "  // 做贼的不会是知府老爷：先把官身、主子、真人排掉\n"
    "  const notCrook = /(知府|县令|知县|尚书|宰相|天子|巡抚|统领|相公|正妻|如夫人|千金)/;\n"
    "  const pool = Object.values(world.actors || {}).filter(\n"
    "    (a) => a && !a.dead && a.id !== 'husband' && !a.jailed && !a.playerControlled && !notCrook.test(String(a.role || '')),\n"
    "  );\n"
    "  // 混街面的更容易犯事：伙计、摊贩、屠户、铁匠、游民\n"
    "  const likely = pool.filter((a) => /(伙计|摊|屠|铁匠|脚夫|车夫|花子|游民|闲汉|小厮|丫鬟)/.test(String(a.role || '')));\n"
    "  const crooks = likely.length ? likely : pool;"
)
if old in s:
    s = s.replace(old, new)
    print('patched: plausible crooks')

s = s.replace(
    "  const culprit = pool[Math.floor(Math.random() * pool.length)];\n  const victim = pool[Math.floor(Math.random() * pool.length)];",
    "  const culprit = crooks[Math.floor(Math.random() * crooks.length)];\n  const victim = pool[Math.floor(Math.random() * pool.length)];",
)

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
