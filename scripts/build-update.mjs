#!/usr/bin/env node
/**
 * 打包软路由热更新包 update.tar.gz
 *
 * 用法：
 *   node scripts/build-update.mjs    # 一条命令，无需参数
 *
 * 打包内容：src/ + roles/ + web/ + data/（含 data/world 大事记账本）+ 三个 .sh + package.json
 * 自动排除：config.json、data/chat、以及线上会自己长大的运行时文件（见 EXCLUDE_PREFIXES）
 *
 * 生成的 update.tar.gz 放在仓库根目录，由 scripts/sync-server.js 在 8089 端口提供，
 * 软路由侧执行：
 *   cd /opt/familysoul && wget -O - http://192.168.1.112:8089/update.tar.gz | tar -xz \
 *     && chmod +x *.sh && ./stop.sh && ./start.sh
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'update.tar.gz');

// ── 强制门禁：打包前必须 100% 通过系统核心不变量守护检查 ──
try {
  console.log('🛡️ 正在执行打包前系统核心不变量守护检查...');
  execSync('node scripts/test_invariants.mjs', { cwd: ROOT, stdio: 'inherit' });
} catch (err) {
  console.error('\n💥 打包被物理阻断：核心不变量检查失败，严禁生成更新包！');
  process.exit(1);
}

// 默认打包运行所需的所有代码与世界数据账本；config.json 永远不进包（各家真实令牌与 Key 都在里面）
const TARGETS = ['src', 'roles', 'web', 'data', 'scripts', 'start.sh', 'stop.sh', 'status.sh', 'package.json'];

// 只排除「线上会自己长大」的运行时文件，避免更新时把路由器的真实状态冲掉。
// 【必须保留】data/world/milestones.json（王家世界大事记与产业账本）——不在排除表里，照常打包！
const EXCLUDE_PREFIXES = [
  'data/chat',               // 线上真实聊天记录（冲刷记忆）
  'data/assistant',          // 助手对话记录（独立隔离，不冲刷）
  'data/users.json',         // 线上自主注册用户表（不冲刷）
  'data/world/state.json',   // 世界状态（服务首次启动会自动生成，不需要随包分发）
  'data/world/events.jsonl', // 世界事件流（同上）
  'data/avatars',            // 用户自传头像（运行时资产，绝不能被包覆盖）
  'data/routine.json',       // 作息守护配置（各家自己调的时间）
  'data/husband-token',      // 令牌锁定文件（敏感，绝不外带）
];

const pad = (n, width) => n.toString(8).padStart(width - 1, '0') + '\0';

function makeHeader({ name, size = 0, mode = 0o644, type = '0', mtime = Math.floor(Date.now() / 1000) }) {
  if (Buffer.byteLength(name, 'utf8') > 100) throw new Error(`路径过长（>100 字节）：${name}`);
  const b = Buffer.alloc(512, 0);
  b.write(name, 0, 100, 'utf8');
  b.write(pad(mode, 8), 100);
  b.write(pad(0, 8), 108);
  b.write(pad(0, 8), 116);
  b.write(pad(size, 12), 124);
  b.write(pad(mtime, 12), 136);
  b.write('        ', 148); // 校验位先填空格
  b.write(type, 156);
  b.write('ustar\0', 257);
  b.write('00', 263);
  b.write('root', 265);
  b.write('root', 297);
  let sum = 0;
  for (let i = 0; i < 512; i += 1) sum += b[i];
  b.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  return b;
}

function collect(rel, out) {
  if (EXCLUDE_PREFIXES.some((p) => rel === p || rel.startsWith(p + '/'))) return;
  // 临时/一次性脚本不进包（以 _ 开头的文件）
  const base = path.posix.basename(rel);
  if (base.startsWith('_')) return;
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.warn(`[!] 跳过不存在的路径：${rel}`);
    return;
  }
  const st = fs.statSync(abs);
  if (st.isDirectory()) {
    out.push({ name: rel.replace(/\/?$/, '/'), mode: 0o755, type: '5', mtime: Math.floor(st.mtimeMs / 1000) });
    for (const child of fs.readdirSync(abs).sort()) {
      collect(path.posix.join(rel, child), out);
    }
    return;
  }
  out.push({ name: rel, mode: rel.endsWith('.sh') ? 0o755 : 0o644, type: '0', size: st.size, mtime: Math.floor(st.mtimeMs / 1000) });
}

const entries = [];
for (const t of TARGETS) collect(t, entries);

const chunks = [];
for (const e of entries) {
  chunks.push(makeHeader(e));
  if (e.type === '0') {
    const data = fs.readFileSync(path.join(ROOT, e.name));
    if (data.length !== e.size) throw new Error(`读取时长度变化：${e.name}`);
    chunks.push(data);
    const rest = data.length % 512;
    if (rest !== 0) chunks.push(Buffer.alloc(512 - rest, 0));
  }
}
chunks.push(Buffer.alloc(1024, 0)); // 归档结束

const tarBuf = Buffer.concat(chunks);
const gz = zlib.gzipSync(tarBuf, { level: 9 });
fs.writeFileSync(OUT, gz);

const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
console.log(`已生成 ${path.relative(ROOT, OUT)}  ${mb(gz.length)}（未压缩 ${mb(tarBuf.length)}）`);
console.log(`包含 ${entries.filter((e) => e.type === '0').length} 个文件（data/ 已打包，运行时文件已排除）`);
for (const e of entries) {
  if (e.type === '0') console.log(`  ${String(e.size).padStart(9)}  ${e.name}`);
}
console.log(`\n已排除的运行时文件：${EXCLUDE_PREFIXES.join('、')}`);
console.log('data/world/milestones.json 已随包分发；路由器的 state.json / 聊天记录 / 作息配置不受影响。');
