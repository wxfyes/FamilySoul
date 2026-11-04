HEAD = r'''
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
'''


TAIL = r'''
fs.rmSync(root, { recursive: true, force: true });
'''



print(HEAD[:0])
