import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { executeNarrativeTags } from '../src/chat/narrative-engine.js';
import { loadState, saveState } from '../src/world/state.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-test-'));
fs.mkdirSync(path.join(tmpDir, 'world'), { recursive: true });
const initState = {
  clock: { day: 23, hour: 1 },
  assets: { silver: 10000, properties: [] },
  actors: { husband: { id: 'husband', name: '王甯' } },
  flags: {},
  ledger: []
};
saveState(tmpDir, initState);

console.log('🧪 1. 模拟买第一条船（120两）...');
let res1 = executeNarrativeTags({
  dataDir: tmpDir, viewerActorId: 'husband', sayText: '买了，120两把运河货船办妥！', replyText: '【提示】买好了。[[pay:置办运河货船|定金=120]]'
});
let s1 = loadState(tmpDir);
assert.strictEqual(s1.assets.silver, 9880, '首次扣120两');
console.log('✅ 首次扣除120两，余 9880 两');

console.log('🧪 2. 方案变动为三条船（273两），必须只补差额 153 两！...');
let res2 = executeNarrativeTags({
  dataDir: tmpDir, viewerActorId: 'husband', sayText: '定下，按273两把三条船办妥！', replyText: '【提示】添两条船。[[pay:置办三条运河货船，连修缮桐油与船工安家月钱|定金=273]]'
});
let s2 = loadState(tmpDir);
assert.strictEqual(s2.assets.silver, 9727, '补差额153两后总扣273两');
console.log('✅ 方案变更补差额 153 两，总计扣 273 两，余 9727 两');

console.log('🧪 3. 方案再变更为大船队四条船（730两），必须只补差额 457 两！...');
let res3 = executeNarrativeTags({
  dataDir: tmpDir, viewerActorId: 'husband', sayText: '拍板了，就按730两置办大船队！', replyText: '【提示】定下船队。[[pay:置办船队：两条大船两条小船并船工|总计=730]]'
});
let s3 = loadState(tmpDir);
assert.strictEqual(s3.assets.silver, 9270, '补差额457两后总扣730两');
console.log('✅ 方案升级补差额 457 两，总计扣 730 两，余 9270 两');

console.log('🧪 4. 再次收到四条船扣款（730两，不同标题），必须 0 差额免扣！...');
let res4 = executeNarrativeTags({
  dataDir: tmpDir, viewerActorId: 'husband', sayText: '定下了，买吧！', replyText: '【提示】船队造册。[[pay:置办船队·四条船并船工|全款=730]]'
});
let s4 = loadState(tmpDir);
assert.strictEqual(s4.assets.silver, 9270, '同类最高预算已覆盖，绝不再扣！');
assert.ok(res4.reply.includes('不再重复扣款') || res4.reply.includes('已包含'), '必须包含免重复扣款提示');
console.log('✅ 相同最高预算再次来袭，成功 0 扣款核销！余额依然保持 9270 两！');

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('🎉 差额覆盖与防重扣铁律全面生效！');

