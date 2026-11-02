import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const root = path.join(os.tmpdir(), 'fs-pt-' + Date.now());
const dir = path.join(root, 'data');
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ family: { husband:{token:'h'}, liuwenxia:{token:'l', actor:'liuwenxia'} } }), 'utf8');
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
let w = loadState(dir);
ensureCities(w);
w.actors.liuwenxia = { id:'liuwenxia', name:'紫嫣', role:'老板娘', gender:'female', home:'wine_shop', location:'street', relations:{husband:{trust:80,desire:60,fear:0,grievance:0}}, schedule:[] };
w.actors.yujie = { id:'yujie', name:'于子归', role:'营造行工头', gender:'male', home:'wine_shop', location:'street', relations:{}, schedule:[] };
w.actors.husband.location = 'tea_house';
w.chatPartners = { liuwenxia: 'yujie' };
saveState(dir, w);
const llm = { isReady: () => true, complete: async (a) => {
  if (a.maxTokens === 160) return { text: '这事我来担，你别管。', usage: null };
  if (a.maxTokens >= 200 && a.maxTokens < 300) return { text: '我借给你20两，第44日还。', usage: null };
  if (a.maxTokens <= 200) return { text: '[[world:none]]' };
  return { text: '（屋里一时没人应声。）' };
}};
const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: llm, ttsService:null, visionService:null, dataDir: dir });
const r = await svc.chat({ text: '都找上门了，你还不操心？', modality:'text', profileKey:'liuwenxia', roleName:'x', actorId:'liuwenxia' });
console.log('回复:', String(r.reply?.text || '').replace(/\n/g, ' / '));
const w2 = loadState(dir);
console.log('对象:', w2.chatPartners?.liuwenxia);
fs.rmSync(root, { recursive: true, force: true });
'''
open('.tmp_pt.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_pt.mjs'], capture_output=True, text=True, encoding='utf-8')
full = (out.stdout or '') + (out.stderr or '')
for line in full.split('\n'):
    if any(k in line for k in ['回复:', '对象:', 'Proxy', '失败']):
        print(line.strip())
os.remove('.tmp_pt.mjs')
