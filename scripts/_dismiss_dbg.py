import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("      if (farewellSay && !/\\[\\[depart:/.test(String(reply || ''))) {",
              "      if (farewellSay) {", 1)
s = s.replace("        if (goers.length) {", "        console.log(`[Departure] 送客判定：在场 ${hereF.length} 人，应走 ${goers.length} 人`);\n        if (goers.length) {", 1)
s = s.replace("            if (wF.places?.[back] && moveActor(wF, a.id, back, 'world', '告辞离场')) names.push(a.name);",
              "            const mv = wF.places?.[back] ? moveActor(wF, a.id, back, 'world', '告辞离场') : { ok: false };\n            if (mv?.ok) names.push(a.name); else console.log(`[Departure] ${a.name} 没走成：${mv?.error || '没有去处'}`);", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('patched dismiss guard + logs')
