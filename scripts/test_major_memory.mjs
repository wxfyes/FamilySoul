import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadState, saveState } from '../src/world/state.js';
import { executeNarrativeTags } from '../src/chat/narrative-engine.js';

console.log('🧪 送官/判案这类大事，模型忘写标签也要落记忆...');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-majormem-'));
try {
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.copyFileSync('data/world/state.json', path.join(dir, 'world', 'state.json'));
  const w = loadState(dir);
  w.actors.zhai_test = { id: 'zhai_test', name: '翟管事', role: '翟家管事', location: 'goods_shop', home: 'goods_shop' };
  w.actors.husband.location = 'goods_shop';
  saveState(dir, w);

  executeNarrativeTags({
    dataDir: dir,
    viewerActorId: 'husband',
    sayText: '把翟管事送衙门',
    replyText: '【翟管事】：“东家，小的冤枉！”（两名护院把翟管事押去了衙门。）',
  });
  const after = loadState(dir);
  const mem = (after.memories || []).find((m) => String(m.text || '').includes('翟管事') && String(m.text || '').includes('衙门'));
  assert.ok(mem, '重大事件应自动写入长期记忆');
  assert.ok((mem.about || []).includes('zhai_test'), '记忆 about 必须包含当事人');
  console.log('✅ 事件已落记忆，老板娘/翟管事以后能召回');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
