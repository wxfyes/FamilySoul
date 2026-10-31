import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

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
  const TEST_PORT = 3288;
  const HUSBAND_TOKEN = 'wxf_husband_exclusive_token_2026';

  const proc = spawn('node', ['src/server.js'], {
    cwd: ROOT_DIR,
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: 'ignore'
  });

  await new Promise(r => setTimeout(r, 1200));

  try {
    console.log('--- 1. 测试 Web 控制台首页 HTML 托管 ---');
    const htmlRes = await request(`http://127.0.0.1:${TEST_PORT}/`, {
      headers: { 'Accept': 'text/html,application/xhtml+xml' }
    });
    assert.strictEqual(htmlRes.status, 200);
    assert(htmlRes.headers['content-type'].includes('text/html'), '必须返回 text/html');
    assert(htmlRes.raw.includes('FamilySoul'), '必须包含网页标题');
    console.log('✅ FamilySoul Web 控制台 HTML 托管成功');

    console.log('--- 2. 测试获取所有角色列表 GET /api/admin/roles ---');
    const rolesRes = await request(`http://127.0.0.1:${TEST_PORT}/api/admin/roles?token=${HUSBAND_TOKEN}`);
    assert.strictEqual(rolesRes.status, 200);
    assert.strictEqual(rolesRes.body.ok, true);
    assert(rolesRes.body.roles.some(r => r.name === '傲娇助手'), '必须包含傲娇助手');
    console.log('✅ 角色列表获取成功，当前角色数：', rolesRes.body.roles.length);

    console.log('--- 3. 测试在线创建与保存新角色 POST /api/admin/roles/save ---');
    const saveRes = await request(`http://127.0.0.1:${TEST_PORT}/api/admin/roles/save?token=${HUSBAND_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { name: '测试猛男', content: '# 测试猛男\n\n- 身份：高大威猛知己' }
    });
    assert.strictEqual(saveRes.status, 200);
    assert.strictEqual(saveRes.body.ok, true);
    console.log('✅ 新角色「测试猛男」在线创建保存成功');

    console.log('--- 4. 测试在线安全删除角色 POST /api/admin/roles/delete ---');
    const delRes = await request(`http://127.0.0.1:${TEST_PORT}/api/admin/roles/delete?token=${HUSBAND_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { name: '测试猛男' }
    });
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.body.ok, true);
    console.log('✅ 角色安全删除成功');

    console.log('--- 5. 测试家庭成员配置读取 GET /api/admin/family ---');
    const familyRes = await request(`http://127.0.0.1:${TEST_PORT}/api/admin/family?token=${HUSBAND_TOKEN}`);
    assert.strictEqual(familyRes.status, 200);
    assert.strictEqual(familyRes.body.ok, true);
    assert(familyRes.body.family.husband && familyRes.body.family.wife && familyRes.body.family.kid);
    console.log('✅ 家庭配置读取成功：相公/老婆/孩子全部独立齐备');

    console.log('\n========================================================');
    console.log('  🎉 Web 控制台所有管理 API 测试 100% 全绿通过！       ');
    console.log('========================================================');
  } finally {
    proc.kill();
  }
}

run().catch(err => {
  console.error('❌ Admin 测试失败：', err);
  process.exit(1);
});
