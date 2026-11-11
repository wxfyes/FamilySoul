/**
 * 管理后台与控制台路由模块
 * 抽离自 src/server.js，负责 /api/admin/* 所有管理端与维护验收接口
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { pruneForeignRooms, settleItinerants, buildPremises, buildCourts } from '../world/residence.js';
import { roomForHour } from '../world/room-life.js';
import { peek, buildMorningReport, refreshPropertyIncomes, queueProactive } from '../world/clock.js';
import { detectDrift, collectDrifters, buildDriftPrompt, applyPlacements } from '../world/society.js';
import { readRecentEvents, shichenOf, saveState, worldDate, loadState } from '../world/state.js';
import { buildStateSummary } from '../world/summarize.js';
import { maybeOfferAlliance } from '../world/marriage.js';
import { advanceWorldTick } from '../world/tick.js';
import { isPlaceNameOk } from '../world/ledger-rules.js';
import { pursueGoals, refreshGoals } from '../world/goals.js';
import { auditWorld, inspectStructure, buildRepairPrompt, applyRepairs, auditAll } from '../world/audit.js';
import { ensureRealms } from '../world/realm.js';
import { moveActor } from '../world/position.js';
import { buildTimeline, eventText } from '../world/events-view.js';
import { recentLedger } from '../world/ledger.js';
import { hireStaff } from '../world/employment.js';
import { renameActor } from '../world/identity.js';
import { factionSilver, factionStrength } from '../world/factions.js';
import { upkeepOf } from '../world/warfare.js';
import { grainPrice } from '../world/prices.js';
import { nextPromotion, spawnBandit } from '../world/bandits.js';
import { maritalTextOf, mensesStatusText } from '../world/persona.js';
import { addMemory } from '../world/memory.js';
import { healWorld } from '../world/heal.js';
import { sendJson, parseJsonBody } from '../middleware/http-utils.js';
import { resolveMember as resolveMemberAuth, getLockedToken as getLockedTokenAuth, getFamilyProfiles as getFamilyProfilesAuth, MEMBER_LAST_SEEN, HUMAN_ONLINE_MS } from '../middleware/auth.js';

export async function handleAdminRoutes(req, res, ctx) {
  const {
    pathname,
    url,
    config,
    TOKEN_LOCK_FILE,
    ROOT_DIR,
    DATA_DIR,
    STARTED_AT,
    rolesManager,
    llmClient,
    ttsService,
    visionService,
    petService,
    userRegistry,
    generateCase,
    getRoutineConfig,
    saveRoutineConfig,
  } = ctx;

  if (!pathname.startsWith('/api/admin')) {
    return false;
  }

  function getLockedToken() {
    return getLockedTokenAuth({ config, lockFile: TOKEN_LOCK_FILE });
  }

  function getFamilyProfiles() {
    return getFamilyProfilesAuth({ config, lockFile: TOKEN_LOCK_FILE });
  }

  function resolveMember(r, u) {
    return resolveMemberAuth(r, u, { config, lockFile: TOKEN_LOCK_FILE, userRegistry });
  }

  function matchRoute(route) {
    if (pathname === route) return true;
    if (pathname === `/api/admin${route}`) return true;
    if (pathname === `/api${route}`) return true;
    if (pathname === `/dsh-surfcore/pet-api${route}`) return true;
    if (pathname === `/dsh-surfcore/pet-api/api${route}`) return true;
    return false;
  }

  // 1. 验收与维护接口
  // 手动推一格世界（验收用）：POST /api/admin/tick-run
  if (req.method === 'POST' && pathname === '/api/admin/tick-run') {
    try {
      const body = await parseJsonBody(req, 8 * 1024);
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
      const world = loadState(DATA_DIR);
      world.flags = world.flags || {};
      delete world.flags.lastTick;
      if (body && body.regen) { world.flags.goalDay = 0; for (const a of Object.values(world.actors || {})) if (a) delete a.goal; }
      let goalsInfo = null;
      let tick;
      try {
        const fresh = refreshGoals(world);
        const moved = pursueGoals(world);
        goalsInfo = { fresh, moved };
      } catch (e) { goalsInfo = { error: e.message }; }
      tick = advanceWorldTick(world, Number(world.clock?.hour) || 0);
      saveState(DATA_DIR, world);
      return sendJson(res, 200, { ok: true, tick, goalsInfo, day: world.clock?.day, hour: world.clock?.hour });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }


  // 调试：看某账号最近几条对话（只读，不落盘）
  if (req.method === 'GET' && pathname === '/api/admin/chat-tail') {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
      const key = String(url.searchParams.get('key') || 'husband');
      const h = petService.readHistory(key) || {};
      const msgs = (Array.isArray(h.messages) ? h.messages : []).slice(-8).map((m) => ({
        role: m.role, speaker: m.speaker || '', text: String(m.text || '').slice(0, 200), at: m.at || 0,
      }));
      return sendJson(res, 200, { ok: true, key, msgs });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }


  // 验收：立刻在某城生成一桩案子 POST /api/admin/case-now {city}
  if (req.method === 'POST' && pathname === '/api/admin/case-now') {
    try {
      const body = await parseJsonBody(req, 8 * 1024);
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
      const city = String(body.city || '临江府');
      const w = loadState(DATA_DIR);
      w.flags = w.flags || {};
      w.flags.pendingCase = { city, day: w.clock?.day || 1 };
      saveState(DATA_DIR, w);
      await globalThis.__worldGenerators?.generateCase?.();
      const after = loadState(DATA_DIR);
      const c = (after.cases || []).slice(-1)[0] || null;
      return sendJson(res, 200, { ok: true, case: c });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }


  // 验收：立即重算产业日入 POST /api/admin/shop-refresh
  if (req.method === 'POST' && pathname === '/api/admin/shop-refresh') {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
      const world = loadState(DATA_DIR);
      try { refreshPropertyIncomes(world); } catch { /* 忽略 */ }
      // 开着的铺子按"一年挣出十倍租钱"的下限兜底（与日结同一规则）
      for (const p of (world.assets?.properties || [])) {
        const open = ['已开张', '正常营业'].includes(String(p.status || ''));
        if (!open) { p.incomePerDay = 0; continue; }
        const isShop = /铺|店|号|栈|坊/.test(String(p.name || '')) && !/酒楼|茶坊|茶栈|货栈/.test(String(p.name || ''));
        const rentYearly = Number(p.rentYearly || p.rentAnnual || 0);
        const floor = isShop ? (rentYearly > 0 ? rentYearly / 365 * 10 : 1.5) : 0.15;
        if ((Number(p.incomePerDay) || 0) < floor) p.incomePerDay = Math.round(floor * 100) / 100;
      }
      const n = (world.assets?.properties || []).length;
      saveState(DATA_DIR, world);
      const list = (world.assets?.properties || []).map((p) => ({ name: p.name, status: p.status, income: p.incomePerDay }));
      return sendJson(res, 200, { ok: true, count: n, list });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }


  // 验收：立刻让大户来提亲 POST /api/admin/alliance-now
  if (req.method === 'POST' && pathname === '/api/admin/alliance-now') {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
      const world = loadState(DATA_DIR);
      world.flags = world.flags || {};
      world.flags.allianceCheckedDay = 0;
      world.flags.allianceOffer = null;
      const offer = maybeOfferAlliance(world, String(member.actor || 'husband'), true);
      saveState(DATA_DIR, world);
      return sendJson(res, 200, { ok: Boolean(offer), offer: offer || null });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }


  // 验收/维护：全服重名改正 POST /api/admin/name-dedupe
  if (req.method === 'POST' && pathname === '/api/admin/name-dedupe') {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
      // 用活的世界对象（peek 缓存）改名，别改完文件、线上还是旧名
      const world = peek(DATA_DIR);
      const keep = new Set();
      const all = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.name);
      all.sort((a, b) => (Number(a.createdDay) || 0) - (Number(b.createdDay) || 0));
      const renamed = [];
      for (const a of all) {
        if (!keep.has(a.name)) { keep.add(a.name); continue; }
        if (a.id === 'husband' || String(a.id).startsWith('usr_')) continue;
        const base = a.name;
        const suf = ['二', '三', '四', '五', '六', '七', '八', '九', '十'];
        let nm = base;
        for (let i = 0; i < suf.length && keep.has(nm); i += 1) nm = base + suf[i];
        if (keep.has(nm)) continue;
        renamed.push(`${base}→${nm}`);
        a.name = nm;
        keep.add(nm);
      }
      saveState(DATA_DIR, world);
      return sendJson(res, 200, { ok: true, renamed: renamed.length, sample: renamed.slice(0, 12) });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }


  // 体检：状态读写、内存、耗时 GET /api/admin/perf
  if (req.method === 'GET' && pathname === '/api/admin/perf') {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
      const world = peek(DATA_DIR);
      const st = globalThis.__stateStats || {};
      let stateBytes = 0;
      try { stateBytes = fs.statSync(path.join(DATA_DIR, 'world', 'state.json')).size; } catch { /* 忽略 */ }
      const mem = process.memoryUsage();
      return sendJson(res, 200, {
        ok: true,
        rssMB: Math.round(mem.rss / 1048576),
        heapMB: Math.round(mem.heapUsed / 1048576),
        uptimeSec: Math.round(process.uptime()),
        stateMB: Math.round(stateBytes / 1048576 * 100) / 100,
        actors: Object.keys(world.actors || {}).length,
        places: Object.keys(world.places || {}).length,
        events: Array.isArray(world.events) ? world.events.length : 0,
        state: st,
        moneyAudit: world.flags?.moneyAudit || null,
        chat: globalThis.__chatStats || null,
      });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }


  // 体检：历史曲线（内存/聊天耗时），供看板画"心率图" GET /api/admin/perf/history
  if (req.method === 'GET' && pathname === '/api/admin/perf/history') {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
      return sendJson(res, 200, { ok: true, points: globalThis.__perfSeries || [] });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // 体检：极简心率图（SVG，浏览器直接打开） GET /api/admin/perf/chart?token=...
  if (req.method === 'GET' && pathname === '/api/admin/perf/chart') {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
      const pts = (globalThis.__perfSeries || []).slice(-120);
      const W = 640; const H = 160; const P = 8;
      const rss = pts.map((p) => Number(p.rssMB) || 0);
      const chat = pts.map((p) => Number(p.chatMs) || 0);
      const maxR = Math.max(60, ...rss); const maxC = Math.max(1000, ...chat);
      const path = (arr, max) => arr.map((v, i) => {
        const x = P + (i / Math.max(1, arr.length - 1)) * (W - P * 2);
        const y = H - P - (v / max) * (H - P * 2);
        return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="background:#0f172a">
<text x="10" y="16" fill="#94a3b8" font-size="12">内存 RSS（蓝，峰值 ${maxR}MB） / 聊天耗时（红，峰值 ${maxC}ms）</text>
<path d="${path(rss, maxR)}" fill="none" stroke="#38bdf8" stroke-width="2"/>
<path d="${path(chat, maxC)}" fill="none" stroke="#f87171" stroke-width="1.5" opacity="0.9"/>
</svg>`;
      res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(svg);
      return;
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }


  // 维护：一笔入账（启动本钱/补偿） POST /api/admin/grant {amount,title}
  if (req.method === 'POST' && pathname === '/api/admin/grant') {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
      const body = await parseJsonBody(req, 8 * 1024);
      const amount = Math.round(Number(body.amount || 0) * 100) / 100;
      if (!(amount > 0)) return sendJson(res, 200, { ok: false, error: '金额不对' });
      const world = peek(DATA_DIR);
      world.assets = world.assets || {};
      world.assets.silver = Math.round(((Number(world.assets.silver) || 0) + amount) * 100) / 100;
      world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
      world.ledger.push({ day: world.clock?.day || 1, hour: world.clock?.hour || 0, delta: amount, title: String(body.title || '入账').slice(0, 24), by: 'husband', balance: world.assets.silver });
      saveState(DATA_DIR, world);
      return sendJson(res, 200, { ok: true, silver: world.assets.silver });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // 2. 主控制台管理接口
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

    // 手动跑一次院落作息（验收用）：POST /api/admin/room-tick
    if (req.method === 'POST' && pathname === '/api/admin/room-tick') {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '令牌无效' });
        const world = loadState(DATA_DIR);
        const hourNow = Number(world.clock?.hour) || 0;
        const moved = [];
        for (const a of Object.values(world.actors || {})) {
          if (!a || a.dead || a.jailed || a.away) continue;
          if (!a.home || !world.places?.[a.home]) continue;
          // 与每小时作息同一把尺：住处是宅子/院子就参与（不再用名字猜）
          const hp = world.places[a.home];
          if (!hp.residence && !hp.parent) continue;
          const to = roomForHour(world, a, hourNow);
          if (!to || to === a.location) continue;
          const r = moveActor(world, a.id, to, 'world', '按作息走动');
          if (r?.ok) { moved.push(`${a.name}→${world.places?.[to]?.name || to}`); a.activity = { text: '在自己宅里走动', at: hourNow, day: world.clock?.day || 1 }; }
        }
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, hour: hourNow, moved, places: Object.keys(world.places || {}).length });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 世界日报：今天世界自己发生了什么（米价、民心、摊子、谁有了打算）
    if (req.method === 'GET' && matchRoute('/world/daily-report')) {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
        const world = loadState(DATA_DIR);
        const day = Number(world.clock?.day) || 1;
        const log = (world.flags?.tickLog || []).filter((x) => x && Number(x.day) === day).slice(-24);
        const goals = Object.values(world.actors || {})
          .filter((a) => a && !a.dead && a.goal && !String(a.id).startsWith('usr_'))
          .slice(0, 12)
          .map((a) => ({ name: a.name, doing: a.goal.text, 到: a.goal.due }));
        return sendJson(res, 200, { ok: true, day, log, goals });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 空间体检：清串模板房间、补经营场所与衙署、流动小贩归位（一次性手动触发后落盘）
    if (req.method === 'POST' && pathname === '/api/admin/spaces-sweep') {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '令牌无效' });
        const world = loadState(DATA_DIR);
        const pruned = pruneForeignRooms(world);
        const settled = settleItinerants(world);
        const prem = buildPremises(world);
        const court = buildCourts(world);
        saveState(DATA_DIR, world);
        return sendJson(res, 200, {
          ok: true,
          pruned, settled, premises: prem, courts: court,
          places: Object.keys(world.places || {}).length,
          restaurant: Object.values(world.places?.canal_restaurant?.rooms || {}).map((r) => r.name),
          yamen: Object.values(world.places?.yamen?.rooms || {}).map((r) => r.name),
        });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 诊断：宅院状态（临时）
    if (req.method === 'GET' && pathname === '/api/admin/places-debug') {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '令牌无效' });
        const world = loadState(DATA_DIR);
        const root = world.places?.husband_room || {};
        return sendJson(res, 200, {
          ok: true,
          places: Object.keys(world.places || {}).length,
          husName: root.name || null,
          residence: Boolean(root.residence),
          grade: root.grade || null,
          rooms: Object.keys(root.rooms || {}).length,
          roomKeys: Object.keys(root.rooms || {}).slice(0, 10),
          exits: (root.exits || []).slice(0, 12),
          sweepDay: world.flags?.residenceSweptDay || null,
          sweepVer: world.flags?.residenceBuildVersion || null,
          // 生成立体空间体检
          roomPlaces: Object.keys(world.places || {}).filter((k) => world.places[k]?.parent).length,
          wangRooms: Object.values(root.rooms || {}).map((r) => `${r.name}:${r.depth || '-'}/${r.access || '-'}`),
          restaurant: Object.values(world.places?.canal_restaurant?.rooms || {}).map((r) => r.name),
          yamen: Object.values(world.places?.yamen?.rooms || {}).map((r) => r.name),
          itinerantInHome: Object.values(world.actors || {})
            .filter((a) => a && !a.dead && /卖花|货郎|挑夫|轿夫|游商/.test(String(a.role || '')) && world.places?.[a.home]?.residence && world.places[a.home]?.owner !== a.id)
            .map((a) => a.name),
        });
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

    // 7. 读取系统配置与视觉/模型设置 GET /api/admin/config
    if (req.method === 'GET' && pathname === '/api/admin/config') {
      return sendJson(res, 200, {
        ok: true,
        llmMode: config.llmMode || 'auto',
        deepseek: {
          apiKey: config.deepseek?.apiKey || '',
          baseUrl: config.deepseek?.baseUrl || 'https://api.deepseek.com/v1',
          model: config.deepseek?.model || 'deepseek-chat',
        },
        qwen: {
          apiKey: config.qwen?.apiKey || 'sk-ws-H.YLYIHYI.H9tm.MEUCIQDs397_NkoVhAW6M1g8T0iNRkKMpuIdCQEWQBcvbUZDEAIgLegR5m4SrL7vNmRI4RxrcSvFB1RWTvCq13eyEw3U1o8',
          baseUrl: config.qwen?.baseUrl || 'https://ws-5ov9z4mrw5xcq2fp.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
          model: config.qwen?.model || 'qwen-plus',
        },
        gemini: {
          enabled: config.gemini?.enabled !== false,
          apiKey: config.gemini?.apiKey || '',
          model: config.gemini?.model || 'gemini-3.5-flash',
          proxy: config.gemini?.proxy || '',
          useProxy: config.gemini?.useProxy !== false && Boolean(config.gemini?.proxy),
        },
      });
    }

    // 8. 保存系统配置与视觉/模型设置 POST /api/admin/config/save
    if (req.method === 'POST' && pathname === '/api/admin/config/save') {
      try {
        const body = await parseJsonBody(req);
        let updated = false;

        // 大模型通道模式与配置
        if (body.llmMode) {
          config.llmMode = String(body.llmMode).trim();
          updated = true;
        }
        if (body.deepseek && typeof body.deepseek === 'object') {
          if (!config.deepseek) config.deepseek = {};
          if (body.deepseek.apiKey !== undefined) config.deepseek.apiKey = String(body.deepseek.apiKey).trim();
          if (body.deepseek.baseUrl !== undefined) config.deepseek.baseUrl = String(body.deepseek.baseUrl).trim();
          if (body.deepseek.model !== undefined) config.deepseek.model = String(body.deepseek.model).trim();
          updated = true;
        }
        if (body.qwen && typeof body.qwen === 'object') {
          if (!config.qwen) config.qwen = {};
          if (body.qwen.apiKey !== undefined) config.qwen.apiKey = String(body.qwen.apiKey).trim();
          if (body.qwen.baseUrl !== undefined) config.qwen.baseUrl = String(body.qwen.baseUrl).trim();
          if (body.qwen.model !== undefined) config.qwen.model = String(body.qwen.model).trim();
          updated = true;
        }

        // 视觉与代理配置
        if (body.gemini && typeof body.gemini === 'object') {
          if (!config.gemini) config.gemini = {};
          config.gemini.enabled = body.gemini.enabled !== false;
          config.gemini.proxy = String(body.gemini.proxy || '').trim();
          config.gemini.useProxy = Boolean(body.gemini.useProxy);
          if (body.gemini.model) config.gemini.model = body.gemini.model;
          if (body.gemini.apiKey) config.gemini.apiKey = body.gemini.apiKey;

          visionService.proxy = config.gemini.proxy;
          visionService.useProxy = config.gemini.useProxy;
          visionService.enabled = config.gemini.enabled;
          visionService.model = config.gemini.model;
          if (config.gemini.apiKey) visionService.apiKey = config.gemini.apiKey;
          visionService.detectedProxy = null;
          updated = true;
        }

        if (updated) {
          // 热更新大模型调度器
          if (petService && petService.llmClient) {
            petService.llmClient.updateConfig({
              deepseek: config.deepseek,
              qwen: config.qwen,
              llmMode: config.llmMode || 'auto',
            });
            console.log('[Admin] 🧠 大模型通道已热重载: 模式=' + (config.llmMode || 'auto') + ', DeepSeek=' + (config.deepseek?.apiKey ? '已配置' : '未配置') + ', 通义=' + (config.qwen?.apiKey ? '已配置' : '未配置'));
          }
          fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
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

    // 9.26f2 批量裁撤家丁/护院/丫鬟，并把兵账与真人对齐 POST /api/admin/staff/trim {guard,retainer,maid}
    if (req.method === 'POST' && pathname === '/api/admin/staff/trim') {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        const world = peek(DATA_DIR);
        const spec = [
          { role: '家丁', target: body.guard != null ? Math.max(0, Number(body.guard) || 0) : null },
          { role: '护院', target: body.retainer != null ? Math.max(0, Number(body.retainer) || 0) : null },
          { role: '丫鬟', target: body.maid != null ? Math.max(0, Number(body.maid) || 0) : null },
        ];
        const removed = [];
        for (const { role, target } of spec) {
          if (target == null) continue;
          const list = Object.entries(world.actors || {})
            .filter(([, a]) => a && !a.dead && String(a.role || '') === role)
            .sort((x, y) => String(x[0]).localeCompare(String(y[0]))); // 老的留下，新的裁掉
          while (list.length > target) {
            const [id, a] = list.pop();
            delete world.actors[id];
            if (world.npcArcs) delete world.npcArcs[id];
            removed.push(`${a.name}(${role})`);
          }
        }
        // 兵账与真人对齐：家丁/护院/私兵按真实人数重算，私兵营兵不再虚高
        const f = world.factions?.wangjia;
        let counts = null;
        if (f) {
          const countRole = (re) => Object.values(world.actors || {}).filter((a) => a && !a.dead && re.test(String(a.role || ''))).length;
          f.kinds = f.kinds && typeof f.kinds === 'object' ? f.kinds : {};
          f.kinds.guard = countRole(/^家丁$/);
          f.kinds.retainer = countRole(/^护院$/);
          f.kinds.army = countRole(/私兵/);
          const sum = Math.round((Number(f.kinds.guard) || 0) + (Number(f.kinds.retainer) || 0) + (Number(f.kinds.army) || 0));
          f.stationed = { 临江府: sum };
          f.troops = sum;
          f.army = sum;
          f.guards = f.kinds.guard;
          f.fresh = Math.min(Number(f.fresh) || 0, sum);
          counts = { ...f.kinds, troops: sum };
          // 旧镜像一并同步，避免别的页面还读 world.military / forces 的旧数
          world.military = world.military || {};
          world.military.guards = f.kinds.guard;
          world.military.army = sum;
          world.military.militia = 0;
          if (world.forces?.husband) {
            world.forces.husband.guards = f.kinds.guard;
            world.forces.husband.army = sum;
            world.forces.husband.militia = 0;
          }
        }
        saveState(DATA_DIR, world);
        console.log(`[Staff] 裁撤 ${removed.length} 人；兵账对齐：${JSON.stringify(counts)}`);
        return sendJson(res, 200, { ok: true, removed: removed.length, names: removed.slice(0, 40), counts });
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
        if (!isPlaceNameOk(placeName)) return sendJson(res, 400, { ok: false, error: '这不像个地名' });
        const actor = world.actors?.[id];
        if (!actor || !placeName) return sendJson(res, 400, { ok: false, error: '参数不全' });
        world.places = world.places || {};
        let pid = world.places[placeName] ? placeName : Object.keys(world.places).find((k) => world.places[k]?.name === placeName);
        if (!pid) {
          world.flags = world.flags || {};
          world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;
          pid = `place_${world.flags.placeSeq}`;
          world.places[pid] = { name: placeName, exits: ['street'], owner: id, dynamic: true };
        }
        moveActor(world, actor.id, pid, 'ui', '管理改位');
        if (!actor.home || actor.home === 'street') actor.home = pid;
        saveState(DATA_DIR, world);
        console.log(`[Actor] ${actor.name} → ${placeName}`);
        return sendJson(res, 200, { ok: true, place: placeName });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.24 世界回滚 POST /api/admin/world/rewind {day, hour, trim}
    if (req.method === 'POST' && pathname === '/api/admin/world/rewind') {
      try {
        const body = await parseJsonBody(req, 64 * 1024);
        const w = peek(DATA_DIR);
        const day = Math.max(1, Number(body.day) || 1);
        const hour = Math.max(0, Math.min(23, Number(body.hour) || 0));
        const trim = body.trim !== false;
        w.clock.day = day;
        w.clock.hour = hour;
        w.lastRealAt = Date.now();
        let trimmed = 0;
        if (trim) {
          const before = (w.cases || []).length + (w.rumors || []).length + (w.memorials || []).length;
          w.cases = (w.cases || []).filter((c) => Number(c.day) <= day);
          w.rumors = (w.rumors || []).filter((r) => Number(r.day) <= day);
          w.memorials = (w.memorials || []).filter((m) => Number(m.day) <= day);
          if (w.court) {
            w.court.decisions = (w.court.decisions || []).filter((d) => Number(d.day) <= day);
            w.court.lastDecreeDay = Math.min(Number(w.court.lastDecreeDay) || 0, day);
          }
          const after = w.cases.length + w.rumors.length + w.memorials.length;
          trimmed = before - after;
          w.flags = w.flags || {};
          w.flags.pendingCase = null;
          w.flags.crimeCheckedDay = day;
          w.history = (w.history || []).filter((h) => Number(h.day) <= day);
        }
        // 主线退回关口之前
        for (const arc of Object.values(w.arcs || {})) {
          if (!arc) continue;
          if (Number(arc.stage) > 3) arc.stage = 3;
          arc.atEdge = false;
        }
        saveState(DATA_DIR, w);
        console.log(`[World] 回滚到第${day}日${hour}时（清掉 ${trimmed} 条后续记录）`);
        return sendJson(res, 200, { ok: true, clock: w.clock, trimmed });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.25 世界步进 POST /api/admin/world/step {days}
    if (req.method === 'POST' && pathname === '/api/admin/world/step') {
      try {
        const body = await parseJsonBody(req, 64 * 1024);
        const days = Number(body.days) || 1;
        if (typeof globalThis.__stepWorld !== 'function') {
          return sendJson(res, 503, { ok: false, error: '世界还没启动完，稍后再试' });
        }
        const log = await globalThis.__stepWorld(days);
        const world = peek(DATA_DIR);
        return sendJson(res, 200, { ok: true, steps: log, clock: world.clock });
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
            money: typeof a.money === 'number' ? a.money : null,
            debt: Number(a.debt) || 0,
            onPeriod: Boolean(a.menses?.on),
            cycleDay: typeof a.menses?.cycleDay === 'number' ? a.menses.cycleDay : null,
            fertile: (() => { const m = a.menses; if (!m || typeof m.cycleDay !== 'number' || m.on) return false; return m.cycleDay >= 9 && m.cycleDay <= 16; })(),
            pregnant: Boolean(a.pregnancy && !a.pregnancy.born),
            pregnantDays: Number(a.pregnancy?.days) || 0,
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

    // 清空随行队伍 POST /api/admin/party/clear
    if (req.method === 'POST' && pathname === '/api/admin/party/clear') {
      try {
        const world = peek(DATA_DIR);
        world.party = world.party || {};
        world.party.husband = [];
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, party: [] });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.23 自更新 POST /api/admin/self-update {url} —— 只覆盖代码，绝不动 data/
    if (req.method === 'POST' && pathname === '/api/admin/self-update') {
      try {
        const body = await parseJsonBody(req, 64 * 1024);
        const url = String(body.url || 'http://192.168.1.106:8089/update.tar.gz');
        const root = process.cwd();
        const script = [
          'set -e',
          'TMP=/tmp/fs-update-$$',
          'mkdir -p $TMP',
          `wget -q -O $TMP/u.tgz '${url}'`,
          'tar -xzf $TMP/u.tgz -C $TMP',
          // 只同步代码与脚本，data/ 世界数据一律不动
          `for d in src web scripts docs mobile; do if [ -d $TMP/$d ]; then rm -rf '${root}'/$d && cp -r $TMP/$d '${root}'/$d; fi; done`,
          `for f in package.json index.html '*.sh'; do true; done`,
          `cp -f $TMP/package.json '${root}'/package.json 2>/dev/null || true`,
          `cp -f $TMP/*.sh '${root}'/ 2>/dev/null || true`,
          `chmod +x '${root}'/*.sh 2>/dev/null || true`,
          `cd '${root}'`,
          './stop.sh || true',
          'sleep 1',
          './start.sh',
        ].join(' && ');
        const { spawn } = await import('node:child_process');
        const child = spawn('sh', ['-c', script], { detached: true, stdio: 'ignore', cwd: '/tmp' });
        child.unref();
        console.log(`[SelfUpdate] 已启动自更新（不含 data/）：${url}`);
        return sendJson(res, 200, { ok: true, started: true, note: '约 10 秒后重启，只更新代码不动世界数据' });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.26j 删记忆 POST /api/admin/memory/remove {text}
    if (req.method === 'POST' && pathname === '/api/admin/memory/remove') {
      try {
        const body = await parseJsonBody(req, 64 * 1024);
        const world = peek(DATA_DIR);
        const text = String(body.text || '').slice(0, 60);
        const before = (world.memories || []).length;
        world.memories = (world.memories || []).filter((m) => !String(m?.text || '').includes(text));
        saveState(DATA_DIR, world);
        const removed = before - world.memories.length;
        console.log(`[Memory] 删除 ${removed} 条：${text}`);
        return sendJson(res, 200, { ok: true, removed });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.26k 记忆列表 GET /api/admin/memories
    if (req.method === 'GET' && pathname === '/api/admin/memories') {
      try {
        const world = peek(DATA_DIR);
        return sendJson(res, 200, { ok: true, memories: (world.memories || []).map((m) => ({ text: m.text, about: m.about || [], visible: m.visible || '', day: m.day })) });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.27 三道自检 GET /api/admin/audit
    if (req.method === 'GET' && pathname === '/api/admin/audit') {
      try {
        const world = peek(DATA_DIR);
        const structure = inspectStructure(world);
        return sendJson(res, 200, { ok: true, result: auditAll(world), structure, structureCount: structure.length });
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
        const world = loadState(DATA_DIR);
        const r = renameActor(world, String(body.id || '').trim(), String(body.name || ''), { by: 'husband' });
        if (!r.ok) return sendJson(res, 400, { ok: false, error: r.error });
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, from: r.from, to: r.to, touched: r.touched || 0 });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 读某个成员最近的聊天记录（诊断用，只读）
    if (req.method === 'GET' && pathname === '/api/admin/history/read') {
      try {
        const member = String(url.searchParams.get('member') || 'husband');
        const limit = Math.min(60, Number(url.searchParams.get('limit')) || 20);
        const h = petService.readHistory(member) || {};
        const msgs = (h.messages || []).slice(-limit).map((m) => ({
          role: m.role, text: String(m.text || '').slice(0, 200), at: m.at || null,
        }));
        return sendJson(res, 200, { ok: true, member, count: msgs.length, messages: msgs });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

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

    // 9.31b 弹出某个成员最后 N 条聊天历史 POST /api/admin/history/pop {member, count}
    if (req.method === 'POST' && pathname === '/api/admin/history/pop') {
      try {
        const body = await parseJsonBody(req, 64 * 1024);
        const member = String(body.member || 'husband').trim();
        const count = Math.max(1, Number(body.count) || 2);
        const cur = petService.readHistory(member);
        cur.messages = (cur.messages || []).slice(0, -count);
        petService.saveHistory(member, cur);
        console.log(`[History] 已弹出 ${member} 最后 ${count} 条历史（剩余 ${cur.messages.length} 条）`);
        return sendJson(res, 200, { ok: true, member, popped: count, remaining: cur.messages.length });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 立刻跑一次结构自检并修账（诊断/验收）
    if (req.method === 'POST' && pathname === '/api/admin/audit/repair') {
      try {
        const world = loadState(DATA_DIR);
        ensureRealms(world);
        const issues = inspectStructure(world);
        let fixed = 0;
        if (llmClient.isReady() && issues.length) {
          const { system, user } = buildRepairPrompt(world, issues);
          const out = await llmClient.complete({ system, messages: [{ role: 'user', content: user }], temperature: 0.3, maxTokens: 1200 });
          const text = typeof out === 'string' ? out : (out?.text || out?.content || out?.reply || '');
          fixed = applyRepairs(world, text).fixed;
        } else {
          fixed = applyRepairs(world, '').fixed;
        }
        world.flags = world.flags || {};
        world.flags.lastAuditDay = Number(world.clock?.day) || 1;
        saveState(DATA_DIR, world);
        const left = inspectStructure(world);
        return sendJson(res, 200, { ok: true, found: issues.length, fixed, left: left.length, remaining: left.slice(0, 10) });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 雇一个人进某处产业（管理用 / 人工纠错）—— 走唯一入口 hireStaff
    if (req.method === 'POST' && pathname === '/api/admin/staff/hire') {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        const world = loadState(DATA_DIR);
        const r = hireStaff(world, {
          propName: body.prop, name: body.name, role: body.role || '伙计', via: 'admin',
        });
        if (!r.ok) return sendJson(res, 400, { ok: false, error: r.error });
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, hired: r.actor.name, role: r.actor.role, prop: r.prop.name, staff: r.prop.staff });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 删掉误记的产业（管理用）：按名字
    if (req.method === 'POST' && pathname === '/api/admin/property/delete') {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        const name = String(body.name || '').trim();
        const world = loadState(DATA_DIR);
        const before = (world.assets?.properties || []).length;
        world.assets = world.assets || {};
        world.assets.properties = (world.assets.properties || []).filter((x) => x && String(x.name) !== name);
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, removed: before - world.assets.properties.length, left: world.assets.properties.length });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 删掉误立的地方，把人送回一处（管理用）
    if (req.method === 'POST' && pathname === '/api/admin/place/delete') {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        let id = String(body.id || '');
        const wantName = String(body.name || '');
        const to = String(body.to || 'street');
        const world = loadState(DATA_DIR);
        if (!id && wantName) {
          const hit = Object.entries(world.places || {}).find(([, pl]) => pl && String(pl.name) === wantName);
          if (hit) id = hit[0];
        }
        if (!world.places?.[id]) return sendJson(res, 404, { ok: false, error: '没有这个地点' });
        const name = world.places[id].name;
        const back = world.places[to] ? to : 'street';
        for (const a of Object.values(world.actors || {})) {
          if (a && a.location === id) moveActor(world, a.id, back, 'world', '地点撤销');
        }
        delete world.places[id];
        if (world.dynamicPlaces) delete world.dynamicPlaces[id];
        for (const ap of world.appointments || []) if (ap && ap.place === id) delete ap.place;
        saveState(DATA_DIR, world);
        console.log(`[Place] 删掉「${name}」，人送回${world.places[back]?.name || back}`);
        return sendJson(res, 200, { ok: true, deleted: name, movedTo: world.places[back]?.name || back });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 人间自愈：规则自愈 + 手动让天道安顿（诊断/验收用）
    if (req.method === 'POST' && pathname === '/api/admin/world/heal') {
      try {
        const world = loadState(DATA_DIR);
        const ruleFixes = healWorld(world);
        let changed = ruleFixes.length;
        let notes = [...ruleFixes];
        let text = '';
        let rError = null;

        const drift = detectDrift(world) || collectDrifters(world);
        if (drift && llmClient.isReady()) {
          try {
            const { system, user } = buildDriftPrompt(world, drift);
            const out = await llmClient.complete({ system, messages: [{ role: 'user', content: user }], temperature: 0.4, maxTokens: 1500 });
            text = typeof out === 'string' ? out : (out?.text || out?.content || out?.reply || JSON.stringify(out || {}));
            const r = applyPlacements(world, text);
            changed += (r.changed || 0);
            notes = notes.concat(r.notes || []);
            rError = r.error || null;
          } catch (e) {
            console.warn('[Heal] LLM安顿异常：', e.message);
          }
        }
        world.flags = world.flags || {};
        world.flags.lastSelfHealDayHour = (Number(world.clock?.day) || 1) * 24 + (Number(world.clock?.hour) || 0);
        saveState(DATA_DIR, world);
        return sendJson(res, 200, {
          ok: true, healed: true, changed,
          notes: notes.slice(0, 30), error: rError,
          raw: String(text || '').slice(0, 400),
        });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.31b 改世界人物属性 POST /api/admin/actor/set {id, age, gender, role, money, name}
    if (req.method === 'POST' && pathname === '/api/admin/actor/set') {
      try {
        const body = await parseJsonBody(req, 64 * 1024);
        const world = peek(DATA_DIR);
        const a = world.actors?.[String(body.id || '')];
        if (!a) return sendJson(res, 404, { ok: false, error: '没有这个人' });
        const changed = {};
        if (body.name != null) { a.name = String(body.name).slice(0, 12); changed.name = a.name; }
        if (body.age != null) { a.age = Math.max(1, Math.min(120, Number(body.age) || 1)); changed.age = a.age; }
        if (body.gender != null) { a.gender = String(body.gender) === 'male' ? 'male' : 'female'; changed.gender = a.gender; }
        if (body.role != null) { a.role = String(body.role).slice(0, 24); changed.role = a.role; }
        if (body.money != null) { a.money = Math.max(0, Number(body.money) || 0); changed.money = a.money; }
        if (body.location != null) {
          const locStr = String(body.location).trim();
          let pid = world.places?.[locStr] ? locStr : Object.keys(world.places || {}).find(k => world.places[k]?.name === locStr || k === locStr);
          if (pid && world.places?.[pid]) { moveActor(world, a.id, pid, 'ui', '管理改位'); changed.location = world.places[pid].name; }
        }
        // 住处（数据清洗用）：按 place id 或地点全名都认
        if (body.home != null) {
          const homeStr = String(body.home).trim();
          const pid = world.places?.[homeStr] ? homeStr : Object.keys(world.places || {}).find(k => k === homeStr || world.places[k]?.name === homeStr);
          if (!pid || !world.places?.[pid]) return sendJson(res, 400, { ok: false, error: '没有这个住处' });
          a.home = pid;
          a.homeName = world.places[pid].name;
          changed.home = a.homeName;
        }
        if (body.quarters != null) {
          const qStr = String(body.quarters).trim();
          const qid = world.places?.[qStr] ? qStr : Object.keys(world.places || {}).find(k => k === qStr || world.places[k]?.name === qStr);
          if (!qid || !world.places?.[qid]) return sendJson(res, 400, { ok: false, error: '没有这个住处' });
          a.quarters = qid;
          changed.quarters = world.places[qid].name;
        }
        // 婚配：给谁当配偶（双向写，避免一边有一边没有）
        if (body.spouse !== undefined) {
          const sid = body.spouse ? String(body.spouse) : null;
          if (sid && !world.actors?.[sid]) return sendJson(res, 400, { ok: false, error: '没有这个配偶' });
          if (a.spouse && world.actors?.[a.spouse] && world.actors[a.spouse].spouse === a.id) {
            world.actors[a.spouse].spouse = null;   // 解开旧的一对
          }
          a.spouse = sid;
          if (sid) {
            world.actors[sid].spouse = a.id;
            if (!world.actors[sid].marital) world.actors[sid].marital = 'married';
          }
          changed.spouse = sid ? (world.actors[sid].name || sid) : null;
        }
        if (body.marital != null) { a.marital = String(body.marital); changed.marital = a.marital; }
        if (body.jailed !== undefined) {
          if (body.jailed === null || body.jailed === false) { delete a.jailed; changed.jailed = null; }
          else if (typeof body.jailed === 'object') { a.jailed = body.jailed; changed.jailed = a.jailed; }
        }
        if (body.trust != null || body.desire != null || body.grievance != null) {
          if (!a.relations) a.relations = {};
          if (!a.relations.husband) a.relations.husband = { trust: 50, desire: 0, grievance: 0 };
          if (body.trust != null) { a.relations.husband.trust = Math.max(0, Math.min(100, Math.round(Number(body.trust)) || 0)); changed.trust = a.relations.husband.trust; }
          if (body.desire != null) { a.relations.husband.desire = Math.max(0, Math.min(100, Math.round(Number(body.desire)) || 0)); changed.desire = a.relations.husband.desire; }
          if (body.grievance != null) { a.relations.husband.grievance = Math.max(0, Math.min(100, Math.round(Number(body.grievance)) || 0)); changed.grievance = a.relations.husband.grievance; }
        }
        saveState(DATA_DIR, world);
        console.log(`[Admin] 改人物：${a.name} ${JSON.stringify(changed)}`);
        return sendJson(res, 200, { ok: true, actor: { id: a.id, name: a.name, age: a.age, gender: a.gender, role: a.role, money: a.money } });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.305 钱账调整：只给管理员修误扣/误加，必须落一条流水
    if (req.method === 'POST' && pathname === '/api/admin/money/adjust') {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        const delta = Math.round(Number(body.delta) * 100) / 100;
        if (!delta || Math.abs(delta) > 10000) return sendJson(res, 400, { ok: false, error: 'delta 不合法' });
        const world = loadState(DATA_DIR);
        world.assets = world.assets || {};
        world.assets.silver = Math.round(((Number(world.assets.silver) || 0) + delta) * 100) / 100;
        world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
        world.ledger.push({
          day: world.clock?.day || 1, hour: world.clock?.hour || 0, delta,
          title: String(body.note || '账目调整').slice(0, 24),
          category: delta > 0 ? '进账' : '开销', by: 'husband', balance: world.assets.silver,
        });
        world.notes = Array.isArray(world.notes) ? world.notes : [];
        world.notes.push({ day: world.clock?.day || 1, hour: world.clock?.hour || 0, text: String(body.note || '账目调整').slice(0, 40) });
        saveState(DATA_DIR, world);
        console.log(`[MoneyAdjust] ${delta > 0 ? '+' : ''}${delta} 两：${body.note || ''}；现银 ${world.assets.silver}`);
        return sendJson(res, 200, { ok: true, silver: world.assets.silver });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.30b 指定产业添人：已有的人调过去，没有的人真落籍（后台修数据用）
    if (req.method === 'POST' && pathname === '/api/admin/project/staff') {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        const world = loadState(DATA_DIR);
        const props = Array.isArray(world.assets?.properties) ? world.assets.properties : [];
        const prop = props.find((p) => p && p.name && (String(p.name) === String(body.property || '') || String(p.name).includes(String(body.property || ''))));
        if (!prop) return sendJson(res, 404, { ok: false, error: '没有这间产业' });
        if (!prop.placeId) {
          const hit = Object.entries(world.places || {}).find(([, pl]) => pl && String(pl.name).includes(String(prop.name)));
          if (hit) { prop.placeId = hit[0]; prop.place = hit[0]; prop.placeName = hit[1].name; }
        }
        if (!prop.placeId || !world.places?.[prop.placeId]) return sendJson(res, 400, { ok: false, error: '产业没有地点' });
        const name = String(body.name || '').trim().slice(0, 8);
        const role = String(body.role || '伙计').slice(0, 8);
        if (!name) return sendJson(res, 400, { ok: false, error: '需要 name' });
        let actor = Object.values(world.actors || {}).find((a) => a && !a.dead && a.name === name);
        if (actor) {
          moveActor(world, actor.id, prop.placeId, 'world', '调往产业');
          if (role) actor.role = role;
        } else {
          const r = hireStaff(world, { propName: prop.name, name, role, hiredBy: 'husband' });
          if (!r?.ok) return sendJson(res, 400, { ok: false, error: r?.error || '招人失败' });
          actor = Object.values(world.actors || {}).find((a) => a && a.name === name);
        }
        if (actor) {
          prop.staffIds = Array.isArray(prop.staffIds) ? prop.staffIds : [];
          if (!prop.staffIds.includes(actor.id)) prop.staffIds.push(actor.id);
          prop.staff = prop.staffIds.length;
          actor.home = prop.placeId;
          actor.quarters = prop.placeId;
          actor.workplace = prop.name;
          actor.workplaceId = prop.placeId;
          actor.schedule = [];
          actor.duty = { ...(actor.duty || {}), home: prop.placeId, place: prop.placeId };
          if (/掌柜/.test(role)) { prop.keeper = actor.id; prop.keeperName = actor.name; }
        }
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, property: prop.name, placeId: prop.placeId, staff: prop.staff, actor: actor?.name || null });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.31 账本修复：清掉"只写流水、没进现银"的测试行；可补一条尾款债权
    if (req.method === 'POST' && pathname === '/api/admin/ledger/repair') {
      try {
        const body = await parseJsonBody(req, 128 * 1024);
        const world = loadState(DATA_DIR);
        const day = Number(body.day) || Number(world.clock?.day) || 1;
        const delta = Number(body.delta);
        const keepBalance = Number(body.keepBalance);
        const titleRe = body.titlePattern ? new RegExp(String(body.titlePattern)) : null;
        if (!delta || !Number.isFinite(keepBalance)) {
          return sendJson(res, 400, { ok: false, error: '需要 delta 与 keepBalance' });
        }
        const before = Array.isArray(world.ledger) ? world.ledger.length : 0;
        const removed = [];
        world.ledger = (world.ledger || []).filter((e) => {
          if (!e) return false;
          const match = Number(e.day) === day && Number(e.delta) === delta
            && (!titleRe || titleRe.test(String(e.title || '')))
            && Math.abs(Number(e.balance) - keepBalance) > 0.005;
          if (match) { removed.push({ title: e.title, delta: e.delta, balance: e.balance }); return false; }
          return true;
        });
        let promise = null;
        const p = body.promise;
        if (p && p.text && Number(p.due) > 0 && Number(p.amount) > 0) {
          const exists = (world.promises || []).some((x) => x && !x.done && x.orderBalance && String(x.text || '').includes(String(p.text).slice(0, 12)));
          if (!exists) {
            promise = {
              id: `pr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
              text: String(p.text).slice(0, 80),
              due: Number(p.due),
              at: Number(world.clock?.day) || 1,
              done: false, about: [], owner: 'husband',
              orderBalance: Math.round(Number(p.amount) * 100) / 100,
            };
            world.promises = Array.isArray(world.promises) ? world.promises : [];
            world.promises.push(promise);
          }
        }
        world.notes = Array.isArray(world.notes) ? world.notes : [];
        world.notes.push({ day, hour: world.clock?.hour || 0, text: `账本修复：清 ${removed.length} 条无现银流水${promise ? '，补尾款债权' : ''}` });
        world.notes = world.notes.slice(-80);
        saveState(DATA_DIR, world);
        console.log(`[LedgerRepair] 清 ${removed.length} 条 day=${day} delta=${delta}，保留 balance=${keepBalance}`);
        return sendJson(res, 200, { ok: true, removed, before, after: world.ledger.length, promise });
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
          moveActor(world, id, to, 'world', '拖去牢里');
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
        let added = 0;
        for (const it of items) {
          if (addMemory(world, { text: it?.text, day: it?.day, about: it?.about || [], visible: it?.visible || 'private' })) added += 1;
        }
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



    // 9.88 立即触发一条主动递话事件（供相公或测试随时演练，带TTS语音合成）
    if (req.method === 'POST' && pathname === '/api/admin/proactive/trigger') {
      try {
        const body = await parseJsonBody(req, 16 * 1024);
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
        const world = loadState(DATA_DIR);
        const speaker = body.speaker || '二房·芸娘';
        const actorId = body.actorId || 'yunnia';
        const text = body.text || '【二房·芸娘】：相公，老茶坊今日账目妾身已盘清了，新给你做了一双软底暖靴。炉子上煨着莲子羹，相公何时回房歇息？';
        const place = body.place || '临江·王宅·西厢房';
        const placeId = body.placeId || 'wang_mansion_west';
        const reason = body.reason || 'night_care';

        let audioKey = null;
        try {
          if (ttsService) {
            const cleanSpeech = text.replace(/【[^】\n]+】\s*[:：]?/g, '').replace(/[（(][^）)]*[）)]/g, '').trim();
            if (cleanSpeech) {
              const ttsRes = await ttsService.synthesizeToFile({ text: cleanSpeech });
              audioKey = ttsRes?.audioKey || null;
            }
          }
        } catch { /* 忽略语音失败 */ }

        queueProactive(world, {
          speaker,
          actorId,
          place,
          placeId,
          text,
          fallback: text,
          reason,
          type: 'proactive',
          isLetter: true,
          force: true,
        });

        if (audioKey && world.proactive?.length) {
          world.proactive[world.proactive.length - 1].audioKey = audioKey;
        }

        saveState(DATA_DIR, world);
        console.log(`[Admin] 立即触发主动便笺: ${speaker} -> 相公（地点：${place}）`);
        return sendJson(res, 200, { ok: true, text, speaker, place, audioKey });
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

    // 9.36 手动放一股匪 POST /api/admin/bandit/spawn {city, strength, tier, name}
    if (req.method === 'POST' && pathname === '/api/admin/bandit/spawn') {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        const world = loadState(DATA_DIR);
        const b = spawnBandit(world, {
          city: String(body.city || '临江府'),
          strength: Number(body.strength) || 8,
          tier: Number(body.tier) || 1,
          name: String(body.name || ''),
        });
        saveState(DATA_DIR, world);
        console.log(`[Bandit] 手动放匪：${b.name}（${b.strength} 人，${b.tier} 阶）@${b.homeCity}`);
        return sendJson(res, 200, { ok: true, bandit: { id: b.id, name: b.name, strength: b.strength, tier: b.tier, city: b.homeCity } });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 10. 世界状态速览 GET /api/admin/world（天道的幕后账本，只读）
    if (req.method === 'GET' && pathname === '/api/admin/world') {
      try {
        const world = peek(DATA_DIR);
        const actors = Object.entries(world.actors || {})
          // 相公本人也放进列表，看板才能看到他的行踪
          .map(([key, a]) => ({
            id: key,
            name: a.name,
            role: a.role,
            place: world.places?.[a.location]?.name || a.location || '',
            relations: a.relations?.husband || null,
            intimacy: a.intimacy || null,
            household: Boolean(a.household),
            origin: a.origin || 'preset',
            gender: a.gender || (key === 'husband' ? 'male' : '未知'),
            money: typeof a.money === 'number' ? a.money : null,
            age: Number(a.age) || null,
            home: a.home || null,
            homeName: a.home ? (world.places?.[a.home]?.name || '') : '',
            duty: a.duty || null,
            marital: a.marital || null,
            maritalText: maritalTextOf(a, a.spouse ? (world.actors?.[a.spouse]?.name || '') : ''),
            bodyText: mensesStatusText(a),
            spouseId: a.spouse || null,
            spouseName: a.spouse ? (world.actors?.[a.spouse]?.name || '') : '',
            residence: a.residence ? { type: a.residence.type, placeId: a.residence.placeId, placeName: world.places?.[a.residence.placeId]?.name || '' } : null,
            onPeriod: Boolean(a.menses?.on),
            fertile: (() => {
              const m = a.menses;
              if (!m || typeof m.cycleDay !== 'number' || m.on) return false;
              // 28 天周期：第 9~16 天为易孕期（排卵前后）
              return m.cycleDay >= 9 && m.cycleDay <= 16;
            })(),
            debt: Number(a.debt) || 0,
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

        // 妻妾名分与家宅谱系
        const marriagesList = Array.isArray(world.marriages) ? [...world.marriages] : [];
        const knownMarriages = new Set(marriagesList.map((m) => m.who));
        if (!knownMarriages.has('waner') && world.actors?.waner) {
          marriagesList.unshift({
            who: 'waner',
            name: world.actors.waner.name || '沈婉儿',
            rank: '正妻·大娘子',
            dowry: 0,
            day: 1,
          });
          knownMarriages.add('waner');
        }
        const yunKey = world.actors?.yunnia ? 'yunnia' : (world.actors?.yunniang ? 'yunniang' : null);
        if (yunKey && !knownMarriages.has('yunnia') && !knownMarriages.has('yunniang')) {
          marriagesList.push({
            who: yunKey,
            name: world.actors[yunKey].name || '林芸娘',
            rank: world.actors[yunKey].role || '二房如夫人',
            dowry: 0,
            day: 1,
          });
          knownMarriages.add(yunKey);
        }
        const marriages = marriagesList.map((m) => {
          const a = world.actors?.[m.who] || {};
          return {
            id: m.id || m.who,
            who: m.who,
            name: m.name || a.name,
            rank: m.rank || a.role || '如夫人',
            location: a.location || 'backyard',
            placeName: world.places?.[a.location]?.name || '后院暖阁',
            pregnancy: a.pregnancy || null,
            pregnancyMonth: a.pregnancy && !a.pregnancy.born ? Math.floor((a.pregnancy.days || 0) / 30) : null,
            children: a.children || [],
            intimacy: a.intimacy || null,
            day: m.day || 1,
          };
        });

        // 派系
        const factions = world.factions || {
          yamen: { name: '临江府衙', relation: 0, power: 45 },
          court: { name: '朝廷权贵', relation: -10, power: 90 },
        };

        // 粮草与物价
        const grainPrice = Number(world.cities?.linjiang?.price || 100);
        const grainStock = Math.round(Number(world.court?.treasury?.grain) || 0);
        const grain = { price: grainPrice, stock: grainStock };

        // 一句话概览
        const hus = world.actors?.husband;
        const husLocName = world.places?.[hus?.location]?.name || '临江茶坊';
        const silverVal = Number(world.assets?.silver || 0).toFixed(1);
        const allProps = Array.isArray(world.assets?.properties) ? world.assets.properties : [];
        const propList = allProps.filter((p) => p && (p.owner === 'husband' || p.keeper === 'husband' || (!p.owner && !p.keeper)));
        const dailyInc = propList.reduce((s, p) => s + (Number(p.incomePerDay) || 0), 0).toFixed(1);
        const digest = `大明江南 · 第${world.clock?.day || 1}日${shichenOf(world.clock?.hour ?? 8)}（${world.clock?.hour ?? 8}时），相公身在【${husLocName}】，现存白银 ${silverVal} 两，产业日入 ${dailyInc} 两。`;

        // 今日晨报
        const morningReport = world.flags?.lastMorningReport || (typeof buildMorningReport === 'function' ? buildMorningReport(world) : '');

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
          bandits: Object.values(world.bandits || {}).map((b) => ({
            id: b.id, name: b.name, kind: b.kind, tier: b.tier, strength: b.strength,
            leader: b.leader, homeCity: b.homeCity, silver: b.silver, grain: b.grain, region: b.region,
          })),
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
        factions: Object.values(world.factions || {}).map((f) => ({
          id: f.id, name: f.name, kind: f.kind, leader: f.leader,
          troops: Number(f.troops) || 0, grain: Math.round((Number(f.grain) || 0) * 10) / 10,
          silver: Math.round(factionSilver(world, f) * 100) / 100,
          morale: Number(f.morale) || 0, ambition: Number(f.ambition) || 0,
          strength: factionStrength(world, f), cities: (f.cities || []).slice(0, 12),
          gear: f.gear || {}, kinds: f.kinds || {}, fresh: Number(f.fresh) || 0, freshUntilDay: Number(f.freshUntilDay) || 0,
          monthlyPay: upkeepOf(world, f).monthlyPay, monthlyGrain: upkeepOf(world, f).monthlyGrain,
          arrears: f.arrears || { months: 0, owed: 0 },
          stationed: f.stationed || {}, marches: (f.marches || []).map((m) => ({ to: m.to, troops: m.troops, arriveDay: m.arriveDay })),
        })),
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
            const evs = readRecentEvents(DATA_DIR, 30).filter(
              (e) => (Number(e?.day) || 0) * 24 + (Number(e?.hour) || 0) <= nowH,
            );
            // 每条都带上人话说明，并合并同一时刻同一件事的重复
            const out = [];
            const index = new Map();
            for (const e of evs) {
              const text = eventText(world, e);
              const key = `${e.day}|${e.hour}|${e.action}|${e.actor}|${e.payload?.actorId || ''}`;
              const hit = index.get(key);
              if (hit) {
                hit.repeat += 1;
                hit.text = `${hit.base}（×${hit.repeat}）`;
                continue;
              }
              const item = { ...e, text, base: text, repeat: 1 };
              index.set(key, item);
              out.push(item);
            }
            return out.slice(-12);
          })(),
          timeline: buildTimeline(world, readRecentEvents(DATA_DIR, 40), 14),
          ledger: recentLedger(world, 8),
          summary: buildStateSummary(DATA_DIR),
          marriages,
          factions,
          grain,
          digest,
          morningReport,
          quelledTotal: Number(world.flags?.quelledTotal) || 0,
          nextRank: (() => { try { return nextPromotion(world); } catch { return null; } })(),
        });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

  return sendJson(res, 404, { ok: false, error: `未找到对应管理接口: ${pathname}` });
}
