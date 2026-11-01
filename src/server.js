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
      historyTurns: 14,
      mode: 'full',
    },
    world: {
      enabled: true,
      tickIntervalMs: 2 * 60 * 1000,
      msPerWorldHour: 2.5 * 60 * 1000,
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
  const isHtmlWanted = req.headers.accept && req.headers.accept.includes('text/html');
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
          lines = raw.split('\n').filter(Boolean).slice(-100);
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
          clock: { ...(world.clock || {}), shichen: shichenOf(world.clock?.hour ?? 0) },
          assets: world.assets,
          actors,
          pending: world.pending || [],
          promises: world.promises || [],
          recentEvents: readRecentEvents(DATA_DIR, 12),
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

  // 世界引擎：启动天道时钟（离线补算 + 定时心跳）
  try {
    startWorldClock(DATA_DIR, {
      enabled: config.world?.enabled !== false,
      intervalMs: Number(config.world?.tickIntervalMs) || 2 * 60 * 1000,
      msPerWorldHour: Number(config.world?.msPerWorldHour) || 2.5 * 60 * 1000,
      onAfterTick: fillProactiveTexts,
    });
  } catch (err) {
    console.warn('[World] 世界时钟启动失败：', err.message);
  }
});
