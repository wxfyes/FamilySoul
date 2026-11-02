import io

p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "      } else if (kind === 'move') {\n"
    "        const id = resolveActor(world, args.who);\n"
    "        if (!id) continue;"
)
new = (
    "      } else if (kind === 'move') {\n"
    "        const id = resolveActor(world, args.who);\n"
    "        if (!id) continue;\n"
    "        // 真人成员在自己的账号里走动，绝不许顺带把相公搬过去\n"
    "        const caller = String((opts && (opts.selfId || opts.memberKey)) || '');\n"
    "        if (id === 'husband' && caller && caller !== 'husband') {\n"
    "          applied.push(`拒绝:${caller}不能移动相公`);\n"
    "          continue;\n"
    "        }"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: block moving husband from member session')
else:
    print('WARN: move branch not found')

# applyWorldTags 签名要能拿到 opts（确认一下）
io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
