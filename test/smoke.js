import assert from 'node:assert';
import { RolesManager } from '../src/roles-manager.js';
import { EdgeTtsService } from '../src/edge-tts.js';

console.log('--- 开始独立服务端冒烟自检 ---');

// 1. 验证角色管理
const rm = new RolesManager('傲娇助手');
const activeRole = rm.getActiveRole();
console.log('1. 当前激活角色:', activeRole);
assert.strictEqual(activeRole, '傲娇助手');

const persona = rm.getRolePersona('傲娇助手');
console.log('2. 人设卡读取成功，包含字符数:', persona.length);
assert.ok(persona.includes('温柔小娘子'));
assert.ok(persona.includes('12345'));
assert.ok(persona.includes('上山打老虎'));
assert.ok(persona.includes('大被同眠'));

// 2. 验证 Edge-TTS 微软云端纯 Node 极速合成
console.log('3. 正在测试微软晓晓 Edge-TTS 云端 WebSocket 合成...');
const tts = new EdgeTtsService({ defaultVoice: 'zh-CN-XiaoxiaoNeural' });
const ttsRes = await tts.synthesizeToFile({ text: '相公，妾身在软路由里等你呢。' });
console.log('4. Edge-TTS 合成结果:', ttsRes);
assert.ok(ttsRes.ok);
assert.ok(ttsRes.key);

console.log('🎉 所有核心自检全部通过！纯 Node.js 环境完美运行！');
