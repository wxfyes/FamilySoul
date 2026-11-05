import io
p = 'src/world/factions.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """  // 城的归属同步到势力：owner 是势力 id 就记在它名下"""
new = """  // 既有的势力（临江府衙/朝廷权贵/运河漕帮…）补上兵权字段，别另起一套
  for (const [fid, f] of Object.entries(world.factions)) {
    if (!f || typeof f !== 'object') continue;
    f.id = f.id || fid;
    if (!f.kind) f.kind = fid === 'court' ? 'court' : fid === 'wangjia' ? 'player' : 'clan';
    if (!f.leader) f.leader = fid === 'court' ? 'court' : fid === 'wangjia' ? 'husband' : null;
    if (f.troops === undefined) f.troops = 0;
    if (f.grain === undefined) f.grain = 0;
    if (f.morale === undefined) f.morale = Math.max(20, Math.min(80, Number(f.power) || 50));
    if (f.ambition === undefined) f.ambition = fid === 'court' ? 40 : fid === 'wangjia' ? 35 : 30;
    if (!f.stance) f.stance = fid === 'wangjia' ? 'defend' : 'status_quo';
  }

  // 城的归属同步到势力：owner 是势力 id 就记在它名下"""
if old in s and '别另起一套' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('补上既有势力的兵权字段')
