import io
p = 'src/world/goals.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { materializeRoom } from './residence.js';",
              "import { materializeRoom } from './residence.js';\nimport { moveActor } from './position.js';", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('补 moveActor 导入')
