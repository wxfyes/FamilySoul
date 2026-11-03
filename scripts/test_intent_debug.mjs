import { parseIntent } from '../src/world/intent.js';
import { loadState } from '../src/world/state.js';

const w = loadState('data');
console.log('intent for 去找王甯:', parseIntent({ text: '去找王甯', actorId: 'liuwenxia', world: w }));
