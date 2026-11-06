import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'maybeOfferAlliance' not in s.split('function')[0]:
    s = s.replace("import { buildStateSummary } from './world/summarize.js';",
                  "import { buildStateSummary } from './world/summarize.js';\nimport { maybeOfferAlliance } from './world/marriage.js';", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('import')
