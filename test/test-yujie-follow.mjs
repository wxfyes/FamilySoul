import assert from 'node:assert';
import { loadState, saveState } from '../src/world/state.js';
import { applySummon } from '../src/world/summon.js';

const dataDir = 'data';
const w = loadState(dataDir);

// 确保有于子归
if (!Object.values(w.actors).some((a) => a && /于子归|于杰/.test(a.name))) {
  w.actors.npc_2 = {
    id: 'npc_2',
    name: '于子归',
    role: '营造行工头',
    gender: 'male',
    home: 'wine_shop',
    location: 'street',
    spouse: 'liuwenxia'
  };
}

// 模拟情景：紫嫣和于子归同在 street（青石板长街）
w.actors.liuwenxia.location = 'street';
const yujie = Object.values(w.actors).find((a) => a && /于子归|于杰/.test(a.name));
yujie.location = 'street';
saveState(dataDir, w);

// 紫嫣发话："赶紧弄完，一起回家"
const res = applySummon(dataDir, '赶紧弄完，一起回家', '', 'liuwenxia');
console.log('applySummon result:', res);

const wAfter = loadState(dataDir);
console.log('紫嫣位置:', wAfter.actors.liuwenxia.location);
console.log('于子归位置:', wAfter.actors[yujie.id].location);

assert.strictEqual(wAfter.actors.liuwenxia.location, 'wine_shop', '紫嫣应该回到 wine_shop');
assert.strictEqual(wAfter.actors[yujie.id].location, 'wine_shop', '于子归应该跟紫嫣一起回到 wine_shop');

console.log('✅ 测试通过：紫嫣叫于子归一起回家，于子归同步跟随回铺！');
