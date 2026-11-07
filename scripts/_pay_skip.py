import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
# ① 标记跳过，防 sanePrice 把 0 又夹回 typical
s = s.replace("""          if (handledByAction) {
            for (const o of opts2) o.price = 0;
            console.log(`[Pay] 「${title2}」由动作入口结算，报价标签作废`);
          }""",
"""          if (handledByAction) {
            for (const o of opts2) { o.price = 0; o.skip = true; }
            console.log(`[Pay] 「${title2}」由动作入口结算，报价标签作废`);
          }""", 1)
# ② 夹价循环跳过
s = s.replace("""          for (const o of opts2) {
            const labelAll = `${o.label} ${title2}`;""",
"""          for (const o of opts2) {
            if (o.skip) continue;
            const labelAll = `${o.label} ${title2}`;""", 1)
# ③ 自动扣款跳过
s = s.replace("""            const first = (opts2 || []).find((o) => Number(o.price) > 0) || opts2[0];
            const price = Number(first?.price) || 0;""",
"""            const first = (opts2 || []).find((o) => Number(o.price) > 0 && !o.skip) || (opts2 || [])[0];
            const price = first?.skip ? 0 : (Number(first?.price) || 0);""", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('付款跳过标记')

# ④ 上房不再 private（private 会被菜单过滤掉）
p2 = 'src/world/chat-actions.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("private: true, dynamic: true };", "use: 'room', dynamic: true };", 1)
io.open(p2, 'w', encoding='utf-8-sig').write(t)
print('上房可见')
