import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadState, saveState } from '../src/world/state.js';
import { executeNarrativeTags } from '../src/chat/narrative-engine.js';

console.log('🧪 同一处产业同一天只按总预算扣一次，后续报价只补差额...');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-projectpay-'));
try {
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.copyFileSync('data/world/state.json', path.join(dir, 'world', 'state.json'));
  const w = loadState(dir);
  w.actors.husband.location = 'husband_room';
  w.assets.silver = 2000;
  saveState(dir, w);

  executeNarrativeTags({ dataDir: dir, viewerActorId: 'husband', sayText: '开鑫雅阁', replyText: '好。[[pay:鑫雅阁开张|开张=600]]' });
  const mid = loadState(dir);
  assert.strictEqual(mid.assets.silver, 1400, '首次应扣 600');

  executeNarrativeTags({ dataDir: dir, viewerActorId: 'husband', sayText: '再算算', replyText: '铺面与置办合计。[[pay:鑫雅阁盘铺与置办|置办=200]]' });
  const after = loadState(dir);
  assert.strictEqual(after.assets.silver, 1400, '同一产业同一天不得再扣 200');
  console.log('✅ 只扣 600，没有重复扣');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
