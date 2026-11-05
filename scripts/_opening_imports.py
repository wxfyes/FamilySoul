import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# 缺少的导入与 round2
if 'inferGenderFromIdentity' not in s.split('async function')[0]:
    s = s.replace("import { ensureDwelling, defaultSchedule } from './world/dwelling.js';",
                  "import { ensureDwelling, defaultSchedule } from './world/dwelling.js';\n"
                  "import { inferGenderFromIdentity, inferAgeFromIdentity } from './world/persona.js';\n"
                  "const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;")
    print('补 persona 导入与 round2')
io.open(p, 'w', encoding='utf-8-sig').write(s)
