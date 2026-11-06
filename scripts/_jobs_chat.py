import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 8.81 相公叫护院/家丁"
add = """    // 8.80 营生三件事：摆摊 / 找差事 / 租铺（哪个城都能做，不分临江内外）
    try {
      const sayT = String(sayText || '');
      const wB = loadState(this.dataDir);
      const meB = wB.actors?.[this._viewerActorId || 'husband'] || wB.actors?.husband;
      const labelOf3 = (nm) => { const seg = String(nm || '').split('·')[0]; return /府$|州$|县$/.test(seg) ? seg : '临江府'; };
      const myCity3 = labelOf3(wB.places?.[meB?.location]?.name);
      const base3 = wB.flags?.cityBase?.[myCity3];
      const money3 = (id) => (id === 'husband' ? Number(wB.assets?.silver) || 0 : Number(wB.actors?.[id]?.money) || 0);
      const pay3 = (id, amt) => {
        if (id === 'husband') { wB.assets.silver = Math.round(((Number(wB.assets.silver) || 0) - amt) * 100) / 100; }
        else { const a = wB.actors[id]; if (a) a.money = Math.round(((Number(a.money) || 0) - amt) * 100) / 100; }
      };

      // 摆摊
      const mStall = /摆(个)?摊|支个摊|摆摊卖(.{1,6})/.exec(sayT);
      if (mStall && /街|集|市/.test(String(wB.places?.[meB?.location]?.name || ''))) {
        const goods = (mStall[2] || '杂货').slice(0, 6);
        const fee = 0.05;
        if (money3(meB.id) < fee) {
          reply += `\\n（摆摊要先交 ${fee.toFixed(2)} 两摊位钱，手头不够。）`;
        } else {
          pay3(meB.id, fee);
          meB.stall = { good: goods, word: goods, price: 0.04, sinceDay: wB.clock?.day || 1 };
          meB.role = '摊贩'; meB.title = '摊贩';
          saveState(this.dataDir, wB);
          reply += `\\n（你在${wB.places?.[meB.location]?.name || '街边'}支起摊子卖${goods}，交了 ${fee.toFixed(2)} 两摊位钱。）`;
          console.log(`[Job] ${meB.name} 在${myCity3}摆摊卖${goods}`);
        }
      }

      // 找差事（本城差事表）
      if (/找(个)?(活|差事|营生)|应差|寻个差事/.test(sayT) && base3?.jobs?.length) {
        if (meB.job) {
          reply += `\\n（你眼下已在${meB.job.city}做${meB.job.title}，一日 ${Number(meB.job.pay).toFixed(2)} 两。）`;
        } else {
          const job = base3.jobs[Math.floor(Math.random() * base3.jobs.length)];
          meB.job = { city: myCity3, title: job.title, pay: job.pay, place: job.place, sinceDay: wB.clock?.day || 1 };
          meB.role = job.title; meB.title = job.title;
          saveState(this.dataDir, wB);
          reply += `\\n（你应了${myCity3}的${job.title}，一日 ${job.pay.toFixed(2)} 两，当值在${wB.places?.[job.place]?.name || '街面上'}。）`;
          console.log(`[Job] ${meB.name} 应差：${job.title} @${myCity3}`);
        }
      }

      // 租铺（本城集市里一间）
      if (/租(个|一间|下)?铺|盘个铺子|开个铺子/.test(sayT) && base3?.marketId) {
        const rent = Math.round((20 + (Number(wB.cities?.[myCity3]?.wealth) || 30) * 0.4) * 100) / 100;
        if (money3(meB.id) < rent) {
          reply += `\\n（本城租一间铺面要 ${rent.toFixed(2)} 两，手头不够。）`;
        } else {
          pay3(meB.id, rent);
          const nm = `${myCity3}·${meB.name}的铺子`;
          wB.assets = wB.assets || {};
          wB.assets.properties = Array.isArray(wB.assets.properties) ? wB.assets.properties : [];
          wB.assets.properties.push({
            id: `prop_${Date.now()}`, name: nm, kind: 'shops',
            incomePerDay: 0.3, owner: meB.id, keeper: meB.id, staff: 0,
            city: myCity3, place: base3.marketId, status: '已开张', openedDay: wB.clock?.day || 1,
            capital: Math.max(100, rent * 8),
          });
          saveState(this.dataDir, wB);
          reply += `\\n（你在${wB.places?.[base3.marketId]?.name || '集市'}租下一间铺子，花了 ${rent.toFixed(2)} 两。）`;
          console.log(`[Job] ${meB.name} 在${myCity3}租铺：${rent} 两`);
        }
      }
    } catch (err) { console.warn('[Job] 营生处理失败：', err.message); }

""" + anchor
if '营生三件事' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加营生指令')
