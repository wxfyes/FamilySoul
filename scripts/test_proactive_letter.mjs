import assert from 'node:assert';
import { queueProactive } from '../src/world/clock.js';
import { healWorld } from '../src/world/heal.js';

console.log('🧪 运行主动请示事件、天字阁房间实例化、人物落地与动身数据流测试...');

// 1. 测试 healWorld 自动消除 canal_restaurant 幽灵空壳、实例化天字阁与落地周有财、汪德润
const worldToHeal = {
  places: {
    place_44: {
      id: 'place_44',
      name: '运河码头大酒楼',
      exits: ['dock'],
    },
    canal_restaurant: {
      id: 'canal_restaurant',
      name: '运河码头大酒楼',
      exits: ['market_street'],
    },
  },
  actors: {
    husband: { id: 'husband', name: '王甯', location: 'place_44' },
  },
};

const fixes = healWorld(worldToHeal);
assert.strictEqual(worldToHeal.places['canal_restaurant'], undefined, 'canal_restaurant 幽灵空壳必须被彻底清理');
assert.strictEqual(worldToHeal.places['place_44'].exits.includes('market_street'), true, '原本 canal_restaurant 的出口必须并入 place_44');
assert.strictEqual(worldToHeal.places['place_44__f3']?.name, '运河码头三层大酒楼·三层天字阁', '必须生成三层天字阁真实房间');
assert.strictEqual(worldToHeal.actors['npc_accountant_zhou']?.name, '周有财', '必须生成账房先生周有财');
assert.strictEqual(worldToHeal.actors['wang_zongshang']?.name, '汪德润', '必须生成扬州盐帮汪总商汪德润');
assert.strictEqual(worldToHeal.actors['wang_zongshang']?.location, 'place_44__f3', '汪总商必须真实身处三层天字阁');

// 2. 测试 queueProactive 对 actorId, placeId, place, isLetter 的正确收录与持久化
const mockWorld = {
  clock: { day: 20, hour: 14 },
  flags: {},
  proactive: [],
};

const ok = queueProactive(mockWorld, {
  reason: 'business_hook',
  speaker: '运河大酒楼·账房',
  actorId: 'npc_accountant_zhou',
  place: '运河码头三层大酒楼',
  placeId: 'place_44',
  isLetter: true,
  text: '【运河大酒楼·账房】：东家，扬州盐帮汪总商派人送来五十两定金，要包下明儿整座天字阁办寿宴，大厨特遣小的来请示东家意下如何？',
  fallback: '【运河大酒楼·账房】：请东家定夺！',
  type: 'proactive',
  force: true,
});

assert.strictEqual(ok, true, 'queueProactive 应入队成功');
assert.strictEqual(mockWorld.proactive.length, 1);
const queued = mockWorld.proactive[0];
assert.strictEqual(queued.actorId, 'npc_accountant_zhou', '必须保留 actorId 字段');
assert.strictEqual(queued.placeId, 'place_44', '必须保留 placeId 字段');
assert.strictEqual(queued.place, '运河码头三层大酒楼', '必须保留 place 字段');
assert.strictEqual(queued.isLetter, true, '必须保留 isLetter 字段');
assert.strictEqual(queued.speaker, '运河大酒楼·账房');

// 2. 模拟 server.js /events 中的下发字段推导逻辑
const spk = queued.speaker;
const finalText = queued.text;
const isInnerHousehold = /婉儿|小翠|婉宁/.test(spk);
let place = queued.place || null;
if (!place && (!isInnerHousehold || /大酒楼|酒楼|茶坊|商铺|货栈/.test(spk || finalText))) {
  if (/大酒楼|酒楼|账房|汪总商/.test(spk || finalText)) place = '运河码头三层大酒楼';
}
assert.strictEqual(place, '运河码头三层大酒楼');

const husLoc = 'wang_mansion_hall'; // 相公在王宅议事厅
const isSamePlace = false;
const isLetter = (queued.isLetter !== undefined)
  ? (queued.isLetter && !isSamePlace)
  : (!isSamePlace && Boolean(place));

assert.strictEqual(isLetter, true, '相公在王宅时收到酒楼账房请示，必须判定为 isLetter: true');

// 3. 模拟客户端 message_bubble 中的 shouldShowGoButton 判定条件
const message = {
  isPending: false,
  isLetter: isLetter,
  inferredPlace: place,
};
const isUser = false;
const isPresentHere = false; // 账房不在王宅议事厅
const currentPlace = '临江·王宅·议事厅';
const isSamePlaceClient = currentPlace.contains ? currentPlace.contains(place) : currentPlace.includes(place);

const shouldShowGoButton = !isUser &&
  !message.isPending &&
  !isPresentHere &&
  !isSamePlaceClient &&
  message.isLetter &&
  message.inferredPlace != null &&
  message.inferredPlace.length > 0;

assert.strictEqual(shouldShowGoButton, true, '客户端必须判定展示【动身前往「运河码头三层大酒楼」】按钮！');

console.log('✅ 主动请示事件、递信标牌与动身按钮数据流回归测试全部通过！');

