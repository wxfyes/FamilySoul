import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("if (Math.random() < 0.0001) {   // 每城每天万分之一：全国约半年一灾",
              "if (Math.random() < 0.00025) {   // 每城每天 0.025%：全国约 70 天一场大灾")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('灾荒率调到 0.025%（全国约 70 天一场）')
