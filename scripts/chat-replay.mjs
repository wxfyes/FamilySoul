#!/usr/bin/env node
/**
 * 对话行为快照（Golden Master）—— 重构 pet-service.js 的第二道护城河
 *
 * 用法：
 *   node scripts/chat-replay.mjs --record   # 录基线（写入 docs/chat-replay-baseline.json）
 *   node scripts/chat-replay.mjs --check    # 逐字比对（CI / 每步重构后必跑）
 *
 * 原则：
 *   ① 完全离线：LLM 用固定桩，不连任何模型；不读写线上存档；
 *   ② 完全隔离：每个用例都在临时 data 副本里跑，跑完即删；
 *   ③ 完全确定：Math.random 用固定种子，用例之间互不影响；
 *   ④ 只比"用户可见事实"：回复文本、分角、关键落库状态（谁在哪/钱/匪），不比时间戳。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(ROOT, 'docs', 'chat-replay-baseline.json');
const SEED_FILES = ['state.json', 'milestones.json', 'scenes.json'];

const { PetService } = await import(pathToFileURL(path.join(ROOT, 'src', 'pet-service.js')).href);

/** 每个用例：输入 + 固定台词桩（模型只会"说"这一句） */
const CASES = [
  { id: 'daily-greet', input: '娘子，今日可好？', llm: '【沈婉儿】：“相公回来了，妾身这就沏茶。”' },
  { id: 'accounts', input: '酒楼这个月进项如何？', llm: '【沈婉儿】：“回相公，酒楼本月净入三十三两。”' },
  {
    id: 'group-scene',
    input: '都说说今日各忙什么。',
    setup: 'all',
    llm: '【沈婉儿】：“妾身核了茶坊的账。”\n【林芸娘】：“妾身在柜台招呼客人。”',
  },
  { id: 'summon-yunnia', input: '叫芸娘来。', llm: '【林芸娘】：“妾身来了。”' },
  { id: 'dismiss', input: '都退下歇着吧。', llm: '【沈婉儿】：“是，相公早些歇息。”' },
  { id: 'say-go-home', input: '我回家了。', llm: '【沈婉儿】：“相公说笑了。”' },
  { id: 'ask-absent', input: '紫嫣在哪？', llm: '【沈婉儿】：“紫嫣在花铺。”' },
  { id: 'withdraw-silver', input: '取二十两银子来。', llm: '【沈婉儿】：“妾身这就去取。”' },
  { id: 'call-xiaocui', input: '小翠，沏壶茶来。', llm: '【小翠】：“奴婢这就去。”' },
  {
    id: 'tavern-plan',
    input: '运河大酒楼开张的事，你们怎么看？',
    setup: 'all',
    llm: '【沈婉儿】：“妾身以为先请个好掌柜。”\n【林芸娘】：“妾身去牙行打听。”',
  },
  { id: 'empty-input', input: '   ', llm: '（不该被调用）' },
];

/** 固定种子随机数（mulberry32），保证同一用例每次跑都一样 */
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 临时 data 目录：只带世界账本，不碰线上任何文件 */
function prepareDataDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-replay-'));
  fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'chat'), { recursive: true });
  for (const f of SEED_FILES) {
    const src = path.join(ROOT, 'data', 'world', f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, 'world', f));
  }
  return dir;
}

/** 把种子世界摆成"正房日常"：相公与婉儿、小翠在正房，芸娘默在东厢（测传唤）；all=全员在场 */
function normalizeSeed(dir, c) {
  const file = path.join(dir, 'world', 'state.json');
  try {
    const w = JSON.parse(fs.readFileSync(file, 'utf8'));
    const put = (id, loc) => {
      const a = w.actors?.[id];
      if (!a) return;
      a.location = loc;
      if (!a.home) a.home = loc;
      delete a.away;
      delete a.awayUntil;
    };
    put('husband', 'husband_room');
    put('waner', 'husband_room');
    put('xiaocui', 'husband_room');
    put('yunnia', c.setup === 'all' || !w.places?.wang_mansion_east ? 'husband_room' : 'wang_mansion_east');
    if (w.actors?.husband) delete w.actors.husband.activity;
    fs.writeFileSync(file, JSON.stringify(w));
  } catch { /* 种子坏了就让用例自己报错 */ }
}

function readState(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'world', 'state.json'), 'utf8'));
  } catch {
    return {};
  }
}

/** 只取"重构期间必须保持不变"的事实，跳过时间戳/缓存等易变字段 */
function snapshotState(world) {
  const loc = (id) => world?.actors?.[id]?.location || null;
  return {
    husband: loc('husband'),
    waner: loc('waner'),
    yunnia: loc('yunnia'),
    xiaocui: loc('xiaocui'),
    silver: Math.round((Number(world?.assets?.silver) || 0) * 100) / 100,
    bandits: Object.keys(world?.bandits || {}).length,
    tasks: Array.isArray(world?.tasks) ? world.tasks.length : 0,
    quelledTotal: Number(world?.flags?.quelledTotal) || 0,
  };
}

