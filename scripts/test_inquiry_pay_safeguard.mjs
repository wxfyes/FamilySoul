import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { executeNarrativeTags } from '../src/chat/narrative-engine.js';
import { loadState, saveState } from '../src/world/state.js';

const tmpDir = path.resolve('tmp/test_inquiry_pay_' + Date.now());
fs.mkdirSync(tmpDir, { recursive: true });

const initState = {
  clock: { day: 22, hour: 10 },
  actors: {
    husband: { id: 'husband', name: '王甯', location: 'husband_room' },
    waner: { id: 'waner', name: '沈婉儿', location: 'husband_room' },
  },
  places: {
    husband_room: { id: 'husband_room', name: '临江·王宅·正房', exits: [] },
    dock: { id: 'dock', name: '运河码头', exits: [] },
  },
  assets: {
    silver: 10000,
    properties: [],
  },
  ledger: [],
};

saveState(tmpDir, initState);

console.log('🧪 1. 验证相公询价时，模型吐出 [[pay]] 绝不扣款，只挂待定夺单...');
const resInquiry = executeNarrativeTags({
  replyText: '【正妻·婉儿】：一条运河中等货船，总要一百二十两上下。[[pay:置办运河货船|一百二十两=120]]',
  sayText: '对，一条船约多少钱？',
  dataDir: tmpDir,
  viewerActorId: 'husband',
});

const stateAfterInquiry = loadState(tmpDir);
assert.equal(stateAfterInquiry.assets.silver, 10000, '询价时银两必须分文不扣！');
assert.ok(stateAfterInquiry.pendingAction, '必须生成待定夺单 pendingAction');
assert.equal(stateAfterInquiry.pendingAction.title, '置办运河货船');
assert.ok(resInquiry.reply.includes('商议报价') || resInquiry.reply.includes('待相公定夺'), '回复中应提示商议报价或待相公定夺');
assert.ok(!resInquiry.reply.includes('已付 120.00 两'), '绝对不能出现已付提示！');
console.log('✅ 询价时不擅自扣款，成功拦截并挂入待定夺单！');

console.log('🧪 2. 验证相公下达明确购买指令时，扣款并自动落地货船资产与带货盈利...');
const resPurchase = executeNarrativeTags({
  replyText: '【正妻·婉儿】：妾身这便支银子使人去码头寻船匠！[[pay:置办运河货船|一百二十两=120]]',
  sayText: '准了，支120两银子去买船吧！',
  dataDir: tmpDir,
  viewerActorId: 'husband',
});

const stateAfterPurchase = loadState(tmpDir);
assert.equal(stateAfterPurchase.assets.silver, 9880, '明确购买后扣除 120 两');
const shipProp = stateAfterPurchase.assets.properties.find(p => p.name.includes('货船'));
assert.ok(shipProp, '名下必须真有这艘货船！');
assert.ok(shipProp.incomePerDay >= 7, '货船带货日收益必须落地（>=7两/日）');
assert.ok(shipProp.desc.includes('带货') || shipProp.desc.includes('托运'), '货船描述必须包含带货托运功能');
console.log(`✅ 货船成功落地！名称：${shipProp.name}，成本：${shipProp.costSilver}两，每日带货进账：${shipProp.incomePerDay}两`);

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('🎉 所有询价风控与货船带货收益测试全部通过！');
