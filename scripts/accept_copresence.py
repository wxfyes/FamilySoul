import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const root = path.join(os.tmpdir(), 'fs-cop-' + Date.now());
const dir = path.join(root, 'data');
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
// 两个真人账号：紫嫣(liuwenxia) 与 苏慕雪(yangcaiyun)，同一地点
fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({
  family: {
    husband: { token: 't_h', title: '温柔小娘子' },
    liuwenxia: { token: 't_l', title: '紫嫣', actor: 'liuwenxia' },
    yangcaiyun: { token: 't_y', title: '苏慕雪', actor: 'yangcaiyun' },
  },
}), 'utf8');
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
let w = loadState(dir);
ensureCities(w);
w.actors.liuwenxia = { id:'liuwenxia', name:'紫嫣', role:'老板娘', gender:'female', home:'wine_shop', location:'tea_house', relations:{husband:{trust:20,desire:10,fear:0,grievance:0}}, schedule:[] };
w.actors.yangcaiyun = { id:'yangcaiyun', name:'苏慕雪', role:'货栈老板娘', gender:'female', home:'goods_shop', location:'tea_house', relations:{husband:{trust:20,desire:10,fear:0,grievance:0}}, schedule:[] };
w.actors.husband.location = 'tea_house';
saveState(dir, w);
const llm = { isReady: () => true, complete: async (a) => (a.maxTokens <= 200 ? { text: '[[world:none]]', usage: null } : { text: '【阿吉】：两位娘子稍坐。', usage: null }) };
const svc = new PetService({ rolesManager: { getActiveRole: () => 'x', getRolePersona: () => 'x', listRoles: () => [] }, llmClient: llm, ttsService: null, visionService: null, dataDir: dir });
svc.saveHistory('yangcaiyun', { messages: [], lastUserAt: 0, lastAssistantAt: 0 });
await svc.chat({ text: '慕雪，你也在这儿？', modality:'text', profileKey:'liuwenxia', roleName:'x', actorId:'liuwenxia' });
const h = svc.readHistory('yangcaiyun');
const w2 = loadState(dir);
fs.writeFileSync('cop-out.txt', [
  '苏慕雪的记录里有没有紫嫣的话: ' + (h.messages || []).some(m => String(m.text).includes('慕雪，你也在这儿')),
  '推送给苏慕雪的条目: ' + (w2.proactive || []).filter(p => p.to === 'yangcaiyun').length,
  '场景里存的条数: ' + JSON.stringify((JSON.parse(fs.readFileSync(path.join(dir,'world','scenes.json'),'utf8'))||{})).length,
].join('\n'), 'utf8');
fs.rmSync(root, { recursive: true, force: true });
'''
open('.tmp_cop.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_cop.mjs'], capture_output=True, text=True, encoding='utf-8')
print('ERR:', out.stderr[:400])
if os.path.exists('cop-out.txt'):
    print(io.open('cop-out.txt', encoding='utf-8').read())
    os.remove('cop-out.txt')
os.remove('.tmp_cop.mjs')
