import io
p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      } else if (kind === 'property') {
        // 新开产业：天道可以真的给世界添一间铺子
        const name = String(args.name || '').trim().slice(0, 20);
        if (!name) continue;"""
new = """      } else if (kind === 'property') {
        // 新开产业：天道可以真的给世界添一间铺子——但名字必须是真铺号，不能是"几个铺子"这种量词
        const name = String(args.name || '').trim().slice(0, 20);
        if (!name) continue;
        const badName = /^(几|多|若干|一些|这个|那个|某|一两|两三|好几个|数个)|几个|多少|若干|随便|随便开|开个/.test(name);
        const shopSuffix = /铺|号|栈|坊|楼|店|行|庄|堂|馆|局|肆|轩|斋/.test(name);
        if (badName || !shopSuffix || name.length < 2 || name.length > 12) {
          applied.push(`忽略产业：「${name}」不像铺号`);
          console.log(`[Property] 拒绝造产业：${name}（不是铺号）`);
          continue;
        }
        // 日入按人间行情夹住（铺子不可能日入百两）
        const rawSet = Number(args.set ?? args.income ?? 0) || 0;
        const set = Math.max(0.05, Math.min(30, Math.round(rawSet * 100) / 100));"""
if old in s:
    s = s.replace(old, new, 1)
    # 用夹过的 set 写入
    s = s.replace("          incomePerDay: Math.max(0, Number(args.set ?? args.income ?? 0) || 0),",
                  "          incomePerDay: set,", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 产业名与日入都校验')
