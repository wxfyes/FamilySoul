import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const root = path.join(os.tmpdir(), 'fs-ph2-' + Date.now());
const dir = path.join(root, 'data');
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ family: { husband: { token:'h' }, liuwenxia: { token:'l', actor:'liuwenxia' } } }), 'utf8');
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
let w = loadState(dir);
ensureCities(w);
w.actors.liuwenxia = { id:'liuwenxia', name:'紫嫣', role:'老板娘', gender:'female', home:'wine_shop', location:'tea_house', relations:{husband:{trust:80,desire:60,fear:0,grievance:0}}, schedule:[] };
w.actors.husband.location = 'tea_house';
saveState(dir, w);
let proxySystem = '', proxyUser = '';
const llm = { isReady: () => true, complete: async (a) => {
  if (a.maxTokens === 220) { proxySystem = a.system; proxyUser = a.messages?.[0]?.content || ''; return { text: '雅阁那回我记得，门是我留的。' }; }
  if (a.maxTokens <= 200) return { text: '[[world:none]]' };
  return { text: '【阿吉】：嗯。' };
} };
const svc = new PetService({ rolesManager: { getActiveRole: () => 'x', getRolePersona: () => 'x', listRoles: () => [] }, llmClient: llm, ttsService: null, visionService: null, dataDir: dir });
svc.saveHistory('husband', { messages: [
  { id:'h1', role:'user', text:'紫嫣，雅阁的门我留着了', at: Date.now()-9000 },
  { id:'h2', role:'assistant', text:'【紫嫣】：相公既留着门，妾身就上来。', at: Date.now()-8000 },
], lastUserAt: Date.now(), lastAssistantAt: Date.now() });
const r = await svc.chat({ text: '上次雅阁你对我做了什么还记得不', modality:'text', profileKey:'liuwenxia', roleName:'x', actorId:'liuwenxia' });
fs.writeFileSync('ph2-out.txt', [
  '回复: ' + String(r.reply?.text ?? ''),
  '代演SYSTEM含他账号的对话: ' + (/门我留着/.test(proxySystem) ? '是' : '否'),
  'SYSTEM尾段: ' + proxySystem.slice(-220),
].join('\n'), 'utf8');
fs.rmSync(root, { recursive: true, force: true });
'''
open('.tmp_ph2.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_ph2.mjs'], capture_output=True, text=True, encoding='utf-8')
print('ERR:', out.stderr[:300])
if os.path.exists('ph2-out.txt'):
    print(io.open('ph2-out.txt', encoding='utf-8').read())
    os.remove('ph2-out.txt')
os.remove('.tmp_ph2.mjs')
