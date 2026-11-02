import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const root = path.join(os.tmpdir(), 'fs-hm-' + Date.now());
const dir = path.join(root, 'data');
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ family: { husband:{token:'h'}, liuwenxia:{token:'l', actor:'liuwenxia'} } }), 'utf8');
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
let w = loadState(dir); ensureCities(w);
w.actors.liuwenxia = { id:'liuwenxia', name:'紫嫣', role:'老板娘', gender:'female', home:'wine_shop', location:'wine_shop', relations:{husband:{trust:80,desire:60}}, schedule:[] };
w.actors.husband.location = 'tea_house';
saveState(dir, w);
const llm = { isReady: () => true, complete: async (a) => {
  // 主模型不给回执；记账员返回"把相公搬到她那儿"
  if (a.maxTokens <= 200) return { text: '[[world:move who=husband to=于家酒肆]]', usage: null };
  if (a.maxTokens >= 200 && a.maxTokens < 300) return { text: '好。', usage: null };
  return { text: '【阿吉】：路上好走。', usage: null };
}};
const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: llm, ttsService:null, visionService:null, dataDir: dir });
await svc.chat({ text: '我去酒肆看看', modality:'text', profileKey:'liuwenxia', roleName:'x', actorId:'liuwenxia' });
await new Promise((r) => setTimeout(r, 1800));
const s = loadState(dir);
console.log('紫嫣:', s.places[s.actors.liuwenxia.location]?.name);
console.log('王甯:', s.places[s.actors.husband.location]?.name);
fs.rmSync(root, { recursive: true, force: true });
'''
open('.tmp_hm.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_hm.mjs'], capture_output=True, text=True, encoding='utf-8')
full = (out.stdout or '') + (out.stderr or '')
for line in full.split('\n'):
    if any(k in line for k in ['紫嫣:', '王甯:', '拒绝', 'World]', '记账']):
        print(line.strip())
os.remove('.tmp_hm.mjs')
