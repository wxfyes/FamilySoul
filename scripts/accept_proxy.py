import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const root = path.join(os.tmpdir(), 'fs-proxy-' + Date.now());
const dir = path.join(root, 'data');
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ family: { husband: { token:'h' }, liuwenxia: { token:'l', actor:'liuwenxia' } } }), 'utf8');
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
let w = loadState(dir);
ensureCities(w);
w.actors.liuwenxia = { id:'liuwenxia', name:'紫嫣', role:'老板娘', gender:'female', home:'wine_shop', location:'tea_house', relations:{husband:{trust:20,desire:10,fear:0,grievance:0}}, schedule:[] };
w.actors.husband.location = 'tea_house';
w.memories = [{ text: '王甯答应过给紫嫣留雅阁的门' }];
saveState(dir, w);
const calls = [];
const llm = { isReady: () => true, complete: async (a) => {
  calls.push(a.maxTokens);
  if (a.maxTokens <= 200) return { text: '我在这儿。你要的东西我留着，没给别人。', usage: null };
  return { text: '（屋里一时没人应声。）', usage: null };
}};
const svc = new PetService({ rolesManager: { getActiveRole: () => 'x', getRolePersona: () => 'x', listRoles: () => [] }, llmClient: llm, ttsService: null, visionService: null, dataDir: dir });
const r = await svc.chat({ text: '王甯出来', modality:'text', profileKey:'liuwenxia', roleName:'x', actorId:'liuwenxia' });
fs.writeFileSync('proxy-out.txt', [
  '调用次数: ' + calls.length + '  tokens设定: ' + JSON.stringify(calls),
  '回复: ' + String(r.reply?.text ?? ''),
].join('\n'), 'utf8');
fs.rmSync(root, { recursive: true, force: true });
'''
open('.tmp_proxy.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_proxy.mjs'], capture_output=True, text=True, encoding='utf-8')
print('ERR:', out.stderr[:400])
if os.path.exists('proxy-out.txt'):
    print(io.open('proxy-out.txt', encoding='utf-8').read())
    os.remove('proxy-out.txt')
os.remove('.tmp_proxy.mjs')
