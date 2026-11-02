import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
probe = r"""
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const root = path.join(os.tmpdir(), 'fs-where-' + Date.now());
const dir = path.join(root, 'data');
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ family: { husband:{token:'h'} } }), 'utf8');
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
let w = loadState(dir); ensureCities(w);
w.places.sz_street = { name: '苏州府·长街', exits: ['street'], dynamic: true };
w.actors.husband.location = 'sz_street';
saveState(dir, w);
const llm = { isReady: () => true, complete: async (a) => {
  if (a.maxTokens >= 200 && a.maxTokens < 300) return { text: '（沉默）', usage: null };
  if (a.maxTokens <= 200) return { text: '[[world:none]]', usage: null };
  return { text: '……', usage: null };
}};
const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: llm, ttsService:null, visionService:null, dataDir: dir });
const r = await svc.chat({ text: '我在哪', modality:'text', profileKey:'husband', roleName:'x', actorId:null });
console.log('回复:', String(r.reply?.text || ''));
fs.rmSync(root, { recursive: true, force: true });
"""
open('.tmp_where.mjs','w',encoding='utf-8').write(probe)
r = subprocess.run(['node','.tmp_where.mjs'], capture_output=True, text=True, encoding='utf-8')
print((r.stdout or '').strip()[-200:])
os.remove('.tmp_where.mjs')
