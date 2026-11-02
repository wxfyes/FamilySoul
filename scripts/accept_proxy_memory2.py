import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const root = path.join(os.tmpdir(), 'fs-pm2-' + Date.now());
const dir = path.join(root, 'data');
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ family: { husband: { token:'h' }, liuwenxia: { token:'l', actor:'liuwenxia' } } }), 'utf8');
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
let w = loadState(dir);
ensureCities(w);
w.actors.liuwenxia = { id:'liuwenxia', name:'紫嫣', role:'老板娘', gender:'female', home:'wine_shop', location:'tea_house', relations:{husband:{trust:80,desire:60,fear:0,grievance:0}}, schedule:[] };
w.actors.husband.location = 'tea_house';
w.appointments = [{ name:'紫嫣', day:24, hour:12, text:'提两坛新酿茶酒样到雅阁，谈城南酒肆供价', actorId:'liuwenxia' }];
w.memories = [{ text:'王甯与紫嫣在雅阁私下见过一面，留了门' }];
saveState(dir, w);
let proxySystem = '', proxyUser = '';
const llm = { isReady: () => true, complete: async (a) => {
  if (a.maxTokens === 160) { proxySystem = a.system; proxyUser = a.messages?.[0]?.content || ''; return { text: '（放下茶样）雅阁那事我记得。', usage: null }; }
  if (a.maxTokens <= 200) return { text: '[[world:none]]', usage: null };
  return { text: '【阿吉】：娘子稍坐。', usage: null };
}};
const svc = new PetService({ rolesManager: { getActiveRole: () => 'x', getRolePersona: () => 'x', listRoles: () => [] }, llmClient: llm, ttsService: null, visionService: null, dataDir: dir });
const r = await svc.chat({ text: '王甯，雅阁的事你还记得吗', modality:'text', profileKey:'liuwenxia', roleName:'x', actorId:'liuwenxia' });
fs.writeFileSync('pm2-out.txt', [
  '回复: ' + String(r.reply?.text ?? ''),
  '代演提示含雅阁约定: ' + (/雅阁/.test(proxySystem) ? '是' : '否'),
  '代演提示含你们记忆: ' + (/雅阁私下见过/.test(proxySystem) ? '是' : '否'),
  'SYSTEM片段: ' + proxySystem.slice(-260),
].join('\n'), 'utf8');
fs.rmSync(root, { recursive: true, force: true });
'''
open('.tmp_pm2.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_pm2.mjs'], capture_output=True, text=True, encoding='utf-8')
print('ERR:', out.stderr[:300])
if os.path.exists('pm2-out.txt'):
    print(io.open('pm2-out.txt', encoding='utf-8').read())
    os.remove('pm2-out.txt')
os.remove('.tmp_pm2.mjs')
