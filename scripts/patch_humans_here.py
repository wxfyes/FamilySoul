import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "        const hus = Object.values(wHere.actors || {}).find((a) => a && a.id === 'husband');"
add = (
    "        try {\n"
    "          const rootDir2 = path.dirname(this.dataDir);\n"
    "          const humansHere = Object.values(wHere.actors || {})\n"
    "            .filter((a) => a && !a.dead && a.id !== this._viewerActorId && a.location === locId)\n"
    "            .filter((a) => Boolean(memberKeyOfActor(rootDir2, a.id)))\n"
    "            .map((a) => a.name);\n"
    "          if (humansHere.length) {\n"
    "            bits.push(`同一处的真人还有：${humansHere.join('、')}——他们的话由他们自己说，你不许替他们开口`);\n"
    "          }\n"
    "        } catch { /* 忽略 */ }\n"
)
if anchor in s and '同一处的真人还有' not in s:
    s = s.replace(anchor, add + anchor, 1)
    print('patched: list real humans present')
else:
    print('WARN: anchor not found or already patched')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
