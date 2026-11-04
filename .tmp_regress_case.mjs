
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const root = path.join(os.tmpdir(), 'fs-reg-' + Date.now());
const dir = path.join(root, 'data');
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ family: { husband:{token:'h'}, liuwenxia:{token:'l', actor:'liuwenxia'} } }), 'utf8');
const { loadState, saveState, ensureCities, ensureCourt } = await import('./src/world/state.js');
const { applyWorldTags } = await import('./src/world/dispatch.js');
const { tick } = await import('./src/world/clock.js');
let w = loadState(dir); ensureCities(w); ensureCourt(w);
w.actors.liuwenxia = { id:'liuwenxia', name:'紫嫣', role:'老板娘', gender:'female', home:'wine_shop', location:'street', relations:{husband:{trust:80,desire:60,fear:0,grievance:0}}, schedule:[] };
w.actors.husband.location = 'tea_house';
w.assets.silver = 300;
w.assets.properties = [{ id:'p1', name:'运河码头三层大酒楼', incomePerDay: 8, keeper:'husband', city:'临江府', staff: 3 }];
saveState(dir, w);
const mkLlm = (reply='【阿吉】：嗯。', proxy='') => ({ isReady: () => true, complete: async (a) => {
  if (proxy && a.maxTokens >= 150 && a.maxTokens <= 300) return { text: proxy, usage: null };
  if (a.maxTokens <= 200) return { text: '[[world:none]]', usage: null };
  return { text: reply, usage: null };
}});

w.actors.suniang = { id:'suniang', name:'苏娘', role:'绣坊寡妇', gender:'female', home:'street', location:'street', relations:{husband:{trust:18}}, schedule:[] };
w.actors.husband.location = 'tea_house';
saveState(dir, w);
const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: mkLlm('【苏娘】：在呢。'), ttsService:null, visionService:null, dataDir: dir });
const r = await svc.chat({ text: '苏娘', modality:'text', profileKey:'husband', roleName:'x', actorId:null });
const t = String(r.reply?.text||'');
console.log(t && t !== '……' && t.includes('苏娘') ? 'PASS' : 'FAIL ' + t.slice(0, 30));

fs.rmSync(root, { recursive: true, force: true });
