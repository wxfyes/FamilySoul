/**
 * 核心业务不变量守护测试（System Invariants Guard）
 *
 * 本脚本是系统的物理底线守护神：
 * 任何代码修改、重构或数据流转，若违背了以下任何一条不变量，
 * 必须立刻以非零状态码退出并报错，绝对不允许打包或部署！
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isPropertyOperational, getPropertyNominalIncome, calculateDailyIncome } from '../src/world/properties.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

let errors = 0;
function assertInvariant(condition, desc) {
  if (!condition) {
    console.error(`❌ [不变量违背] ${desc}`);
    errors++;
  } else {
    console.log(`✅ [不变量守护] ${desc}`);
  }
}

console.log('🛡️ 开始执行 FamilySoul 核心业务不变量断言检查...\n');

// ── 1. 产业不变量断言 ──
const mockRestaurant = { id: 'canal_restaurant', name: '运河码头三层大酒楼', status: '正常营业', incomePerDay: 124.1, costSilver: 510 };
assertInvariant(getPropertyNominalIncome(mockRestaurant) >= 100, '运河码头三层大酒楼额定基准日入必须 >= 100 两（日进斗金铁律）');

const mockFleet = { id: 'prop_fleet', name: '王家运河大船队（一大三小）', status: '正常起航', costSilver: 730 };
assertInvariant(isPropertyOperational(mockFleet), '王家大船队「正常起航」状态必须被判定为正常营运产生收益');
assertInvariant(getPropertyNominalIncome(mockFleet) >= 40, '王家大船队额定基准日入必须 >= 40 两');

const mockSalt = { id: 'prop_salt', name: '码头盐铺', status: '已开张' };
assertInvariant(getPropertyNominalIncome(mockSalt) >= 20, '码头盐铺官盐商行额定基准日入必须 >= 20 两');

const mockWorld = {
  clock: { day: 10, hour: 12 },
  cities: { 临江府: { price: 100, unrest: 0 } },
  actors: { husband: { name: '王甯' } }
};
const gain = calculateDailyIncome(mockWorld, mockRestaurant);
assertInvariant(gain >= 124.1, '大酒楼当日日结收益绝不可低于额定基准 124.1 两');
assertInvariant(mockRestaurant.incomePerDay >= 124.1, '大酒楼额定日入绝不可被行情反向冲刷削减');

// ── 2. 提示词纯净度不变量断言 ──
const rolesDir = path.join(ROOT, 'roles');
const roleFiles = fs.readdirSync(rolesDir).filter((f) => f.endsWith('.md'));
for (const rf of roleFiles) {
  const content = fs.readFileSync(path.join(rolesDir, rf), 'utf8');
  assertInvariant(!content.includes('杨振华'), `角色文件 roles/${rf} 严禁包含废弃名字「杨振华」`);
  // 检查是否在正面描述中把酒楼写成没买（排除严禁令行）
  const badLines = content.split('\n').filter((line) => !/严禁|禁止|绝不/.test(line) && /酒楼.*(?:还没买|未盘下|打算买|去看铺面|筹备开业)/.test(line));
  assertInvariant(badLines.length === 0, `角色文件 roles/${rf} 严禁否定相公全款盘下大酒楼盛大开业的事实`);
  assertInvariant(!/崔婉宁.*(?:寡妇|亡故)/.test(content), `角色文件 roles/${rf} 严禁污蔑侧室崔婉宁闺秀名节`);
}

// ── 3. 大事记资产一致性不变量断言 ──
const milestonesPath = path.join(ROOT, 'data/world/milestones.json');
if (fs.existsSync(milestonesPath)) {
  const rawText = fs.readFileSync(milestonesPath, 'utf8');
  const has510 = rawText.includes('五百一十两') && rawText.includes('大酒楼');
  assertInvariant(has510, '大事记账本 data/world/milestones.json 必须完整包含 510 两买下运河大酒楼的大事');
}

// ── 4. 总结与退出码 ──
console.log('');
if (errors > 0) {
  console.error(`💥 不变量检查失败！共有 ${errors} 项核心红线被违背，严禁发布！`);
  process.exit(1);
} else {
  console.log('🎉 所有核心业务不变量全部完好，系统安全稳健！');
}
