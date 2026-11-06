import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 事实句不再冒充"府中"这个说话人，且住处用 home 不是当前所在
s = s.replace("""        let whereH = String(wHouse.places?.[houseActor.location]?.name || '');
        if (!whereH || /^[a-z0-9_]+$/i.test(whereH)) whereH = String(wHouse.places?.[houseActor.home]?.name || '');
        if (!whereH || /^[a-z0-9_]+$/i.test(whereH)) whereH = '宅中';
        const factLine = `【府中】${houseActor.name}是${houseActor.role || '府里人'}，就住「${whereH}」。`;""",
"""        let whereH = String(wHouse.places?.[houseActor.home]?.name || '');
        if (!whereH || /^[a-z0-9_]+$/i.test(whereH)) whereH = String(wHouse.places?.[houseActor.location]?.name || '');
        if (!whereH || /^[a-z0-9_]+$/i.test(whereH)) whereH = '宅中';
        const factLine = `（${houseActor.name}是${houseActor.role || '府里人'}，住处是「${whereH}」。）`;""", 1)
s = s.replace("""          reply = `【府中】：${asked.name}是${asked.role || '府里人'}，就住在这宅子里。`;""",
"""          reply = `（${asked.name}是${asked.role || '府里人'}，就住在这宅子里。）`;""", 1)

# ② 送客判定加一行日志，先看它到底有没有进
s = s.replace("""      if (farewellSay) {
        const wF = loadState(this.dataDir);""",
"""      console.log(`[Departure] 判定 say="${String(sayText || '').slice(0, 24)}" farewell=${farewellSay}`);
      if (farewellSay) {
        const wF = loadState(this.dataDir);""", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('事实句+日志')
