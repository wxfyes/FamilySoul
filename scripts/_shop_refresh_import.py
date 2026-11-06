import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'refreshPropertyIncomes' not in s.split('function')[0]:
    s = s.replace("import { startWorldClock, peek, buildMorningReport } from './world/clock.js';",
                  "import { startWorldClock, peek, buildMorningReport, refreshPropertyIncomes } from './world/clock.js';", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('补导入')
