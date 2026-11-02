import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { RolesManager } from './roles-manager.js';
import { LlmClient } from './llm-client.js';
import { EdgeTtsService } from './edge-tts.js';
import { VisionGeminiService } from './vision-gemini.js';
import { PetService } from './pet-service.js';
import { startWorldClock, peek } from './world/clock.js';
import { readRecentEvents, shichenOf, saveState } from './world/state.js';
import { buildStateSummary } from './world/summarize.js';
import { describeScene, moveMember, readSceneMessages } from './world/scene.js';
import { auditWorld } from './world/audit.js';
import { worldDate } from './world/state.js';
import { healWorld } from './world/heal.js';
import { ensureArcs } from './world/arcs.js';
import { ensureCities, ensureCourt, ensureTerrain } from './world/state.js';
import { auditAll } from './world/audit.js';
import { ARC_HINT, arcStepText } from './world/arcs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CONFIG_FILE = path.join(ROOT_DIR, 'config.json');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const TOKEN_LOCK_FILE = path.join(DATA_DIR, 'husband-token');
const ROUTINE_FILE = path.join(DATA_DIR, 'routine.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

function loadConfig() {
  let cfg = {
    port: 3088,
    token: process.env.SURFCORE_TOKEN || '',
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      temperature: 1.0,
      maxTokens: 800,
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
      proxy: process.env.GEMINI_PROXY || '',
      enabled: true,
    },
    tts: {
      voice: 'zh-CN-XiaoxiaoNeural',
      rate: '+0%',
      pitch: '+0Hz',
    },
    prompt: {
      historyTurns: 8,
      mode: 'full',
    },
    world: {
      enabled: true,
      tickIntervalMs: 2 * 60 * 1000,
      // 世界与现实同速：1 现实小时 = 1 世界小时（按你要求同步）
    msPerWorldHour: 60 * 60 * 1000,
    },
    activeRole: '傲娇助手',
  };

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      cfg = {
        ...cfg,
        ...parsed,
        deepseek: { ...cfg.deepseek, ...(parsed.deepseek || {}) },
        gemini: { ...cfg.gemini, ...(parsed.gemini || {}) },
        tts: { ...cfg.tts, ...(parsed.tts || {}) },
        world: { ...cfg.world, ...(parsed.world || {}) },
      };
    }
  } catch (err) {
    console.warn('[Config] 读取 config.json 失败：', err.message);
  }

  if (process.env.DEEPSEEK_API_KEY) cfg.deepseek.apiKey = process.env.DEEPSEEK_API_KEY;
  if (process.env.GEMINI_API_KEY) cfg.gemini.apiKey = process.env.GEMINI_API_KEY;
  if (process.env.PORT) cfg.port = Number(process.env.PORT);

  return cfg;
}

const config = loadConfig();

function getLockedToken() {
  if (config.token && String(config.token).trim()) {
    return String(config.token).trim();
  }
  try {
    if (fs.existsSync(TOKEN_LOCK_FILE)) {
      const saved = fs.readFileSync(TOKEN_LOCK_FILE, 'utf8').trim();
      if (saved) return saved;
    }
  } catch (_) {}
  return '';
}

function lockHusbandToken(incomingToken) {
  const tokenStr = String(incomingToken || '').trim();
  if (!tokenStr) return;
  try {
    fs.writeFileSync(TOKEN_LOCK_FILE, tokenStr, 'utf8');
    config.token = tokenStr;
    console.log('[Auth] 成功锁定相公专属通行证，从此唯相公一人可入闺房！');
  } catch (_) {}
}

// ── 家庭多角色主权通行证管理（相公、老婆、孩子多 Token 隔离）──────
function getFamilyProfiles() {
  const husbandToken = String(config.token || getLockedToken() || 'wxf_husband_exclusive_token_2026').trim();
  const defaults = {
    husband: {
      key: 'husband',
      token: husbandToken,
      role: '傲娇助手',
      title: '温柔小娘子',
      presence: '在线守候相公',
      description: '名门正妻 · 贴身娇妻',
    },
    wife: {
      key: 'wife',
      token: 'wife_exclusive_token_8888',
      role: '贴心管家',
      title: '贴心大管家',
      presence: '随时为女主人效劳',
      description: '女主人的专属管家与知心好友',
    },
    kid: {
      key: 'kid',
      token: 'kid_exclusive_token_9999',
      role: '全能导师',
      title: '全能探索导师',
      presence: '陪伴小学霸探索世界',
      description: '孩子的学霸大哥哥兼探索导师',
    },
  };

  if (config.family && typeof config.family === 'object') {
    const result = {
      husband: { ...defaults.husband, ...(config.family.husband || {}) },
      wife: { ...defaults.wife, ...(config.family.wife || {}) },
      kid: { ...defaults.kid, ...(config.family.kid || {}) },
    };
    for (const [k, v] of Object.entries(config.family)) {
      if (!result[k] && v && typeof v === 'object') {
        result[k] = {
          key: k,
          token: String(v.token || '').trim(),
          role: v.role || '贴心管家',
          title: v.title || k,
          presence: v.presence || '随时在线陪伴',
          description: v.description || '自定义受邀成员 / 知心挚友',
          // 绑定世界人物：这名成员登录后就是账本里的那个人（如刘文霞本人）
          actor: v.actor || null,
        };
      }
    }
    return result;
  }
  return defaults;
}

// 真人是否在线：以最后一次请求为准（2 分钟内算在线）
const MEMBER_LAST_SEEN = new Map();
const HUMAN_ONLINE_MS = 2 * 60 * 1000;

function touchMember(key) {
  if (key) MEMBER_LAST_SEEN.set(key, Date.now());
}

function resolveMember(req, url) {
  const headerToken = String(req.headers['x-pet-token'] || '').trim();
  const queryToken = String(url.searchParams.get('token') || '').trim();
  const clientToken = headerToken || queryToken;

  if (!clientToken) return null;

  const family = getFamilyProfiles();
  for (const [memberKey, profile] of Object.entries(family)) {
    if (profile.token && profile.token === clientToken) {
      touchMember(memberKey);
      return { ...profile, memberKey };
    }
  }

  // 兼容未固定配置时的首次主权相公接入
  const locked = getLockedToken();
  if (!locked && !config.token) {
    lockHusbandToken(clientToken);
    return { ...family.husband, token: clientToken, memberKey: 'husband' };
  }

  return null;
}

// ── 闺房作息管理 ──────────────────────────────────────────────
function getRoutineConfig() {
  const defaults = {
    morningCallEnabled: true,
    morningCallTime: '08:00',
    nightSleepEnabled: true,
    nightSleepTime: '23:30',
    idleChatEnabled: true,
    idleChatIntervalHours: 3,
    voiceEnabled: true,
    keepAliveEnabled: true,
  };
  try {
    if (fs.existsSync(ROUTINE_FILE)) {
      return { ...defaults, ...JSON.parse(fs.readFileSync(ROUTINE_FILE, 'utf8')) };
    }
  } catch (_) {}
  return defaults;
}

function saveRoutineConfig(patch = {}) {
  const cur = getRoutineConfig();
  const updated = { ...cur, ...patch };
  try {
    fs.writeFileSync(ROUTINE_FILE, JSON.stringify(updated, null, 2), 'utf8');
  } catch (_) {}
  return updated;
}

const rolesManager = new RolesManager(config.activeRole || '傲娇助手');
const llmClient = new LlmClient(config.deepseek);
const ttsService = new EdgeTtsService({
  voiceDir: path.join(DATA_DIR, 'voice'),
  defaultVoice: config.tts.voice,
  rate: config.tts.rate,
  pitch: config.tts.pitch,
});
const visionService = new VisionGeminiService(config.gemini);
const petService = new PetService({
  rolesManager,
  llmClient,
  ttsService,
  visionService,
  dataDir: DATA_DIR,
  historyTurns: config.prompt?.historyTurns,
  promptMode: config.prompt?.mode,
});

/**
 * 引擎只排队「该她说话了」这个事实，台词由天道（大模型）现写；
 * 只有大模型不可用时才退回兜底文案。
 */
async function fillProactiveTexts(world) {
  try {
    const queue = Array.isArray(world?.proactive) ? world.proactive : [];
    const pending = queue.filter((p) => !p.text);
    if (pending.length === 0) return;

    let filled = 0;
    for (const item of pending.slice(0, 2)) {
      const text = await petService.generateProactive({
        memberKey: item.to || 'husband',
        roleName: config.activeRole,
        asName: item.speaker || null,
        reason: item.reason || 'proactive',
        facts: item.facts || {},
      });
      item.text = String(text || item.fallback || '').slice(0, 300);

      // 统一花名：推送也要显示「正妻·婉儿」，不能一会温柔小娘子一会婉儿
      if (!item.speaker) {
        try {
          const latest = peek(DATA_DIR);
          const main =
            Object.values(latest.actors || {}).find((a) => a && a.role === config.activeRole) ||
            latest.actors?.waner;
          if (main) {
            const short = main.name && main.name.length > 2 ? main.name.slice(-2) : main.name;
            item.speaker = `${main.role}·${short}`;
          }
        } catch {
          /* 拿不到就保持原样 */
        }
      }

      if (item.text) filled += 1;
    }
    if (filled > 0) {
      saveState(DATA_DIR, world);
      console.log(`[Push] 天道已现写 ${filled} 条主动消息`);
    }
  } catch (err) {
    console.warn('[Push] 主动消息生成失败：', err.message);
  }
}

