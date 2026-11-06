import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      if (/找(个)?(活|差事|营生)|应差|寻个差事/.test(sayT) && base3?.jobs?.length) {"""
new = """      if (/找.{0,3}(活|差事|营生|事做|口饭吃)|应差|寻个差事/.test(sayT) && base3?.jobs?.length) {"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 找活正则放宽')
old2 = """      if (mStall && /街|集|市/.test(String(wB.places?.[meB?.location]?.name || ''))) {"""
new2 = """      if (mStall && !/街|集|市/.test(String(wB.places?.[meB?.location]?.name || ''))) {
        reply += `\\n（摆摊得去街上或集市，院子里摆不开。）`;
      }
      if (mStall && /街|集|市/.test(String(wB.places?.[meB?.location]?.name || ''))) {"""
if old2 in s and '院子里摆不开' not in s:
    s = s.replace(old2, new2, 1)
    print('② 摆摊提示')
io.open(p, 'w', encoding='utf-8-sig').write(s)
