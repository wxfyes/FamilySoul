import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 摆摊货名：从"卖X"里取
old = """        const goods = (mStall[2] || '杂货').slice(0, 6);"""
new = """        const mGoods = /卖(.{1,6})/.exec(sayT);
        const goods = String((mGoods && mGoods[1]) || mStall[2] || '杂货').slice(0, 6);"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 摊货名')

# ② 老城没有 jobs 就补一套默认差事
old2 = """      if (/找.{0,3}(活|差事|营生|事做|口饭吃)|应差|寻个差事/.test(sayT) && base3?.jobs?.length) {"""
new2 = """      if (base3 && !Array.isArray(base3.jobs)) {
        base3.jobs = [
          { title: '米行帮工', pay: 0.05, place: base3.streetId },
          { title: '客栈跑堂', pay: 0.05, place: base3.innId },
          { title: '更夫', pay: 0.04, place: base3.streetId },
          { title: '码头卸货', pay: 0.06, place: base3.streetId },
        ];
      }
      if (/找.{0,3}(活|差事|营生|事做|口饭吃)|应差|寻个差事/.test(sayT) && base3?.jobs?.length) {"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 差事兜底')
io.open(p, 'w', encoding='utf-8-sig').write(s)
