import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        if (opts2.length > 0) {
          // 报价夹回人间：房钱、饭钱这类，天道随口报多大都要收回来"""
new = """        if (opts2.length > 0) {
          // 引擎动作已经管的名目（开房/买米/走货/赌/打点）：付款标签作废，免重复扣钱
          const handledByAction = /开房|上房|房钱|住店|买米|卖米|走货|赌|打点/.test(`${title2} ${String(sayText || '')}`);
          if (handledByAction) {
            for (const o of opts2) o.price = 0;
            console.log(`[Pay] 「${title2}」由动作入口结算，报价标签作废`);
          }
          // 报价夹回人间：房钱、饭钱这类，天道随口报多大都要收回来"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 报价标签作废')

# ② 带人出门认数词
p2 = 'src/world/chat-actions.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """  if (/(带|领|点)\\s*(个|几名|几个)?\\s*(护院|家丁)|(护院|家丁)\\s*(随我|随行|跟我)/.test(say)) {"""
new2 = """  if (/(带|领|点)\\s*([\\d一二两三四五六七八九十]+\\s*个?|几名|几个)?\\s*(护院|家丁)|(护院|家丁)\\s*(随我|随行|跟我)/.test(say)) {"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 带人数词')
