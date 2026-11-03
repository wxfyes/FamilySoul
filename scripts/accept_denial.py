import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const root = path.join(os.tmpdir(), 'fs-den2-' + Date.now());
const dir = path.join(root, 'data');
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ family: { husband:{token:'h'} } }), 'utf8');
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
let w = loadState(dir); ensureCities(w);
w.actors.husband.location = 'tea_house';
w.actors.waner.location = 'tea_house';
saveState(dir, w);
const llm = { isReady: () => true, complete: async (a) => {
  if (a.maxTokens <= 200) return { text: '[[world:none]]', usage: null };
  return { text: '【天道·地点·临江茶坊】：\n【沈婉儿】：可这一声"芸娘"……相公是从哪儿听来的名儿？哪家的姑娘？', usage: null };
}};
const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: llm, ttsService:null, visionService:null, dataDir: dir });
const r = await svc.chat({ text: '芸娘', modality:'text', profileKey:'husband', roleName:'x', actorId:null });
console.log('回复:', String(r.reply?.text || '').replace(/\n/g, ' / '));
console.log('含天道标签:', /【天道/.test(String(r.reply?.text || '')) ? '是（不好）' : '否');
fs.rmSync(root, { recursive: true, force: true });
'''
open('.tmp_den2.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_den2.mjs'], capture_output=True, text=True, encoding='utf-8')
for line in ((out.stdout or '') + (out.stderr or '')).split('\n'):
    if '回复:' in line or '含天道' in line or '改正' in line:
        print(line.strip())
os.remove('.tmp_den2.mjs')
