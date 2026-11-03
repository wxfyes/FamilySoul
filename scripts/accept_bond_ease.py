import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir = path.join(os.tmpdir(), 'fs-ease2-' + Date.now());
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
const { applyWorldTags } = await import('./src/world/dispatch.js');
let w = loadState(dir); ensureCities(w); saveState(dir, w);
w = loadState(dir);
console.log('化解前:', JSON.stringify(w.bonds.waner?.yunnia));
applyWorldTags(dir, [{ kind:'relation', args:{ who:'waner', field:'grievance', delta:-30 } }], { selfId:'husband' });
w = loadState(dir);
console.log('化解后:', JSON.stringify(w.bonds.waner?.yunnia));
'''
open('.tmp_ease2.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_ease2.mjs'], capture_output=True, text=True, encoding='utf-8')
print((out.stdout or '').strip())
print('ERR', (out.stderr or '')[-200:])
os.remove('.tmp_ease2.mjs')
