import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
if "from './world/tick.js'" not in s:
    s = s.replace("import { buildStateSummary } from './world/summarize.js';",
                  "import { buildStateSummary } from './world/summarize.js';\nimport { advanceWorldTick } from './world/tick.js';", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('import tick')
