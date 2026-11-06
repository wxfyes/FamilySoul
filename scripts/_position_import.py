import io
p = 'src/world/position.js'
s = io.open(p, encoding='utf-8-sig').read()
if "from './privacy.js'" not in s:
    s = s.replace("export const MOVE_REASONS = new Set(['ui', 'world']);",
                  "import { isInnerRoom } from './privacy.js';\n\nexport const MOVE_REASONS = new Set(['ui', 'world']);", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('补 import')
