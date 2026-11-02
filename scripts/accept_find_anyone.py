import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir = path.join(os.tmpdir(), 'fs-find-' + Date.now());
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
const { applySummon } = await import('./src/world/summon.js');
let w = loadState(dir);
ensureCities(w);
w.actors.liuwenxia = { id:'liuwenxia', name:'紫嫣', role:'老板娘', gender:'female', home:'wine_shop', location:'wine_shop', relations:{}, schedule:[] };
w.actors.yujie = { id:'yujie', name:'于子归', role:'工头', gender:'male', home:'street', location:'street', relations:{}, schedule:[] };
w.actors.qiantonghai = { id:'qiantonghai', name:'钱通海', role:'茶行行长', gender:'male', home:'dock', location:'dock', relations:{}, schedule:[] };
w.actors.aji = { id:'aji', name:'阿吉', role:'跑堂', gender:'male', home:'tea_house', location:'tea_house', relations:{}, schedule:[] };
saveState(dir, w);
for (const say of ['去找于子归', '去找钱通海', '去找阿吉', '去找杨采儿']) {
  const before = loadState(dir).actors.liuwenxia.location;
  const r = applySummon(dir, say, '', 'liuwenxia');
  const after = loadState(dir).actors.liuwenxia.location;
  console.log(`${say} → ${before} ⇒ ${after}  (${r ? JSON.stringify(r.visited || r.summoned || r) : '无动作'})`);
}
fs.rmSync(dir, { recursive: true, force: true });
'''
open('.tmp_find.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_find.mjs'], capture_output=True, text=True, encoding='utf-8')
print((out.stdout or '')[-900:])
print('ERR', (out.stderr or '')[-300:])
os.remove('.tmp_find.mjs')
