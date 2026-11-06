import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { beginStateBatch, endStateBatch } from './world/state.js';",
              "import { beginStateBatch, endStateBatch, runInStateTurn } from './world/state.js';", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('补导入')
