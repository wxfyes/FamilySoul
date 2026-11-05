import io
# 上房价再收一档：明制一日几分银（0.05 两上下）
p = 'src/world/pricing.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("inn_room: { min: 0.03, max: 0.2, typical: 0.08, unit: '日', name: '客栈上房' },",
              "inn_room: { min: 0.02, max: 0.1, typical: 0.05, unit: '日', name: '客栈上房' },")
s = s.replace("inn_bed: { min: 0.01, max: 0.08, typical: 0.03, unit: '日', name: '客栈通铺' },",
              "inn_bed: { min: 0.005, max: 0.04, typical: 0.02, unit: '日', name: '客栈通铺' },")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('上房价收到 0.02~0.1')

# 长工日钱：月 0.3~0.5 → 日 0.015
p2 = 'src/world/clock.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("    const wage = Math.round(staff * 0.04 * 100) / 100;   // 短工日钱，明制约三四分银",
              "    const wage = Math.round(staff * 0.015 * 100) / 100;  // 长工日钱：月钱约 0.45 两")
io.open(p2, 'w', encoding='utf-8-sig').write(t)
print('长工日钱 0.015')
