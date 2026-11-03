import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# 1) 引入 seedPersonalMoney
old_imp = "import { ensureCities, ensureCourt, ensureTerrain } from './world/state.js';"
new_imp = "import { ensureCities, ensureCourt, ensureTerrain, seedPersonalMoney } from './world/state.js';"
if old_imp in s:
    s = s.replace(old_imp, new_imp, 1)
    print('① 引入 seedPersonalMoney')

# 2) 开机时补私房钱
old_boot = """    ensureTerrain(wA);
    saveState(DATA_DIR, wA);"""
new_boot = """    ensureTerrain(wA);
    try { seedPersonalMoney(wA); } catch { /* 忽略 */ }
    saveState(DATA_DIR, wA);"""
if old_boot in s:
    s = s.replace(old_boot, new_boot, 1)
    print('② 开机补私房钱并落盘')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
