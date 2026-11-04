import { PetService } from '../src/pet-service.js';
import { loadConfig } from '../src/server.js';

// 模拟测试记账员
const pet = new PetService({ dataDir: 'data' });
const userText = '你意思是翟家老板私自改的？';
const replyText = `【随科】：“王掌柜是个明白人，差爷我也不绕了。”
“底册上的数，是翟家管事拿着衙门里认过账的文书来改的，差爷我照着誊的，手印也是我按的。”
“至于那文书是谁批的，差爷我一个小小书办，真不敢往深里说。您要问，得问愿意往上头走的人。”`;

const ops = await pet.extractWorldOpsFromTurn({ userText, replyText, profileKey: 'husband' });
console.log('Ops extracted:', ops);
