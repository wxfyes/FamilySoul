import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { moveActor } from './world/position.js';",
              "import { moveActor, isHumanBound } from './world/position.js';", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('补 isHumanBound 导入')
