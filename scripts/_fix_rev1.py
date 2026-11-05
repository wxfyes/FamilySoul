import io

# ============ 修 ① 城市产权唯一入口 ============
p = 'src/world/warfare.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "/** 某城的驻军 */"
block = '''/**
 * 城市易主：唯一写入口。
 * 旧主的领地账本必须原子化剔除，不许出现"三方同时声称拥有"。
 */
export function changeCityOwner(world, cityName, newOwnerFid) {
  const ct = world.cities?.[cityName];
  if (!ct) return false;
  const oldOwner = String(ct.owner || 'court');

  const old = world.factions?.[oldOwner];
  if (old && Array.isArray(old.cities)) old.cities = old.cities.filter((c) => c !== cityName);

  ct.owner = newOwnerFid;

  const next = world.factions?.[newOwnerFid];
  if (next) {
    next.cities = Array.isArray(next.cities) ? next.cities : [];
    if (!next.cities.includes(cityName)) next.cities.push(cityName);
  }
  // 城里若还驻着旧主的兵，随城一并转归新主（免得兵与城分离）
  if (old && old.stationed && old.stationed[cityName]) {
    const n = Number(old.stationed[cityName]) || 0;
    delete old.stationed[cityName];
    old.troops = Object.values(old.stationed).reduce((x, y) => x + (Number(y) || 0), 0);
    if (next) {
      next.stationed = next.stationed && typeof next.stationed === 'object' ? next.stationed : {};
      next.stationed[cityName] = (Number(next.stationed[cityName]) || 0) + n;
      next.troops = Object.values(next.stationed).reduce((x, y) => x + (Number(y) || 0), 0);
    }
  }
  return true;
}

/** 某城的驻军 */'''
if 'changeCityOwner' not in s:
    s = s.replace(anchor, block, 1)
    print('① 城市产权唯一入口')

# 破城 / 招降 改用 changeCityOwner
old_win = """  if (win) {
    ct.owner = attacker;
    ct.defense = Math.max(5, Math.round(defense * 0.6));
    ct.unrest = Math.min(100, (num(ct.unrest) || 0) + 10);
    f.morale = Math.min(100, Math.round(num(f.morale) + 5));
    f.cities = Array.isArray(f.cities) ? f.cities : [];
    if (!f.cities.includes(cityName)) f.cities.push(cityName);"""
new_win = """  if (win) {
    changeCityOwner(world, cityName, attacker);
    ct.defense = Math.max(5, Math.round(defense * 0.6));
    ct.unrest = Math.min(100, (num(ct.unrest) || 0) + 10);
    f.morale = Math.min(100, Math.round(num(f.morale) + 5));"""
if old_win in s:
    s = s.replace(old_win, new_win, 1)
    print('② 破城走唯一入口')

old_bribe = """  if (Math.random() < 0.45) {
    ct.owner = fid;
    ct.unrest = Math.min(100, (num(ct.unrest) || 0) + 4);
    f.cities = Array.isArray(f.cities) ? f.cities : [];
    if (!f.cities.includes(cityName)) f.cities.push(cityName);"""
new_bribe = """  if (Math.random() < 0.45) {
    changeCityOwner(world, cityName, fid);
    ct.unrest = Math.min(100, (num(ct.unrest) || 0) + 4);"""
if old_bribe in s:
    s = s.replace(old_bribe, new_bribe, 1)
    print('③ 招降走唯一入口')

# 修 ⑤ 攻城战损：胜方生还 45%~60%
old_survive = "  setStationed(world, f, cityName, here - send + (win ? Math.round(send * 0.75) : 0));"
new_survive = """  // 攻城是硬仗：胜方生还 45%~60%，败方全损
  const surviveRate = win ? 0.45 + Math.random() * 0.15 : 0;
  setStationed(world, f, cityName, here - send + Math.round(send * surviveRate));"""
if old_survive in s:
    s = s.replace(old_survive, new_survive, 1)
    print('④ 攻城战损下调')

io.open(p, 'w', encoding='utf-8-sig').write(s)
