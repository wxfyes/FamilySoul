import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
if "from './world/warfare.js'" not in s:
    s = s.replace("import { hireStaff } from './world/employment.js';",
                  "import { hireStaff } from './world/employment.js';\nimport { spawnHouseholdStaff } from './world/warfare.js';", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('补 warfare 导入')
