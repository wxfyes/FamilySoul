import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("""        const fs = require('node:fs');
        const pathM = require('node:path');""",
"""        const pathM = path;""", 1)
if "import path from 'node:path';" not in s:
    s = s.replace("import fs from 'node:fs';", "import fs from 'node:fs';\nimport path from 'node:path';", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('import 修正')
