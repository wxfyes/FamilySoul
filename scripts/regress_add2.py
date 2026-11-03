import io

p = 'scripts/regress.py'
s = io.open(p, encoding='utf-8').read()

add = '''

@case('街上的人会应声（在场 NPC 代演）')
def c13():
    out = run_node(HEAD + r"""
w.actors.tangpo = { id:'tangpo', name:'唐婆', role:'甜记糖铺', gender:'female', home:'street', location:'street', activity:{text:'熬糖'}, relations:{husband:{trust:30}}, schedule:[] };
w.actors.tangpo.location = 'street';
w.actors.husband.location = 'street';
saveState(dir, w);
const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: mkLlm('', '糖刚熬好，公子要尝尝？'), ttsService:null, visionService:null, dataDir: dir });
const r = await svc.chat({ text: '唐婆', modality:'text', profileKey:'husband', roleName:'x', actorId:null });
const t = String(r.reply?.text||'');
console.log(t.includes('唐婆') && t !== '……' ? 'PASS' : 'FAIL ' + t.slice(0,40));
""" + TAIL)
    return 'PASS' in out, out


@case('天道场景标签不漏进正文')
def c14():
    out = run_node(HEAD + r"""
w.actors.waner.location = 'tea_house';
saveState(dir, w);
const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: mkLlm('【天道·地点·临江茶坊】：\\n【沈婉儿】：相公回来了。'), ttsService:null, visionService:null, dataDir: dir });
const r = await svc.chat({ text: '婉儿', modality:'text', profileKey:'husband', roleName:'x', actorId:null });
const t = String(r.reply?.text||'');
console.log(!/【天道/.test(t) && t.includes('婉儿') ? 'PASS' : 'FAIL ' + t.slice(0,40));
""" + TAIL)
    return 'PASS' in out, out


def main():'''

s = s.replace('\ndef main():', add, 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('added 2 more cases')
