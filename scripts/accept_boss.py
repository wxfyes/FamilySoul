import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const dir = path.join(os.tmpdir(), 'fs-boss-' + Date.now());
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
let w = loadState(dir);
ensureCities(w);
w.actors.liuwenxia = w.actors.liuwenxia || { id:'liuwenxia', name:'紫嫣', role:'于家酒肆老板娘', gender:'female', home:'wine_shop', location:'tea_house', relations:{husband:{trust:20,desire:10,fear:0,grievance:0}}, schedule:[] };
w.actors.liuwenxia.location = 'tea_house';
w.actors.husband.location = 'tea_house';
if (!w.assets.properties.some(p=>p.id==='wine_shop')) w.assets.properties.push({ id:'wine_shop', name:'于家酒肆', status:'正常营业', incomePerDay:1.1, keeper:'liuwenxia', owner:'liuwenxia' });
saveState(dir, w);
const reply = '【临江茶坊·阿吉】：掌柜的在楼上忙，您先坐。\n【王甯】：（下楼）紫嫣，你来了。';
const llm = { isReady: () => true, complete: async (a) => (a.maxTokens <= 200 ? { text: '[[world:none]]', usage: null } : { text: reply, usage: null }) };
const svc = new PetService({ rolesManager: { getActiveRole: () => 'x', getRolePersona: () => 'x', listRoles: () => [] }, llmClient: llm, ttsService: null, visionService: null, dataDir: dir });
const r = await svc.chat({ text: '找王掌柜', modality:'text', profileKey:'liuwenxia', roleName:'x', actorId:'liuwenxia' });
fs.writeFileSync('boss-out.txt', String(r.reply?.text ?? ''), 'utf8');
fs.rmSync(dir, { recursive: true, force: true });
'''
open('.tmp_boss.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_boss.mjs'], capture_output=True, text=True, encoding='utf-8')
print('ERR:', out.stderr[:300])
if os.path.exists('boss-out.txt'):
    print('回复:', io.open('boss-out.txt', encoding='utf-8').read())
    os.remove('boss-out.txt')
os.remove('.tmp_boss.mjs')
