import io
p = 'src/world/city.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "  ensurePlace(world, innId, `${city}·客栈`, { use: 'shop' });"
new = """  // 临江客栈是老地方，别再造一家；其余城各建各的
  let innId2 = innId;
  if (city === '临江府' && world.places?.inn) innId2 = 'inn';
  else ensurePlace(world, innId, `${city}·客栈`, { use: 'shop' });
  innId = innId2;"""
if old in s and 'let innId2' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('临江复用客栈')
else:
    print('已处理或未匹配')
