import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

start_marker = "    // 真人扮演世界人物时：AI 演在场所有人，只去掉场景标记，不动任何人名标签"
end_marker = "    // 她一开口就算\"在行动\"，主线不会因为躺平被世界替她定夺"

start = s.find(start_marker)
end = s.find(end_marker)
if start < 0 or end < 0 or end < start:
    print('WARN: block markers not found', start, end)
else:
    replacement = (
        "    // 真人扮演世界人物：整块重写——模型出「【说话人】台词」，引擎逐段校验\n"
        "    if (this._viewerActorId) {\n"
        "      try {\n"
        "        const wPost = loadState(this.dataDir);\n"
        "        const mePost = wPost.actors?.[this._viewerActorId];\n"
        "        const locPost = mePost?.location;\n"
        "        const present = Object.values(wPost.actors || {})\n"
        "          .filter((a) => a && !a.dead && a.id !== this._viewerActorId && a.location === locPost)\n"
        "          .flatMap((a) => [a.name, a.name.length > 2 ? a.name.slice(-2) : a.name])\n"
        "          .filter(Boolean);\n"
        "        const husPost = Object.values(wPost.actors || {}).find((a) => a && a.id === 'husband');\n"
        "        const husHere = husPost && husPost.location === locPost;\n"
        "        reply = normalizeMemberReply(reply, {\n"
        "          selfName: this._viewerName,\n"
        "          selfAliases: this._knownNames || [],\n"
        "          present,\n"
        "          husbandPresent: Boolean(husHere),\n"
        "          husbandPlace: husHere ? null : String(wPost.places?.[husPost?.location]?.name || '别处'),\n"
        "        });\n"
        "      } catch (err) {\n"
        "        console.warn('[Member] 回复规范化失败：', err.message);\n"
        "      }\n"
        "    }\n\n"
    )
    s = s[:start] + replacement + s[end:]
    print('rewrote member reply pipeline')

# 引入新模块
if 'normalizeMemberReply' not in s.split('\n\n')[0]:
    s = s.replace(
        "import { buildMemberCard } from './world/member-card.js';",
        "import { buildMemberCard } from './world/member-card.js';\nimport { normalizeMemberReply } from './world/member-reply.js';",
    )

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
