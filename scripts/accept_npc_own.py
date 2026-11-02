import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const root = path.join(os.tmpdir(), 'fs-own-' + Date.now());
const dir = path.join(root, 'data');
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ family: { husband:{token:'h'}, liuwenxia:{token:'l', actor:'liuwenxia'} } }), 'utf8');
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
let w = loadState(dir);
ensureCities(w);
w.actors.liuwenxia = { id:'liuwenxia', name:'紫嫣', role:'老板娘', gender:'female', home:'wine_shop', location:'street', relations:{husband:{trust:80,desire:60,fear:0,grievance:0}}, schedule:[] };
w.actors.aji = { id:'aji', name:'阿吉', role:'跑堂', gender:'male', home:'tea_house', location:'street', schedule:[] };
w.npcArcs = { aji: { lastStep: '茶坊后灶台塌了半边，午市正忙', day: 15 } };
w.chatPartners = { liuwenxia: 'aji' };
saveState(dir, w);
let sysText = '';
const llm = { isReady: () => true, complete: async (a) => {
  if (a.messages && a.messages[0] && String(a.messages[0].content || '').includes('紫嫣') && a.maxTokens > 600) sysText = String(a.system || '');
  if (a.maxTokens === 160) return { text: '灶台塌了，正愁着呢。', usage: null };
  if (a.maxTokens <= 200) return { text: '[[world:none]]', usage: null };
  return { text: '【阿吉】：嗯。', usage: null };
}};
const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: llm, ttsService:null, visionService:null, dataDir: dir });
await svc.chat({ text: '阿吉，今日怎么了', modality:'text', profileKey:'liuwenxia', roleName:'x', actorId:'liuwenxia' });
console.log('上下文含"各自正碰上":', /各自正碰上/.test(sysText) ? '是' : '否');
fs.rmSync(root, { recursive: true, force: true });
'''
open('.tmp_own.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_own.mjs'], capture_output=True, text=True, encoding='utf-8')
print((out.stdout or '').strip()[-300:])
print('ERR', (out.stderr or '')[-200:])
os.remove('.tmp_own.mjs')
