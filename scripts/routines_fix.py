import io

# ============ ① routines：跳过真人账号，并按角色名里提到的铺子找工位 ============
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """    const home = a.home && world.places?.[a.home] ? a.home : null;
    const work = (a.work && world.places?.[a.work]) ? a.work : home;"""
new = """    if (a.humanBound) continue;   // 真人登着的角色不由引擎摆布

    // 工位：先看 work/home；没有就从角色名里提到的铺子名去配（"于家酒肆老板娘"→于家酒肆）
    const home = a.home && world.places?.[a.home] ? a.home : null;
    let work = (a.work && world.places?.[a.work]) ? a.work : home;
    if (!work) {
      const byName = Object.entries(world.places || {}).find(([, pl]) => {
        const nm = String(pl?.name || '');
        return nm.length >= 2 && String(a.role || '').includes(nm);
      });
      if (byName) work = byName[0];
    }
    if (!work && /跑堂|伙计|小二/.test(String(a.role || ''))) work = world.places?.tea_house ? 'tea_house' : null;"""
if old in s:
    s = s.replace(old, new, 1)
    print('① routines 跳过真人 + 按角色名找工位')
io.open(p, 'w', encoding='utf-8').write(s)

# ============ ② 服务器启动时标记真人账号，并清掉测试残留人物 ============
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
anchor = "    seedPersonalMoney(wA);"
add = """    // 给真人账号绑定的角色打标记：引擎不许摆布他们
    try {
      const cfg0 = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      for (const m of Object.values(cfg0.family || {})) {
        if (m?.actor && wA.actors?.[m.actor]) wA.actors[m.actor].humanBound = true;
      }
    } catch { /* 忽略 */ }

    // 清掉早期测试残留的占位人物（不是真名）
    try {
      for (const [id, a] of Object.entries(wA.actors || {})) {
        if (a && ['城中人', '全能导师', '路人甲', '路人乙'].includes(String(a.name || ''))) {
          delete wA.actors[id];
          console.log(`[State] 清掉占位人物：${a.name}`);
        }
      }
    } catch { /* 忽略 */ }

    seedPersonalMoney(wA);"""
if anchor in t and 'humanBound = true' not in t:
    t = t.replace(anchor, add, 1)
    print('② 标记真人 + 清占位人物')
io.open(p2, 'w', encoding='utf-8').write(t)
print('done')
