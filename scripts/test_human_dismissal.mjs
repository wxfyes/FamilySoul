import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadState, saveState } from '../src/world/state.js';
import { executeNarrativeTags } from '../src/chat/narrative-engine.js';
import { clearHumanSeen } from '../src/world/presence.js';

console.log('🧪 真人离线时，相公说“走吧”应能让她回家并出提示...');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-humandep-'));
try {
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.copyFileSync('data/world/state.json', path.join(dir, 'world', 'state.json'));
  const w = loadState(dir);
  w.actors.husband.location = 'inn';
  w.actors.zhanjing.location = 'inn';
  w.actors.zhanjing.humanBound = true;
  delete w.actors.zhanjing.awayUntil;
  saveState(dir, w);
  clearHumanSeen('zhanjing');

  const out = executeNarrativeTags({
    dataDir: dir,
    viewerActorId: 'husband',
    sayText: '嗯，走吧',
    replyText: '【发妻·静儿】：“那我走了。”',
  });
  const after = loadState(dir);
  assert.notStrictEqual(after.actors.zhanjing.location, 'inn', '静儿不能还留在原地');
  assert.ok(/告辞|告退|退了出去/.test(String(out.reply || '')), '应出一条离场提示');
  console.log('✅ 真人离线可听命回家，且有提示');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
