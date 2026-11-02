import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const root = path.join(os.tmpdir(), 'fs-spawn-' + Date.now());
const dir = path.join(root, 'data');
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ family: { husband:{token:'h'}, liuwenxia:{token:'l', actor:'liuwenxia'} } }), 'utf8');
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
let w = loadState(dir);
ensureCities(w);
w.actors.liuwenxia = { id:'liuwenxia', name:'紫嫣', role:'老板娘', gender:'female', home:'wine_shop', location:'street', relations:{husband:{trust:80,desire:60,fear:0,grievance:0}}, schedule:[] };
w.actors.aji = { id:'aji', name:'阿吉', role:'跑堂伙计', gender:'male', home:'tea_house', location:'street', schedule:[] };
w.chatPartners = { liuwenxia: 'aji' };
saveState(dir, w);
let call = 0;
const llm = { isReady: () => true, complete: async (a) => {
  call += 1;
  if (a.maxTokens >= 200 && a.maxTokens < 300) return { text: '阿吉：街口那柳三娘，卖花的，人倒是爽利。', usage: null };
  if (a.maxTokens <= 200) return { text: '[[world:spawn name="柳三娘" role="卖花婆子" goals="养大女儿"]]', usage: null };
  return { text: '【阿吉】：街口那柳三娘，卖花的。', usage: null };
}};
const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: llm, ttsService:null, visionService:null, dataDir: dir });
const r = await svc.chat({ text: '阿吉，街上那个卖花的柳三娘是谁？', modality:'text', profileKey:'liuwenxia', roleName:'x', actorId:'liuwenxia' });
await new Promise((r)=>setTimeout(r,2500));
w = loadState(dir);
const npc = Object.values(w.actors).find(a => a.name === '柳三娘');
console.log('回复:', String(r.reply?.text || '').slice(0, 60));
console.log('新人物:', npc ? `${npc.name} / ${npc.role} / ${npc.location} / origin=${npc.origin}` : '（没有生成）');
fs.rmSync(root, { recursive: true, force: true });
'''
open('.tmp_spawn.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_spawn.mjs'], capture_output=True, text=True, encoding='utf-8')
full = (out.stdout or '') + (out.stderr or '')
for line in full.split('\n'):
    if any(k in line for k in ['回复:', '新人物:', 'Spawn', '失败', 'Error']):
        print(line.strip())
os.remove('.tmp_spawn.mjs')
