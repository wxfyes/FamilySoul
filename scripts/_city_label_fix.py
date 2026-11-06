import io
# ① marriage cityOf 校验城市存在
p = 'src/world/marriage.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """const labelOf = (nm) => {
  const seg = String(nm || '').split('·')[0];
  return /府$|州$|县$/.test(seg) ? seg : '临江府';
};"""
new = """const labelOf = (nm, world) => {
  const seg = String(nm || '').split('·')[0];
  if (/府$|州$|县$/.test(seg) && world?.cities?.[seg]) return seg;
  return '临江府';
};"""
if old in s:
    s = s.replace(old, new, 1)
    s = s.replace("const cityOf = (world, actor) => labelOf(world.places?.[actor?.location]?.name);",
                  "const cityOf = (world, actor) => labelOf(world.places?.[actor?.location]?.name, world);", 1)
    # 确保 labelOf 定义在使用前（cityOf 在后面）
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① marriage 城市校验')

# ② server labelOf 校验
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("""        const labelOf = (nm) => {
          const seg = String(nm || '').split('·')[0];
          return /府$|州$|县$/.test(seg) ? seg : '临江府';
        };""",
"""        const labelOf = (nm) => {
          const seg = String(nm || '').split('·')[0];
          if (/府$|州$|县$/.test(seg) && world.cities?.[seg]) return seg;
          return '临江府';
        };""", 1)
io.open(p2, 'w', encoding='utf-8-sig').write(t)
print('② server labelOf')
