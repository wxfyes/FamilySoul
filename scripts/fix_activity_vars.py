import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

s = s.replace(
    "        const acts = (wNow.actors ? Object.values(wNow.actors) : [])\n"
    "          .filter((a) => a && !a.dead && a.location === locNow && a.id !== this._viewerActorId && a.activity?.text)",
    "        const acts = Object.values(wHere.actors || {})\n"
    "          .filter((a) => a && !a.dead && a.location === locId && a.id !== this._viewerActorId && a.activity?.text)",
)

io.open(p, 'w', encoding='utf-8').write(s)
print('fixed variable names')
