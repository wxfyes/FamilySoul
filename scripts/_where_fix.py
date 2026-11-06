import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        if (pName) {
          assistantMsg.text = `【${pName}】：（你在${pName}。）`;
          assistantMsg.audioKey = null;
          console.log('[Where] 直接答位置：' + pName);
        }"""
new = """        if (pName) {
          // 用旁白、不用【地点】当发言人（否则会被在场铁律当成"地点在说话"剔掉）
          const wRoom = loadState(this.dataDir);
          const hereRoom = wRoom.places?.[locSelf];
          const furn = (hereRoom?.rooms && Object.keys(hereRoom.rooms).length) ? '' : '';
          const meW = this._viewerActorId ? wRoom.actors?.[this._viewerActorId] : wRoom.actors?.husband;
          const silver = Number(meW?.money ?? wRoom.assets?.silver ?? 0);
          assistantMsg.text = `（你在「${pName}」。${silver > 0 ? `身上还有 ${silver.toFixed(2)} 两碎银。` : ''}${furn}）`;
          assistantMsg.audioKey = null;
          console.log('[Where] 直接答位置：' + pName);
        }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 位置回答改旁白，不再冒充发言人')
