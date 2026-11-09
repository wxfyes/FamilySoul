import assert from 'node:assert';
import { recallMemories } from '../src/world/memory.js';

console.log('🧪 旧情/同房记忆不能被后来的闲事挤出上下文...');

const world = {
  actors: {
    husband: { id: 'husband', name: '王甯' },
    zhanjing: { id: 'zhanjing', name: '静儿' },
  },
  memories: [
    { text: '静儿在客栈上房应了王甯，认下这门私情，只求他护得住', about: ['husband', 'zhanjing'], day: 20 },
  ],
};
for (let i = 0; i < 30; i += 1) {
  world.memories.push({ text: `静儿与相公说第${i}件闲事`, about: ['husband', 'zhanjing'], day: 21 + i });
}

const out = recallMemories(world, ['husband', 'zhanjing'], { limit: 12 });
assert.ok(out.some((t) => t.includes('私情')), '旧情记忆必须被保留在召回结果里');
console.log('✅ 私情记忆被钉住，没有被 30 条闲事挤掉');
