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
          description: v.description || '自定义受邀成员 / 知心挚友'
        };
      }
    }
    return result;
  }
  return defaults;
}

function resolveMember(req, url) {
  const headerToken = String(req.headers['x-pet-token'] || '').trim();
  const queryToken = String(url.searchParams.get('token') || '').trim();
  const clientToken = headerToken || queryToken;

  if (!clientToken) return null;

  const family = getFamilyProfiles();
  for (const [memberKey, profile] of Object.entries(family)) {
    if (profile.token && profile.token === clientToken) {
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
          return sendJson(res, 200, { ok: true, removed });
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
          clock: { ...(world.clock || {}), shichen: shichenOf(world.clock?.hour ?? 0) },
          assets: world.assets,
          actors,
          pending: world.pending || [],
          promises: (world.promises || []).filter((p) => p && !p.done),
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

const PORT = config.port || 3088;
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

  // 世界引擎：启动天道时钟（离线补算 + 定时心跳）
  try {
    startWorldClock(DATA_DIR, {
      enabled: config.world?.enabled !== false,
      intervalMs: Number(config.world?.tickIntervalMs) || 2 * 60 * 1000,
      msPerWorldHour: Number(config.world?.msPerWorldHour) || 60 * 60 * 1000,
      onAfterTick: fillProactiveTexts,
    });
  } catch (err) {
    console.warn('[World] 世界时钟启动失败：', err.message);
  }
});
