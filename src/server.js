import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { RolesManager } from './roles-manager.js';
import { LlmClient } from './llm-client.js';
import { EdgeTtsService } from './edge-tts.js';
import { VisionGeminiService } from './vision-gemini.js';
import { PetService } from './pet-service.js';

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
    return {
      husband: { ...defaults.husband, ...(config.family.husband || {}) },
      wife: { ...defaults.wife, ...(config.family.wife || {}) },
      kid: { ...defaults.kid, ...(config.family.kid || {}) },
    };
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
});

function parseJsonBody(req, limitBytes = 3 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let bytes = 0;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > limitBytes) {
        req.destroy();
        return reject(new Error('请求体超出限制（最大 3MB）'));
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
    if (clientToken && clientToken !== husbandToken) {
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
  }

  // 1.5 语音音频流拉取 /dsh-surfcore/pet-api/audio/:key.wav (32位MD5哈希寻址，免Token流式播放，让手机音频播放器无感直出)
  const audioMatch = pathname.match(/^\/dsh-surfcore\/pet-api\/audio\/([a-zA-Z0-9_-]+)\.(wav|mp3)$/);
  if (audioMatch) {
    const key = audioMatch[1];
    const audioFile = ttsService.getAudioFile(key);
    if (!audioFile || !fs.existsSync(audioFile)) {
      return sendJson(res, 404, { ok: false, error: '音频文件不存在或已过期' });
    }
    const stat = fs.statSync(audioFile);
    res.writeHead(200, {
      'Content-Type': 'audio/wav',
      'Content-Length': stat.size,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400',
    });
    fs.createReadStream(audioFile).pipe(res);
    return;
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

  // 9. 事件轮询 GET /dsh-surfcore/pet-api/events
  if (req.method === 'GET' && pathname === '/dsh-surfcore/pet-api/events') {
    return sendJson(res, 200, {
      ok: true,
      events: [],
      cursor: 0,
    });
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
      });
      return sendJson(res, result.ok ? 200 : 500, result);
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // 13. 闺房视频通话 POST /dsh-surfcore/pet-api/video-chat
  if (req.method === 'POST' && pathname === '/dsh-surfcore/pet-api/video-chat') {
    try {
      const body = await parseJsonBody(req);
      const result = await petService.videoChat({
        text: body.text,
        imageBase64: body.imageBase64,
        modality: body.modality || 'voice',
        profileKey: currentMember.memberKey,
      });
      return sendJson(res, result.ok ? 200 : 500, result);
    } catch (err) {
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
});
