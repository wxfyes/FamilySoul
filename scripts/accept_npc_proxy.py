import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const root = path.join(os.tmpdir(), 'fs-npcp6-' + Date.now());
const dir = path.join(root, 'data');
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ family: { husband:{token:'h'}, liuwenxia:{token:'l', actor:'liuwenxia'} } }), 'utf8');
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
let w = loadState(dir);
ensureCities(w);
w.actors.liuwenxia = { id:'liuwenxia', name:'紫嫣', role:'老板娘', gender:'female', home:'wine_shop', location:'street', relations:{husband:{trust:80,desire:60,fear:0,grievance:0}}, schedule:[] };
w.actors.yujie = { id:'yujie', name:'于子归', role:'营造行工头', gender:'male', home:'wine_shop', location:'street', relations:{}, schedule:[] };
w.actors.husband.location = 'tea_house';
saveState(dir, w);
const llm = { isReady: () => true, complete: async (a) => {
  if (a.maxTokens === 160) return { text: '（抬头）娘子？', usage: null };
  if (a.maxTokens <= 200) return { text: '[[world:none]]' };
  return { text: '（屋里一时没人应声。）' };
}};
const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: llm, ttsService:null, visionService:null, dataDir: dir });
const r = await svc.chat({ text: '于子归', modality:'text', profileKey:'liuwenxia', roleName:'x', actorId:'liuwenxia' });
console.log('回复:', String(r.reply?.text || ''));
fs.rmSync(root, { recursive: true, force: true });
'''
open('.tmp_npcp6.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_npcp6.mjs'], capture_output=True, text=True, encoding='utf-8')
print('--- STDOUT ---')
print((out.stdout or '')[-2000:])
print('--- STDERR ---')
print((out.stderr or '')[-800:])
os.remove('.tmp_npcp6.mjs')
