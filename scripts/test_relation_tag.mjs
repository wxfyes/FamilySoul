import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadState, saveState } from '../src/world/state.js';
import { executeNarrativeTags } from '../src/chat/narrative-engine.js';

console.log('🧪 关系标签必须真的改关系账本，不能只改一句展示...');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-rel-'));
try {
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.copyFileSync('data/world/state.json', path.join(dir, 'world', 'state.json'));
  const w = loadState(dir);
  w.actors.yangcaiyun.name = '柳如烟';
  w.actors.yangcaiyun.relations = { husband: { trust: 70, desire: 50, fear: 0, grievance: 0 } };
  w.actors.husband.location = w.actors.yangcaiyun.location;
  saveState(dir, w);

  const out = executeNarrativeTags({
    dataDir: dir,
    viewerActorId: 'husband',
    sayText: '让我亲一下，抱一抱',
    replyText: '【老板娘·柳如烟】：“相公既这么说，妾身便依你。”[[relation:柳如烟|desire|+5]]',
  });
  assert.ok(!String(out.reply || '').includes('[[relation:'), '标签应被引擎吃掉');
  const after = loadState(dir);
  assert.ok(after.actors.yangcaiyun.relations.husband.desire >= 58, '情愫应至少涨到 58（标签+5，亲密+3或+4）');
  assert.ok(after.actors.yangcaiyun.relations.husband.trust >= 70, '信任不应倒退');
  console.log(`✅ 情愫真涨到 ${after.actors.yangcaiyun.relations.husband.desire}，不再只是台词`);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
