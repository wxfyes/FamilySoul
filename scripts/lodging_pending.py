import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 将 Gate 门禁客观事实注入为天道推演的刚性阻力边界"
block = """    // 开房：只挂"待付款"，等界面点头；绝不当场搬人
    try {
      if (/(开房|开间房|要间房|住店|住一晚|要个?上房|客房)/.test(say)) {
        const wPend = loadState(this.dataDir);
        const meP = this._viewerActorId ? wPend.actors?.[this._viewerActorId] : wPend.actors?.husband;
        const partnerId = String((wPend.chatPartners || {})[this._viewerActorId || 'husband'] || '');
        const partner = wPend.actors?.[partnerId];
        wPend.pendingAction = {
          kind: 'lodging',
          id: `pend_${Date.now()}`,
          inn: 'inn',
          luxury: 3,
          cheap: 0.2,
          by: meP?.id || 'husband',
          with: partner && !partner.dead && partner.location === meP?.location ? partnerId : '',
          withName: partner && partner.location === meP?.location ? partner.name : '',
          askedDay: wPend.clock?.day || 1,
          askedHour: wPend.clock?.hour || 0,
        };
        saveState(this.dataDir, wPend);
        contextHintEarly += '（【待付】相公还只是说要开房，钱还没付。你这轮别写"进了房间/上了楼"，最多写到叫掌柜、问价、递钥匙。）\\n';
        console.log('[Lodging] 已挂待付款，等界面确认');
      }
    } catch { /* 忽略 */ }

    // 将 Gate 门禁客观事实注入为天道推演的刚性阻力边界"""

if anchor in s and '已挂待付款' not in s:
    s = s.replace(anchor, block, 1)
    print('① 开房挂待付款')
io.open(p, 'w', encoding='utf-8').write(s)
print('done')
