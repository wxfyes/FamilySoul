import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "        self: { name: me?.name || '', role: me?.role || '', place: place?.name || '', isHusband },"
new = """        self: (() => {
          const maritalMap = { single: '未婚', married: '已婚', widowed: '寡居', concubine: '侧室' };
          const spouseName = me?.spouse ? (world.actors?.[me.spouse]?.name || '') : '';
          const res = me?.residence || null;
          const resName = res?.placeId ? (world.places?.[res.placeId]?.name || '') : '';
          const resText = res?.type === 'own' ? `自有${resName || '民宅'}`
            : res?.type === 'rent' ? `租住${resName || ''}`
            : res?.type === 'inn' ? '住客栈'
            : res?.type === 'family' ? `寄居${resName || ''}` : '';
          return {
            name: me?.name || '', role: me?.role || '', place: place?.name || '', isHusband,
            married: maritalMap[me?.marital || 'single'] || '未婚',
            spouseName,
            residence: resText,
          };
        })(),"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('/api/me 带婚配与住处')
