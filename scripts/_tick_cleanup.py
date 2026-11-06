import io
p = 'src/world/tick.js'
s = io.open(p, encoding='utf-8-sig').read()
start = s.find("  // ── ③.5 家眷白天会自己走动")
end = s.find("  // ── ③.6 每人自己的打算")
if start > 0 and end > start:
    s = s[:start] + s[end:]
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('删掉旧的随机走动块（改为目标驱动）')
