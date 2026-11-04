import io
p = 'scripts/healthcheck.mjs'
s = io.open(p, encoding='utf-8').read()
old = """    if (a.place && !placeNames.has(a.place) && VERBOSE) console.log(`    位置不在名册：${a.name} @ ${a.place}`);"""
new = """    // 位置写成英文 id 才是真问题（中文地名可能只是没进公共名册，比如正房）
    if (a.place && /[a-zA-Z_]/.test(String(a.place))) {
      posBad += 1;
      console.log(`    位置是 id 不是地名：${a.name} @ ${a.place}`);
    }"""
if old in s:
    s = s.replace(old, new, 1)
    print('修掉"正房"误报')
s = s.replace("  if (!posBad) pass('位置名册可读');", "  if (!posBad) pass('位置没有写成英文 id');")
io.open(p, 'w', encoding='utf-8').write(s)
