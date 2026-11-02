import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const root = path.join(os.tmpdir(), 'fs-bat-' + Date.now());
const dir = path.join(root, 'data');
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ family: { husband:{token:'h'}, liuwenxia:{token:'l', actor:'liuwenxia'} } }), 'utf8');
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
let w = loadState(dir);
ensureCities(w);
w.actors.liuwenxia = { id:'liuwenxia', name:'紫嫣', role:'老板娘', gender:'female', home:'wine_shop', location:'tea_house', relations:{husband:{trust:100,desire:63,fear:0,grievance:0}}, schedule:[] };
w.actors.yujie = { id:'yujie', name:'于子归', role:'工头', gender:'male', home:'wine_shop', location:'street', relations:{}, schedule:[] };
w.actors.husband.location = 'tea_house';
saveState(dir, w);

const cases = [
  ['我喜欢你', '我心里装着于杰，不能给你别的应承。', '关系错位应被拦'],
  ['你喜欢我吗', '婉儿前几日还问我这话呢。', '提婉儿应被删'],
  ['你借我20两', '我亲手把20两交到你手上了。', '无借贷应被拦'],
  ['我喜欢你', '这话我记下了。', '正常应保留'],
];
const out = [];
for (const [said, modelSays, expect] of cases) {
  const llm = { isReady: () => true, complete: async (a) => {
    if (a.maxTokens >= 200 && a.maxTokens < 300) return { text: modelSays, usage: null };
    if (a.maxTokens <= 200) return { text: '[[world:none]]' };
    return { text: '【阿吉】：嗯。' };
  }};
  const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: llm, ttsService:null, visionService:null, dataDir: dir });
  const r = await svc.chat({ text: said, modality:'text', profileKey:'liuwenxia', roleName:'x', actorId:'liuwenxia' });
  out.push(`[${expect}] 模型：${modelSays}\n  → ${String(r.reply?.text || '').replace(/\n/g, ' / ')}`);
}
fs.writeFileSync('bat-out.txt', out.join('\n\n'), 'utf8');
fs.rmSync(root, { recursive: true, force: true });
'''
open('.tmp_bat.mjs', 'w', encoding='utf-8').write(probe)
r = subprocess.run(['node', '.tmp_bat.mjs'], capture_output=True, text=True, encoding='utf-8')
print('ERR:', r.stderr[:300])
if os.path.exists('bat-out.txt'):
    print(io.open('bat-out.txt', encoding='utf-8').read())
    os.remove('bat-out.txt')
os.remove('.tmp_bat.mjs')
