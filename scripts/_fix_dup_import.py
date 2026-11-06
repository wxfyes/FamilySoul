import io
p = 'src/world/state.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
seen = 0
out = []
for l in lines:
    if l.strip().startswith("import { fallbackName } from './migration.js';"):
        seen += 1
        if seen > 1:
            continue
    out.append(l)
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(out))
print('去重导入，剩', seen-0, '→', min(seen,1))
