import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const TOKEN_LOCK_FILE = path.join(DATA_DIR, 'husband-token');

// 清理旧锁
try {
  if (fs.existsSync(TOKEN_LOCK_FILE)) fs.unlinkSync(TOKEN_LOCK_FILE);
} catch (_) {}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    req.end();
  });
}

async function run() {
  const TEST_PORT = 3199;
  const proc = spawn('node', ['src/server.js'], {
    cwd: ROOT_DIR,
    env: { ...process.env, PORT: String(TEST_PORT), SURFCORE_TOKEN: '' },
    stdio: 'ignore'
  });

  // 等待启动
  await new Promise(r => setTimeout(r, 1200));

  try {
    console.log('--- 1. 测试公开探活 GET /health ---');
    const health = await request(`http://127.0.0.1:${TEST_PORT}/health`);
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.ok, true);
    console.log('✅ 公开探活成功');

    console.log('--- 2. 测试无 Token 访问受保接口（必须 401 铁壁拦截）---');
    const noToken = await request(`http://127.0.0.1:${TEST_PORT}/dsh-surfcore/pet-api/health`);
    assert.strictEqual(noToken.status, 401);
    assert.strictEqual(noToken.body.code, 'AUTH_FORBIDDEN');
    console.log('✅ 无 Token 阻断成功：', noToken.body.error);

    console.log('--- 3. 测试相公专属 Token 接入 ---');
    const HUSBAND_TOKEN = 'wxf_husband_exclusive_token_2026';
    const husbandAuth = await request(`http://127.0.0.1:${TEST_PORT}/dsh-surfcore/pet-api/health?token=${HUSBAND_TOKEN}`);
    assert.strictEqual(husbandAuth.status, 200);
    assert.strictEqual(husbandAuth.body.ok, true);
    assert.strictEqual(husbandAuth.body.member, 'husband');
    console.log('✅ 相公专属 Token 接入成功，身份识别为 husband');

    console.log('--- 4. 测试老婆专属 Token 接入 ---');
    const WIFE_TOKEN = 'wife_exclusive_token_8888';
    const wifeAuth = await request(`http://127.0.0.1:${TEST_PORT}/dsh-surfcore/pet-api/health?token=${WIFE_TOKEN}`);
    assert.strictEqual(wifeAuth.status, 200);
    assert.strictEqual(wifeAuth.body.member, 'wife');
    console.log('✅ 老婆专属 Token 接入成功，身份识别为 wife (贴心管家)');

    console.log('--- 5. 测试孩子专属 Token 接入 ---');
    const KID_TOKEN = 'kid_exclusive_token_9999';
    const kidAuth = await request(`http://127.0.0.1:${TEST_PORT}/dsh-surfcore/pet-api/health?token=${KID_TOKEN}`);
    assert.strictEqual(kidAuth.status, 200);
    assert.strictEqual(kidAuth.body.member, 'kid');
    console.log('✅ 孩子专属 Token 接入成功，身份识别为 kid (全能导师)');

    console.log('--- 6. 测试陌生人伪造 Token 接入（必须 401 拒之门外）---');
    const fakeAuth = await request(`http://127.0.0.1:${TEST_PORT}/dsh-surfcore/pet-api/health?token=fake_intruder_token`);
    assert.strictEqual(fakeAuth.status, 401);
    assert.strictEqual(fakeAuth.body.code, 'AUTH_FORBIDDEN');
    console.log('✅ 陌生人伪造 Token 拦截成功：小娘子和家庭隐私绝对安全！');

    console.log('--- 5. 测试 Flutter 客户端状态接口 GET /dsh-surfcore/pet-api/status ---');
    const statusRes = await request(`http://127.0.0.1:${TEST_PORT}/dsh-surfcore/pet-api/status`, {
      headers: {
        'x-pet-token': HUSBAND_TOKEN,
        'Host': `127.0.0.1:${TEST_PORT}`
      }
    });
    assert.strictEqual(statusRes.status, 200);
    assert.strictEqual(statusRes.body.ok, true);
    assert(statusRes.body.role && statusRes.body.role.name, '必须包含 role.name');
    assert.strictEqual(statusRes.body.presence.state, '在线守候相公');
    console.log('✅ 客户端 status 协议对齐成功：', statusRes.body.role.name, statusRes.body.presence.state);

    console.log('--- 6. 测试历史记录读取 GET /dsh-surfcore/pet-api/history ---');
    const historyRes = await request(`http://127.0.0.1:${TEST_PORT}/dsh-surfcore/pet-api/history`, {
      headers: { 'x-pet-token': HUSBAND_TOKEN }
    });
    assert.strictEqual(historyRes.status, 200);
    assert.strictEqual(historyRes.body.ok, true);
    assert(Array.isArray(historyRes.body.history));
    console.log('✅ 历史记录接口响应成功');

    console.log('\n========================================================');
    console.log('  🎉 HTTP 接口与 Token 主权闭环全绿通过！稳妥无虞！     ');
    console.log('========================================================');
  } finally {
    proc.kill();
    try {
      if (fs.existsSync(TOKEN_LOCK_FILE)) fs.unlinkSync(TOKEN_LOCK_FILE);
    } catch (_) {}
  }
}

run().catch(err => {
  console.error('❌ HTTP 测试失败：', err);
  process.exit(1);
});