function speakersOf(text) {
  const out = [];
  for (const m of String(text || '').matchAll(/【([^】]{1,10})】/g)) {
    const name = m[1].trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

const silent = async (fn) => {
  const old = { log: console.log, warn: console.warn, info: console.info, debug: console.debug };
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
  console.debug = () => {};
  try {
    return await fn();
  } finally {
    console.log = old.log;
    console.warn = old.warn;
    console.info = old.info;
    console.debug = old.debug;
  }
};

async function runCase(c) {
  const dir = prepareDataDir();
  normalizeSeed(dir, c);
  const realRandom = Math.random;
  Math.random = seededRandom(10086);
  try {
    const fakeLlm = {
      isReady: () => true,
      complete: async () => ({ text: c.llm }),
    };
    const rolesManager = {
      getActiveRole: () => '傲娇助手',
      // buildSystemPrompt 里 persona 是"一段字符串"，不是对象
      getRolePersona: () => '你是傲娇助手：嘴硬心软，说话简短。',
    };
    const svc = new PetService({
      rolesManager,
      llmClient: fakeLlm,
      dataDir: dir,
      historyTurns: 4,
      promptMode: 'full',
    });
    const res = await silent(() => svc.chat({ text: c.input, profileKey: 'husband', modality: 'text' }));
    const reply = typeof res?.reply === 'string' ? res.reply : String(res?.reply?.text || '');
    return {
      id: c.id,
      input: c.input,
      ok: Boolean(res?.ok),
      error: res?.ok === false ? String(res?.error || '') : '',
      reply,
      speakers: speakersOf(reply),
      state: snapshotState(readState(dir)),
    };
  } catch (e) {
    return {
      id: c.id,
      input: c.input,
      ok: false,
      error: `EXCEPTION: ${e.message}`,
      reply: '',
      speakers: [],
      state: {},
    };
  } finally {
    Math.random = realRandom;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* 忽略 */ }
  }
}

async function record() {
  const seedFile = path.join(ROOT, 'data', 'world', 'state.json');
  const seedHash = fs.existsSync(seedFile)
    ? crypto.createHash('sha1').update(fs.readFileSync(seedFile)).digest('hex').slice(0, 12)
    : 'missing';
  const cases = [];
  for (const c of CASES) {
    process.stdout.write(`  · 录制 ${c.id} …\n`);
    cases.push(await runCase(c));
  }
  const baseline = {
    meta: {
      version: 1,
      note: 'pet-service.js 重构行为快照；--record 生成，--check 逐字比对。不要手改。',
      seedHash,
      caseCount: cases.length,
      recordedAt: new Date().toISOString(),
    },
    cases,
  };
  fs.writeFileSync(BASELINE, JSON.stringify(baseline, null, 2), 'utf8');
  console.log(`\n✅ 基线已写入 ${path.relative(ROOT, BASELINE)}（${cases.length} 条用例，seed ${seedHash}）`);
}

async function check() {
  if (!fs.existsSync(BASELINE)) {
    console.error(`❌ 没有基线文件：${path.relative(ROOT, BASELINE)}，先跑 --record`);
    process.exit(2);
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const diffs = [];
  for (const expect of baseline.cases || []) {
    const c = CASES.find((x) => x.id === expect.id) || { id: expect.id, input: expect.input, llm: '' };
    const got = await runCase(c);
    const a = JSON.stringify({ ok: expect.ok, error: expect.error, reply: expect.reply, speakers: expect.speakers, state: expect.state });
    const b = JSON.stringify({ ok: got.ok, error: got.error, reply: got.reply, speakers: got.speakers, state: got.state });
    if (a !== b) {
      diffs.push({ id: expect.id, expect, got });
    }
  }
  if (!diffs.length) {
    console.log(`\n✅ chat-replay 通过：${(baseline.cases || []).length} 条用例逐字一致（seed ${baseline.meta?.seedHash || '?'}）`);
    return;
  }
  console.error(`\n❌ chat-replay 发现 ${diffs.length} 处行为差异：\n`);
  for (const d of diffs) {
    console.error(`—— 用例 ${d.id} ——`);
    if (d.expect.reply !== d.got.reply) {
      console.error(`  期望回复: ${JSON.stringify(d.expect.reply)}`);
      console.error(`  实际回复: ${JSON.stringify(d.got.reply)}`);
    }
    if (JSON.stringify(d.expect.speakers) !== JSON.stringify(d.got.speakers)) {
      console.error(`  期望分角: ${JSON.stringify(d.expect.speakers)}  实际分角: ${JSON.stringify(d.got.speakers)}`);
    }
    if (JSON.stringify(d.expect.state) !== JSON.stringify(d.got.state)) {
      console.error(`  期望状态: ${JSON.stringify(d.expect.state)}`);
      console.error(`  实际状态: ${JSON.stringify(d.got.state)}`);
    }
    if (d.expect.ok !== d.got.ok) console.error(`  期望 ok=${d.expect.ok} 实际 ok=${d.got.ok} (${d.got.error})`);
  }
  process.exit(1);
}

const arg = process.argv[2] || '--check';
if (arg === '--record') await record();
else if (arg === '--check') await check();
else {
  console.error('用法：node scripts/chat-replay.mjs --record | --check');
  process.exit(2);
}
