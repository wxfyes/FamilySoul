import io, os, subprocess, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir = path.join(os.tmpdir(), 'fs-inc-' + Date.now());
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
const { loadState, saveState, ensureCities } = await import('./src/world/state.js');
const { tick } = await import('./src/world/clock.js');
const H = 3600 * 1000;
let w = loadState(dir);
ensureCities(w);
w.clock.day = 1; w.clock.hour = 22;
w.assets.properties = [
  { id:'p1', name:'运河码头三层大酒楼', incomePerDay: 8, keeper:'husband', city:'临江府', staff: 6 },
  { id:'p2', name:'临江茶坊老店', incomePerDay: 1.2, keeper:'husband', city:'临江府', staff: 2 },
];
saveState(dir, w);
const t0 = Date.now();
for (let i = 1; i <= 6; i++) {
  tick(dir, { now: t0 + i * 24 * H, msPerWorldHour: H });
  const s = loadState(dir);
  const inc = (s.assets.properties || []).map((p) => `${p.name.slice(0,4)}:${p.incomePerDay}`).join('  ');
  const city = Object.values(s.cities)[0];
  console.log(`第${s.clock.day}日 ${inc}  民心乱=${city.unrest} 物价=${city.price}`);
}
fs.rmSync(dir, { recursive: true, force: true });
'''
open('.tmp_inc.mjs', 'w', encoding='utf-8').write(probe)
out = subprocess.run(['node', '.tmp_inc.mjs'], capture_output=True, text=True, encoding='utf-8')
print((out.stdout or '').strip())
print('ERR', (out.stderr or '')[-300:])
os.remove('.tmp_inc.mjs')
