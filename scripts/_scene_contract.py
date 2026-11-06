import io
# A. 家眷离场只能回自己住处
p = 'src/world/summon.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    const from = actor.location;
    const dest = resolvePlaceTarget(world, hint, { nearId: from, actor });"""
new = """    const from = actor.location;
    let dest = resolvePlaceTarget(world, hint, { nearId: from, actor });
    // 家眷离场只认自己的住处：不许被一句"去长街"支到街上
    const isKin = String(actor.spouse || '') === 'husband' || /正妻|如夫人|二房|侧室|妾|通房|丫鬟|婆子|嬷嬷/.test(String(actor.role || ''));
    if (isKin) {
      const home = actor.home && world.places?.[actor.home] ? actor.home : null;
      if (home && dest !== home) {
        console.log(`[Departure] ${actor.name} 是内眷，目的地改回住处`);
        dest = home;
      }
    }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('A 内眷只能回住处')

# B. 模型自己写的"告辞/退了出去"旁白一律删，离场事实只由引擎那一行说
p2 = 'src/pet-service.js'
t = io.open(p2, encoding='utf-8-sig').read()
anchor = "    // 9. NPC 告辞离场：先照 [[depart:谁|去哪]] 把真位移走完，再清标签"
add = """    // 8.96 模型自己写的"起身告辞/退了出去"旁白：删掉，离场事实只由引擎那一行说
    try {
      reply = String(reply || '').split('\\n').filter((ln) => !/^\\s*[（(][^）)]{0,40}(起身告辞|退了出去|告退|退下|告退出去)[^）)]{0,20}[）)]\\s*$/.test(ln)).join('\\n');
    } catch { /* 忽略 */ }

""" + anchor
if '模型自己写的"起身告辞' not in t and anchor in t:
    t = t.replace(anchor, add, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('B 删模型离场旁白')
