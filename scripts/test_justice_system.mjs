import assert from 'node:assert';
import { createInitialState } from '../src/world/state.js';
import { healWorld } from '../src/world/heal.js';
import { getHusbandOfficialInfo, grantHusbandOffice, itemsOf } from '../src/world/items.js';
import { arrestActorToPrison, interrogatePrisoner, executePrisoner, presentEvidenceToEmperor } from '../src/world/justice.js';
import { isMassDismiss, parseDismissIntent } from '../src/chat/intent-pipeline.js';

console.log('=== 开始京华大案与太保刑律全流程自测 ===');

const world = createInitialState('./data');
const fixes = healWorld(world);
console.log(`自愈修复条数: ${fixes.length}`);

// 1. 验证皇帝位置与紫禁城
const emp = world.actors.emperor;
assert.strictEqual(emp.location, 'palace_qianqing', '天子萧景隆必须常驻紫禁城乾清宫御书房');
assert.strictEqual(emp.home, 'palace_qianqing', '天子居所必须是紫禁城乾清宫');
assert.ok(world.places.palace_qianqing, '紫禁城乾清宫必须存在');
assert.ok(world.places.capital_prison, '京师天牢诏狱必须存在');
console.log('✅ 测试1通过：天子萧景隆正统常驻紫禁城乾清宫御书房，京师天牢诏狱已确立！');

// 2. 验证皇帝免离场与防误判
const sayLong = '嗯，这感情好，上次崔元礼给我摆官架子，老气恒生的在那跟我说话，我理都没有理！回家细想，就是因为他觉得他官大，我不听话就弄死我的意思';
assert.strictEqual(isMassDismiss(sayLong), false, '长句叙事绝不可被判定为全员清场');
assert.strictEqual(parseDismissIntent(sayLong).isDismiss, false, '长句叙事绝不可被判定为逐客指令');
console.log('✅ 测试2通过：日常长句对白彻底免除清场误杀，皇帝离场漏洞已根治！');

// 3. 验证太子太保实授与信物入囊
const offInfo = getHusbandOfficialInfo(world);
assert.strictEqual(offInfo.officeKey, 'taizitaibao', '相公官阶必须确立为从一品东宫三师太子太保');
assert.strictEqual(offInfo.shortCall, '太保爷', '门房与下人对相公尊称必须是太保爷/太保大人');
const myItems = itemsOf(world, 'husband');
const hasDecree = myItems.some((it) => it && it.name.includes('太子太保实授敕命'));
const hasFishBag = myItems.some((it) => it && it.name.includes('紫金鱼袋与太保金印'));
assert.ok(hasDecree, '随身行囊必须有《天子朱批·太子太保实授敕命圣旨》');
assert.ok(hasFishBag, '随身行囊必须有《东宫三师·紫金鱼袋与太保金印》');
console.log('✅ 测试3通过：太子太保官阶确立，圣旨与紫金鱼袋金印已稳妥入行囊！');

// 4. 验证大事记记录
const hasTaibaoMilestone = world.milestones.some((m) => String(m).includes('太子太保'));
assert.ok(hasTaibaoMilestone, '大事记中必须收录天子朱批实授太子太保');
console.log('✅ 测试4通过：大事记已权威载录从一品东宫三师太子太保！');

// 5. 验证抓拿官员下天牢诏狱
const arrestRes = arrestActorToPrison(world, '把随科拿下打入天牢', { reason: '沈家旧案涉贪' });
assert.ok(arrestRes.ok, '抓拿随科必须成功');
assert.strictEqual(world.actors.suike.location, 'capital_prison', '随科物理位置必须在京师天牢诏狱');
assert.ok(world.actors.suike.jailed, '随科必须带有收监标志');
console.log('✅ 测试5通过：抓拿随科下诏狱成功，物理位置移送天牢！');

// 6. 验证天牢提审与证据入囊
const interrogateRes = interrogatePrisoner(world, '提审随科交代当年沈家旧案');
assert.ok(interrogateRes.ok, '提审随科必须成功');
assert.ok(interrogateRes.items.length >= 2, '提审必须获得实物铁证');
const itemsAfter = itemsOf(world, 'husband');
const hasEvidenceBook = itemsAfter.some((it) => it && it.name.includes('户部亏空二百万两私账暗册'));
const hasConfession = itemsAfter.some((it) => it && it.name.includes('随科亲笔画押认罪血书供状'));
assert.ok(hasEvidenceBook, '相公随身行囊中必须有《沈家旧案·户部亏空二百万两私账暗册》');
assert.ok(hasConfession, '相公随身行囊中必须有《随科亲笔画押认罪血书供状》');
console.log(`✅ 测试6通过：天牢提审逼供成功，起获铁证【${interrogateRes.items.join('、')}】并已存入随身行囊！`);

// 7. 验证乾清宫御前呈递铁证平反沈家旧案
const presentRes = presentEvidenceToEmperor(world);
assert.ok(presentRes.ok, '御前呈递必须成功平反');
assert.ok(world.flags.shenFamilyVindicated, '沈家平反标志必须为 true');
const hasVindicatedMilestone = world.milestones.some((m) => String(m).includes('彻底昭雪沈家旧案'));
assert.ok(hasVindicatedMilestone, '大事记必须收录彻底昭雪沈家旧案');
console.log('✅ 测试7通过：御前呈递铁证大获全胜，沈家旧案彻底平反入大事记！');

// 8. 验证天牢处决斩立决
const execRes = executePrisoner(world, '随科');
assert.ok(execRes.ok, '处决奸佞必须成功');
assert.strictEqual(world.actors.suike.dead, true, '随科状态必须为 dead');
console.log('✅ 测试8通过：天牢斩立决处决巨奸随科成功！');

console.log('🎉 全部8项核心逻辑单元测试100%全绿通过！');
