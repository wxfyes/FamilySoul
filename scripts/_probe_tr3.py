import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
probe = r"""
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const root = path.join(os.tmpdir(), 'fs-tr3-' + Date.now());
const dir = path.join(root, 'data');
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ family: { husband:{token:'h'} } }), 'utf8');
const { loadState, saveState, ensureCities, ensureCourt } = await import('./src/world/state.js');
let w = loadState(dir); ensureCities(w); ensureCourt(w);
w.actors.husband.location = 'tea_house';
w.actors.liuwenxia = { id:'liuwenxia', name:'紫嫣', role:'老板娘', gender:'female', home:'wine_shop', location:'wine_shop', relations:{}, schedule:[] };
saveState(dir, w);
const llm = { isReady: () => true, complete: async (a) => {
  if (a.maxTokens >= 200 && a.maxTokens < 300) return { text: '紫嫣：相公慢走。', usage: null };
  if (a.maxTokens <= 200) return { text: '[[world:none]]', usage: null };
  return { text: '【紫嫣】：相公慢走。', usage: null };
}};
const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: llm, ttsService:null, visionService:null, dataDir: dir });
const r = await svc.chat({ text: '去苏州府', modality:'text', profileKey:'husband', roleName:'x', actorId:null });
const s = loadState(dir);
console.log('位置:', s.places[s.actors.husband.location]?.name);
console.log('回复:', String(r.reply?.text || '').replace(/\n/g,' / ').slice(0,80) || '（空）');
fs.rmSync(root, { recursive: true, force: true });
"""
open('.tmp_tr3.mjs','w',encoding='utf-8').write(probe)
r = subprocess.run(['node','.tmp_tr3.mjs'], capture_output=True, text=True, encoding='utf-8')
print((r.stdout or '').strip()[-300:])
print('ERR', (r.stderr or '')[-200:])
os.remove('.tmp_tr3.mjs')
