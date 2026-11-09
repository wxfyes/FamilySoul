import assert from 'node:assert';
import { trimMemories, MEMORY_CAP } from '../src/world/memory.js';

console.log('🧪 长期记忆超限时，先丢闲事，私情/婚嫁/大案必须保住...');

const world = { memories: [] };
world.memories.push({ text: '静儿在客栈上房应了王甯，认下这门私情', about: ['husband', 'zhanjing'], day: 20 });
for (let i = 0; i < 2200; i += 1) {
  world.memories.push({ text: `某日闲话第${i}条`, about: ['husband'], day: 21 });
}

trimMemories(world);
assert.ok(world.memories.some((m) => m.text.includes('私情')), '早期私情记忆不能被挤掉');
assert.ok(world.memories.length <= MEMORY_CAP, '总量不得超上限');
console.log(`✅ 超限后仍保住私情，总量 ${world.memories.length}/${MEMORY_CAP}`);
