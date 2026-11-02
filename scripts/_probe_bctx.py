import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
probe = r"""
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const root = path.join(os.tmpdir(), 'fs-bctx-' + Date.now());
const dir = path.join(root, 'data');
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ family: { husband:{token:'h'}, liuwenxia:{token:'l', actor:'liuwenxia'} } }), 'utf8');
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
let w = loadState(dir); ensureCities(w);
w.actors.liuwenxia = { id:'liuwenxia', name:'紫嫣', role:'老板娘', gender:'female', home:'backyard', location:'backyard', relations:{husband:{trust:80,desire:60}}, schedule:[] };
w.actors.waner.location = 'backyard';
w.actors.yunnia.location = 'backyard';
saveState(dir, w);
let sysText = '';
const llm = { isReady: () => true, complete: async (a) => {
  if (a.maxTokens > 600) sysText = String(a.system || '');
  if (a.maxTokens === 160) return { text: '嗯。', usage: null };
  if (a.maxTokens <= 200) return { text: '[[world:none]]', usage: null };
  return { text: '【婉儿】：在呢。', usage: null };
}};
const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: llm, ttsService:null, visionService:null, dataDir: dir });
await svc.chat({ text: '婉儿', modality:'text', profileKey:'liuwenxia', roleName:'x', actorId:'liuwenxia' });
console.log('上下文含"他们彼此":', /他们彼此/.test(sysText) ? '是' : '否');
fs.rmSync(root, { recursive: true, force: true });
"""
open('.tmp_bctx.mjs','w',encoding='utf-8').write(probe)
r = subprocess.run(['node','.tmp_bctx.mjs'], capture_output=True, text=True, encoding='utf-8')
print((r.stdout or '').strip()[-200:])
os.remove('.tmp_bctx.mjs')
