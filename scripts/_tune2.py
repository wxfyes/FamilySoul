import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
# 秋粮折银太肥（800 两/日），压回侧面收入
s = s.replace("const grainToSilver = Math.round(Math.min(200, grainNow * 0.1) * 1.2 * K * 100) / 100;",
              "const grainToSilver = Math.round(Math.min(200, grainNow * 0.1) * 0.3 * K * 100) / 100;")
# 灾荒率：全国约 120 天一场（约 3 年一崩）
s = s.replace("if (Math.random() < 0.00025) {   // 每城每天 0.025%：全国约 70 天一场大灾",
              "if (Math.random() < 0.00015) {   // 每城每天 0.015%：全国约 120 天一场大灾")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('秋粮折银降到 0.3 系数；灾荒率 0.015%')
