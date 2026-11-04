import io
# ① /api/me 增补 home
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """            married: maritalMap[me?.marital || 'single'] || '未婚',"""
new = """            homeId: me?.home || null,
            homeName: me?.home ? (world.places?.[me.home]?.name || '') : '',
            married: maritalMap[me?.marital || 'single'] || '未婚',"""
if old in s and 'homeName:' not in s.split('self:')[1][:800]:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① /api/me 带 homeName')
