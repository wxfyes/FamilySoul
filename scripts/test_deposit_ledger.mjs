import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { applyStatedDeposit } from '../src/chat/dialogue-postprocess.js';
import { loadState, saveState } from '../src/world/state.js';

console.log('🧪 运行定金收条真实落账与流水幂等回归测试...');

const testDataDir = path.resolve('tmp_test_deposit');
fs.mkdirSync(testDataDir, { recursive: true });

try {
  const initialWorld = {
    clock: { day: 20, hour: 15 },
    assets: { silver: 100 },
    ledger: [],
  };
  saveState(testDataDir, initialWorld);

  const prevText = '东家来了！扬州盐帮汪总商派了管事送定金上门，足五十两纹银，包下三层天字阁给汪老夫人办七十大寿，日子定在这个月十八，这是定金收条，请东家过目。';
  const userText = '好的';

  // 1. 首次批复定金收条
  const res1 = applyStatedDeposit(userText, prevText, { dataDir: testDataDir });
  assert.strictEqual(res1.length, 1, '首次批复应成功落账');
  assert.strictEqual(res1[0].includes('50两'), true);

  const after1 = loadState(testDataDir);
  assert.strictEqual(after1.assets.silver, 150, '公账现银必须从 100 增至 150');
  assert.strictEqual(after1.ledger.length, 1, '流水账必须新增 1 笔记录');
  assert.strictEqual(after1.ledger[0].delta, 50);
  assert.strictEqual(after1.ledger[0].title, '运河大酒楼·汪总商寿宴定金');

  // 2. 幂等测试：连续回复或重试，不应重复入账
  const res2 = applyStatedDeposit(userText, prevText, { dataDir: testDataDir });
  assert.strictEqual(res2.length, 0, '同一天同一笔定金不应重复落账');

  const after2 = loadState(testDataDir);
  assert.strictEqual(after2.assets.silver, 150, '公账现银应保持 150，不得重复增加');
  assert.strictEqual(after2.ledger.length, 1, '流水账依然只有 1 笔');

  // 3. 商单尾款 110 两确认并立下债权字据
  const prevTextBalance = '东家算得明白，正是如此。一百六十两的席面钱，扣去先收的五十两定金，汪家那头还欠咱们一百一十两。小的已跟汪府管事说定，席面办罢当日结清余款。';
  const userTextBalance = '成，办妥结清';
  applyStatedDeposit(userTextBalance, prevTextBalance, { dataDir: testDataDir });

  const after3 = loadState(testDataDir);
  const balPromise = (after3.promises || []).find((p) => p && p.orderBalance === 110);
  assert.ok(balPromise, '必须在契据账本生成 110 两商单尾款记录');
  assert.strictEqual(balPromise.orderBalance, 110);
  assert.strictEqual(balPromise.done, false);
  // 尾款只是债权，绝不能当定金再收一次
  assert.strictEqual(after3.assets.silver, 150, '尾款 110 两不得提前入现银');
  assert.strictEqual(after3.ledger.length, 1, '尾款不得新增定金流水');

  console.log('✅ 定金真实落账入库与尾款债权字据测试全部通过！');
} finally {
  fs.rmSync(testDataDir, { recursive: true, force: true });
}

