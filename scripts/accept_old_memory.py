import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const root = path.join(os.tmpdir(), 'fs-mem2-' + Date.now());
const dir = path.join(root, 'data');
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ family: { husband:{token:'h'}, liuwenxia:{token:'l', actor:'liuwenxia'} } }), 'utf8');
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
const { applyWorldTags } = await import('./src/world/dispatch.js');
let w = loadState(dir); ensureCities(w);
w.actors.liuwenxia = { id:'liuwenxia', name:'紫嫣', role:'老板娘', gender:'female', home:'wine_shop', location:'wine_shop', relations:{husband:{trust:80,desire:60}}, schedule:[] };
w.actors.husband.location = 'wine_shop';
saveState(dir, w);
// 记一条旧事
applyWorldTags(dir, [{ kind:'remember', args:{ text:'那回在雅阁，相公替紫嫣挡了钱通海一记耳光', about:'liuwenxia', visible:'private' } }], { selfId:'husband' });
saveState(dir, loadState(dir));
const llm = { isReady: () => true, complete: async (a) => (a.maxTokens <= 200 ? { text: '[[world:none]]', usage: null } : { text: '【紫嫣】：记得，那回你替我挡了。', usage: null }) };
const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: llm, ttsService:null, visionService:null, dataDir: dir });
const r = await svc.chat({ text: '还记得雅阁那回吗', modality:'text', profileKey:'liuwenxia', roleName:'x', actorId:'liuwenxia' });
console.log('回复:', String(r.reply?.text||'').replace(/\n/g,' / ').slice(0,60));
fs.rmSync(root, { recursive: true, force: true });
'''
open('.tmp_mem2.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_mem2.mjs'], capture_output=True, text=True, encoding='utf-8')
print((out.stdout or '').strip()[-300:])
print('ERR', (out.stderr or '')[-200:])
os.remove('.tmp_mem2.mjs')
