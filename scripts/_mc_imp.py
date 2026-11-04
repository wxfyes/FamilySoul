import io
p = 'src/world/member-card.js'
s = io.open(p, encoding='utf-8-sig').read()
if "from './person-facts.js'" not in s:
    s = s.replace("import { arcStepText } from './arcs.js';",
                  "import { arcStepText } from './arcs.js';\nimport { personFacts } from './person-facts.js';", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('补 personFacts 的 import')
