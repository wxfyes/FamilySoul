import assert from 'node:assert';
import { runTaskDues } from '../src/world/clock.js';

console.log('🧪 差事到期，应主动递一条提醒，且只提醒一次...');

const world = {
  clock: { day: 20, hour: 10 },
  flags: {},
  actors: { npc_accountant_zhou: { id: 'npc_accountant_zhou', name: '周有财' } },
  tasks: [
    { id: 't1', actorId: 'npc_accountant_zhou', name: '周有财', what: '打听三件事', status: 'doing', dueDay: 20, owner: 'husband' },
    { id: 't2', actorId: 'npc_accountant_zhou', name: '周有财', what: '已办完', status: 'done', dueDay: 19 },
  ],
};

const outs = [];
const events = [];
runTaskDues(world, events, (o) => outs.push(o));
assert.strictEqual(outs.length, 1, '到期差事应推一条');
assert.ok(String(outs[0].fallback).includes('周有财'), '提醒里应有办差人');
assert.strictEqual(world.tasks[0].remindedDue, 20, '应记下已提醒的日子');
runTaskDues(world, events, (o) => outs.push(o));
assert.strictEqual(outs.length, 1, '同一天不得重复提醒');
console.log('✅ 到期提醒一次，不刷屏');
