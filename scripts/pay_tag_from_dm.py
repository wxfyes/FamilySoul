import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 删掉"正则偷听聊天文字挂待付款"的整块（违反军规第八条）
start = s.find("    // 花钱的事：只挂\"待付款\"")
if start < 0:
    start = s.find("    // 花钱的事：只挂")
end = s.find("    // 将 Gate 门禁客观事实注入为天道推演的刚性阻力边界", start)
if start >= 0 and end > start:
    s = s[:start] + s[end:]
    print('① 已删除正则偷听式挂账')
else:
    print('WARN: 没找到该块')

# ② 改为解析"天道自己声明的付款标记"：[[pay:开房|上房=3|通铺=0.2]]
anchor = "    // 将 Gate 门禁客观事实注入为天道推演的刚性阻力边界"
block = """    // 天道自己声明"要收钱/要付钱"：解析它输出里的 [[pay:标题|选项=价|选项=价]]
    // 这不是偷听玩家说的话，是听天道的裁定；玩家点确认后才真扣钱
    try {
      const payTag = String(reply || '').match(/\\[\\[pay:([^\\]]+)\\]\\]/);
      if (payTag) {
        const body2 = payTag[1];
        const [title2, ...optParts] = body2.split('|');
        const opts2 = optParts
          .map((x) => {
            const m2 = /^(.+?)=([\\d.]+)$/.exec(String(x).trim());
            return m2 ? { key: m2[1], label: m2[1], price: Number(m2[2]) || 0 } : null;
          })
          .filter(Boolean);
        if (opts2.length > 0) {
          const wPay = loadState(this.dataDir);
          const mePay = this._viewerActorId ? wPay.actors?.[this._viewerActorId] : wPay.actors?.husband;
          wPay.pendingAction = {
            kind: 'lodging',
            id: `pend_${Date.now()}`,
            title: String(title2 || '花银子').slice(0, 12),
            inn: 'inn',
            options: opts2,
            by: mePay?.id || 'husband',
            askedDay: wPay.clock?.day || 1,
            askedHour: wPay.clock?.hour || 0,
          };
          saveState(this.dataDir, wPay);
          reply = String(reply || '').replace(payTag[0], '').trim();
          console.log(`[Pay] 天道声明付费：${title2} ${opts2.map((o) => o.label + o.price).join('/')}`);
        }
      }
    } catch { /* 忽略 */ }

    // 将 Gate 门禁客观事实注入为天道推演的刚性阻力边界"""

if anchor in s and '天道自己声明' not in s:
    s = s.replace(anchor, block, 1)
    print('② 已改为解析天道自己的付费声明')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
