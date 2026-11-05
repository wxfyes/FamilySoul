import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { ensureFactions, factionOf, factionSilver, factionStrength } from './world/factions.js';",
              "import { ensureFactions, factionOf, factionSilver, factionStrength, spendFactionSilver } from './world/factions.js';")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('补 spendFactionSilver 引入')
