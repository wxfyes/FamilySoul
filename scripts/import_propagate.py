import io

p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "import { queueProactive } from './clock.js';"
new = "import { queueProactive } from './clock.js';\nimport { propagateMood } from './bonds.js';"
if old in s and 'propagateMood } from' not in s:
    s = s.replace(old, new, 1)
    print('added propagateMood import')
else:
    print('skip')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
