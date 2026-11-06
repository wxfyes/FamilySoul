import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """            if (id === curId || !pl || !pl.name || pl.private) return false;"""
new = """            if (id === curId || !pl || !pl.name || pl.private) return false;
            // 私房一律不列（结构性 access 之外再兜一层，防老数据的漏网）
            if (/后坊|库房|后厨|酒窖|雅间|上房|暖阁|厢房|卧房|下房|值房|账房|书房|祠堂|仓房|柴房|马厩/.test(String(pl.name || ''))) return false;"""
if old in s and '私房一律不列' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 菜单私房兜底过滤')
