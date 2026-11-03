import { parseIntent, VERBS } from '../src/world/intent.js';
import { loadState } from '../src/world/state.js';

const w = loadState('data');
console.log('w.actors.husband:', w.actors.husband);
console.log('w.places[w.actors.husband.location]:', w.places[w.actors.husband.location]);
console.log('intent:', parseIntent({ text: '去找王甯', actorId: 'liuwenxia', world: w }));
