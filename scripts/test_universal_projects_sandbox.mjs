import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { executeNarrativeTags } from '../src/chat/narrative-engine.js';
import { loadState, saveState } from '../src/world/state.js';

const tmpDir = path.resolve('tmp/test_universal_projects_' + Date.now());
fs.mkdirSync(tmpDir, { recursive: true });

const initState = {
  clock: { day: 22, hour: 10 },
  actors: {
    husband: { id: 'husband', name: '王甯', location: 'husband_room' },
    waner: { id: 'waner', name: '沈婉儿', location: 'husband_room' },
  },
  places: {
    husband_room: { id: 'husband_room', name: '临江·王宅·正房', exits: [] },
  },
  assets: {
    silver: 20000,
    properties: [],
  },
  ledger: [],
};

saveState(tmpDir, initState);

console.log('🧪 1. 测试置办【临江兵工厂】：全自动生成军械工坊、锻打冶铁/军械库分区、配备大匠总管、日入测算...');
executeNarrativeTags({
  replyText: '【正妻·婉儿】：妾身这便支八百两开办兵工厂！[[pay:开办临江兵工厂|八百两=800]]',
  sayText: '准了，支800两把临江兵工厂办起来！',
  dataDir: tmpDir,
  viewerActorId: 'husband',
});

const s1 = loadState(tmpDir);
const armory = s1.assets.properties.find(p => p.name.includes('兵工厂'));
assert.ok(armory, '兵工厂必须成功落地！');
assert.equal(armory.category, '军械制造');
assert.equal(armory.costSilver, 800);
assert.ok(armory.incomePerDay >= 50, `日入必须按军工产业费率自动测算（当前: ${armory.incomePerDay}两）`);
assert.ok(armory.desc.includes('军械') || armory.desc.includes('刀枪'), '描述必须具备军械制造属性');
const armoryRooms = Object.values(s1.places).filter(p => p.parent === armory.placeId);
assert.ok(armoryRooms.length >= 2, '必须全自动建出冶铁/军械装配房等子空间');
const armoryStaff = Object.values(s1.actors).find(a => a.work === armory.placeId);
assert.ok(armoryStaff, '必须全自动配备大工头/大匠');
console.log(`✅ 兵工厂全自动落地成功！负责人: ${armoryStaff.name}(${armoryStaff.role})，日入: ${armory.incomePerDay} 两，功能分区: ${armory.floorNames.join('、')}`);

console.log('🧪 2. 测试置办【青瓷窑厂】：全自动生成窑炉烧造、拉胚制坯/封箱仓、窑头管事、日入流水...');
executeNarrativeTags({
  replyText: '【正妻·婉儿】：妾身这便使人去盘下青瓷窑厂！[[pay:置办青瓷窑厂|五百两=500]]',
  sayText: '买了，500两定下青瓷窑厂！',
  dataDir: tmpDir,
  viewerActorId: 'husband',
});

const s2 = loadState(tmpDir);
const kiln = s2.assets.properties.find(p => p.name.includes('青瓷窑厂'));
assert.ok(kiln, '青瓷窑厂必须成功落地！');
assert.equal(kiln.category, '窑炉烧造');
assert.equal(kiln.costSilver, 500);
assert.ok(kiln.incomePerDay >= 30, `日入测算必须落地（当前: ${kiln.incomePerDay}两）`);
const kilnStaff = Object.values(s2.actors).find(a => a.work === kiln.placeId);
assert.ok(kilnStaff, '必须全自动配备窑头管事');
console.log(`✅ 青瓷窑厂全自动落地成功！负责人: ${kilnStaff.name}(${kilnStaff.role})，日入: ${kiln.incomePerDay} 两，功能分区: ${kiln.floorNames.join('、')}`);

console.log('🧪 3. 测试置办【长风镖局】：全自动生成镖运物流、演武场/保税库、大镖头...');
executeNarrativeTags({
  replyText: '【正妻·婉儿】：长风镖局立下，咱家商队走南闯北就安稳了。[[pay:设立长风镖局|四百两=400]]',
  sayText: '立下吧，400两把长风镖局办起来！',
  dataDir: tmpDir,
  viewerActorId: 'husband',
});

const s3 = loadState(tmpDir);
const escort = s3.assets.properties.find(p => p.name.includes('长风镖局'));
assert.ok(escort, '长风镖局必须成功落地！');
assert.equal(escort.category, '车马镖运');
const escortStaff = Object.values(s3.actors).find(a => a.work === escort.placeId);
assert.ok(escortStaff, '必须全自动配备大镖头');
console.log(`✅ 长风镖局全自动落地成功！负责人: ${escortStaff.name}(${escortStaff.role})，日入: ${escort.incomePerDay} 两`);

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('🎉 通用动态产业沙盒引擎测试全线大满贯通过！');

