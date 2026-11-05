/**
 * 一次性修档：把"房间里又长出房间"的野地点清掉，并报告世界有多大。
 *
 * 用法（先停服）：
 *   cd /opt/familysoul && ./stop.sh && node scripts/prune-state.mjs && ./start.sh
 */
import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2] || path.join('data', 'world', 'state.json');
if (!fs.existsSync(file)) {
  console.error('找不到', file);
  process.exit(1);
}

const before = fs.statSync(file).size;
console.log('修档前:', file, (before / 1024 / 1024).toFixed(1), 'MB');

const raw = fs.readFileSync(file, 'utf8');
const world = JSON.parse(raw);
const places = world.places || {};
const total = Object.keys(places).length;

let removedDeep = 0;
for (const pid of Object.keys(places)) {
  if ((String(pid).match(/__/g) || []).length >= 2) {
    delete places[pid];
    removedDeep += 1;
  }
}

let removedDangling = 0;
for (const p of Object.values(places)) {
  if (!p || !p.rooms) continue;
  for (const [k, r] of Object.entries(p.rooms)) {
    if (!r || !r.id || !places[r.id]) {
      delete p.rooms[k];
      removedDangling += 1;
    }
  }
}

// 兜底：地点还是超过 3000，只留下有 parent 的自家院子与有人的地点
let removedBulk = 0;
if (Object.keys(places).length > 3000) {
  const occupied = new Set(Object.values(world.actors || {}).map((a) => a && a.location).filter(Boolean));
  for (const [pid, p] of Object.entries(places)) {
    if (p && p.parent) continue;
    if (pid === 'street' || occupied.has(pid)) continue;
    delete places[pid];
    removedBulk += 1;
  }
}

fs.writeFileSync(file, JSON.stringify(world));
const after = fs.statSync(file).size;

console.log('地点总数:', total, '→', Object.keys(places).length);
console.log('清掉：深两层', removedDeep, '｜空账院子', removedDangling, '｜过量地点', removedBulk);
console.log('修档后:', (after / 1024 / 1024).toFixed(1), 'MB');
