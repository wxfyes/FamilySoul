import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const root = path.join(os.tmpdir(), 'fs-find2-' + Date.now());
const dir = path.join(root, 'data');
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ family: { husband:{token:'h'}, liuwenxia:{token:'l', actor:'liuwenxia'} } }), 'utf8');
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
let w = loadState(dir); ensureCities(w);
w.actors.liuwenxia = { id:'liuwenxia', name:'紫嫣', role:'老板娘', gender:'female', home:'wine_shop', location:'wine_shop', relations:{husband:{trust:80,desire:60}}, schedule:[] };
w.actors.husband.location = 'tea_house';
saveState(dir, w);
const llm = { isReady: () => true, complete: async (a) => {
  if (a.maxTokens >= 200 && a.maxTokens < 300) return { text: '在，我在茶坊。', usage: null };
  if (a.maxTokens <= 200) return { text: '[[world:none]]', usage: null };
  return { text: '【阿吉】：嗯。', usage: null };
}};
const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: llm, ttsService:null, visionService:null, dataDir: dir });

// ① 问他在不在（她在酒肆，他在茶坊）
let r = await svc.chat({ text: '王掌柜在吗', modality:'text', profileKey:'liuwenxia', roleName:'x', actorId:'liuwenxia' });
console.log('问在吗 →', String(r.reply?.text || '').replace(/\n/g,' / ').slice(0, 60));
let s = loadState(dir);
console.log('  位置：她', s.places[s.actors.liuwenxia.location]?.name, '| 他', s.places[s.actors.husband.location]?.name);

// ② 去找他（她动，他不动）
r = await svc.chat({ text: '去找王甯', modality:'text', profileKey:'liuwenxia', roleName:'x', actorId:'liuwenxia' });
s = loadState(dir);
console.log('去找他 → 她', s.places[s.actors.liuwenxia.location]?.name, '| 他', s.places[s.actors.husband.location]?.name);
fs.rmSync(root, { recursive: true, force: true });
'''
open('.tmp_find2.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_find2.mjs'], capture_output=True, text=True, encoding='utf-8')
full = (out.stdout or '') + (out.stderr or '')
for line in full.split('\n'):
    if any(k in line for k in ['问在吗', '位置：', '去找他', 'Proxy']):
        print(line.strip())
os.remove('.tmp_find2.mjs')
