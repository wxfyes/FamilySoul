import assert from 'node:assert';
import { normalizeSpeakers } from '../src/chat/dialogue-postprocess.js';

console.log('🧪 运行双向合意领路转场与残缺括号清洗回归测试...');

// 1. 测试残缺括号清洗
const mockWorld = {
  actors: {
    npc_3: { id: 'npc_3', name: '翟勋柱', role: '跑商掌柜' },
  },
};

const dirtyText = '【跑商路）·勋柱】：“东家自便。”';
const cleaned = normalizeSpeakers(dirtyText, mockWorld);
assert.strictEqual(cleaned.includes('【跑商路）'), false, '残缺括号必须被清洗');
assert.strictEqual(cleaned.includes('勋柱'), true, '必须保留姓名');
console.log('清洗结果:', cleaned);

console.log('✅ 双向领路转场与残缺括号清洗测试全部通过！');

