import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadState, saveState } from '../src/world/state.js';
import { executeNarrativeTags } from '../src/chat/narrative-engine.js';

console.log('🧪 “婉儿芸娘都回家吧”必须两个都真走，并出提示...');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-multidep-'));
try {
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.copyFileSync('data/world/state.json', path.join(dir, 'world', 'state.json'));
  const w = loadState(dir);
  w.actors.husband.location = 'inn';
  for (const id of ['waner', 'yunnia']) {
    if (w.actors[id]) {
      w.actors[id].location = 'inn';
      delete w.actors[id].awayUntil;
    }
  }
  saveState(dir, w);

  const out = executeNarrativeTags({
    dataDir: dir,
    viewerActorId: 'husband',
    sayText: '婉儿芸娘都回家吧',
    replyText: '【正妻·婉儿】：“是，相公。”\n【侧妾·芸娘】：“妾身这就回去。”',
  });
  const after = loadState(dir);
  console.log('after=', after.actors.waner.location, after.actors.yunnia.location, 'reply=', String(out.reply || '').slice(0, 120));
  assert.strictEqual(after.actors.waner.location, 'husband_room', '婉儿应回正房');
  assert.strictEqual(after.actors.yunnia.location, 'wang_mansion_west', '芸娘应回西厢');
  assert.ok(String(out.reply || '').includes('应声告退'), '应出一条离场提示');
  console.log('✅ 两人都真走了，且有提示');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
