import io
# ① 小院名字带全名，避免同姓撞名（撞名会被去重删掉，导致反复重建）
for p in ('src/user-registry.js', 'src/world/state.js'):
    s = io.open(p, encoding='utf-8-sig').read()
    s = s.replace("name: `${surname}家小院`,", "name: `${rawName}的小院`,")
    s = s.replace("name: `${String(a.name).slice(0, 1)}家小院`,", "name: `${a.name}的小院`,")
    io.open(p, 'w', encoding='utf-8-sig').write(s)
print('小院改用全名')
