import io
p = 'src/world/warfare.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("const want = Math.max(0, Math.min(12, Number(count) || 0));", "const want = Math.max(0, Math.min(24, Number(count) || 0));", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)

p2 = 'src/pet-service.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("if (staff.length < Math.min(troops, 12)) {\n          const madeN = spawnHouseholdStaff(wS2, Math.min(troops, 12) - staff.length, 'retainer');",
              "if (staff.length < Math.min(troops, 24)) {\n          const madeN = spawnHouseholdStaff(wS2, Math.min(troops, 24) - staff.length, 'retainer');", 1)
t = t.replace("for (const g of staff.slice(0, 12)) {", "for (const g of staff.slice(0, 24)) {", 1)
io.open(p2, 'w', encoding='utf-8-sig').write(t)
print('上限 12→24')
