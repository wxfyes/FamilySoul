import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
probe = r"""
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir = path.join(os.tmpdir(), 'fs-sp4-' + Date.now());
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
const { applyWorldTags } = await import('./src/world/dispatch.js');
let w = loadState(dir); ensureCities(w); saveState(dir, w);
// 模拟兜底造人
const fresh = [{ name: '柳三娘', role: '婆子' }];
applyWorldTags(dir, fresh.map((f) => ({ kind: 'spawn', args: { name: f.name, role: f.role } })), { selfId: 'liuwenxia' });
w = loadState(dir);
const hit = Object.values(w.actors).find(a => a.name === '柳三娘');
console.log('造人结果:', hit ? `${hit.name}/${hit.role}/@${hit.location}/origin=${hit.origin}` : '失败');
"""
open('.tmp_sp4.mjs','w',encoding='utf-8').write(probe)
r = subprocess.run(['node','.tmp_sp4.mjs'], capture_output=True, text=True, encoding='utf-8')
print((r.stdout or '').strip())
print((r.stderr or '')[-200:])
os.remove('.tmp_sp4.mjs')