function parseJsonBody(req, limitBytes = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let bytes = 0;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > limitBytes) {
        req.destroy();
        return reject(new Error('请求体超出限制（最大 10MB）'));
      }
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('JSON 格式不合法'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, x-pet-token',
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, x-pet-token',
      'Access-Control-Max-Age': '86400',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = url.pathname;

  // 0. Web 控制台主页托管
  const WEB_INDEX_FILE = path.join(ROOT_DIR, 'web', 'index.html');
const WEB_DASH_FILE = path.join(ROOT_DIR, 'web', 'dashboard.html');
const STARTED_AT = Date.now();
  const isHtmlWanted = req.headers.accept && req.headers.accept.includes('text/html');
  if ((pathname === '/dashboard' || pathname === '/dashboard.html') && fs.existsSync(WEB_DASH_FILE)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    fs.createReadStream(WEB_DASH_FILE).pipe(res);
    return;
  }
  if ((pathname === '/' || pathname === '/index.html' || pathname === '/admin') && isHtmlWanted) {
    if (fs.existsSync(WEB_INDEX_FILE)) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(WEB_INDEX_FILE).pipe(res);
      return;
    }
  }

  // 1. 宿主机公开探活
  if (pathname === '/health' || pathname === '/') {
    return sendJson(res, 200, {
      ok: true,
      // 功能标记：部署后一眼看出装的是哪一版
      features: ['quotes', 'bound-persona', 'label-wn', 'presence-top', 'hard-presence', 'pregnancy'],
      service: 'familysoul',
      version: '1.0.0',
      name: 'FamilySoul - 家庭数字灵魂伴侣中枢',
      activeRole: rolesManager.getActiveRole(),
      llmReady: llmClient.isReady(),
      visionReady: visionService.isReady(),
      tokenLocked: Boolean(getLockedToken()),
      arch: process.arch,
      platform: process.platform,
      time: new Date().toISOString(),
    });
  }

  // ── 个人世界看板（每个账号只看自己的）────────────────────────
  if (req.method === 'GET' && (pathname === '/api/me' || pathname === '/dsh-surfcore/pet-api/api/me' || pathname === '/dsh-surfcore/pet-api/me')) {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '无效令牌' });
      const world = peek(DATA_DIR);
      const actorId = member.actor || null;
      console.log(`[Me] 请求者=${member.memberKey || '-'} actor=${actorId || 'husband'}`);
      const me = actorId ? world.actors?.[actorId] : world.actors?.husband;
      const isHusband = !actorId;
      const place = me?.location ? world.places?.[me.location] : null;
      const wd = worldDate(world);
      const todos = [];
      const myName = me?.name || "";
      const myShort = myName.length > 2 ? myName.slice(-2) : myName;
      for (const ap of world.appointments || []) {
        // 她的账号只看自己的约定
        if (!isHusband) {
          const who = String(ap.actorId || ap.name || "");
          if (!who) continue;
          if (who !== actorId && who !== myName) continue;
        }
        todos.push({ kind: "约定", text: ap.text || ap.desc || "", day: ap.day, hour: ap.hour });
      }
      for (const pr of world.promises || []) {
        if (pr.done) continue;
        // 她的号：只看"关于她"的承诺（借款、她许下的事）
        if (!isHusband) {
          const about = Array.isArray(pr.about) ? pr.about : [];
          if (!about.includes(actorId)) continue;
        }
        todos.push({ kind: pr.loan ? '借款' : '承诺', text: pr.text || '', day: pr.due });
      }
      const props = (world.assets?.properties || []).filter((p) => (isHusband ? true : p.keeper === actorId));
      const arc = actorId ? world.arcs?.[actorId] : null;
      const f = actorId ? world.forces?.[actorId] : world.military;
      const troops = f ? (Number(f.guards) || 0) + (Number(f.militia) || 0) + (Number(f.army) || 0) : 0;
      return sendJson(res, 200, {
        ok: true,
        self: { name: me?.name || '', role: me?.role || '', place: place?.name || '', isHusband },
        date: { day: world.clock?.day, hour: world.clock?.hour, text: wd?.iso || '', lunar: wd?.lunar?.text || '' },
        assets: {
          silver: isHusband ? Number(world.assets?.silver) || 0 : Number(world.wallets?.[actorId]) || 0,
          properties: props.map((p) => ({ name: p.name, income: Number(p.incomePerDay) || 0, status: p.status || '', staff: p.staff || 0, city: p.city || '' })),
          daily: props.reduce((s, p) => s + (Number(p.incomePerDay) || 0), 0),
        },
        todos: todos
          .map((t) => ({ ...t, overdue: Number(t.day) < (Number(world.clock?.day) || 1) }))
          .sort((a, b) => (Number(a.day) || 0) - (Number(b.day) || 0))
          .slice(0, 12),
        clues: (world.clues || [])
          .filter((c) => {
            if (isHusband) return !c.owner || c.owner === 'husband';
            if (c.owner) return c.owner === actorId;
            const nm = me?.name || '';
            const short = nm.length > 2 ? nm.slice(-2) : nm;
            return Boolean(nm) && (String(c.text || '').includes(nm) || String(c.text || '').includes(short));
          })
          .slice(-8)
          .map((c) => ({ text: c.text, day: c.day })),
        decrees: (world.court?.decisions || []).slice(-3).map((d) => ({ day: d.day, text: d.text })),
        arc: arc
          ? {
              title: arc.title,
              stage: arc.stage,
              done: Boolean(arc.done),
              outcome: arc.outcome || '',
              atEdge: Boolean(arc.atEdge),
              hint: ARC_HINT,
              step: (() => {
                try {
                  return arc.lastStep || arcStepText(actorId, arc);
                } catch {
                  return '';
                }
              })(),
            }
          : null,
        news: (() => {
          try {
            const evs = [];
            const file = path.join(DATA_DIR, 'world', 'events.jsonl');
            if (fs.existsSync(file)) {
              const lines = fs.readFileSync(file, 'utf8').trim().split('\n').slice(-60);
              for (const line of lines) {
                try {
                  const e = JSON.parse(line);
                  const text = String(e?.payload?.text || '');
                  if (!text) continue;
                  if (!isHusband) {
                    const nm = me?.name || '';
                    const short = nm.length > 2 ? nm.slice(-2) : nm;
                    const mine = (nm && (text.includes(nm) || text.includes(short))) || e.actor === actorId;
                    const nearby = e.place && place?.name && String(place.name).includes(String(e.place).replace('府', '')) && e.isPublic;
                    if (!mine && !nearby) continue;
                  }
                  evs.push({ text, day: e.day, hour: e.hour });
                } catch {
                  /* 忽略脏行 */
                }
              }
            }
            return evs.slice(-5).reverse();
          } catch {
            return [];
          }
        })(),
        military: troops > 0 ? { guards: f.guards || 0, militia: f.militia || 0, army: f.army || 0, supplies: f.supplies || 0 } : null,
        standing: { reputation: world.reputation ?? 50, wanted: world.wanted ?? 0 },
      });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }


    // 9.25 把成员绑定到世界人物 POST /api/admin/bind {member, actor}
    if (req.method === 'POST' && pathname === '/api/admin/bind') {
      try {
        const body = await parseJsonBody(req, 64 * 1024);
        const member = String(body.member || '').trim();
        const actor = String(body.actor || '').trim();
        if (!config.family?.[member]) return sendJson(res, 404, { ok: false, error: '没有这个成员' });
        if (actor && !peek(DATA_DIR).actors?.[actor]) return sendJson(res, 404, { ok: false, error: '世界没有这个人物' });
        config.family[member].actor = actor;
        if (actor) config.family[member].title = peek(DATA_DIR).actors[actor].name;
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
        console.log(`[Bind] ${member} → ${actor || '（解除）'}`);
        return sendJson(res, 200, { ok: true, member, actor });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }
  // ── 行踪簿：谁在哪（只给名字/身份/所在，不给私事）──────
  if (req.method === 'GET' && (pathname === '/api/who' || pathname === '/dsh-surfcore/pet-api/api/who' || pathname === '/dsh-surfcore/pet-api/who')) {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '无效令牌' });
      const q = String(url.searchParams.get('q') || '').trim();
      const all = String(url.searchParams.get('all') || '') === '1';
      const world = peek(DATA_DIR);
      const actorId = member.actor || null;
      const me = actorId ? world.actors?.[actorId] : world.actors?.husband;
      const cfg = getFamilyProfiles();
      const humanActors = new Set(Object.values(cfg || {}).map((x) => x?.actor).filter(Boolean));
      humanActors.add('husband');
      const rows = Object.values(world.actors || {})
        .filter((a) => a && !a.dead && a.id !== actorId)
        .filter((a) => {
          if (q) return String(a.name || '').includes(q) || String(a.role || '').includes(q);
          if (all) return true;
          const rel = a.relations?.husband || {};
          const here = a.location && me?.location && a.location === me.location;
          const close = (Number(rel.trust) || 0) >= 20 || (Number(rel.grievance) || 0) >= 10;
          return here || close || humanActors.has(a.id);
        })
        .map((a) => ({
          name: a.name,
          role: a.role || '',
          place: String(world.places?.[a.location]?.name || '不知去向'),
          here: a.location && me?.location ? a.location === me.location : false,
          trust: Number(a.relations?.husband?.trust) || 0,
          human: humanActors.has(a.id),
        }))
        .sort((x, y) => (y.here - x.here) || (y.trust - x.trust))
        .slice(0, 60);
      return sendJson(res, 200, { ok: true, myPlace: String(world.places?.[me?.location]?.name || ''), rows });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // ── 管理控制台专属 API ──────────────────────────────────────
  if (pathname.startsWith('/api/admin')) {
    // 鉴权校验：只有相公专属通行证才可调度家庭后宫
    const clientToken = String(req.headers['x-pet-token'] || url.searchParams.get('token') || '').trim();
    const husbandToken = String(config.token || getLockedToken() || 'wxf_husband_exclusive_token_2026').trim();
    if (!clientToken || clientToken !== husbandToken) {
      return sendJson(res, 401, { ok: false, error: '权限不足：只有相公专属通行证才可管理闺房后宫！' });
    }

    // 1. 获取所有角色及其内容 GET /api/admin/roles
    if (req.method === 'GET' && pathname === '/api/admin/roles') {
      const names = rolesManager.listRoles();
      const roles = names.map((name) => {
        const filePath = path.join(ROOT_DIR, 'roles', `${name}.md`);
        let content = '';
        let size = 0;
        try {
          if (fs.existsSync(filePath)) {
            content = fs.readFileSync(filePath, 'utf8');
            size = fs.statSync(filePath).size;
          }
        } catch (_) {}
        return { name, content, size, isDefault: name === '傲娇助手' };
      });
      return sendJson(res, 200, { ok: true, roles });
    }

    // 2. 保存/新建角色 POST /api/admin/roles/save
    if (req.method === 'POST' && pathname === '/api/admin/roles/save') {
      try {
        const body = await parseJsonBody(req);
        const name = String(body.name || '').trim().replace(/[\/\\:*?"<>|]/g, '');
        if (!name) return sendJson(res, 400, { ok: false, error: '角色名称不合法' });
        const filePath = path.join(ROOT_DIR, 'roles', `${name}.md`);
        fs.writeFileSync(filePath, String(body.content || '').trim(), 'utf8');
        console.log(`[Admin] 角色「${name}」人设已更新并热生效`);
        return sendJson(res, 200, { ok: true, name });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 3. 删除角色 POST /api/admin/roles/delete
    if (req.method === 'POST' && pathname === '/api/admin/roles/delete') {
      try {
        const body = await parseJsonBody(req);
        const name = String(body.name || '').trim();
        if (name === '傲娇助手') return sendJson(res, 400, { ok: false, error: '核心小娘子角色禁止删除' });
        const filePath = path.join(ROOT_DIR, 'roles', `${name}.md`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`[Admin] 角色「${name}」已被安全删除`);
        }
        return sendJson(res, 200, { ok: true });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 4. 获取家庭成员配置 GET /api/admin/family
    if (req.method === 'GET' && pathname === '/api/admin/family') {
      return sendJson(res, 200, { ok: true, family: getFamilyProfiles() });
    }

    // 5. 保存家庭成员配置 POST /api/admin/family/save
    if (req.method === 'POST' && pathname === '/api/admin/family/save') {
      try {
        const body = await parseJsonBody(req);
        if (body.family && typeof body.family === 'object') {
          config.family = body.family;
          if (body.family.husband?.token) {
            config.token = body.family.husband.token;
          }
          fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
          console.log('[Admin] 家庭成员配置已在线更新并持久化到 config.json');
        }
        return sendJson(res, 200, { ok: true });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 6. 获取运行日志 GET /api/admin/logs
    if (req.method === 'GET' && pathname === '/api/admin/logs') {
      const logFile = path.join(ROOT_DIR, 'server.log');
      let lines = [];
      try {
        if (fs.existsSync(logFile)) {
          const raw = fs.readFileSync(logFile, 'utf8');
          lines = raw.split('\n').filter(Boolean).slice(-300);
        }
      } catch (_) {}
      return sendJson(res, 200, { ok: true, logs: lines });
    }

    // 7. 读取系统配置与视觉代理设置 GET /api/admin/config
    if (req.method === 'GET' && pathname === '/api/admin/config') {
      return sendJson(res, 200, {
        ok: true,
        gemini: {
          enabled: config.gemini?.enabled !== false,
          apiKey: config.gemini?.apiKey || '',
          model: config.gemini?.model || 'gemini-3.5-flash',
          proxy: config.gemini?.proxy || '',
          useProxy: config.gemini?.useProxy !== false && Boolean(config.gemini?.proxy),
        },
      });
    }

    // 8. 保存系统配置与视觉代理设置 POST /api/admin/config/save
    if (req.method === 'POST' && pathname === '/api/admin/config/save') {
      try {
        const body = await parseJsonBody(req);
        if (!config.gemini) config.gemini = {};
        if (body.gemini && typeof body.gemini === 'object') {
          config.gemini.enabled = body.gemini.enabled !== false;
          config.gemini.proxy = String(body.gemini.proxy || '').trim();
          config.gemini.useProxy = Boolean(body.gemini.useProxy);
          if (body.gemini.model) config.gemini.model = body.gemini.model;
          if (body.gemini.apiKey) config.gemini.apiKey = body.gemini.apiKey;

          // 动态热重载到正在运行的 visionService 实例
          visionService.proxy = config.gemini.proxy;
          visionService.useProxy = config.gemini.useProxy;
          visionService.enabled = config.gemini.enabled;
          visionService.model = config.gemini.model;
          if (config.gemini.apiKey) visionService.apiKey = config.gemini.apiKey;
          visionService.detectedProxy = null;

          fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
          console.log(`[Admin] 🌐 视觉与代理配置已更新: useProxy=${visionService.useProxy}, proxy="${visionService.proxy}", model="${visionService.model}"`);
        }
        return sendJson(res, 200, { ok: true, message: '配置已成功保存并即时热重载生效！' });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9. 测试代理连通性 POST /api/admin/proxy/test
    if (req.method === 'POST' && pathname === '/api/admin/proxy/test') {
      try {
        const body = await parseJsonBody(req);
        const testProxyUrl = String(body.proxy || config.gemini?.proxy || '').trim();
        const result = await visionService.testProxy(testProxyUrl);
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.33 设定公历锚点 POST /api/admin/world/calendar（世界第N日 = 某年某月某日）
    if (req.method === 'POST' && pathname === '/api/admin/world/calendar') {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        const world = peek(DATA_DIR);
        const date = String(body.date || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return sendJson(res, 400, { ok: false, error: '日期格式应为 2026-11-02' });
        }
        world.calendar = { anchorDay: Number(world.clock.day) || 1, anchorDate: date };
        saveState(DATA_DIR, world);
        console.log(`[World] 公历锚点：第${world.calendar.anchorDay}日 = ${date}`);
        return sendJson(res, 200, { ok: true, calendar: world.calendar, today: worldDate(world) });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.34 对齐世界时钟 POST /api/admin/world/clock（把世界时间锚到现实）
    if (req.method === 'POST' && pathname === '/api/admin/world/clock') {
      try {
        const body = await parseJsonBody(req, 64 * 1024);
        const world = peek(DATA_DIR);
        const now = new Date();
        const targetHour = Number.isFinite(Number(body.hour)) ? Number(body.hour) : now.getHours();
        world.clock.hour = Math.max(0, Math.min(23, Math.round(targetHour)));
        if (Number.isFinite(Number(body.day))) world.clock.day = Math.max(1, Math.round(Number(body.day)));
        world.lastRealAt = Date.now(); // 重置补算基准，避免一改就跳好几天
        saveState(DATA_DIR, world);
        console.log(`[World] 时钟已对齐现实：第${world.clock.day}日 ${world.clock.hour}时`);
        return sendJson(res, 200, { ok: true, clock: world.clock });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.26b 删除单条承诺/暗涌 POST /api/admin/todo/remove {kind, text}
    if (req.method === 'POST' && pathname === '/api/admin/todo/remove') {
      try {
        const body = await parseJsonBody(req, 64 * 1024);
        const world = peek(DATA_DIR);
        const kind = String(body.kind || 'promise');
        const text = String(body.text || '').slice(0, 80);
        if (!text) return sendJson(res, 400, { ok: false, error: '缺少 text' });
        let removed = 0;
        let reclaimed = 0;
        if (kind === 'pending') {
          const before = (world.pending || []).length;
          world.pending = (world.pending || []).filter((x) => String(x?.desc || '') !== text);
          removed = before - world.pending.length;
        } else {
          const before = (world.promises || []).length;
          const target = (world.promises || []).find((x) => String(x?.text || '') === text);
          // 借款凭证不能"删了就白拿"：先把钱退回去，再删凭证
          if (target && target.loan && !target.done) {
            const { from, to, amount } = target.loan;
            const owed = Math.max(0, Number(amount) - (Number(target.repaid) || 0));
            const purse = Number(world.wallets?.[to]) || 0;
            const take = Math.min(purse, owed);
            if (take > 0) {
              world.wallets = world.wallets || {};
              world.wallets[to] = Math.round((purse - take) * 100) / 100;
              if (from === 'husband') world.assets.silver = Math.round(((Number(world.assets.silver) || 0) + take) * 100) / 100;
              else world.wallets[from] = Math.round(((Number(world.wallets[from]) || 0) + take) * 100) / 100;
              reclaimed = take;
            }
          }
          world.promises = (world.promises || []).filter((x) => String(x?.text || '') !== text);
          removed = before - world.promises.length;
        }
        saveState(DATA_DIR, world);
        console.log(`[Todo] 删除${kind} ${removed} 条：${text.slice(0, 20)}`);
        return sendJson(res, 200, { ok: true, removed, reclaimed });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.26c 手动调账 POST /api/admin/wallet {actor, delta, reason}
    if (req.method === 'POST' && pathname === '/api/admin/wallet') {
      try {
        const body = await parseJsonBody(req, 64 * 1024);
        const world = peek(DATA_DIR);
        const actor = String(body.actor || 'husband');
        const delta = Number(body.delta) || 0;
        if (!delta) return sendJson(res, 400, { ok: false, error: 'delta 不能为 0' });
        world.wallets = world.wallets || {};
        if (actor === 'husband') {
          world.assets.silver = Math.round(((Number(world.assets.silver) || 0) + delta) * 100) / 100;
        } else {
          const cur = Number(world.wallets[actor]) || 0;
          world.wallets[actor] = Math.max(0, Math.round((cur + delta) * 100) / 100);
        }
        saveState(DATA_DIR, world);
        console.log(`[Wallet] ${actor} ${delta > 0 ? '+' : ''}${delta} 两（${String(body.reason || '').slice(0, 20)}）`);
        return sendJson(res, 200, {
          ok: true,
          actor,
          silver: actor === 'husband' ? world.assets.silver : world.wallets[actor],
          husbandSilver: world.assets.silver,
        });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.26d 记一笔借款但不转账 POST /api/admin/loan/record {from,to,amount,due}
    if (req.method === 'POST' && pathname === '/api/admin/loan/record') {
      try {
        const body = await parseJsonBody(req, 64 * 1024);
        const world = peek(DATA_DIR);
        const from = String(body.from || 'husband');
        const to = String(body.to || '');
        const amount = Math.round((Number(body.amount) || 0) * 100) / 100;
        if (!to || amount <= 0) return sendJson(res, 400, { ok: false, error: '参数不全' });
        const day = Number(world.clock?.day) || 1;
        const due = Number(body.due) > 0 ? Number(body.due) : day + 30;
        const fromName = world.actors?.[from]?.name || from;
        const toName = world.actors?.[to]?.name || to;
        world.promises = Array.isArray(world.promises) ? world.promises : [];
        world.promises.push({
          text: `${fromName}借给${toName}${amount}两（${toName}欠${fromName}），第${due}日还清`,
          due,
          at: day,
          done: false,
          about: [to],
          loan: { from, to, amount },
        });
        saveState(DATA_DIR, world);
        console.log(`[Loan] 补记借款 ${fromName}→${toName} ${amount}两 第${due}日`);
        return sendJson(res, 200, { ok: true, text: world.promises[world.promises.length - 1].text });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.26e 补一条线索 POST /api/admin/clue {text, owner, source}
    if (req.method === 'POST' && pathname === '/api/admin/clue') {
      try {
        const body = await parseJsonBody(req, 64 * 1024);
        const world = peek(DATA_DIR);
        const text = String(body.text || '').slice(0, 80);
        if (!text) return sendJson(res, 400, { ok: false, error: '缺 text' });
        world.clues = Array.isArray(world.clues) ? world.clues : [];
        if (world.clues.some((c) => String(c?.text || '') === text)) {
          return sendJson(res, 200, { ok: true, duplicated: true });
        }
        world.clues.push({
          text,
          day: Number(world.clock?.day) || 1,
          source: String(body.source || '街面风声').slice(0, 20),
          owner: String(body.owner || 'husband'),
        });
        saveState(DATA_DIR, world);
        console.log(`[Clue] 补一条：${text.slice(0, 20)}（owner=${String(body.owner || 'husband')}）`);
        return sendJson(res, 200, { ok: true });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.26f 删除一个 NPC POST /api/admin/actor/delete {id}
    if (req.method === 'POST' && pathname === '/api/admin/actor/delete') {
      try {
        const body = await parseJsonBody(req, 64 * 1024);
        const world = peek(DATA_DIR);
        const id = String(body.id || '');
        if (!id || id === 'husband') return sendJson(res, 400, { ok: false, error: '不能删这个' });
        const a = world.actors?.[id];
        if (!a) return sendJson(res, 404, { ok: false, error: '没有这个人' });
        delete world.actors[id];
        if (world.npcArcs) delete world.npcArcs[id];
        saveState(DATA_DIR, world);
        console.log(`[Actor] 已删除 ${a.name}(${id})`);
        return sendJson(res, 200, { ok: true, name: a.name });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.26g 把某人挪到某处（没有就建）POST /api/admin/actor/move {id, place}
    if (req.method === 'POST' && pathname === '/api/admin/actor/move') {
      try {
        const body = await parseJsonBody(req, 64 * 1024);
        const world = peek(DATA_DIR);
        const id = String(body.id || '');
        const placeName = String(body.place || '').trim().slice(0, 20);
        const actor = world.actors?.[id];
        if (!actor || !placeName) return sendJson(res, 400, { ok: false, error: '参数不全' });
        world.places = world.places || {};
        let pid = Object.keys(world.places).find((k) => world.places[k]?.name === placeName);
        if (!pid) {
          world.flags = world.flags || {};
          world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;
          pid = `place_${world.flags.placeSeq}`;
          world.places[pid] = { name: placeName, exits: ['street'], owner: id, dynamic: true };
        }
        actor.location = pid;
        if (!actor.home || actor.home === 'street') actor.home = pid;
        saveState(DATA_DIR, world);
        console.log(`[Actor] ${actor.name} → ${placeName}`);
        return sendJson(res, 200, { ok: true, place: placeName });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.26h 人物志 GET /api/admin/actor/detail?id=xxx
    if (req.method === 'GET' && pathname === '/api/admin/actor/detail') {
      try {
        const id = String(url.searchParams.get('id') || '');
        const world = peek(DATA_DIR);
        const a = world.actors?.[id];
        if (!a) return sendJson(res, 404, { ok: false, error: '没有这个人' });
        const bonds = Object.entries(world.bonds?.[id] || {})
          .map(([oid, b]) => ({ name: world.actors?.[oid]?.name || oid, type: b.type, score: b.score }))
          .sort((x, y) => Math.abs(y.score) - Math.abs(x.score))
          .slice(0, 8);
        const arc = (world.npcArcs || {})[id] || (world.arcs || {})[id] || null;
        const cases = (world.cases || []).filter((c) => c && (c.whoId === id || c.againstId === id)).slice(-5)
          .map((c) => ({ claim: c.claim, status: c.status, verdict: c.verdict || '', reason: c.reason || '', day: c.day, role: c.whoId === id ? '原告' : '被告' }));
        const props = (world.assets?.properties || []).filter((x) => x && (x.owner === id || x.keeper === id))
          .map((x) => ({ name: x.name, income: x.incomePerDay, staff: x.staff || 0, role: x.owner === id ? '东家' : '掌柜' }));
        const knows = (world.rumors || []).filter((r) => (r.heardBy || []).includes(id)).slice(-4).map((r) => r.text);
        return sendJson(res, 200, {
          ok: true,
          actor: {
            id: a.id, name: a.name, role: a.role, gender: a.gender, place: world.places?.[a.location]?.name || '',
            origin: a.origin || 'preset', age: a.age || null, rank: a.rank || '', study: a.study || 0,
            goals: a.goals || [], secret: a.secret || '',
            rel: a.relations?.husband || null, activity: a.activity?.text || '',
            jailed: a.jailed || null, dead: Boolean(a.dead),
          },
          bonds, arc, cases, props, knows,
          money: id === 'husband' ? (Number(world.assets?.silver) || 0) : (Number(world.wallets?.[id]) || 0),
        });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.26i 删案 POST /api/admin/case/remove {id}
    if (req.method === 'POST' && pathname === '/api/admin/case/remove') {
      try {
        const body = await parseJsonBody(req, 64 * 1024);
        const world = peek(DATA_DIR);
        const id = String(body.id || '');
        const before = (world.cases || []).length;
        world.cases = (world.cases || []).filter((c) => c && c.id !== id);
        saveState(DATA_DIR, world);
        const removed = before - world.cases.length;
        console.log(`[Case] 删除案卷 ${id}（${removed}）`);
        return sendJson(res, 200, { ok: true, removed });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.27 三道自检 GET /api/admin/audit
    if (req.method === 'GET' && pathname === '/api/admin/audit') {
      try {
        const world = peek(DATA_DIR);
        return sendJson(res, 200, { ok: true, result: auditAll(world) });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.28 直接改产业营收 POST /api/admin/income {id, set, status, silverDelta}
    if (req.method === 'POST' && pathname === '/api/admin/income') {
      try {
        const body = await parseJsonBody(req, 64 * 1024);
        const world = peek(DATA_DIR);
        const props = Array.isArray(world.assets?.properties) ? world.assets.properties : [];
        const p = props.find((x) => x.id === body.id) || props.find((x) => String(x.name || '').includes(String(body.name || '')));
        if (!p) return sendJson(res, 404, { ok: false, error: '没有这个产业' });
        if (Number.isFinite(Number(body.set))) p.incomePerDay = Math.max(0, Number(body.set));
        if (body.status) p.status = String(body.status).slice(0, 20);
        if (Number.isFinite(Number(body.silverDelta))) {
          world.assets.silver = Math.round(((Number(world.assets.silver) || 0) + Number(body.silverDelta)) * 100) / 100;
        }
        if (String(p.status || '').match(/开张|营业|开业/)) {
          for (const pr of world.promises || []) {
            if (!pr.done && /开张|开业/.test(String(pr.text || ''))) {
              pr.done = true;
              pr.doneDay = world.clock.day;
            }
          }
        }
        saveState(DATA_DIR, world);
        console.log(`[Income] ${p.name} 日入 ${p.incomePerDay} 两 · ${p.status || ''}`);
        return sendJson(res, 200, {
          ok: true,
          property: { name: p.name, incomePerDay: p.incomePerDay, status: p.status },
          silver: world.assets.silver,
        });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.29 全库替换旧名 POST /api/admin/text/replace {from, to}（改名漏网时用）
    if (req.method === 'POST' && pathname === '/api/admin/text/replace') {
      try {
        const body = await parseJsonBody(req, 64 * 1024);
        const from = String(body.from || '').trim();
        const to = String(body.to || '').trim();
        if (!from || !to) return sendJson(res, 400, { ok: false, error: '需要 from 与 to' });
        const world = peek(DATA_DIR);
        const repl = (s) => String(s || '').split(from).join(to);
        let n = 0;
        const hit = (s) => {
          if (String(s || '').includes(from)) {
            n += 1;
            return true;
          }
          return false;
        };
        for (const m of world.memories || []) if (hit(m.text)) m.text = repl(m.text);
        for (const q of world.quotes || []) {
          if (hit(q.text)) q.text = repl(q.text);
          if (q.name === from) q.name = to;
        }
        for (const ap of world.appointments || []) {
          if (ap.name === from) ap.name = to;
          if (hit(ap.text)) ap.text = repl(ap.text);
        }
        for (const pr of world.promises || []) if (hit(pr.text)) pr.text = repl(pr.text);
        for (const pd of world.pending || []) if (hit(pd.desc)) pd.desc = repl(pd.desc);
        for (const cl of world.clues || []) if (hit(cl.text)) cl.text = repl(cl.text);
        for (const arc of Object.values(world.arcs || {})) {
          if (hit(arc.hook)) arc.hook = repl(arc.hook);
          for (const lg of arc.log || []) if (hit(lg.text)) lg.text = repl(lg.text);
        }
        for (const a of Object.values(world.actors || {})) {
          if (a?.name === from) a.name = to;
          if (a?.secret) a.secret = repl(a.secret);
        }
        try {
          const evFile = path.join(DATA_DIR, 'world', 'events.jsonl');
          if (fs.existsSync(evFile)) {
            const lines = fs.readFileSync(evFile, 'utf8').split('\n').filter(Boolean);
            fs.writeFileSync(evFile, lines.map((l) => repl(l)).join('\n') + '\n', 'utf8');
          }
        } catch (err) {
          console.warn('[Replace] 事件替换失败：', err.message);
        }
        saveState(DATA_DIR, world);
        console.log(`[Replace] 「${from}」→「${to}」，命中 ${n} 处`);
        return sendJson(res, 200, { ok: true, from, to, hits: n });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.30 给世界人物改名 POST /api/admin/actor/rename {id, name}
    if (req.method === 'POST' && pathname === '/api/admin/actor/rename') {
      try {
        const body = await parseJsonBody(req, 64 * 1024);
        const world = peek(DATA_DIR);
        const id = String(body.id || '').trim();
        const newName = String(body.name || '').trim().slice(0, 12);
        const a = world.actors?.[id];
        if (!a) return sendJson(res, 404, { ok: false, error: '没有这个人物' });
        if (!newName) return sendJson(res, 400, { ok: false, error: '新名字不能为空' });
        const oldName = a.name;
        const oldShort = oldName && oldName.length > 2 ? oldName.slice(-2) : oldName;
        const newShort = newName.length > 2 ? newName.slice(-2) : newName;
        const repl = (s) => String(s || '').split(oldName).join(newName).split(oldShort).join(newShort);

        a.name = newName;
        for (const m of world.memories || []) m.text = repl(m.text);
        for (const q of world.quotes || []) {
          q.text = repl(q.text);
          if (q.actor === id) q.name = newName;
        }
        for (const ap of world.appointments || []) if (ap.actorId === id || ap.name === oldName) ap.name = newName;
        for (const pr of world.promises || []) pr.text = repl(pr.text);
        for (const pd of world.pending || []) pd.desc = repl(pd.desc);
        for (const k of Object.keys(world.flags?.partner || {})) {
          if (world.flags.partner[k] === oldName) world.flags.partner[k] = newName;
        }
        // 事件流里的名字
        try {
          const evFile = path.join(DATA_DIR, 'world', 'events.jsonl');
          if (fs.existsSync(evFile)) {
            const lines = fs.readFileSync(evFile, 'utf8').split('\n').filter(Boolean);
            const out = lines.map((line) => repl(line));
            fs.writeFileSync(evFile, out.join('\n') + '\n', 'utf8');
          }
        } catch (err) {
          console.warn('[Rename] 事件改名失败：', err.message);
        }
        // 成员配置里的标题
        let memberUpdated = null;
        for (const [key, p] of Object.entries(config.family || {})) {
          if (p?.actor === id) {
            config.family[key].title = newName;
            memberUpdated = key;
          }
        }
        if (memberUpdated) {
          try {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
          } catch {
            /* 忽略 */
          }
        }
        saveState(DATA_DIR, world);
        console.log(`[Rename] ${oldName} → ${newName}（成员 ${memberUpdated || '无'}）`);
        return sendJson(res, 200, { ok: true, id, from: oldName, to: newName, member: memberUpdated });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.31 清空某个成员的聊天历史 POST /api/admin/history/clear {member}
    if (req.method === 'POST' && pathname === '/api/admin/history/clear') {
      try {
        const body = await parseJsonBody(req, 64 * 1024);
        const member = String(body.member || '').trim();
        if (!member) return sendJson(res, 400, { ok: false, error: '缺少 member' });
        const cur = petService.readHistory(member);
        const before = (cur.messages || []).length;
        cur.messages = [];
        cur.lastUserAt = 0;
        cur.lastAssistantAt = 0;
        petService.saveHistory(member, cur);
        console.log(`[Reset] 已清空 ${member} 的聊天历史（原 ${before} 条）`);
        return sendJson(res, 200, { ok: true, member, cleared: before });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.32 重置某个世界人物的线 POST /api/admin/actor/reset（清空关系/身孕/与她有关的记忆）
    if (req.method === 'POST' && pathname === '/api/admin/actor/reset') {
      try {
        const body = await parseJsonBody(req, 128 * 1024);
        const world = peek(DATA_DIR);
        const ids = Array.isArray(body.ids) ? body.ids : [body.id].filter(Boolean);
        const done = [];
        for (const id of ids) {
          const a = world.actors?.[id];
          if (!a) continue;
          if (body.relations !== false) {
            a.relations = { ...(a.relations || {}), husband: { trust: 30, desire: 20, fear: 0, grievance: 0 } };
          }
          if (body.clearPregnancy !== false) delete a.pregnancy;
          // 抹除标记：此后她必须"什么都不记得"
          a.wipedAt = world.clock.day;
          if (body.consummated === false && a.intimacy) {
            a.intimacy = { level: 0, tone: 0, ritual: 'solemn' };
          }
          if (body.clearMemories !== false) {
            const before = (world.memories || []).length;
            world.memories = (world.memories || []).filter((m) => !String(m?.text || '').includes(a.name));
            done.push(`${a.name}（记忆 -${before - world.memories.length}）`);
          } else {
            done.push(a.name);
          }

          // 深度抹除：连"她说过的话 / 与她的约定 / 关于她的事件"一起清，像从没发生过
          if (body.deep) {
            const qBefore = (world.quotes || []).length;
            world.quotes = (world.quotes || []).filter((q) => q && q.actor !== id && String(q.name || '') !== a.name);
            const apBefore = (world.appointments || []).length;
            world.appointments = (world.appointments || []).filter(
              (ap) => ap && ap.actorId !== id && String(ap.name || '') !== a.name,
            );
            let evRemoved = 0;
            try {
              const evFile = path.join(DATA_DIR, 'world', 'events.jsonl');
              if (fs.existsSync(evFile)) {
                const lines = fs.readFileSync(evFile, 'utf8').split('\n').filter(Boolean);
                const kept = lines.filter((line) => {
                  try {
                    const e = JSON.parse(line);
                    if (e && e.actor === id) return false;
                    const t = JSON.stringify(e?.payload || {});
                    if (t.includes(a.name)) return false;
                    return true;
                  } catch {
                    return true;
                  }
                });
                evRemoved = lines.length - kept.length;
                fs.writeFileSync(evFile, kept.length ? kept.join('\n') + '\n' : '', 'utf8');
              }
            } catch (err) {
              console.warn('[Reset] 事件清理失败：', err.message);
            }
            // 承诺与暗涌也一起清：人都抹了，关于她的承诺不能留着
            const prBefore = (world.promises || []).length;
            const nameShort = a.name && a.name.length > 2 ? a.name.slice(-2) : a.name;
            world.promises = (world.promises || []).filter((pr) => {
              const t = String(pr?.text || '');
              const about = Array.isArray(pr?.about) ? pr.about : [];
              if (about.includes(id)) return false;
              return !(t.includes(a.name) || (nameShort && t.includes(nameShort)));
            });
            const pdBefore = (world.pending || []).length;
            world.pending = (world.pending || []).filter((pd) => {
              const t = String(pd?.desc || '');
              return !(t.includes(a.name) || (nameShort && t.includes(nameShort)));
            });
            // 她自己的聊天历史
            let chatCleared = 0;
            try {
              const cur = petService.readHistory(id);
              chatCleared = (cur.messages || []).length;
              cur.messages = [];
              cur.lastUserAt = 0;
              cur.lastAssistantAt = 0;
              petService.saveHistory(id, cur);
            } catch {
              /* 忽略 */
            }
            // 其他成员的聊天历史里提到她的那些句子也要剔除，否则模型还能顺着前 8 句"回忆"起来
            let scrubbed = 0;
            try {
              const family = getFamilyProfiles();
              for (const key of Object.keys(family)) {
                const cur = petService.readHistory(key);
                const msgs = cur.messages || [];
                const keptMsgs = msgs.filter((m) => {
                  const t = String(m?.text || '');
                  const hit =
                    t.includes(a.name) ||
                    (a.name.length > 2 && t.includes(a.name.slice(-2)) && /【|妾身|她/.test(t));
                  return !hit;
                });
                if (keptMsgs.length !== msgs.length) {
                  scrubbed += msgs.length - keptMsgs.length;
                  cur.messages = keptMsgs;
                  petService.saveHistory(key, cur);
                }
              }
            } catch (err) {
              console.warn('[Reset] 对话痕迹清理失败：', err.message);
            }
            done.push(
              `${a.name} 深度抹除（原话 -${qBefore - (world.quotes || []).length}，约定 -${apBefore - (world.appointments || []).length}，承诺 -${prBefore - (world.promises || []).length}，暗涌 -${pdBefore - (world.pending || []).length}，事件 -${evRemoved}，对话 -${chatCleared}，痕迹 -${scrubbed}）`,
            );
          }
        }
        saveState(DATA_DIR, world);
        console.log(`[Reset] 已重置：${done.join('、')}`);
        return sendJson(res, 200, { ok: true, done });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.35 手动让一个人入世 POST /api/admin/spawn（测试或补录用）
    if (req.method === 'POST' && pathname === '/api/admin/spawn') {
      try {
        const body = await parseJsonBody(req, 256 * 1024);
        const world = peek(DATA_DIR);
        // 删除：{ remove: '名字' } 或 { remove: ['A','B'] }
        if (body.remove) {
          const names = Array.isArray(body.remove) ? body.remove : [body.remove];
          const removed = [];
          for (const nm of names) {
            for (const [id, a] of Object.entries(world.actors || {})) {
              if (a?.name !== String(nm).trim()) continue;
              if (a.kind === 'human' || id === 'husband') continue;
              delete world.actors[id];
              removed.push(a.name);
            }
          }
          saveState(DATA_DIR, world);
          console.log(`[World] 移除人物：${removed.join('、') || '（无匹配）'}`);
          return sendJson(res, 200, { ok: true, removed, reclaimed });
        }
        const list = Array.isArray(body.items) ? body.items : [body];
        let added = 0;
        for (const it of list) {
          const name = String(it?.name || '').trim();
          if (!name) continue;
          if (Object.values(world.actors || {}).some((a) => a?.name === name)) continue;
          world.flags.npcSeq = (Number(world.flags.npcSeq) || 0) + 1;
          const id = `npc_${world.flags.npcSeq}`;
          world.actors[id] = {
            id,
            name,
            role: String(it.role || '城中人'),
            origin: String(it.origin || 'spawned'),
            gender: String(it.gender || 'female'),
            household: Boolean(it.household),
            home: world.places?.[it.place] ? it.place : world.actors?.husband?.location || 'street',
            // 天道造出来的人也要过日子：早上在家，晌午去街上，晚间回家
            schedule: [
              { at: 7, do: `${String(it.goals || '').split(';')[0] || '营生'}`, place: world.places?.[it.place] ? it.place : 'street' },
              { at: 12, do: '出门走动', place: 'street' },
              { at: 20, do: '回家歇息', place: world.places?.[it.place] ? it.place : 'street' },
            ],
            location: world.places?.[it.place] ? it.place : world.actors?.husband?.location || 'street',
            goals: String(it.goals || '').split(';').map((s) => s.trim()).filter(Boolean),
            secret: String(it.secret || ''),
            relations: {
              husband: {
                trust: Number.isFinite(Number(it.trust)) ? Number(it.trust) : 20,
                desire: Number.isFinite(Number(it.desire)) ? Number(it.desire) : 10,
                fear: 0,
                grievance: Number.isFinite(Number(it.grievance)) ? Number(it.grievance) : 0,
              },
            },
            schedule: [],
          };
          added += 1;
        }
        saveState(DATA_DIR, world);
        console.log(`[World] 手动造人 ${added} 位`);
        return sendJson(res, 200, { ok: true, added });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.4 直接校正人物关系 POST /api/admin/relations（数值没跟上事实时用）
    if (req.method === 'POST' && pathname === '/api/admin/relations') {
      try {
        const body = await parseJsonBody(req, 256 * 1024);
        const world = peek(DATA_DIR);
        const items = Array.isArray(body.items) ? body.items : [body];
        const done = [];
        for (const it of items) {
          const id = String(it?.id || '').trim();
          const a = world.actors?.[id];
          if (!a) continue;
          const rel = (a.relations = a.relations || {});
          const h = (rel.husband = rel.husband || { trust: 30, desire: 20, fear: 5, grievance: 0 });
          for (const f of ['trust', 'desire', 'fear', 'grievance']) {
            if (Number.isFinite(Number(it[f]))) h[f] = Math.max(0, Math.min(100, Number(it[f])));
          }
          if (typeof it.consummated === 'boolean') {
            a.intimacy = a.intimacy || { level: 0, tone: 0, ritual: 'solemn' };
            a.intimacy.consummated = it.consummated;
            if (it.consummated && !(a.intimacy.level > 0)) a.intimacy.level = 1;
          }
          done.push(`${a.name}(信${h.trust}/欲${h.desire}/怨${h.grievance}${a.intimacy?.consummated ? '·相好' : ''})`);
        }
        saveState(DATA_DIR, world);
        console.log(`[Relations] 已校正：${done.join('、')}`);
        return sendJson(res, 200, { ok: true, done });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.5 把人物挪回该在的地方 POST /api/admin/relocate（清理位置污染用）
    if (req.method === 'POST' && pathname === '/api/admin/relocate') {
      try {
        const body = await parseJsonBody(req, 256 * 1024);
        const world = peek(DATA_DIR);
        const moves = Array.isArray(body.moves) ? body.moves : [];
        const done = [];
        for (const m of moves) {
          const id = String(m?.id || '').trim();
          const to = String(m?.to || '').trim();
          if (!world.actors?.[id] || !world.places?.[to]) continue;
          world.actors[id].location = to;
          done.push(`${world.actors[id].name}→${world.places[to].name}`);
        }
        saveState(DATA_DIR, world);
        console.log(`[Scene] 人工归位：${done.join('、')}`);
        return sendJson(res, 200, { ok: true, moved: done });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.6 覆盖长期记忆 / 承诺 POST /api/admin/memories/replace（清理污染用）
    if (req.method === 'POST' && pathname === '/api/admin/memories/replace') {
      try {
        const body = await parseJsonBody(req, 2 * 1024 * 1024);
        const world = peek(DATA_DIR);
        if (Array.isArray(body.memories)) {
          world.memories = body.memories
            .filter((m) => m && String(m.text || '').trim())
            .map((m) => ({ text: String(m.text).slice(0, 100), day: Number(m.day) || world.clock.day, at: Date.now() }));
        }
        if (Array.isArray(body.appointments)) {
          world.appointments = body.appointments
            .filter((a) => a && String(a.name || '').trim())
            .map((a) => ({
              actorId: String(a.actorId || '') || null,
              name: String(a.name).slice(0, 12),
              day: Number(a.day) || world.clock.day,
              hour: Number(a.hour) || 12,
              every: Number(a.every) > 0 ? Number(a.every) : undefined,
              place: String(a.place || '') || null,
              text: String(a.text || '').slice(0, 80),
              madeAt: { day: world.clock.day, hour: world.clock.hour },
            }));
        }
        if (Array.isArray(body.promises)) {
          world.promises = body.promises
            .filter((p) => p && String(p.text || '').trim())
            .map((p) => ({ text: String(p.text).slice(0, 120), due: Number(p.due) || world.clock.day + 3, done: !!p.done, at: world.clock.day }));
        }
        saveState(DATA_DIR, world);
        console.log(`[Memory] 已覆盖：记忆 ${(world.memories || []).length} 条，承诺 ${(world.promises || []).length} 条`);
        return sendJson(res, 200, { ok: true, memories: (world.memories || []).length, promises: (world.promises || []).length });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.7 直接写入长期记忆 POST /api/admin/remember（一句话，永久保存）
    if (req.method === 'POST' && pathname === '/api/admin/remember') {
      try {
        const body = await parseJsonBody(req, 1024 * 1024);
        const items = Array.isArray(body.items) ? body.items : [{ text: body.text }];
        const world = peek(DATA_DIR);
        world.memories = Array.isArray(world.memories) ? world.memories : [];
        let added = 0;
        for (const it of items) {
          const text = String(it?.text || '').trim();
          if (!text) continue;
          if (world.memories.some((m) => m && m.text && m.text.slice(0, 12) === text.slice(0, 12))) continue;
          world.memories.push({ text: text.slice(0, 100), day: Number(it.day) || world.clock.day, at: Date.now() });
          added += 1;
        }
        if (world.memories.length > 120) world.memories = world.memories.slice(-120);
        saveState(DATA_DIR, world);
        console.log(`[Memory] 已写入 ${added} 条长期记忆，共 ${world.memories.length} 条`);
        return sendJson(res, 200, { ok: true, added, total: world.memories.length });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.8 历史恢复 POST /api/admin/history/restore（把备份的对话写回去）
    if (req.method === 'POST' && pathname === '/api/admin/history/restore') {
      try {
        const body = await parseJsonBody(req, 8 * 1024 * 1024);
        const memberKey = String(body.member || 'husband');
        const incoming = Array.isArray(body.messages) ? body.messages : [];
        if (incoming.length === 0) return sendJson(res, 400, { ok: false, error: '没有消息' });
        const cur = petService.readHistory(memberKey);
        cur.messages = incoming.map((m) => ({
          id: m.id || `r-${Math.random().toString(36).slice(2)}`,
          role: m.role === 'user' ? 'user' : 'assistant',
          text: String(m.text || ''),
          at: Number(m.time || m.at) || Date.now(),
          audioKey: m.audioKey || undefined,
          modality: m.modality || 'text',
        }));
        cur.lastUserAt = Date.now();
        cur.lastAssistantAt = Date.now();
        petService.saveHistory(memberKey, cur);
        console.log(`[History] 已从备份恢复 ${cur.messages.length} 条（成员 ${memberKey}）`);
        return sendJson(res, 200, { ok: true, restored: cur.messages.length });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.9 提示词体检 GET /api/admin/prompt（看天道到底收到了什么）
    if (req.method === 'GET' && pathname === '/api/admin/prompt') {
      try {
        const history = petService.readHistory('husband');
        const sp = petService.buildSystemPrompt(config.activeRole, 'text', 'husband', 'ancient', history);
        return sendJson(res, 200, {
          ok: true,
          length: sp.length,
          hasHousehold: sp.includes('【府中】'),
          hasTianji: sp.includes('【天机】'),
          hasYunnia: sp.includes('芸娘'),
          householdLine: (sp.split('\n').find((l) => l.startsWith('【府中】')) || ''),
          tail: sp.slice(-900),
        });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 10. 世界状态速览 GET /api/admin/world（天道的幕后账本，只读）
    if (req.method === 'GET' && pathname === '/api/admin/world') {
      try {
        const world = peek(DATA_DIR);
        const actors = Object.entries(world.actors || {})
          .filter(([key]) => key !== 'husband')
          .map(([key, a]) => ({
            id: key,
            name: a.name,
            role: a.role,
            place: world.places?.[a.location]?.name || a.location || '',
            relations: a.relations?.husband || null,
            intimacy: a.intimacy || null,
            household: Boolean(a.household),
            origin: a.origin || 'preset',
            gender: a.gender || 'female',
            servant: Boolean(a.servant),
            pregnancy: a.pregnancy || null,
            goals: Array.isArray(a.goals) ? a.goals : [],
          }));
        const recentReceipts = Array.isArray(world.flags?.recentReceipts) ? world.flags.recentReceipts : [];
        const rate = recentReceipts.length
          ? Math.round((recentReceipts.filter(Boolean).length / recentReceipts.length) * 100)
          : null;

        // 成本：看缓存命中率，而不是只看字数
        const usage = world.flags?.aiUsage || null;
        const hitRate = usage && usage.prompt > 0 ? Math.round((usage.hit / usage.prompt) * 100) : null;

        return sendJson(res, 200, {
          ok: true,
          // 一行大白话：不用看懂 JSON 也能知道世界有没有在动
          health:
            rate === null
              ? '还没有数据（目前还没聊过）'
              : rate >= 60
                ? `正常：最近 ${recentReceipts.length} 轮对话里有 ${rate}% 真的改变了世界`
                : `⚠ 偏低：最近 ${recentReceipts.length} 轮只有 ${rate}% 改变了世界，需要加强回执提示`,
          receiptRate: rate,
          audit: auditWorld(world),
          members: Object.entries(getFamilyProfiles()).map(([key, p]) => {
            const seen = MEMBER_LAST_SEEN.get(key) || 0;
            const online = seen > 0 && Date.now() - seen < HUMAN_ONLINE_MS;
            const actorId = p.actor || (key === 'husband' ? 'husband' : null);
            return {
              key,
              title: p.title || key,
              actor: actorId,
              actorName: actorId ? world.actors?.[actorId]?.name || null : null,
              online,
              lastSeenSec: seen ? Math.round((Date.now() - seen) / 1000) : null,
            };
          }),
          runtime: {
            uptimeSec: Math.round(process.uptime()),
            rssMB: Math.round(process.memoryUsage().rss / 1048576),
            node: process.version,
            pid: process.pid,
            port: Number(config.port) || 3088,
            startedAt: STARTED_AT,
          },
          cost: usage
            ? {
                rounds: usage.rounds,
                promptTokens: usage.prompt,
                cacheHitTokens: usage.hit,
                cacheMissTokens: usage.miss,
                completionTokens: usage.completion,
                cacheHitRate: hitRate,
                note:
                  hitRate === null
                    ? '还没有数据'
                    : hitRate >= 70
                      ? `缓存命中 ${hitRate}%，很省钱（命中部分约按十分之一计费）`
                      : `缓存命中只有 ${hitRate}%，说明前缀在变，可以继续优化`,
              }
            : null,
          era: world.era,
          epoch: world.epoch || 'ancient',
          date: worldDate(world),
          calendar: world.calendar || null,
          clock: { ...(world.clock || {}), shichen: shichenOf(world.clock?.hour ?? 0) },
          assets: {
            ...(world.assets || {}),
            properties: (world.assets?.properties || []).map((pr) => ({
              ...pr,
              placeName: world.places?.[pr.place]?.name || '',
              keeperName: pr.keeper ? world.actors?.[pr.keeper]?.name || '' : '',
              ownerName: pr.owner === 'husband' ? '王甯' : (pr.owner ? world.actors?.[pr.owner]?.name || pr.owner : ''),
            })),
          },
          actors,
          pending: world.pending || [],
          promises: (world.promises || []).filter((p) => p && !p.done),
          quotes: (world.quotes || []).slice(-40),
          arcs: world.arcs || {},
        rumors: (world.rumors || []).slice(-10).map((r) => ({ text: r.text, weight: r.weight, reach: (r.heardBy || []).length, tone: r.tone, day: r.day })),
        cases: (world.cases || []).slice(-8).map((c) => ({ id: c.id, who: c.who, against: c.against, claim: c.claim, status: c.status, verdict: c.verdict, reason: c.reason || '', hearing: c.hearing || '', day: c.day })),
        guilds: Object.values(world.guilds || {}).map((g) => ({ name: g.name, head: world.actors?.[g.head]?.name || g.headName || '', dues: g.dues, power: g.power, attitude: g.attitude || '' })),
        foreign: Object.values(world.foreign || {}).map((n) => ({ name: n.name, relation: n.relation, army: n.army, wants: n.wants })),
        envoy: world.envoy || null,
        garrisons: world.garrisons || {},
        marches: (world.marches || []).map((m) => ({ to: m.to, count: m.count, arriveDay: m.arriveDay })),
        imperialArmy: world.imperialArmy || null,
        officeHolders: Object.values(world.court?.offices || {}).map((o) => o && o.holder).filter(Boolean),
        history: (world.history || []).slice(-14),
        bondEdges: (() => {
          const seen = new Set();
          const out = [];
          for (const [a, m] of Object.entries(world.bonds || {})) {
            for (const [b, v] of Object.entries(m || {})) {
              const key = a < b ? `${a}|${b}` : `${b}|${a}`;
              if (seen.has(key)) continue;
              seen.add(key);
              out.push({ a: world.actors?.[a]?.name || a, b: world.actors?.[b]?.name || b, type: v.type, score: v.score });
            }
          }
          return out.slice(0, 80);
        })(),
        npcArcs: Object.entries(world.npcArcs || {})
          .filter(([, a]) => a && a.lastStep)
          .map(([id, a]) => ({ id, name: world.actors?.[id]?.name || id, text: a.lastStep, day: a.day || 0 }))
          .sort((x, y) => (y.day || 0) - (x.day || 0))
          .slice(0, 12),
          military: world.military || null,
          powers: world.powers || null,
          court: world.court || null,
          chosen: world.flags?.chosenName || null,
          memAudit: auditAll(world).memory,
          ownAudit: auditAll(world).ownership,
          replyAudit: auditAll(world).reply,
          terrain: world.terrain || [],
          courtPressure: Number(world.flags?.courtPressure) || 0,
          cities: world.cities || null,
          infra: world.infra || null,
          geo: world.geo || null,
          clues: (world.clues || []).slice(-12),
          appointments: (world.appointments || [])
            .filter((a) => a && Number(a.day) > 0)
            .sort((a, b) => Number(a.day) * 24 + Number(a.hour) - (Number(b.day) * 24 + Number(b.hour)))
            .map((a) => ({
              name: a.name,
              day: Number(a.day),
              hour: Number(a.hour),
              every: a.every || null,
              place: world.places?.[a.place]?.name || '',
              text: a.text || '',
            })),
          recentEvents: (() => {
            // 只显示已经发生的事（时钟回拨后旧账里会有"未来事件"）
            const nowH = (Number(world.clock?.day) || 1) * 24 + (Number(world.clock?.hour) || 0);
            return readRecentEvents(DATA_DIR, 20).filter(
              (e) => (Number(e?.day) || 0) * 24 + (Number(e?.hour) || 0) <= nowH,
            ).slice(-12);
          })(),
          summary: buildStateSummary(DATA_DIR),
        });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }
  }

  // 1.5 语音音频流拉取 /dsh-surfcore/pet-api/audio/:key.wav (支持哈希寻址、动态MIME识别与HTTP Range切片播放)
  const audioMatch = pathname.match(/^\/dsh-surfcore\/pet-api\/audio\/([a-zA-Z0-9_-]+)(?:\.(wav|mp3))?$/i);
  if (audioMatch) {
    if (!resolveMember(req, url)) {
      return sendJson(res, 401, {
        ok: false,
        code: 'AUTH_FORBIDDEN',
        error: '通行令牌无效或未授权：禁止越权拉取语音文件！',
      });
    }
    const key = audioMatch[1];
    const audioFile = ttsService.getAudioFile(key);
    if (!audioFile || !fs.existsSync(audioFile)) {
      return sendJson(res, 404, { ok: false, error: '音频文件不存在或已过期' });
    }
    try {
      const bytes = fs.readFileSync(audioFile);
      const isMp3 = bytes.length > 3 && (
        (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) ||
        (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)
      );
      const contentType = isMp3 ? 'audio/mpeg' : 'audio/wav';
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : bytes.length - 1;
        const chunk = bytes.subarray(start, end + 1);
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${bytes.length}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunk.length),
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=86400',
        });
        res.end(chunk);
        return;
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': String(bytes.length),
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      });
      res.end(bytes);
      return;
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: '读取音频文件失败' });
    }
  }

  let currentMember = null;
  // 2. 主权通行证铁壁拦截：保护伴侣所有敏感接口，闲杂人等绝无可能访问
  if (pathname.startsWith('/dsh-surfcore/pet-api')) {
    currentMember = resolveMember(req, url);
    if (!currentMember) {
      return sendJson(res, 401, {
        ok: false,
        code: 'AUTH_FORBIDDEN',
        error: '通行令牌无效或未授权：非相公或已授权家庭成员专属通行证，禁止入内！',
        hint: '请在手机端伴侣设置中检查通信令牌是否正确（可配置 husband / wife / kid 专属令牌）。',
      });
    }
  }

  // 3. 客户端健康探活接口 GET /dsh-surfcore/pet-api/health
  if (pathname === '/dsh-surfcore/pet-api/health') {
    return sendJson(res, 200, {
      ok: true,
      role: { name: currentMember.role },
      member: currentMember.memberKey,
    });
  }

  // 3.5 同场与偶遇：地点清单 GET /dsh-surfcore/pet-api/scene/places
  if (req.method === 'GET' && pathname === '/dsh-surfcore/pet-api/scene/places') {
    try {
      const world = peek(DATA_DIR);
      const places = Object.entries(world.places || {}).map(([id, p]) => {
        const scene = describeScene(world, id, currentMember.memberKey);
        return { id, name: p.name, humans: scene.otherHumans.length, npcs: scene.npcs.length };
      });
      return sendJson(res, 200, { ok: true, places });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // 3.6 同场与偶遇：当前所在与同场者 GET /dsh-surfcore/pet-api/scene
  if (req.method === 'GET' && pathname === '/dsh-surfcore/pet-api/scene') {
    try {
      const world = peek(DATA_DIR);
      const me = world.actors?.[currentMember.memberKey];
      const here = me?.location || 'tea_house';
      const scene = describeScene(world, here, currentMember.memberKey);
      return sendJson(res, 200, {
        ok: true,
        place: { id: here, name: scene.placeName },
        isPublic: scene.isPublic,
        humans: scene.otherHumans,
        npcs: scene.npcs,
        messages: readSceneMessages(DATA_DIR, here, 20),
        serverTime: Date.now(),
      });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // 3.8 头像：列表 / 上传 / 读取（全家共享，换一次所有设备都变）
  const AVATAR_DIR = path.join(DATA_DIR, 'avatars');
  const AVATAR_INDEX = path.join(AVATAR_DIR, 'index.json');

  const readAvatarIndex = () => {
    try {
      return JSON.parse(fs.readFileSync(AVATAR_INDEX, 'utf8'));
    } catch {
      return {};
    }
  };
  const writeAvatarIndex = (idx) => {
    fs.mkdirSync(AVATAR_DIR, { recursive: true });
    fs.writeFileSync(AVATAR_INDEX, JSON.stringify(idx, null, 2), 'utf8');
  };
  const avatarKey = (name) => crypto.createHash('md5').update(String(name)).digest('hex').slice(0, 16);

  if (req.method === 'GET' && pathname === '/dsh-surfcore/pet-api/avatars') {
    const idx = readAvatarIndex();
    return sendJson(res, 200, { ok: true, avatars: idx });
  }

  const avatarFileMatch = pathname.match(/^\/dsh-surfcore\/pet-api\/avatar\/([a-zA-Z0-9_]+)\.(jpg|png)$/i);
  if (req.method === 'GET' && avatarFileMatch) {
    const file = path.join(AVATAR_DIR, `${avatarFileMatch[1]}.${avatarFileMatch[2].toLowerCase()}`);
    if (!fs.existsSync(file)) return sendJson(res, 404, { ok: false, error: '头像不存在' });
    const ext = avatarFileMatch[2].toLowerCase();
    res.writeHead(200, {
      'Content-Type': ext === 'png' ? 'image/png' : 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    });
    return fs.createReadStream(file).pipe(res);
  }

  if (req.method === 'POST' && pathname === '/dsh-surfcore/pet-api/avatar') {
    try {
      const body = await parseJsonBody(req, 6 * 1024 * 1024);
      const speaker = String(body.speaker || '').trim();
      const raw = String(body.imageBase64 || '');
      if (!speaker || speaker.length > 24) return sendJson(res, 400, { ok: false, error: '角色名不合法' });
      const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
      const buf = Buffer.from(base64, 'base64');
      if (buf.length < 200) return sendJson(res, 400, { ok: false, error: '图片太小或为空' });
      if (buf.length > 3 * 1024 * 1024) return sendJson(res, 400, { ok: false, error: '图片超过 3MB' });
      const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e;
      const ext = isPng ? 'png' : 'jpg';
      fs.mkdirSync(AVATAR_DIR, { recursive: true });
      const key = avatarKey(speaker);
      fs.writeFileSync(path.join(AVATAR_DIR, `${key}.${ext}`), buf);
      const idx = readAvatarIndex();
      idx[speaker] = { key, ext, updatedAt: Date.now() };
      writeAvatarIndex(idx);
      console.log(`[Avatar] 「${speaker}」头像已更新（${Math.round(buf.length / 1024)}KB）`);
      return sendJson(res, 200, { ok: true, speaker, key, ext });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }
  // 3.7 同场与偶遇：走动 POST /dsh-surfcore/pet-api/scene/move
  if (req.method === 'POST' && pathname === '/dsh-surfcore/pet-api/scene/move') {
    try {
      const body = await parseJsonBody(req);
      const to = String(body.to || '').trim();
      const moved = moveMember(DATA_DIR, currentMember.memberKey, to, currentMember);
      if (!moved) return sendJson(res, 400, { ok: false, error: '没有这个地方' });
      console.log(`[Scene] 成员 [${currentMember.memberKey}] 移动到「${moved.name}」`);
      return sendJson(res, 200, { ok: true, place: moved });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // 4. 客户端主状态接口 GET /dsh-surfcore/pet-api/status (用于一键测试连接与主界面实时状态)
  if (req.method === 'GET' && pathname === '/dsh-surfcore/pet-api/status') {
    return sendJson(res, 200, {
      ok: true,
      role: {
        id: currentMember.memberKey,
        name: currentMember.title || currentMember.role,
        description: currentMember.description || '',
      },
      focus: {
        enabled: false,
      },
      presence: {
        state: currentMember.presence || '在线守护中',
      },
      events: {
        lastSeq: 0,
      },
      serverTime: Date.now(),
    });
  }

  // 5. 作息守护配置 GET & POST /dsh-surfcore/pet-api/routine
  if (pathname === '/dsh-surfcore/pet-api/routine') {
    if (req.method === 'GET') {
      const routine = getRoutineConfig();
      return sendJson(res, 200, {
        ok: true,
        routine,
        ...routine,
      });
    }
    if (req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        saveRoutineConfig(body);
        return sendJson(res, 200, { ok: true });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }
  }

  // 7. 配置读取 GET /dsh-surfcore/pet-api/config
  if (req.method === 'GET' && pathname === '/dsh-surfcore/pet-api/config') {
    const role = rolesManager.getActiveRole();
    return sendJson(res, 200, {
      role: {
        id: 'husband',
        name: role,
        hasPersona: true,
        profileKey: 'husband',
      },
      chat: {
        enabled: true,
        remember: true,
        maxReplyChars: 300,
        voiceMaxChars: 120,
        historyTurns: 20,
      },
      voice: {
        enabled: true,
        route: 'cloud',
        maxChars: 120,
      },
    });
  }

  // 8. 历史记录 GET /dsh-surfcore/pet-api/history
  if (req.method === 'GET' && pathname === '/dsh-surfcore/pet-api/history') {
    const history = petService.readHistory(currentMember.memberKey);
    const formatted = (history.messages || []).map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      time: m.at || Date.now(),
      audioKey: m.audioKey || null,
      modality: m.modality || 'text',
    }));
    return sendJson(res, 200, {
      ok: true,
      history: formatted,
    });
  }

  // 8.1 清空对话历史 POST /dsh-surfcore/pet-api/history/clear
  if (req.method === 'POST' && pathname === '/dsh-surfcore/pet-api/history/clear') {
    petService.saveHistory(currentMember.memberKey, { messages: [], lastUserAt: 0, lastAssistantAt: 0 });
    console.log(`[Chat] 成员 [${currentMember.memberKey}] 历史对话记忆已成功清空`);
    return sendJson(res, 200, { ok: true, message: '历史记忆已成功重置' });
  }

  // 9. 事件轮询 GET /dsh-surfcore/pet-api/events（长轮询：世界主动找人）
  if (req.method === 'GET' && pathname === '/dsh-surfcore/pet-api/events') {
    const waitMs = Math.min(Math.max(Number(url.searchParams.get('wait')) || 20000, 0), 25000);
    const deadline = Date.now() + waitMs;
    try {
      for (;;) {
        const world = peek(DATA_DIR);
        const queue = Array.isArray(world.proactive) ? world.proactive : [];
        const now = Date.now();
        const due = queue
          .filter((item) => item.text && String(item.text).trim().length > 0)
          .filter((item) => (Number(item.at) || 0) <= now)
          .filter((item) => (item.to || 'husband') === currentMember.memberKey)
          .slice(0, 3);
        if (due.length > 0) {
          world.proactive = queue.filter((item) => !due.includes(item));
          saveState(DATA_DIR, world);
          console.log(`[Push] 主动送达 ${due.length} 条 → 成员 [${currentMember.memberKey}]`);
          return sendJson(res, 200, {
            ok: true,
            lastSeq: now,
            cursor: now,
            events: due.map((item, i) => ({
              type: item.type || 'proactive',
              text: item.text,
              speaker: item.speaker || null,
              messageId: `push_${now}_${i}`,
              modality: 'text',
            })),
          });
        }
        if (now >= deadline || res.destroyed) {
          return sendJson(res, 200, { ok: true, events: [], lastSeq: now, cursor: now });
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // 10. 角色列表 GET /dsh-surfcore/pet-api/characters
  if (req.method === 'GET' && pathname === '/dsh-surfcore/pet-api/characters') {
    const list = rolesManager.listRoles();
    return sendJson(res, 200, {
      ok: true,
      characters: list.map((name) => ({
        id: name,
        name,
        isActive: name === currentMember.role,
      })),
      active: currentMember.role,
    });
  }

  // 11. 切换角色 POST /dsh-surfcore/pet-api/characters/select
  if (req.method === 'POST' && pathname === '/dsh-surfcore/pet-api/characters/select') {
    try {
      const body = await parseJsonBody(req);
      const roleName = String(body.id || body.name || '').trim();
      const success = rolesManager.setActiveRole(roleName);
      if (success) {
        currentMember.role = roleName;
        return sendJson(res, 200, { ok: true, active: roleName });
      }
      return sendJson(res, 400, { ok: false, error: '未找到指定角色' });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // 12. 文字与语音对话 POST /dsh-surfcore/pet-api/chat
  if (req.method === 'POST' && pathname === '/dsh-surfcore/pet-api/chat') {
    try {
      const body = await parseJsonBody(req);
      const result = await petService.chat({
        text: body.text,
        modality: body.modality || 'text',
        profileKey: currentMember.memberKey,
        roleName: currentMember.role,
        actorId: currentMember.actor || null,
      });
      return sendJson(res, result.ok ? 200 : 500, result);
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // 13. 视讯通话（支持文字、截帧与录音直传） POST /dsh-surfcore/pet-api/video-chat
  if (req.method === 'POST' && pathname === '/dsh-surfcore/pet-api/video-chat') {
    try {
      const body = await parseJsonBody(req);
      let spokenText = body.text ? body.text.trim() : '';

      // 若移动端（如安卓）传了麦克风录音直传切片，先由中枢进行 ASR 转录
      if (!spokenText && body.audioBase64) {
        console.log(`[VideoChat] 🎙️ 收到成员 [${currentMember.memberKey}] 视讯对讲录音，启动 ASR 转写...`);
        spokenText = await visionService.transcribeAudio({
          audioBase64: body.audioBase64,
          mimeType: body.mimeType || 'audio/aac',
        });
        console.log(`[VideoChat] ✅ 视讯 ASR 转写结果: "${spokenText || '（未听清）'}"`);
      }

      if (!spokenText && body.audioBase64) {
        return sendJson(res, 200, {
          ok: false,
          error: '未听清您的声音，请靠近麦克风再试一次哦～',
        });
      }

      const hasImage = Boolean(body.imageBase64 && body.imageBase64.length > 50);
      const imageSizeKb = hasImage ? Math.round(body.imageBase64.length / 1024) : 0;
      console.log(`[VideoChat] 📹 收到成员 [${currentMember.memberKey}] 视讯通话请求 (截帧大小: ${imageSizeKb}KB, 文字: "${spokenText}")`);

      const result = await petService.videoChat({
        text: spokenText,
        imageBase64: body.imageBase64,
        modality: body.modality || 'voice',
        profileKey: currentMember.memberKey,
        roleName: currentMember.role,
        actorId: currentMember.actor || null,
      });

      console.log(`[VideoChat] ✅ 视讯通话处理完成 (耗时: ${result.latencyMs || 0}ms, 视觉: "${result.visualFact || '降级温存模式'}")`);
      return sendJson(res, result.ok ? 200 : 500, {
        ...result,
        userText: spokenText,
      });
    } catch (err) {
      console.error(`[VideoChat] ❌ 视讯通话处理异常:`, err.message);
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // 14. 语音直传转写与对话（豆包同款：手机纯录音直传，中枢智能转录） POST /dsh-surfcore/pet-api/voice-chat
  if (req.method === 'POST' && pathname === '/dsh-surfcore/pet-api/voice-chat') {
    try {
      const body = await parseJsonBody(req);
      const audioBase64 = body.audioBase64;
      const mimeType = body.mimeType || 'audio/aac';
      let recognizedText = '';

      if (audioBase64) {
        console.log(`[VoiceChat] 🎙️ 收到成员 [${currentMember.memberKey}] 录音直传，启动多模态 ASR 转写...`);
        recognizedText = await visionService.transcribeAudio({ audioBase64, mimeType });
        console.log(`[VoiceChat] ✅ ASR 转录结果: "${recognizedText || '（未听清）'}"`);
      }

      if (!recognizedText || !recognizedText.trim()) {
        return sendJson(res, 200, {
          ok: false,
          error: '未听清语音内容，请靠近麦克风再试一次哦～',
        });
      }

      const result = await petService.chat({
        text: recognizedText.trim(),
        modality: body.modality || 'voice',
        profileKey: currentMember.memberKey,
        roleName: currentMember.role,
        actorId: currentMember.actor || null,
      });

      return sendJson(res, result.ok ? 200 : 500, {
        ...result,
        userText: recognizedText.trim(),
      });
    } catch (err) {
      console.error(`[VoiceChat] ❌ 语音直传处理异常:`, err.message);
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  return sendJson(res, 404, { ok: false, error: `未找到对应接口: ${pathname}` });
});

const PORT = Number(process.env.PORT) || config.port || 3088;
server.listen(PORT, '0.0.0.0', () => {
  console.log('========================================================');
  console.log(`  FamilySoul 家庭数字灵魂伴侣中枢启动成功！              `);
  console.log(`  监听地址: http://0.0.0.0:${PORT}                      `);
  console.log(`  Web 控制台: http://127.0.0.1:${PORT}                   `);
  console.log(`  当前核心角色: ${rolesManager.getActiveRole()}         `);
  console.log(`  DeepSeek 就绪: ${llmClient.isReady() ? 'YES' : 'NO (待配Key)'}`);
  console.log(`  Gemini 视觉: ${visionService.isReady() ? 'YES' : 'NO'}`);
  console.log('========================================================');

  // 账本体检：启动跑一次，之后每 24 小时一次（纯代码，零 token）
  // 1:1 同步：把「整点基准」对齐到现实整点，世界时间才会与现实整点一致
  try {
    const wC = peek(DATA_DIR);
    const nowMs = Date.now();
    const realHour = new Date(nowMs).getHours();
    if (Number(config.world?.msPerWorldHour || 3600000) >= 60 * 60 * 1000) {
      wC.clock.hour = realHour;
      wC.lastRealAt = nowMs - (nowMs % (60 * 60 * 1000)); // 基准落在整点
      wC.flags = wC.flags || {};
      const d = new Date(nowMs);
      wC.flags.realDateMark = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      saveState(DATA_DIR, wC);
      console.log(`[World] 时钟对齐现实整点：第${wC.clock.day}日 ${realHour}时`);
    }
  } catch (err) {
    console.warn('[World] 时钟对齐失败：', err.message);
  }

  // 开机就把各自的主线播种好，不用等到午夜翻篇
  try {
    const wA = peek(DATA_DIR);
    ensureArcs(wA);
    ensureCities(wA);
    ensureCourt(wA);
    ensureTerrain(wA);
    saveState(DATA_DIR, wA);
    console.log(`[Arc] 已播种 ${Object.keys(wA.arcs || {}).length} 条个人主线`);
  } catch (err) {
    console.warn('[Arc] 主线播种失败：', err.message);
  }

  // 启动时先自愈一次（上次崩溃/断电留下的脏账，开机就修好）
  try {
    const w0 = peek(DATA_DIR);
    const fixes = healWorld(w0);
    if (fixes.length > 0) {
      saveState(DATA_DIR, w0);
      console.log(`[Heal] 启动自愈 ${fixes.length} 处：${fixes.slice(0, 5).join('；')}`);
    }
  } catch (err) {
    console.warn('[Heal] 启动自愈失败：', err.message);
  }

  const runAudit = () => {
    try {
      const issues = auditWorld(peek(DATA_DIR));
      if (issues.length === 0) {
        console.log('[Audit] 账本体检通过（0 问题）');
      } else {
        console.warn(`[Audit] ⚠ 发现 ${issues.length} 个账本问题：`);
        issues.slice(0, 10).forEach((s) => console.warn(`  - ${s}`));
      }
    } catch (err) {
      console.warn('[Audit] 体检失败：', err.message);
    }
  };
  runAudit();
  { const t = setInterval(runAudit, 24 * 60 * 60 * 1000); if (t.unref) t.unref(); }

  // 案情由天道现写：哪座城、谁犯事、犯了什么
  async function generateCase() {
    try {
      const w = peek(DATA_DIR);
      const pend = w.flags?.pendingCase;
      if (!pend || !pend.city) return;
      const pool = Object.values(w.actors || {})
        .filter((a) => a && !a.dead && !a.jailed && a.id !== 'husband' && !a.playerControlled)
        .filter((a) => !/(知府|县令|知县|尚书|宰相|天子|巡抚|统领|正妻|如夫人|千金)/.test(String(a.role || '')))
        .slice(0, 40)
        .map((a) => `${a.name}（${a.role || '城中人'}）`);
      if (pool.length < 2) { return; }
      const prompt = [
        `你是天道。${pend.city}民心浮动，今日出了一桩案子。`,
        `城中可涉案的人：${pool.join('、')}。`,
        (() => {
          const rel = [];
          const list = Object.values(w.actors || {}).filter((a) => a && pool.some((p) => p.startsWith(a.name)));
          for (let i = 0; i < list.length; i += 1) {
            for (let j = i + 1; j < list.length; j += 1) {
              const b = w.bonds?.[list[i].id]?.[list[j].id];
              if (b) rel.push(`${list[i].name}与${list[j].name}是${b.type}`);
            }
          }
          return rel.length ? `他们之间的关系：${rel.slice(0, 6).join('；')}。` : '';
        })(),
        '案子要跟他们的关系有关（亲人反目、邻里争产、同行下黑手），别编无关的。',
        '从这些人里挑一个犯事的、一个受害的，写清犯了什么事。',
        '只输出 JSON：{"culprit":"名字","victim":"名字","crime":"一句话(12字内)","place":"地点"}',
      ].join('\n');
      const res = await petService.llmClient.complete({
        system: '只输出一行 JSON，不要解释。',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 160,
        temperature: 0.95,
      });
      const raw = String(res?.text || '');
      const m = raw.match(/\{[\s\S]*\}/);
      let d = null;
      try { d = m ? JSON.parse(m[0]) : null; } catch { d = null; }
      const w2 = peek(DATA_DIR);
      w2.flags = w2.flags || {};
      w2.flags.pendingCase = null;
      const culprit = Object.values(w2.actors || {}).find((a) => a && a.name === String(d?.culprit || ''));
      const victim = Object.values(w2.actors || {}).find((a) => a && a.name === String(d?.victim || ''));
      if (!culprit || !victim || culprit.id === victim.id) { saveState(DATA_DIR, w2); return; }
      w2.cases = Array.isArray(w2.cases) ? w2.cases : [];
      w2.flags.caseSeq = (Number(w2.flags.caseSeq) || 0) + 1;
      w2.cases.push({
        id: `case_${w2.flags.caseSeq}`,
        day: w2.clock.day, hour: w2.clock.hour, city: pend.city,
        place: culprit.location || null,
        who: victim.name, whoId: victim.id,
        against: culprit.name, againstId: culprit.id,
        claim: String(d?.crime || '犯了事').slice(0, 20),
        witnesses: [], status: 'filed', verdict: null, petty: true,
      });
      saveState(DATA_DIR, w2);
      console.log(`[Case] ${pend.city}：${culprit.name}${d?.crime}（告主：${victim.name}）`);
    } catch (err) {
      console.warn('[Case] 生成案情失败：', err.message);
    }
  }

  // 县衙判案：只依据事实（原告、被告、人证、双方关系），由天道裁定
  async function judgeCases() {
    const { addRumor } = await import('./world/rumors.js');
    try {
      const w = peek(DATA_DIR);
      const c = (w.cases || []).find((x) => x && x.status === 'hearing');
      if (!c) return;
      const w2 = peek(DATA_DIR);
      const mag = Object.values(w2.actors || {}).find((a) => a && /县令/.test(String(a.role || '')));
      const prompt = [
        '你是天道，扮演临江县令周文达断案。',
        `原告：${c.who}。被告：${c.against}。所告：${c.claim}。`,
        `现场人证：${(c.witnesses || []).join('、') || '无'}。`,
        '先写堂上情形：原告怎么陈词、被告怎么辩、人证怎么说（各一句，共 2~3 句）。',
        '再写判词。',
        `县令本人收过钱通海的礼（这条是秘密，他判的时候会偏向有钱有势的一方）。`,
        c.petty ? `这是一桩民间小案（${c.claim}）。` : '',
        '只输出 JSON：{"verdict":"guilty|false","reason":"一句话判词(20字内)","penalty":{"silver":0,"wanted":0,"rep":0,"jail":0}}',
        'jail = 下狱天数（小案 3~10 天，重案可 30 天）。',
        '被告有罪则 guilty（罚银/加通缉/掉名声）；证据不足或原告诬告则 false（原告反坐）。',
      ].join('\n');
      const res = await petService.llmClient.complete({
        system: '只输出一行 JSON，不要解释。',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 160,
        temperature: 0.7,
      });
      const raw = String(res?.text || '');
      const m = raw.match(/\{[\s\S]*\}/);
      let d = { verdict: 'false', reason: '证据不足', penalty: {} };
      try { if (m) d = { ...d, ...JSON.parse(m[0]) }; } catch { /* 默认 */ }
      const w3 = peek(DATA_DIR);
      const cc = (w3.cases || []).find((x) => x && x.id === c.id);
      if (!cc) return;
      cc.status = 'judged';
      cc.hearing = String(d.hearing || '').slice(0, 160);
      cc.verdict = d.verdict;
      cc.reason = String(d.reason || '').slice(0, 40);
      const pen = d.penalty || {};
      const silver = Math.max(0, Number(pen.silver) || 0);
      if (d.verdict === 'guilty') {
        if (silver > 0) w3.assets.silver = Math.round(((Number(w3.assets.silver) || 0) - silver) * 100) / 100;
        if (Number(pen.wanted) > 0) w3.flags.wanted = (Number(w3.flags.wanted) || 0) + Number(pen.wanted);
        const jailDays = Math.max(0, Math.min(60, Number(pen.jail) || 0));
        const culprit = w3.actors?.[cc.againstId];
        if (jailDays > 0 && culprit && culprit.id !== 'husband') {
          culprit.jailed = { untilDay: (Number(w3.clock?.day) || 1) + jailDays, caseId: cc.id };
          const cityName = String(cc.city || '');
          if (cityName && cityName !== '临江府') {
            const jailName = `${cityName}·大牢`;
            let jp = Object.keys(w3.places || {}).find((k) => w3.places[k]?.name === jailName);
            if (!jp) {
              w3.flags.placeSeq = (Number(w3.flags.placeSeq) || 0) + 1;
              jp = `place_${w3.flags.placeSeq}`;
              w3.places[jp] = { name: jailName, exits: ['street'], owner: 'court', dynamic: true, city: cityName };
            }
            culprit.location = jp;
          } else {
            culprit.location = culprit.gender === 'male' ? 'jail_male' : 'jail_female';
          }
        }
        if (Number(pen.rep) > 0) w3.reputation = Math.max(0, (Number(w3.reputation) || 50) - Number(pen.rep));
      } else {
        const plaintiff = w3.actors?.[cc.whoId];
        if (plaintiff) {
          plaintiff.relations = plaintiff.relations || {};
          plaintiff.relations.husband = plaintiff.relations.husband || { trust: 30, desire: 0, fear: 0, grievance: 0 };
          plaintiff.relations.husband.trust = Math.max(0, (Number(plaintiff.relations.husband.trust) || 30) - 10);
          plaintiff.relations.husband.grievance = Math.min(100, (Number(plaintiff.relations.husband.grievance) || 0) + 10);
        }
      }
      // 亲近的人替他叫屈
      try {
        const culpritId = cc.againstId;
        const near = Object.entries(w3.bonds?.[culpritId] || {}).filter(([, b]) => b && b.score >= 30);
        for (const [otherId] of near) {
          const other = w3.actors?.[otherId];
          if (!other || other.dead) continue;
          other.relations = other.relations || {};
          const rel = other.relations.husband || { trust: 30, desire: 0, fear: 0, grievance: 0 };
          rel.grievance = Math.min(100, (Number(rel.grievance) || 0) + 4);
          other.relations.husband = rel;
          console.log(`[Court] ${other.name}替${w3.actors[culpritId]?.name}叫屈（怨怼+4）`);
        }
      } catch { /* 忽略 */ }

      try {
        addRumor(w3, {
          text: `${cc.against}因${cc.claim}被断${cc.verdict === 'guilty' ? '有罪' : '无罪'}`,
          about: [cc.againstId, cc.whoId].filter(Boolean),
          tone: cc.verdict === 'guilty' ? -1 : 1,
          weight: 4,
        });
      } catch { /* 忽略 */ }

      saveState(DATA_DIR, w3);
      console.log(`[Court] 判案 ${cc.who} 告 ${cc.against}：${cc.reason}（${cc.verdict}）`);
    } catch (err) {
      console.warn('[Court] 判案失败：', err.message);
    }
  }

  // 天下不止一座城：走到哪座城，天道就把那条街补出来（分批长到 12 家）
  async function generateCityShops() {
    try {
      const w = peek(DATA_DIR);
      const city = String(w.flags?.pendingCityShop || '');
      if (!city) return;
      // 每城标配：青楼、赌坊、客栈、当铺、药铺、米行、酒楼、铁铺、布庄、香烛、糕点、茶馆
      const REQUIRED = ['青楼', '赌坊', '客栈', '当铺', '药铺', '米铺', '铁匠铺', '衣铺', '糖铺', '面摊', '肉铺', '香烛', '糕点', '茶馆'];
      const cityPlaces = Object.values(w.places || {}).filter((p) => p && String(p.name || '').includes(city));
      const haveKinds = new Set(cityPlaces.map((p) => String(p.shopKind || '')));
      const haveNames = cityPlaces.map((p) => String(p.name).replace(`${city}·`, ''));
      const missing = REQUIRED.filter((k) => !haveKinds.has(k));
      const prompt = [
        `你是天道，正在铺设${city}的街市。`,
        haveNames.length ? `已有：${haveNames.join('、')}。` : '这条街还没有铺子。',
        missing.length ? `还缺这些行当：${missing.slice(0, 4).join('、')}——这次就补这几个。` : '标配已齐，补 4 家本地特色。',
        '只输出 JSON 数组：[{"shop":"铺名","kind":"行当","who":"掌柜名","role":"掌柜身份"}]',
        'kind 必须用上面给的行当名（如「青楼」「赌坊」「客栈」）。不要重复已有铺子。',
      ].join('\n');
      const res = await petService.llmClient.complete({
        system: '只输出 JSON 数组，不要解释。',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 280,
        temperature: 0.95,
      });
      const raw = String(res?.text || '');
      const m = raw.match(/\[[\s\S]*\]/);
      let list = [];
      try { list = m ? JSON.parse(m[0]) : []; } catch { list = []; }
      const w2 = peek(DATA_DIR);
      w2.flags = w2.flags || {};
      w2.flags.pendingCityShop = '';
      w2.cityShops = w2.cityShops || {};
      const rec = w2.cityShops[city];
      let count = typeof rec === 'number' ? rec : (rec && rec.count) || 0;
      w2.places = w2.places || {};
      let made = 0;
      for (const item of Array.isArray(list) ? list.slice(0, 4) : []) {
        const shop = String(item?.shop || '').slice(0, 12);
        const who = String(item?.who || '').slice(0, 8);
        const kind = String(item?.kind || '铺子').slice(0, 8);
        const role = String(item?.role || kind).slice(0, 12);
        if (!shop || !who) continue;
        const fullName = `${city}·${shop}`.slice(0, 20);
        if (Object.values(w2.places).some((p) => p && p.name === fullName)) continue;
        if (Object.values(w2.actors).some((a) => a?.name === who)) continue;
        w2.flags.placeSeq = (Number(w2.flags.placeSeq) || 0) + 1;
        const pid = `place_${w2.flags.placeSeq}`;
        w2.places[pid] = { name: fullName, exits: ['street'], dynamic: true, city, shopKind: kind };
        w2.flags.npcSeq = (Number(w2.flags.npcSeq) || 0) + 1;
        const nid = `npc_${w2.flags.npcSeq}`;
        w2.actors[nid] = {
          id: nid, name: who, role, gender: 'female', origin: 'spawned',
          home: pid, location: pid, city,
          relations: { husband: { trust: 30, desire: 10, fear: 0, grievance: 0 } },
          schedule: [], goals: [],
        };
        made += 1;
      }
      count += made;
      w2.cityShops[city] = { count, done: count >= 12 };
      saveState(DATA_DIR, w2);
      console.log(`[City] ${city} 补出 ${made} 家铺子（累计 ${count}/12）`);
    } catch (err) {
      console.warn('[City] 补街市失败：', err.message);
    }
  }

  // 朝议：每 5 天由天道下一道旨（加税/赈灾/征役…），进而推动民心
  async function generateDecree() {
    try {
      const world = peek(DATA_DIR);
      if (!world.court?.pendingDecree) return;
      const day = world.clock?.day || 1;
      const cities = Object.values(world.cities || {}).filter(Boolean);
      const unrest = cities.length
        ? Math.round(cities.reduce((s, c) => s + (Number(c.unrest) || 0), 0) / cities.length)
        : 0;
      const tax = cities.length
        ? Math.round(cities.reduce((s, c) => s + (Number(c.tax) || 0), 0) / cities.length)
        : 10;
      const prompt = [
        `你是天道，扮演大乾朝廷。第${day}日朝议。`,
        `天下平均民心不安度 ${unrest}/100，平均税率 ${tax}%。`,
        '请下一道旨：要么加税、减税、征役、赈灾、严打、大赦之一。',
        '只输出 JSON：{"decree":"一句旨意(20字内)","action":"raise_tax|lower_tax|corvee|relief|crackdown|amnesty","amount":10}',
      ].join('\n');
      const res = await petService.llmClient.complete({
        system: '你只输出一行 JSON，不要解释。',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 120,
        temperature: 0.9,
      });
      const raw = String(res?.text || '');
      const m = raw.match(/\{[\s\S]*\}/);
      let d = { decree: '朝廷下旨', action: 'raise_tax', amount: 10 };
      if (m) {
        try {
          d = { ...d, ...JSON.parse(m[0]) };
        } catch { /* 用默认 */ }
      }
      const { applyDecree } = await import('./world/clock.js');
      const w2 = peek(DATA_DIR);
      const events = [];
      applyDecree(w2, events, d);
      w2.court.pendingDecree = false;
      saveState(DATA_DIR, w2);
      console.log(`[Court] 第${day}日朝议：${String(d.decree).slice(0, 30)}（${d.action} ${d.amount}）`);
    } catch (err) {
      console.warn('[Court] 朝议生成失败：', err.message);
    }
  }

  // NPC 自己的命：每次心跳最多补两个（省 token）
  async function generateNpcArcs() {
    try {
      for (let round = 0; round < 5; round += 1) {
        const world = peek(DATA_DIR);
        const pending = Object.entries(world.npcArcs || {}).find(([, a]) => a && a.pendingStep);
        if (!pending) return;
        const [actorId] = pending;
        const { npcArcPrompt } = await import('./world/arcs.js');
        const prompt = npcArcPrompt(world, actorId);
        if (!prompt) {
          pending[1].pendingStep = false;
          continue;
        }
        const res = await petService.llmClient.complete({
          system: '你是天道，只输出一句处境描写，不写人物反应，不写结局。',
          messages: [{ role: 'user', content: prompt }],
          maxTokens: 120,
          temperature: 0.95,
        });
        const line = String(res?.text || '').trim().split('\n')[0].slice(0, 60);
        const w2 = peek(DATA_DIR);
        const arc = (w2.npcArcs || {})[actorId];
        if (arc) {
          arc.lastStep = line || arc.lastStep || '（他在自己的事里打转）';
          arc.pendingStep = false;
          arc.day = w2.clock?.day || 1;
          saveState(DATA_DIR, w2);
          console.log(`[NpcArc] ${w2.actors?.[actorId]?.name || actorId}：${arc.lastStep.slice(0, 30)}`);
        }
      }
    } catch (err) {
      console.warn('[NpcArc] 生成失败：', err.message);
    }
  }

  // 世界引擎：启动天道时钟（离线补算 + 定时心跳）
  try {
    startWorldClock(DATA_DIR, {
      enabled: config.world?.enabled !== false,
      intervalMs: Number(config.world?.tickIntervalMs) || 2 * 60 * 1000,
      msPerWorldHour: Number(config.world?.msPerWorldHour) || 60 * 60 * 1000,
      onAfterTick: async () => {
        await fillProactiveTexts();
        await generateNpcArcs();
        await generateDecree();
        await generateCityShops();
        await generateCase();
        await judgeCases();
      },
    });
  } catch (err) {
    console.warn('[World] 世界时钟启动失败：', err.message);
  }
});
