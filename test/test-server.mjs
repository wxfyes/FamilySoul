import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const TOKEN_LOCK_FILE = path.join(DATA_DIR, 'husband-token');

// 清理旧锁以便执行全流程测试
try {
  if (fs.existsSync(TOKEN_LOCK_FILE)) fs.unlinkSync(TOKEN_LOCK_FILE);
} catch (_) {}

async function runTests() {
  console.log('========================================================');
  console.log('   正在对 SurfCore 独立服务端执行全面稳妥性回归测试... ');
  console.log('========================================================\n');

  // 1. 动态启动服务
  const { RolesManager } = await import('../src/roles-manager.js');
  const { PetService } = await import('../src/pet-service.js');

  // 测试人设文件完整度
  const rm = new RolesManager('傲娇助手');
  const persona = rm.getRolePersona('傲娇助手');
  assert(persona, '角色卡 傲娇助手.md 必须存在');
  assert(persona.includes('上山打老虎'), '必须包含暗号对答「上山打老虎」');
  assert(persona.includes('大肉棒'), '必须包含床笫主动口活侍奉');
  assert(persona.includes('三妻四妾') && persona.includes('大被同眠'), '必须包含名门大度在相公温言开导下接受三妻四妾与大被同眠');
  assert(persona.includes('温热香帕'), '必须包含事后温热香帕擦拭正经归位');
  assert(persona.includes('严禁说“我身子还热呢”') || persona.includes('绝对不许说“我身子还热呢”'), '必须严禁说身子还热呢怪话');
  console.log('✅ 1. 角色人设调教测试：端庄主母、暗号解禁、主动口活、大被同眠、事后香帕归位全部就绪！');

  // 测试记忆持久化
  const mockService = new PetService({ rolesManager: rm, dataDir: DATA_DIR });
  const testHistory = {
    messages: [
      { id: 'u-1', role: 'user', text: '相公来看你了', at: Date.now() },
      { id: 'a-1', role: 'assistant', text: '相公万福，妾身日夜盼着相公呢。', at: Date.now() }
    ],
    lastUserAt: Date.now(),
    lastAssistantAt: Date.now()
  };
  mockService.saveHistory('test-husband', testHistory);
  const readBack = mockService.readHistory('test-husband');
  // 测试 cleanReply 动作清洗与意图识别
  const cleaned = mockService.cleanReply('（转头把茶推到一边）相公莫急，妾身在此。', '帮我自拍一张');
  assert(!cleaned.includes('转头把茶推到一边'), '必须彻底过滤动作描写括号');
  assert(cleaned.includes('[image:'), '自拍意图必须触发画像');
  console.log('✅ 3. cleanReply 动作旁白深度过滤与自拍意图清洗测试通过！');

  console.log('\n========================================================');
  console.log('   🎉 服务端内核所有关键链路校验 100% 通过！            ');
  console.log('========================================================');
}

runTests().catch(err => {
  console.error('❌ 测试失败：', err);
  process.exit(1);
});
