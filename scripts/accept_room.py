import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir = path.join(os.tmpdir(), 'fs-room-' + Date.now());
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
const { applySummon } = await import('./src/world/summon.js');
let w = loadState(dir);
ensureCities(w);
w.actors.husband.location = 'tea_house';
saveState(dir, w);
for (const say of ['去我房间', '回房', '都去我房间']) {
  const r = applySummon(dir, say, '', 'husband');
  const s = loadState(dir);
  console.log(`${say} → ${s.actors.husband.location} (${s.places[s.actors.husband.location]?.name})`);
}
fs.rmSync(dir, { recursive: true, force: true });
'''
open('.tmp_room.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_room.mjs'], capture_output=True, text=True, encoding='utf-8')
print((out.stdout or '').strip())
print('ERR', (out.stderr or '')[-200:])
os.remove('.tmp_room.mjs')
