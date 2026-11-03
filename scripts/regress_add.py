import io

p = 'scripts/regress.py'
s = io.open(p, encoding='utf-8').read()

add = '''

@case('去X家 → 到X真住处')
def c11():
    out = run_node(HEAD + r"""
w.places.suniang_shop = { name: '苏娘的绣坊', exits: ['street'], dynamic: true };
w.actors.suniang = { id:'suniang', name:'苏娘', role:'绣坊寡妇', gender:'female', home:'suniang_shop', location:'suniang_shop', relations:{husband:{trust:18}}, schedule:[] };
saveState(dir, w);
const { applySummon } = await import('./src/world/summon.js');
applySummon(dir, '去苏娘家', '', 'husband');
const s = loadState(dir);
console.log(s.actors.husband.location === s.actors.suniang.location ? 'PASS' : 'FAIL ' + s.actors.husband.location + ' vs ' + s.actors.suniang.location);
""" + TAIL)
    return 'PASS' in out, out


@case('问不在场的人 → 报位置不报省略号')
def c12():
    out = run_node(HEAD + r"""
w.actors.suniang = { id:'suniang', name:'苏娘', role:'绣坊寡妇', gender:'female', home:'street', location:'street', relations:{husband:{trust:18}}, schedule:[] };
w.actors.husband.location = 'tea_house';
saveState(dir, w);
const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: mkLlm('【苏娘】：在呢。'), ttsService:null, visionService:null, dataDir: dir });
const r = await svc.chat({ text: '苏娘', modality:'text', profileKey:'husband', roleName:'x', actorId:null });
const t = String(r.reply?.text||'');
console.log(t && t !== '……' && t.includes('苏娘') ? 'PASS' : 'FAIL ' + t.slice(0, 30));
""" + TAIL)
    return 'PASS' in out, out


def main():'''

s = s.replace('\ndef main():', add, 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('added 2 regression cases')
