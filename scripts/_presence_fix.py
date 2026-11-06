import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
# 不再挂待付单
old = """          wPay.pendingAction = {
            kind: 'lodging',
            id: `pend_${Date.now()}`,
            title: String(title2 || '花银子').slice(0, 12),
            inn: 'inn',
            options: opts2,
            by: mePay?.id || 'husband',
            askedDay: wPay.clock?.day || 1,
            askedHour: wPay.clock?.hour || 0,
          };
          saveState(dataDir, wPay);"""
new = """          // 已即付，不再挂待付单（弹窗不再出现）
          delete wPay.pendingAction;
          saveState(dataDir, wPay);"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('② 不挂待付单')

# ③ 同宅内眷隔屋应声 → 走到这间来（只限同一座宅子，不跨城）
old2 = """      // 8.786 旧报价作废"""
new2 = """      // 8.7845 同宅女眷在别的屋里应了声：她就走过来（只在同一座宅子里，绝不跨城）
      try {
        const wP = loadState(this.dataDir);
        const meP = wP.actors?.[this._viewerActorId || 'husband'] || wP.actors?.husband;
        const hereName = String(wP.places?.[meP?.location]?.name || '');
        const estate = hereName.includes('·') ? hereName.split('·').slice(0, 2).join('·') : '';
        const spk = [...String(reply || '').matchAll(/【([^】]{1,12})】/g)].map((m) => m[1]);
        let moved = false;
        for (const sp of spk) {
          const nm = sp.includes('·') ? sp.split('·').pop().trim() : sp;
          const a = Object.values(wP.actors || {}).find((x) => x && !x.dead && x.name === nm);
          if (!a || a.location === meP?.location) continue;
          const aHome = String(wP.places?.[a.home]?.name || '');
          const aEstate = aHome.includes('·') ? aHome.split('·').slice(0, 2).join('·') : '';
          const inSameEstate = estate && (aEstate === estate || String(wP.places?.[a.location]?.name || '').startsWith(estate));
          if (!inSameEstate) continue;
          const mv = moveActor(wP, a.id, meP.location, 'world', '到跟前回话');
          if (mv?.ok) moved = true;
        }
        if (moved) saveState(this.dataDir, wP);
      } catch { /* 忽略 */ }

""" + old2
if '同宅女眷在别的屋里应了声' not in s:
    s = s.replace(old2, new2, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('③ 同宅应声走过来')
