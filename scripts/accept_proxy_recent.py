import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const root = path.join(os.tmpdir(), 'fs-pr-' + Date.now());
const dir = path.join(root, 'data');
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ family: { husband: { token:'h' }, liuwenxia: { token:'l', actor:'liuwenxia' } } }), 'utf8');
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
let w = loadState(dir);
ensureCities(w);
w.actors.liuwenxia = { id:'liuwenxia', name:'紫嫣', role:'老板娘', gender:'female', home:'wine_shop', location:'tea_house', relations:{husband:{trust:80,desire:60,fear:0,grievance:0}}, schedule:[] };
w.actors.husband.location = 'tea_house';
w.memories = [{ text:'雅阁那回，相公与紫嫣在里头待了半个时辰，门是她亲手掩的' }];
saveState(dir, w);
let proxyUser = '', proxySystem = '';
const llm = { isReady: () => true, complete: async (a) => {
  if (a.maxTokens === 220) { proxySystem = a.system; proxyUser = a.messages?.[0]?.content || ''; return { text: '雅阁那回我记得，不必你提醒。', usage: null }; }
  if (a.maxTokens <= 200) return { text: '[[world:none]]', usage: null };
  return { text: '【阿吉】：娘子稍坐。', usage: null };
}};
const svc = new PetService({ rolesManager: { getActiveRole: () => 'x', getRolePersona: () => 'x', listRoles: () => [] }, llmClient: llm, ttsService: null, visionService: null, dataDir: dir });
svc.saveHistory('liuwenxia', { messages: [
  { id:'1', role:'user', text:'你明知故问，雅阁的事？', at: Date.now()-4000 },
  { id:'2', role:'assistant', text:'【王甯】：雅阁里我确实不在。', at: Date.now()-3000 },
], lastUserAt: Date.now(), lastAssistantAt: Date.now() });
const r = await svc.chat({ text: '你对我做了什么', modality:'text', profileKey:'liuwenxia', roleName:'x', actorId:'liuwenxia' });
fs.writeFileSync('pr-out.txt', [
  '回复: ' + String(r.reply?.text ?? ''),
  '传了刚才的对话: ' + (/雅阁的事/.test(proxyUser) ? '是' : '否'),
  '记忆含雅阁: ' + (/雅阁那回/.test(proxySystem) ? '是' : '否'),
  'USER片段: ' + proxyUser.slice(0, 220),
].join('\n'), 'utf8');
fs.rmSync(root, { recursive: true, force: true });
'''
open('.tmp_pr.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_pr.mjs'], capture_output=True, text=True, encoding='utf-8')
print('ERR:', out.stderr[:300])
if os.path.exists('pr-out.txt'):
    print(io.open('pr-out.txt', encoding='utf-8').read())
    os.remove('pr-out.txt')
os.remove('.tmp_pr.mjs')
