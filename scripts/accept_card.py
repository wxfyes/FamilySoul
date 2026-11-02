import io, os, subprocess, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const dir = path.join(os.tmpdir(), 'fs-accept-' + Date.now());
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
const { loadState, saveState, ensureCities, ensureCourt } = await import('./src/world/state.js');
let w = loadState(dir);
ensureCities(w); ensureCourt(w);
w.actors.liuwenxia = w.actors.liuwenxia || { id:'liuwenxia', name:'紫嫣', role:'于家酒肆老板娘', gender:'female', home:'wine_shop', location:'wine_shop', relations:{husband:{trust:20,desire:10,fear:0,grievance:0}}, schedule:[] };
w.actors.liuwenxia.location = 'wine_shop';
w.actors.husband.location = 'tea_house';
if (!w.assets.properties.some(p=>p.id==='wine_shop')) w.assets.properties.push({ id:'wine_shop', name:'于家酒肆', status:'正常营业', incomePerDay:1.1, keeper:'liuwenxia', owner:'liuwenxia' });
w.wallets = { liuwenxia: 3.3 };
saveState(dir, w);
let sys = '';
const llm = { isReady: () => true, complete: async (a) => { if (a.maxTokens <= 200) return { text: '[[world:none]]', usage: null }; sys = a.system || ''; return { text: '【旁白】：嗯。', usage: null }; } };
const svc = new PetService({ rolesManager: { getActiveRole: () => 'x', getRolePersona: () => 'x', listRoles: () => [] }, llmClient: llm, ttsService: null, visionService: null, dataDir: dir });
await svc.chat({ text: '我铺子今天进多少', modality:'text', profileKey:'liuwenxia', roleName:'x', actorId:'liuwenxia' });
fs.writeFileSync('accept-out.txt', [
  'cardOk=' + (sys.includes('【你是谁】') && sys.includes('于家酒肆') && sys.includes('1.10两')),
  'hasGlobal=' + (sys.includes('【朝中】') || sys.includes('【天下】')),
  'sysLen=' + sys.length,
  '---preview---',
  sys.slice(0, 500),
].join('\n'), 'utf8');
fs.rmSync(dir, { recursive: true, force: true });
'''
open('.tmp_accept.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_accept.mjs'], capture_output=True, text=True, encoding='utf-8')
print('STDOUT:', out.stdout[:300])
print('STDERR:', out.stderr[:400])
if os.path.exists('accept-out.txt'):
    print(io.open('accept-out.txt', encoding='utf-8').read())
    os.remove('accept-out.txt')
os.remove('.tmp_accept.mjs')
