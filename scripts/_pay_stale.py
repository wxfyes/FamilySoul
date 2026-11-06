import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 8.787 大户提亲：答应或回绝"
add = """    // 8.786 旧报价作废：这一轮先说新话，上一张单子就不算数了
    try {
      const wQ = loadState(this.dataDir);
      if (wQ.pendingAction) {
        delete wQ.pendingAction;
        saveState(this.dataDir, wQ);
        console.log('[Pay] 上一张待付单作废（对话已进入下一轮）');
      }
    } catch { /* 忽略 */ }

""" + anchor
if '旧报价作废' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('旧报价作废')
