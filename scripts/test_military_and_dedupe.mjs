import assert from 'node:assert';
import { ensureMilitaryGenerals, summonGuards, dispatchGarrison, reviewTroops } from '../src/world/military-dispatch.js';
import { healDuplicateActors } from '../src/world/heal.js';
import { materializeNarrativeActor } from '../src/world/dynamic-actor.js';

console.log('🛡️ 开始验证提督将领中枢与重复人物去重修复...');

const world = {
  clock: { day: 26, hour: 14 },
  actors: {
    husband: { id: 'husband', name: '王甯', location: 'yamen' },
    yangshenzhi: { id: 'yangshenzhi', name: '杨慎之', role: '临江知府', origin: 'preset', relations: { husband: { trust: 84 } } },
    county_magistrate: { id: 'county_magistrate', name: '周文达', role: '临江县令', origin: 'preset', relations: { husband: { trust: 72 } } },
    // 模拟线上污染的两个克隆体
    actor_dyn_mwg2dqjn_e4ms: { id: 'actor_dyn_mwg2dqjn_e4ms', name: '杨慎之', role: '临江知府', origin: 'narrative', dynamicSpawn: true },
    actor_dyn_mwg45lq9_euhv: { id: 'actor_dyn_mwg45lq9_euhv', name: '文达', role: '临江县令', origin: 'narrative', dynamicSpawn: true },
  },
  places: {
    yamen: { id: 'yamen', name: '临江县衙', exits: [] },
    yamen__store: { id: 'yamen__store', name: '临江县衙·库房', exits: ['yamen'] },
    dock: { id: 'dock', name: '运河码头', exits: [] },
  },
  flags: {},
};

// 1. 测试五大将领入籍
const genAdded = ensureMilitaryGenerals(world);
assert(genAdded >= 5, `应新增至少5位将领，实为 ${genAdded}`);
assert(world.actors.general_zhaolei, '游击将军赵雷必须存在');
assert(world.actors.general_zhouwu, '中军副将周武必须存在');
assert(world.actors.general_chenhaiping, '水师参将陈海平必须存在');
assert(world.actors.general_sutie, '神机千总苏铁必须存在');
assert(world.actors.general_lishitou, '亲兵百户李石头必须存在');
console.log('✅ 五大骨干将领与亲兵编制入籍正常');

// 2. 测试“来人”召唤亲兵
const callRes = summonGuards(world);
assert(callRes.ok, '召唤亲兵必须成功');
assert.strictEqual(world.actors.general_zhaolei.location, 'yamen', '赵雷必须即刻移到相公所在地点');
assert.strictEqual(world.actors.general_lishitou.location, 'yamen', '李石头必须即刻移到相公所在地点');
assert(callRes.notice.includes('赵雷'), '回执必须包含赵雷领命台词');
assert(world.places.yamen.guardsPresent, '地点必须记录 guardsPresent');
console.log('✅ 随时召唤亲兵护卫（赵雷带队破门而入）测试通过');

// 3. 测试调兵遣将：派兵看守县衙库房
const dispRes = dispatchGarrison(world, { generalName: '赵雷', placeTarget: '县衙库房', count: 50, mission: '看守' });
assert(dispRes.ok, '调兵看守必须成功');
assert(world.places.yamen__store.garrison, '目标地点必须挂载 garrison 驻防状态');
assert.strictEqual(world.places.yamen__store.garrison.general, '赵雷', '守将必须为赵雷');
assert.strictEqual(world.places.yamen__store.garrison.count, 50, '驻兵必须为50人');
console.log('✅ 调兵遣将真实改变地点驻防状态测试通过');

// 4. 测试“点兵”检阅中枢帅帐大账
const reviewRes = reviewTroops(world);
assert(reviewRes.ok, '点兵必须成功');
assert(reviewRes.notice.includes('从一品水陆提督'), '必须包含提督官衔');
assert(reviewRes.notice.includes('周武'), '必须包含中军副将周武');
assert(reviewRes.notice.includes('陈海平'), '必须包含水师参将陈海平');
console.log('✅ 点兵检阅提督兵符大账测试通过');

// 5. 测试根治“两个杨慎之、两个周文达”
console.log('正在执行全域重名克隆体自愈清理...');
const dupFixes = healDuplicateActors(world);
assert(dupFixes.length >= 2, `应清理至少2个克隆人，实际清理 ${dupFixes.length} 个`);
assert.strictEqual(world.actors.actor_dyn_mwg2dqjn_e4ms, undefined, '克隆杨慎之必须被彻底删除');
assert.strictEqual(world.actors.actor_dyn_mwg45lq9_euhv, undefined, '克隆文达必须被彻底删除');
assert.strictEqual(world.actors.yangshenzhi.name, '杨慎之', '正本杨慎之必须完好保留');
assert.strictEqual(world.actors.county_magistrate.name, '周文达', '正本周文达必须完好保留');
console.log('✅ 两个杨慎之、两个周文达彻底安全吸收合并与清理完毕！');

// 6. 测试动态具象化防克隆机制
const spawn1 = materializeNarrativeActor(world, { name: '杨慎之', role: '知府' });
assert.strictEqual(spawn1.id, 'yangshenzhi', '再次提及杨慎之必须直接返回原版正本，严禁再造克隆人');
const spawn2 = materializeNarrativeActor(world, { name: '文达', role: '临江县令' });
assert.strictEqual(spawn2.id, 'county_magistrate', '再次提及文达必须直接返回原版周文达，严禁再造克隆人');
console.log('✅ 动态生成防克隆漏洞拦截测试通过！');

console.log('🎉 提督将领中枢与防克隆去重自愈全项测试 100% 完美通过！');
