import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const root = path.join(os.tmpdir(), 'fs-pp-' + Date.now());
const dir = path.join(root, 'data');
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ family: { husband: { token:'h' }, liuwenxia: { token:'l', actor:'liuwenxia' } } }), 'utf8');
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
let w = loadState(dir);
ensureCities(w);
w.actors.liuwenxia = { id:'liuwenxia', name:'紫嫣', role:'老板娘', gender:'female', home:'wine_shop', location:'tea_house', relations:{husband:{trust:90,desire:70,fear:0,grievance:0}}, schedule:[] };
w.actors.husband.location = 'tea_house';
w.promises = [
  { text:'照顾紫嫣娘俩，但不给名分', due:16, done:false },
  { text:'替紫嫣撑腰，与钱通海掰扯铺子归属', due:17, done:false },
];
w.memories = [{ text:'雅阁里，紫嫣与相公说了半宿私房话，门是相公留的' }]; // 老记忆：无 about
saveState(dir, w);
let proxySystem = '';
const llm = { isReady: () => true, complete: async (a) => {
  if (a.maxTokens >= 200 && a.maxTokens < 300) { proxySystem = a.system; return { text: '雅阁那回我记得。' }; }
  if (a.maxTokens <= 200) return { text: '[[world:none]]' };
  return { text: '【阿吉】：嗯。' };
} };
const svc = new PetService({ rolesManager: { getActiveRole: () => 'x', getRolePersona: () => 'x', listRoles: () => [] }, llmClient: llm, ttsService: null, visionService: null, dataDir: dir });
const r = await svc.chat({ text: '上次雅阁你对我做了什么还记得不', modality:'text', profileKey:'liuwenxia', roleName:'x', actorId:'liuwenxia' });
fs.writeFileSync('pp-out.txt', [
  '回复: ' + String(r.reply?.text ?? ''),
  '含承诺: ' + (/照顾紫嫣|撑腰/.test(proxySystem) ? '是' : '否'),
  '含雅阁记忆: ' + (/半宿私房话/.test(proxySystem) ? '是' : '否'),
].join('\n'), 'utf8');
fs.rmSync(root, { recursive: true, force: true });
'''
open('.tmp_pp.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_pp.mjs'], capture_output=True, text=True, encoding='utf-8')
print('ERR:', out.stderr[:300])
if os.path.exists('pp-out.txt'):
    print(io.open('pp-out.txt', encoding='utf-8').read())
    os.remove('pp-out.txt')
os.remove('.tmp_pp.mjs')
