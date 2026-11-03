import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const root = path.join(os.tmpdir(), 'fs-auto-' + Date.now());
const dir = path.join(root, 'data');
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ family: { husband:{token:'h'}, zhanjing:{token:'z', actor:'zhanjing'} } }), 'utf8');
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
let w = loadState(dir); ensureCities(w);
w.actors.zhanjing = { id:'zhanjing', name:'静儿', role:'书吏发妻', gender:'female', home:'yamen', location:'street', relations:{husband:{trust:42,desire:30,fear:0,grievance:13}}, schedule:[] };
w.actors.qiantonghai.location = 'street';
w.actors.qiantonghai.activity = { text: '在茶行坐馆收货' };
saveState(dir, w);
const llm = { isReady: () => true, complete: async (a) => {
  if (a.maxTokens >= 150 && a.maxTokens <= 300) return { text: '客官要的茶，后头正称着呢。', usage: null };
  if (a.maxTokens <= 200) return { text: '[[world:none]]', usage: null };
  // 主模型写了一个不在场的人
  return { text: '【紫嫣】：相公。', usage: null };
}};
const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: llm, ttsService:null, visionService:null, dataDir: dir });
const r = await svc.chat({ text: '今天有点累', modality:'text', profileKey:'zhanjing', roleName:'x', actorId:'zhanjing' });
console.log('回复:', String(r.reply?.text || '').replace(/\n/g, ' / '));
fs.rmSync(root, { recursive: true, force: true });
'''
open('.tmp_auto.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_auto.mjs'], capture_output=True, text=True, encoding='utf-8')
for line in ((out.stdout or '') + (out.stderr or '')).split('\n'):
    if any(k in line for k in ['回复:', 'Proxy', 'Scene']):
        print(line.strip())
os.remove('.tmp_auto.mjs')
