import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir = path.join(os.tmpdir(), 'fs-prov-' + Date.now());
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
const { applyWorldTags } = await import('./src/world/dispatch.js');
let w = loadState(dir); ensureCities(w); saveState(dir, w);
const before = JSON.stringify(loadState(dir).bonds.aji?.wangpo || null);
const r = applyWorldTags(dir, [{ kind:'bond', args:{ a:'阿吉', b:'王婆', type:'嫌隙', score:-15 } }], { selfId:'husband' });
w = loadState(dir);
console.log('回执:', r.join(' | '));
console.log('挑唆前:', before);
console.log('挑唆后:', JSON.stringify(w.bonds.aji?.wangpo || null));
console.log('重载后:', JSON.stringify(loadState(dir).bonds.aji?.wangpo || null));
'''
open('.tmp_prov.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_prov.mjs'], capture_output=True, text=True, encoding='utf-8')
print((out.stdout or '').strip())
print('ERR', (out.stderr or '')[-200:])
os.remove('.tmp_prov.mjs')
