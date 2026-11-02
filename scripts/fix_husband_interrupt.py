import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "        const said = String(say || '');\n"
    "        const askedHim = /(王甯|王掌柜|少掌柜|相公)/.test(said)\n"
    "          || /(你|您)/.test(said)\n"
    "          || /(那你|你是谁|谁啊|在吗)/.test(said);"
)
new = (
    "        const said = String(say || '');\n"
    "        // 她在跟别的在场者说话时，王甯不许插嘴\n"
    "        const talkingToOther = Object.values(wPost.actors || {}).some(\n"
    "          (a) => a && !a.dead && a.id !== 'husband' && a.id !== this._viewerActorId\n"
    "            && a.location === locPost && a.name && said.includes(a.name),\n"
    "        );\n"
    "        const namedHim = /(王甯|王掌柜|少掌柜|相公)/.test(said);\n"
    "        const askedHim = namedHim || (!talkingToOther && /(你|您)/.test(said));"
)
if old in s:
    s = s.replace(old, new)
    print('patched: husband stays quiet when she addresses someone else')
else:
    print('WARN: askedHim block not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
