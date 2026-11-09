import assert from 'node:assert';
import {
  openCorrespondence, listCorrespondence, appendCorrespondence, markCorrespondence,
  setCorrespondenceStatus, getCorrespondence,
} from '../src/world/correspondence.js';

console.log('🧪 来信/回话独立落盘，不混主聊天...');

const world = { clock: { day: 21, hour: 8 }, flags: {} };
const t = openCorrespondence(world, {
  fromId: 'npc_17', fromName: '翟管事', to: 'husband', kind: 'letter',
  privacy: 'private', placeName: '翟家货栈', source: '来信', text: '东家，后门的事有回话了。',
});
assert.ok(t && t.id, '应开一封信');
assert.strictEqual(world.correspondence.length, 1, '落盘一条 thread');
assert.strictEqual(listCorrespondence(world, 'husband').length, 1, '收件箱里能列出');

appendCorrespondence(world, t.id, 'me', '知道了，按计划办。');
const got = getCorrespondence(world, t.id, 'husband');
assert.strictEqual(got.messages.length, 2, '回信应进同一 thread');
assert.strictEqual(got.messages[1].role, 'me', '回信角色是 me');
markCorrespondence(world, t.id);
setCorrespondenceStatus(world, t.id, 'husband', 'replied');
assert.strictEqual(getCorrespondence(world, t.id).status, 'replied');
console.log('✅ 来信、回信、状态都在同一 thread 落盘，未进主聊天');
