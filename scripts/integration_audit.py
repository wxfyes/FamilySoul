import io, os, subprocess, sys, json
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

probe = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir = path.join(os.tmpdir(), 'fs-int-' + Date.now());
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
const { loadState, saveState, ensureCities, ensureCourt } = await import('./src/world/state.js');
const { tick } = await import('./src/world/clock.js');
const { auditAll, auditBonds } = await import('./src/world/audit.js');
const H = 3600 * 1000;

let w = loadState(dir);
ensureCities(w); ensureCourt(w);
saveState(dir, w);

// 给一点启动资源
w = loadState(dir);
w.assets.silver = 400;
w.military = { army: 60, militia: 10, guards: 5, supplies: 60, morale: 60, quality: 20, training: 20 };
saveState(dir, w);

const t0 = Date.now();
const DAYS = 120;
let lastDay = 0;
for (let d = 1; d <= DAYS; d += 1) {
  tick(dir, { now: t0 + d * 24 * H, msPerWorldHour: H });
}

w = loadState(dir);
const out = {};
out.day = w.clock.day;
out.actors = Object.keys(w.actors || {}).length;
out.spawned = Object.values(w.actors).filter(a => a.origin === 'spawned').length;
out.bonds = (() => { let n = 0; const seen = new Set(); for (const [a, m] of Object.entries(w.bonds||{})) for (const b of Object.keys(m||{})) { const k = a<b?a+'|'+b:b+'|'+a; if (!seen.has(k)) { seen.add(k); n++; } } return n; })();
out.bondIssues = auditBonds(w).length;
out.rumors = (w.rumors || []).length;
out.rumorHeard = (w.rumors || []).reduce((s, r) => s + (r.heardBy || []).length, 0);
out.cases = (w.cases || []).length;
out.casesJudged = (w.cases || []).filter(c => c.status === 'judged').length;
out.casesPending = (w.cases || []).filter(c => c.status !== 'judged').length;
out.memorials = (w.memorials || []).length;
out.memorialsResolved = (w.memorials || []).filter(m => m.status !== 'pending').length;
out.vacantOffices = Object.values(w.court?.offices || {}).filter(o => o && o.vacant).length;
out.counties = Object.keys(w.actors || {}).filter(k => k.startsWith('county_')).length;
out.guilds = Object.keys(w.guilds || {}).length;
out.foreign = Object.keys(w.foreign || {}).length;
out.treasury = Math.round(Number(w.court?.treasury?.silver) || 0);
out.grain = Math.round(Number(w.court?.treasury?.grain) || 0);
out.treasuryNegative = (Number(w.court?.treasury?.silver) || 0) < 0;
out.history = (w.history || []).length;
out.appointments = (w.recentEvents || []).filter(e => (e.action || '') === 'appoint' || /补.*缺/.test(String(e.text || e.payload?.text || ''))).length;
out.exams = (w.recentEvents || []).filter(e => (e.action || '') === 'exam').length;
out.badLocations = Object.values(w.actors).filter(a => a && !a.dead && a.location && !w.places?.[a.location]).length;
const audit = auditAll(w);
out.ledgerIssues = audit.ledger.length;
out.memoryIssues = audit.memory.length;
out.ownershipIssues = audit.ownership.length;
out.jailed = Object.values(w.actors).filter(a => a && a.jailed).length;
out.studyActors = Object.values(w.actors).filter(a => a && Number(a.study) > 0).length;
out.ranks = Object.values(w.actors).filter(a => a && a.rank).length;
console.log('RESULT ' + JSON.stringify(out));
fs.rmSync(dir, { recursive: true, force: true });
'''
open('.tmp_int.mjs', 'w', encoding='utf-8').write(probe)
r = subprocess.run(['node', '.tmp_int.mjs'], capture_output=True, text=True, encoding='utf-8')
full = (r.stdout or '') + (r.stderr or '')
for line in full.split('\n'):
    if line.startswith('RESULT '):
        data = json.loads(line[len('RESULT '):])
        for k, v in data.items():
            print(f'{k:18} {v}')
        break
else:
    print('FAILED')
    print(full[-2000:])
os.remove('.tmp_int.mjs')
