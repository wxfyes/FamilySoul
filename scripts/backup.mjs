#!/usr/bin/env node
/**
 * 世界数据备份 / 归档（纯本地，零依赖）
 *
 * 绝对安全原则：
 *   ① 只读 data/，绝不写 data/
 *   ② 不删任何"今天刚备份过"的东西
 *   ③ 清理默认 dry-run，加 --prune 才真删
 *   ④ 任何异常都不影响正在运行的服务
 *
 * 用法：
 *   node scripts/backup.mjs                    # 备份（默认）
 *   node scripts/backup.mjs --prune            # 备份 + 清理过期备份
 *   node scripts/backup.mjs --prune-audio 7    # 另加：删除 7 天前的语音
 *   node scripts/backup.mjs --verify           # 校验最近一份备份能否解开
 *
 * 参数：
 *   --data <dir>           默认 ./data
 *   --out <dir>            默认 ./backups
 *   --keep-days <n>        日备份保留天数（默认 14）
 *   --keep-weeks <n>       周备份保留份数（默认 8，周日那份自动升级为周备份）
 *   --prune-audio <n>      删除 n 天前的 data/voice/*.wav（默认不删）
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const argOf = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const has = (name) => args.includes(name);

const DATA = path.resolve(argOf('--data', './data'));
const OUT = path.resolve(argOf('--out', './backups'));
const KEEP_DAYS = Number(argOf('--keep-days', 14)) || 14;
const KEEP_WEEKS = Number(argOf('--keep-weeks', 8)) || 8;
const PRUNE_AUDIO_DAYS = has('--prune-audio') ? Number(argOf('--prune-audio', 0) || 7) : 0;
const DO_PRUNE = has('--prune');
const VERIFY = has('--verify');

const stamp = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const now = Date.now();
const log = (...a) => console.log(...a);

function walk(dir, filter = () => true) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full, filter));
    else if (filter(full)) out.push(full);
  }
  return out;
}

function gzipTo(src, dstRel) {
  const buf = fs.readFileSync(src);
  const gz = zlib.gzipSync(buf, { level: 9 });
  const dst = path.join(OUT, dstRel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, gz);
  return { src, dst, raw: buf.length, gz: gz.length, sha: crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16) };
}

// ---------- 1. 备份 ----------
function doBackup() {
  const day = stamp();
  const dayDir = path.join(OUT, day);
  if (!fs.existsSync(DATA)) {
    log(`✗ 找不到数据目录：${DATA}`);
    process.exit(1);
  }

  const want = [];
  for (const rel of ['world/state.json', 'world/milestones.json']) {
    const p = path.join(DATA, rel);
    if (fs.existsSync(p)) want.push(p);
  }
  for (const p of walk(path.join(DATA, 'chat'), (f) => f.endsWith('.json'))) want.push(p);

  if (!want.length) {
    log('✗ data/ 里没有可备份的文件（world/state.json 都不在），中止');
    process.exit(1);
  }

  const items = [];
  for (const src of want) {
    const rel = path.relative(DATA, src).replace(/\\/g, '/');
    items.push(gzipTo(src, path.join(day, `${rel}.gz`)));
  }

  const manifest = {
    day, at: new Date().toISOString(),
    files: items.map((x) => ({
      path: path.relative(DATA, x.src).replace(/\\/g, '/'),
      rawBytes: x.raw, gzBytes: x.gz, sha256_16: x.sha,
    })),
    totalRaw: items.reduce((s, x) => s + x.raw, 0),
    totalGz: items.reduce((s, x) => s + x.gz, 0),
  };
  fs.writeFileSync(path.join(dayDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  log(`✓ 备份完成：${items.length} 个文件 → ${dayDir}`);
  log(`  原始 ${(manifest.totalRaw / 1024).toFixed(1)} KB → 压缩 ${(manifest.totalGz / 1024).toFixed(1)} KB`);
  for (const f of manifest.files) log(`  · ${f.path}  ${(f.rawBytes / 1024).toFixed(1)} KB`);
  return dayDir;
}

// ---------- 2. 清理过期备份 ----------
function doPruneBackups() {
  if (!fs.existsSync(OUT)) return { removed: [], kept: 0 };
  const dirs = fs.readdirSync(OUT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
    .map((d) => d.name)
    .sort();

  const weekKeep = new Set();
  for (const d of dirs) {
    const dt = new Date(`${d}T00:00:00Z`);
    if (dt.getUTCDay() === 0) weekKeep.add(d); // 周日
  }
  const weeks = [...weekKeep].sort().slice(-KEEP_WEEKS);
  const weekSet = new Set(weeks);

  const removed = [];
  for (const d of dirs) {
    const ageDays = (now - new Date(`${d}T00:00:00Z`).getTime()) / 86400000;
    const isWeek = weekSet.has(d);
    const keep = isWeek ? true : ageDays <= KEEP_DAYS;
    if (!keep) {
      removed.push(d);
      if (DO_PRUNE) fs.rmSync(path.join(OUT, d), { recursive: true, force: true });
    }
  }

  if (removed.length) {
    log(`${DO_PRUNE ? '✓ 已清理' : '· 待清理（dry-run）'} ${removed.length} 份过期备份：${removed.join(', ')}`);
  } else {
    log('· 没有过期备份需要清理');
  }
  log(`  日备份保留 ${KEEP_DAYS} 天，周备份保留 ${KEEP_WEEKS} 份`);
  return { removed, kept: dirs.length - removed.length };
}

// ---------- 3. 清理旧语音 ----------
function doPruneAudio(days) {
  const voiceDir = path.join(DATA, 'voice');
  if (!fs.existsSync(voiceDir)) return;
  const files = fs.readdirSync(voiceDir).filter((f) => f.endsWith('.wav'));
  let n = 0;
  let bytes = 0;
  for (const f of files) {
    const p = path.join(voiceDir, f);
    const age = (now - fs.statSync(p).mtimeMs) / 86400000;
    if (age > days) {
      n += 1;
      bytes += fs.statSync(p).size;
      if (DO_PRUNE) fs.rmSync(p, { force: true });
    }
  }
  log(`${DO_PRUNE ? '✓ 已删' : '· 待删（dry-run）'} 语音 ${n} 条（${(bytes / 1024 / 1024).toFixed(1)} MB），阈值 ${days} 天`);
}

// ---------- 4. 校验最近一份 ----------
function doVerify() {
  if (!fs.existsSync(OUT)) {
    log('✗ 没有 backups 目录');
    process.exit(1);
  }
  const dirs = fs.readdirSync(OUT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
    .map((d) => d.name).sort();
  if (!dirs.length) {
    log('✗ 没有可校验的备份');
    process.exit(1);
  }
  const latest = dirs[dirs.length - 1];
  const manPath = path.join(OUT, latest, 'manifest.json');
  if (!fs.existsSync(manPath)) {
    log(`✗ 最近备份 ${latest} 缺 manifest.json`);
    process.exit(1);
  }
  const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
  let ok = 0;
  for (const f of man.files) {
    const gzPath = path.join(OUT, latest, `${f.path}.gz`);
    if (!fs.existsSync(gzPath)) {
      log(`  ✗ 缺文件 ${f.path}`);
      continue;
    }
    try {
      const buf = zlib.gunzipSync(fs.readFileSync(gzPath));
      const sha = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
      if (sha !== f.sha256_16) log(`  ⚠ 校验不符 ${f.path}`);
      else if (/\.json$/.test(f.path)) JSON.parse(buf.toString('utf8'));
      ok += 1;
    } catch (e) {
      log(`  ✗ 解压/解析失败 ${f.path}：${e.message}`);
    }
  }
  log(`${ok === man.files.length ? '✓' : '⚠'} 最近备份 ${latest}：${ok}/${man.files.length} 个文件校验通过`);
}

// ---------- main ----------
if (VERIFY) {
  doVerify();
} else {
  doBackup();
  doPruneBackups();
  if (PRUNE_AUDIO_DAYS > 0) doPruneAudio(PRUNE_AUDIO_DAYS);
  if (!DO_PRUNE) log('（提醒：这是 dry-run 预览，加 --prune 才会真正删除）');
}
