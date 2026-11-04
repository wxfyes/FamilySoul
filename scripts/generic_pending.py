import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

start = s.find("    // 开房：只挂\"待付款\"")
end = s.find("    // 将 Gate 门禁客观事实注入为天道推演的刚性阻力边界", start)
if start < 0 or end < 0:
    print('WARN: 没找到旧块')
else:
    block = """    // 花钱的事：只挂"待付款"，等他在界面上点头；绝不当场扣钱、绝不当场搬人
    // 开房、买东西、打点、赏钱、聘礼……都走这一条
    try {
      const wPend = loadState(this.dataDir);
      const meP = this._viewerActorId ? wPend.actors?.[this._viewerActorId] : wPend.actors?.husband;
      const partnerId = String((wPend.chatPartners || {})[this._viewerActorId || 'husband'] || '');
      const partner = wPend.actors?.[partnerId];
      const withMe = partner && !partner.dead && partner.location === meP?.location;

      const wantsLodging = /(开房|开间房|要间房|住店|住一晚|要个?上房|客房)/.test(say);
      const wantsBuy = /(买下|买这个|买它|要买|付钱|给钱|打点|赏|聘礼|定金|租金|包下)/.test(say);

      if (wantsLodging || wantsBuy) {
        wPend.pendingAction = {
          kind: wantsLodging ? 'lodging' : 'spend',
          id: `pend_${Date.now()}`,
          title: wantsLodging ? '开房' : String(say).slice(0, 18),
          inn: 'inn',
          options: wantsLodging
            ? [
                { key: 'luxury', label: '上房', price: 3 },
                { key: 'cheap', label: '通铺', price: 0.2 },
              ]
            : [{ key: 'pay', label: '照付', price: 1 }],
          by: meP?.id || 'husband',
          with: withMe ? partnerId : '',
          withName: withMe ? partner.name : '',
          askedDay: wPend.clock?.day || 1,
          askedHour: wPend.clock?.hour || 0,
        };
        saveState(this.dataDir, wPend);
        contextHintEarly += `（【待付】相公只是在说要花钱（${wPend.pendingAction.title}），钱还没付。你这轮别写"已经付了/已经进了房"，最多写到问价、掏钱的动作。）\\n`;
        console.log(`[Pay] 已挂待付款：${wPend.pendingAction.title}`);
      }
    } catch { /* 忽略 */ }

"""
    s = s[:start] + block + s[end:]
    io.open(p, 'w', encoding='utf-8').write(s)
    print('已换成通用"待付款"')

# 金额：普通花销按当前银子的一成，最小 0.5 两（给个合理默认）
io.open(p, 'w', encoding='utf-8').write(s)
print('done')
