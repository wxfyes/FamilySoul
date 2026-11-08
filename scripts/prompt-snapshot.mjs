#!/usr/bin/env node
/**
 * 提示词装配快照（Prompt Golden Master）
 *
 * 用法：
 *   node scripts/prompt-snapshot.mjs --record   # 录基线（docs/prompt-baseline.json）
 *   node scripts/prompt-snapshot.mjs --check    # 逐字比对（Step 3 及以后每步必跑）
 *
 * 与 chat-replay 互补：chat-replay 比"回复与落库状态"，本脚本比"发给模型的 system prompt"。
 * 只归一化日期/时间戳，其余逐字比对。覆盖：主视角（古/今）、妻子视角、独立人物视角。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(ROOT, 'docs', 'prompt-baseline.json');
const mode = process.argv[2] || '--check';

const { PetService } = await import(pathToFileURL(path.join(ROOT, 'src', 'pet-service.js')).href);

function prepare() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-prompt-'));
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'chat'), { recursive: true });
  for (const f of ['state.json', 'milestones.json', 'scenes.json']) {
    const src = path.join(ROOT, 'data', 'world', f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, 'world', f));
  }
  // 固定世界时钟：只比提示词装配，不比"今天几点"
  try {
    const sf = path.join(dir, 'world', 'state.json');
    const w = JSON.parse(fs.readFileSync(sf, 'utf8'));
    w.clock = { ...(w.clock || {}), day: 600, hour: 0 };
    fs.writeFileSync(sf, JSON.stringify(w));
  } catch { /* 忽略 */ }
  return dir;
}

/** 时间戳归一：只比"装配内容"，不比哪天几点 */
function normalize(text) {
  return String(text)
    .replace(/\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?/g, '<DATE>')
    .replace(/\d{1,2}:\d{2}(:\d{2})?/g, '<TIME>')
    .replace(/\d{4}-\d{2}-\d{2}T[^\s，。]+/g, '<ISO>')
    // 真实系统时间会变"时辰"（子时/丑时…），只比装配内容，不比此刻几点
    .replace(/传统[子丑寅卯辰巳午未申酉戌亥]时/g, '传统<SHICHEN>')
    // "属于上午辰巳，日光融融，当下时令气候：…" 也是随时钟变的描述，整段掩掉
    .replace(/（属于[^）]*）/g, '（属于<TIMECTX>）');
}

const SCENARIOS = [
  { id: 'husband-full', role: '傲娇助手', member: 'husband', epoch: 'ancient' },
  { id: 'wife-full', role: '贴心管家', member: 'wife', epoch: 'ancient' },
  { id: 'modern-full', role: '傲娇助手', member: 'husband', epoch: 'modern' },
  {
    id: 'viewer-liuwenxia', role: '傲娇助手', member: 'liuwenxia', epoch: 'ancient',
    viewer: 'liuwenxia', viewerName: '柳文霞', persona: '你是柳文霞，于家酒肆老板娘。',
  },
];

async function buildAll() {
  const dir = prepare();
  try {
    const svc = new PetService({
      rolesManager: {
        getActiveRole: () => '傲娇助手',
        getRolePersona: () => '你是傲娇助手：嘴硬心软，说话简短。',
      },
      llmClient: { isReady: () => true, complete: async () => ({ text: '' }) },
      dataDir: dir,
      historyTurns: 4,
      promptMode: 'full',
    });
    const out = {};
    for (const s of SCENARIOS) {
      svc._viewerActorId = s.viewer || null;
      svc._viewerName = s.viewerName || null;
      svc._actorPersonaOverride = s.persona || null;
      const text = svc.buildSystemPrompt(s.role, 'text', s.member, s.epoch, { messages: [] });
      out[s.id] = { length: text.length, text: normalize(text) };
    }
    return out;
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* 忽略 */ }
  }
}

const silent = async (fn) => {
  const old = { log: console.log, warn: console.warn, info: console.info, debug: console.debug };
  console.log = () => {}; console.warn = () => {}; console.info = () => {}; console.debug = () => {};
  try { return await fn(); } finally {
    console.log = old.log; console.warn = old.warn; console.info = old.info; console.debug = old.debug;
  }
};

const current = await silent(buildAll);

if (mode === '--record') {
  fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2), 'utf8');
  const sizes = Object.entries(current).map(([k, v]) => `${k}=${v.length}`).join(' / ');
  console.log(`✅ 已写入 ${path.relative(ROOT, BASELINE)}（${SCENARIOS.length} 场景：${sizes}）`);
} else if (mode === '--check') {
  if (!fs.existsSync(BASELINE)) {
    console.error(`❌ 没有基线：${path.relative(ROOT, BASELINE)}，先跑 --record`);
    process.exit(2);
  }
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const diffs = [];
  for (const id of Object.keys(base)) {
    if (JSON.stringify(base[id]) !== JSON.stringify(current[id])) {
      diffs.push({ id, base: base[id], now: current[id] });
    }
  }
  if (!diffs.length) {
    console.log(`✅ prompt-snapshot 通过：${Object.keys(base).length} 个场景逐字一致`);
  } else {
    console.error(`❌ prompt-snapshot 发现 ${diffs.length} 处差异：`);
    for (const d of diffs) {
      const x = String(d.base?.text || '');
      const y = String(d.now?.text || '');
      let at = 0;
      while (at < Math.max(x.length, y.length) && x[at] === y[at]) at++;
      console.error(`—— ${d.id}（前 ${x.length} / 后 ${y.length}）首差 @${at}`);
      console.error(`  前: ${JSON.stringify(x.slice(Math.max(0, at - 60), at + 60))}`);
      console.error(`  后: ${JSON.stringify(y.slice(Math.max(0, at - 60), at + 60))}`);
    }
    process.exit(1);
  }
} else {
  console.error('用法：node scripts/prompt-snapshot.mjs --record | --check');
  process.exit(2);
}
