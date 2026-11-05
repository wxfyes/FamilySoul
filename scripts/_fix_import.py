import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'pruneForeignRooms' not in s.split('\n')[30]:
    pass
# 统一补导入
if "from './world/residence.js'" in s:
    import re
    s = re.sub(r"import \{[^}]*\} from './world/residence.js';",
               "import { ensureResidence, repairRooms, pruneForeignRooms, settleItinerants, buildPremises, buildCourts } from './world/residence.js';",
               s, count=1)
else:
    s = s.replace("import { visiblePropertiesOf } from './world/employment.js';",
                  "import { visiblePropertiesOf } from './world/employment.js';\nimport { ensureResidence, repairRooms, pruneForeignRooms, settleItinerants, buildPremises, buildCourts } from './world/residence.js';")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('补齐 residence 导入')
