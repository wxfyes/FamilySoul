import io
# ① 报价即扣款，不再等确认（扣完在回复里报一句）
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          const wPay = loadState(dataDir);
          const mePay = this._viewerActorId ? wPay.actors?.[this._viewerActorId] : wPay.actors?.husband;
          wPay.pendingAction = {"""
new = """          const wPay = loadState(dataDir);
          const mePay = this._viewerActorId ? wPay.actors?.[this._viewerActorId] : wPay.actors?.husband;
          // 即刻落账：不再挂待付单等确认，扣完在回复里报明
          try {
            const first = (opts2 || []).find((o) => Number(o.price) > 0) || opts2[0];
            const price = Number(first?.price) || 0;
            if (price > 0) {
              const silverNow = Number(wPay.assets?.silver) || 0;
              if (silverNow >= price) {
                wPay.assets.silver = Math.round((silverNow - price) * 100) / 100;
                wPay.ledger = Array.isArray(wPay.ledger) ? wPay.ledger : [];
                wPay.ledger.push({ day: wPay.clock?.day || 1, hour: wPay.clock?.hour || 0, delta: -price, title: String(title2 || '花销').slice(0, 24), by: mePay?.id || 'husband', balance: wPay.assets.silver });
                saveState(dataDir, wPay);
                reply += `\\n（已付 ${price.toFixed(2)} 两：${String(title2 || '花销').slice(0, 12)}。余 ${wPay.assets.silver.toFixed(2)} 两。）`;
                console.log(`[Pay] 即付 ${price} 两：${title2}`);
              } else {
                reply += `\\n（要 ${price.toFixed(2)} 两，手头只有 ${silverNow.toFixed(2)} 两，这桩先记着。）`;
              }
            }
          } catch (err) { console.warn('[Pay] 即付失败：', err.message); }
          wPay.pendingAction = {"""
if old in s and '即刻落账' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 即付')
