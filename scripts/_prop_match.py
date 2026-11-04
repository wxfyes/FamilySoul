import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      const cands = Object.entries(world.places).filter(([, pl]) => {
        const pn = String(pl?.name || '');
        return pn && (pn === nm || pn.includes(nm) || nm.includes(pn));
      });"""
new = """      // 只认同名或只差两字以内的说法（"运河码头" 不能代表 "运河码头三层大酒楼"）
      const cands = Object.entries(world.places).filter(([, pl]) => {
        const pn = String(pl?.name || '');
        if (!pn) return false;
        if (pn === nm) return true;
        const near = Math.abs(pn.length - nm.length) <= 2;
        return near && (pn.includes(nm) || nm.includes(pn));
      });"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('收紧产业-地点匹配')
