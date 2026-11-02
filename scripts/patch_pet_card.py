import io, re, sys

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# 1) 引入身份卡
if 'buildMemberCard' not in s:
    s = s.replace(
        "import { auditReply } from './world/audit.js';",
        "import { auditReply } from './world/audit.js';\nimport { buildMemberCard } from './world/member-card.js';",
    )

# 2) 她的分支改用身份卡
old = "const own = buildStateSummary(this.dataDir, { roleName: '傲娇助手', memberKey: 'husband', viewer: this._viewerActorId });"
new = "const own = buildMemberCard(this.dataDir, this._viewerActorId);"
if old in s:
    s = s.replace(old, new)
    print('patched bound summary -> member card')
else:
    print('WARN: bound summary call not found')

# 3) 身份卡最后再重申一遍（贴近生成）
anchor = "      lines.push('- 以上是你自己知道的事，不是全知视角。别人私下的银钱、产业、往来，你不知情。');"
reinforce = (
    "      lines.push('');\n"
    "      lines.push('【再说一遍】' + own.split('\\n').slice(0, 4).join('；'));\n"
    "      lines.push('');\n"
)
if '【再说一遍】' not in s and anchor in s:
    s = s.replace(anchor, reinforce + anchor)
    print('added reinforcement block')

io.open(p, 'w', encoding='utf-8').write(s)
print('done, length', len(s))
