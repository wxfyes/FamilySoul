import io
p = 'src/world/audit.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'hireStaff' in s and "from './employment.js'" not in s:
    lines = s.split('\n')
    idx = next((i for i,l in enumerate(lines) if l.startswith('import ')), None)
    if idx is not None:
        lines.insert(idx, "import { hireStaff } from './employment.js';")
    else:
        lines.insert(0, "import { hireStaff } from './employment.js';")
    io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
    print('audit 补 import')
