import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
probe = r"""
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir = path.join(os.tmpdir(), 'fs-sp3-' + Date.now());
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
let w = loadState(dir);
ensureCities(w);
saveState(dir, w);
w = loadState(dir);
console.log('初始人数:', Object.keys(w.actors).length);
"""
open('.tmp_sp3.mjs','w',encoding='utf-8').write(probe)
r = subprocess.run(['node','.tmp_sp3.mjs'], capture_output=True, text=True, encoding='utf-8')
print((r.stdout or '').strip())
os.remove('.tmp_sp3.mjs')
