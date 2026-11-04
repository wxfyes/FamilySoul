import io
src = io.open('scripts/regress.py', encoding='utf-8').read()
head = src.split("HEAD = r'''")[1].split("'''")[0]
tail = src.split("TAIL = r'''")[1].split("'''")[0]
body = """
const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: mkLlm('【阿吉】：嗯。', '在，我在茶坊。'), ttsService:null, visionService:null, dataDir: dir });
const r = await svc.chat({ text: '王掌柜在吗', modality:'text', profileKey:'liuwenxia', roleName:'x', actorId:'liuwenxia' });
console.log('REPLY=' + JSON.stringify(String(r.reply?.text||'')));
"""
io.open('.tmp_case.mjs','w',encoding='utf-8').write(head + body + tail)
print('已生成 .tmp_case.mjs')
