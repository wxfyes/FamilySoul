import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const root = path.join(os.tmpdir(), 'fs-home3-' + Date.now());
const dir = path.join(root, 'data');
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ family: { husband:{token:'h'}, liuwenxia:{token:'l', actor:'liuwenxia'} } }), 'utf8');
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
let w = loadState(dir);
ensureCities(w);
w.actors.liuwenxia = { id:'liuwenxia', name:'紫嫣', role:'老板娘', gender:'female', home:'wine_shop', location:'street', relations:{husband:{trust:80,desire:60,fear:0,grievance:0}}, schedule:[] };
w.actors.husband.location = 'tea_house';
saveState(dir, w);
const llm = { isReady: () => true, complete: async (a) => {
  if (a.maxTokens >= 200 && a.maxTokens < 300) return { text: '好。', usage: null };
  if (a.maxTokens <= 200) return { text: '[[world:none]]', usage: null };
  return { text: '【紫嫣】：我回去了。', usage: null };
}};
const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: llm, ttsService:null, visionService:null, dataDir: dir });
const r = await svc.chat({ text: '回家', modality:'text', profileKey:'liuwenxia', roleName:'x', actorId:'liuwenxia' });
const s = loadState(dir);
console.log('紫嫣:', s.places[s.actors.liuwenxia.location]?.name);
console.log('王甯:', s.places[s.actors.husband.location]?.name);
console.log('回复:', String(r.reply?.text||'').slice(0,40));
fs.rmSync(root, { recursive: true, force: true });
'''
open('.tmp_home3.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_home3.mjs'], capture_output=True, text=True, encoding='utf-8')
full = (out.stdout or '') + (out.stderr or '')
for line in full.split('\n'):
    if any(k in line for k in ['紫嫣:', '王甯:', '回复:', 'Scene', '记账']):
        print(line.strip())
os.remove('.tmp_home3.mjs')
