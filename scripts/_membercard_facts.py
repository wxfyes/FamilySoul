import io
# ① member-card：用 placeFacts 取代写死的 placeLine
p = 'src/world/member-card.js'
s = io.open(p, encoding='utf-8-sig').read()
start = s.find('function placeLine(world, actorId, me) {')
end = s.find('function arcLine(', start)
if start > 0 and end > start:
    s = s[:start] + s[end:]
    print('① 删掉写死的 placeLine')

# 引入并用 placeFacts
if 'place-facts.js' not in s:
    s = s.replace("import { loadState, worldDate } from './state.js';",
                  "import { loadState, worldDate } from './state.js';\nimport { placeFacts } from './place-facts.js';", 1)
    print('② 引入 placeFacts')

s = s.replace("  const placeFact = placeLine(world, actorId, me);",
              "  const placeFact = placeFacts(world, me.location);")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('③ 改用 placeFacts')
