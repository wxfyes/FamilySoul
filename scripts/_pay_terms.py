import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          for (const o of opts2) {
            const k = clampKey(`${o.label} ${title2}`);
            if (k) o.price = sanePrice(k, o.price);
          }"""
new = """          for (const o of opts2) {
            const labelAll = `${o.label} ${title2}`;
            // 房租/半年付/年付这类是"分期"，不能拿整间铺子的市价下限去夹它
            const isTerm = /租|付|月|季|半年|年|押/.test(labelAll) || opts2.length > 1;
            if (isTerm) {
              o.price = Math.max(0.01, Math.min(5000, Number(o.price) || 0));
            } else {
              const k = clampKey(labelAll);
              if (k) o.price = sanePrice(k, o.price);
            }
          }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('分期价不再被市价下限夹')
