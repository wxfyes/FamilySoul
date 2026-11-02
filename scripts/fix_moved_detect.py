import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "      if (summonResult?.moved?.includes('相公')) engineMovedHusband = true;"
new = (
    "      if (summonResult?.moved?.length || summonResult?.wentTo) engineMovedHusband = true;"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: moved detection includes wentTo')
else:
    print('WARN: moved line not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
