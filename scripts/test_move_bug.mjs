import { parseIntent } from '../src/world/intent.js';
import { applySummon } from '../src/world/summon.js';
import { loadState } from '../src/world/state.js';

const say = '你意思是翟家老板私自改的？';
const lastBotSaid = '底册上的数，是翟家管事拿着衙门里认过账的文书来改的';
const w = loadState('data');

console.log('--- 测试 parseIntent ---');
const intent = parseIntent({ text: say, actorId: 'husband', world: w, lastBotSaid });
console.log('intent:', intent);

console.log('--- 测试 applySummon ---');
const summon = applySummon('data', say, lastBotSaid, 'husband');
console.log('summon:', summon);
