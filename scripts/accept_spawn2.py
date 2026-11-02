import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir = path.join(os.tmpdir(), 'fs-sp2-' + Date.now());
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
const { applyWorldTags } = await import('./src/world/dispatch.js');
let w = loadState(dir);
ensureCities(w);
saveState(dir, w);
const applied = applyWorldTags(dir, [{ kind: 'spawn', args: { name: '柳三娘', role: '卖花婆子' } }], { selfId: 'husband' });
console.log('回执:', JSON.stringify(applied));
w = loadState(dir);
const hit = Object.values(w.actors).find(a => a.name === '柳三娘');
console.log('找到:', hit ? `${hit.id} ${hit.name} ${hit.role} @${hit.location}` : '无');
console.log('人数:', Object.keys(w.actors).length);
'''
open('.tmp_sp2.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_sp2.mjs'], capture_output=True, text=True, encoding='utf-8')
print((out.stdout or '')[-600:])
print('ERR', (out.stderr or '')[-400:])
os.remove('.tmp_sp2.mjs')
