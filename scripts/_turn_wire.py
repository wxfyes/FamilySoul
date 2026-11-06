import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { loadState, saveState } from './world/state.js';",
              "import { loadState, saveState, runInStateTurn } from './world/state.js';", 1)
old = """        result = await petService.chat({
          text: body.text,
          modality: body.modality || 'text',
          profileKey: currentMember.memberKey,
          roleName: currentMember.role,
          actorId: currentMember.actor || null,
        });"""
new = """        result = await runInStateTurn(() => petService.chat({
          text: body.text,
          modality: body.modality || 'text',
          profileKey: currentMember.memberKey,
          roleName: currentMember.role,
          actorId: currentMember.actor || null,
        }));"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('聊天包进回合')
