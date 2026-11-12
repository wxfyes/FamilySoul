import http from 'node:http';
import { pruneForeignRooms, settleItinerants, buildPremises, buildCourts } from './world/residence.js';
import { describeRoom, roomForHour } from './world/room-life.js';
import { knock, grantPass, residenceOf } from './world/visit.js';
import fs from 'node:fs';
import dns from 'node:dns';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { RolesManager } from './roles-manager.js';
import { LlmClient } from './llm-client.js';
import { EdgeTtsService } from './edge-tts.js';
import { VisionGeminiService } from './vision-gemini.js';
import { PetService } from './pet-service.js';
import { planNamedNpcMoves } from './chat/plan-moves.js';
import { startWorldClock, peek, buildMorningReport, refreshPropertyIncomes, queueProactive, runBusinessTraffic, dispatchNaturalProactive } from './world/clock.js';
import {
  listCorrespondence, getCorrespondence, markCorrespondence, appendCorrespondence,
  setCorrespondenceStatus,
} from './world/correspondence.js';
import { detectDrift, collectDrifters, buildDriftPrompt, applyPlacements, shouldHeal } from './world/society.js';
import { readRecentEvents, shichenOf, saveState, appendEvents, nextEvent } from './world/state.js';
import { beginStateBatch, endStateBatch, runInStateTurn } from './world/state.js';
import { buildStateSummary } from './world/summarize.js';
import { maybeOfferAlliance } from './world/marriage.js';
import { advanceWorldTick } from './world/tick.js';
import { ensureCityBase, streetOfCity, cityOfPlace } from './world/city.js';
import { isPlaceNameOk } from './world/ledger-rules.js';
import { itemsOf, giveItem, showItem, askItem, addItem, prepareHouseholdItem, HOUSEHOLD_SUPPLY_PRESETS } from './world/items.js';
import { pursueGoals, refreshGoals } from './world/goals.js';
import { describeScene, moveMember, readSceneMessages } from './world/scene.js';
import { auditWorld, inspectStructure, buildRepairPrompt, applyRepairs } from './world/audit.js';
import { ensureRealms } from './world/realm.js';
import { worldDate } from './world/state.js';
import { healWorld } from './world/heal.js';
import { ensureArcs } from './world/arcs.js';
import { ensureCities, ensureCourt, ensureTerrain, seedPersonalMoney, loadState } from './world/state.js';
import { applyAction } from './world/apply.js';
import { auditAll } from './world/audit.js';
import { ARC_HINT, arcStepText } from './world/arcs.js';
import { moveActor, isHumanBound } from './world/position.js';
import { markHumanSeen, isHumanOnline } from './world/presence.js';
import { buildTimeline, eventText } from './world/events-view.js';
import { spendSilver, recentLedger } from './world/ledger.js';
import { getMoney, setMoney, spendMoney, syncMoney } from './world/money.js';
import { isPlaceName } from './world/naming.js';
import { hireStaff, visiblePropertiesOf } from './world/employment.js';
import { renameActor, syncNames } from './world/identity.js';
import { buildOpeningFacts, buildOpeningPrompt } from './world/opening.js';
import { ensureFactions, factionOf, factionSilver, factionStrength, spendFactionSilver } from './world/factions.js';
import { recruit, buyGrain, besiege, bribeCity, fortify, march, stationTroops, transferPropertyGrain, troopsAt, totalTroops, buyGear, callToArms, upkeepOf, payArrears } from './world/warfare.js';
import { buildStrategyPrompt, applyStrategyDecisions } from './world/strategy.js';
import { marketSnapshot, grainPrice } from './world/prices.js';
import { roomPriceAt, propertyPriceAt, priceOf } from './world/pricing.js';
import { buyGoods, sellGoods, goodsSnapshot } from './world/trade.js';
import { materializeMigrant, fallbackName } from './world/migration.js';
import { quellBandits, banditStrengthTotal, nextPromotion, spawnBandit } from './world/bandits.js';
import { RECRUIT_KINDS } from './world/warfare.js';
import { maritalTextOf, mensesStatusText } from './world/persona.js';
import { addFame, fameOf, legitimacy } from './world/reputation.js';
import { ensureClans, clanBacking, relatedClanIds } from './world/clans.js';
import { canalFrozen } from './world/season.js';
import { AssistantService } from './assistant-service.js';
import { UserRegistry } from './user-registry.js';
import { addMemory } from './world/memory.js';
import { sendJson, parseJsonBody, handleOptions } from './middleware/http-utils.js';
import { resolveMember as resolveMemberAuth, getLockedToken as getLockedTokenAuth, lockHusbandToken as lockHusbandTokenAuth, getFamilyProfiles as getFamilyProfilesAuth, touchMember, MEMBER_LAST_SEEN } from './middleware/auth.js';
import { handleStaticRoutes } from './routes/static-routes.js';
import { handleAdminRoutes } from './routes/admin-routes.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CONFIG_FILE = path.join(ROOT_DIR, 'config.json');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const AVATAR_DIR = path.join(DATA_DIR, 'avatars');
const AVATAR_INDEX = path.join(AVATAR_DIR, 'index.json');
const TOKEN_LOCK_FILE = path.join(DATA_DIR, 'husband-token');
const ROUTINE_FILE = path.join(DATA_DIR, 'routine.json');
const STARTED_AT = Date.now();

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(AVATAR_DIR, { recursive: true });

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
      historyTurns: 4,
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
  return getLockedTokenAuth({ config, lockFile: TOKEN_LOCK_FILE });
}

function lockHusbandToken(incomingToken) {
  return lockHusbandTokenAuth(incomingToken, { config, lockFile: TOKEN_LOCK_FILE });
}

function getFamilyProfiles() {
  return getFamilyProfilesAuth({ config, lockFile: TOKEN_LOCK_FILE });
}

function resolveMember(req, url) {
  return resolveMemberAuth(req, url, { config, lockFile: TOKEN_LOCK_FILE, userRegistry });
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
const llmClient = new LlmClient({ deepseek: config.deepseek, qwen: config.qwen, llmMode: config.llmMode || 'deepseek' });
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
const userRegistry = new UserRegistry({ dataDir: DATA_DIR });
const assistantService = new AssistantService({ dataDir: DATA_DIR, llmClient });

/**
 * 引擎只排队「该她说话了」这个事实，台词由天道（大模型）现写；
 * 只有大模型不可用时才退回兜底文案。
 */
async function fillProactiveTexts() {
  try {
    // 第一段：只读。抄出待填的那几条（只带 id 与所需事实），此后不再碰 snap
    const snap = peek(DATA_DIR);
    const pending = (Array.isArray(snap.proactive) ? snap.proactive : [])
      .filter((p) => p && !p.text)
      .slice(0, 2)
      .map((p) => ({
        id: p.id,
        to: p.to || 'husband',
        speaker: p.speaker || null,
        reason: p.reason || 'proactive',
        facts: p.facts || {},
        fallback: p.fallback || '',
      }));
    if (!pending.length) return;

    // 第二段：逐条等天道现写（耗时阶段，不持有可写世界）
    const results = [];
    for (const item of pending) {
      let text = '';
      try {
        text = await petService.generateProactive({
          memberKey: item.to,
          roleName: config.activeRole,
          asName: item.speaker,
          reason: item.reason,
          facts: item.facts,
        });
      } catch (e) {
        console.warn('[Push] 生成失败：', e.message);
      }
      const finalText = String(text || item.fallback || '').slice(0, 300);
      if (!finalText) continue;
      const spkMatch = finalText.match(/^\s*【([^】\n]{1,16})】/);
      results.push({
        id: item.id,
        text: finalText,
        speaker: spkMatch ? spkMatch[1].trim() : item.speaker,
      });
    }
    if (!results.length) return;

    // 第三段：重新读盘（含这几秒内相公的一切操作），按 id 精准写回
    const fresh = loadState(DATA_DIR);
    const list = Array.isArray(fresh.proactive) ? fresh.proactive : [];
    const main =
      Object.values(fresh.actors || {}).find((a) => a && a.role === config.activeRole) ||
      fresh.actors?.waner;
    let filled = 0;
    for (const r of results) {
      const target = list.find((p) => p && p.id === r.id);
      if (!target || target.text) continue;
      target.text = r.text;
      if (r.speaker) {
        target.speaker = r.speaker;
      } else if (!target.speaker && main) {
        const short = main.name && main.name.length > 2 ? main.name.slice(-2) : main.name;
        target.speaker = `${main.role}·${short}`;
      }
      // 尝试为主动递话生成真实语音，使 App 端收到时可自动原声播报
      try {
        if (ttsService && target.text) {
          const cleanSpeech = target.text.replace(/【[^】\n]+】\s*[:：]?/g, '').replace(/[（(][^）)]*[）)]/g, '').trim();
          if (cleanSpeech) {
            const ttsRes = await ttsService.synthesizeToFile({ text: cleanSpeech });
            if (ttsRes?.audioKey) {
              target.audioKey = ttsRes.audioKey;
            }
          }
        }
      } catch { /* 语音失败不影响文字上屏 */ }
      filled += 1;
    }
    if (filled > 0) {
      saveState(DATA_DIR, fresh);
      console.log(`[Push] 天道已现写 ${filled} 条主动消息`);
    }
  } catch (err) {
    console.warn('[Push] 主动消息生成失败：', err.message);
  }
}


// 体检采样：30 秒一个点，留最近 2 小时（只读内存，不碰世界账）
globalThis.__perfSeries = globalThis.__perfSeries || [];
try {
  const __sampler = setInterval(() => {
    try {
      const mem = process.memoryUsage();
      const st = globalThis.__stateStats || {};
      const chat = globalThis.__chatStats || { avgMs: 0, maxMs: 0 };
      const series = globalThis.__perfSeries;
      series.push({
        t: Date.now(),
        rssMB: Math.round(mem.rss / 1048576),
        heapMB: Math.round(mem.heapUsed / 1048576),
        chatMs: Number(chat.avgMs) || 0,
        writes: Number(st.writes) || 0,
        loads: Number(st.loads) || 0,
      });
      if (series.length > 240) series.shift();
    } catch { /* 忽略 */ }
  }, 30000);
  if (typeof __sampler.unref === 'function') __sampler.unref();
} catch { /* 忽略 */ }



  // 案情由天道现写：哪座城、谁犯事、犯了什么
  async function generateCase() {
    try {
      const w = peek(DATA_DIR);
      const pend = w.flags?.pendingCase;
      if (!pend || !pend.city) return;
      const cityLabel = (nm) => { const seg = String(nm || '').split('·')[0]; return /府$|州$|县$/.test(seg) ? seg : '临江府'; };
      const pool = Object.values(w.actors || {})
        .filter((a) => a && !a.dead && !a.jailed && a.id !== 'husband' && !a.playerControlled)
        // 案子只在这座城里发生：别把外城的人拉来顶案
        .filter((a) => cityLabel(w.places?.[a.location]?.name) === String(pend.city || ''))
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
        day: w2.clock.day, hour: w2.clock.hour,
        // 地点跟被告实际所在城走，别张冠李戴
        city: (() => {
          const pl = w2.places?.[culprit.location]?.name || '';
          const parts = String(pl).split('·');
          const hit = parts.find((p) => /府|州|县/.test(p));
          return hit || pend.city;
        })(),
        place: culprit.location || null,
        who: victim.name, whoId: victim.id,
        against: culprit.name, againstId: culprit.id,
        claim: String(d?.crime || '犯了事').slice(0, 20),
        witnesses: [], status: 'summoned', hearDay: (Number(w2.clock?.day) || 1) + 1, hearHour: 9, verdict: null, petty: true,
      });
      saveState(DATA_DIR, w2);
      console.log(`[Case] ${pend.city}：${culprit.name}${d?.crime}（告主：${victim.name}）`);
    } catch (err) {
      console.warn('[Case] 生成案情失败：', err.message);
    }
  }

const server = http.createServer(async (req, res) => {
  // CORS 预检
  if (handleOptions(req, res)) return;

  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = url.pathname;

  // 0. 静态资源托管（Web 控制台、Dashboard、静态头像等）
  if (handleStaticRoutes(req, res, { pathname, rootDir: ROOT_DIR, avatarDir: AVATAR_DIR })) {
    return;
  }

  function matchRoute(route) {
    if (pathname === route) return true;
    if (pathname === `/api${route}`) return true;
    if (pathname === `/dsh-surfcore/pet-api${route}`) return true;
    if (pathname === `/dsh-surfcore/pet-api/api${route}`) return true;
    return false;
  }

  // 0. 公开自主建档入世接口 POST /api/register
  if (req.method === 'POST' && matchRoute('/register')) {
    try {
      // 留个痕：谁在什么时候来注册（排查"客户端没发出去"还是"服务端拒了"）
      console.log(`[Register] 收到注册请求：ua=${String(req.headers?.['user-agent'] || '').slice(0, 60)} token=${url.searchParams.get('token') ? '有' : '无'}`);
      const body = await parseJsonBody(req, 16 * 1024);
      const resData = userRegistry.register(body);
      if (!resData.ok) {
        return sendJson(res, 400, resData);
      }
      return sendJson(res, 200, resData);
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

    // 0.042 中馈：补发内宅积欠月例
    if (req.method === 'POST' && pathname === '/api/world/household') {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
        const body = await parseJsonBody(req, 32 * 1024);
        const world = loadState(DATA_DIR);
        world.assets = world.assets && typeof world.assets === 'object' ? world.assets : {};
        const ar = world.assets.householdArrears || { months: 0, owed: 0 };
        const act = String(body.action || 'pay_arrears');
        if (act !== 'pay_arrears') return sendJson(res, 200, { ok: false, error: '未知动作' });
        if (!(Number(ar.owed) > 0)) return sendJson(res, 200, { ok: false, error: '内宅并不欠月例' });
        const need = Math.round(Number(ar.owed) * 100) / 100;
        const silver = Number(world.assets.silver) || 0;
        if (silver < need) return sendJson(res, 200, { ok: false, error: `银不够：欠 ${need} 两，手头 ${silver.toFixed(2)} 两` });
        world.assets.silver = Math.round((silver - need) * 100) / 100;
        world.assets.householdArrears = { months: 0, owed: 0 };
        for (const a of Object.values(world.actors || {})) {
          if (!a || a.dead || !a.household) continue;
          const rel = a.relations?.husband;
          if (rel) {
            rel.grievance = Math.max(0, Math.round((Number(rel.grievance) || 0) - 10));
            rel.trust = Math.min(100, Math.round((Number(rel.trust) || 50) + 5));
          }
        }
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, text: `补发内宅积欠 ${need} 两，婉儿重掌中馈，家宅复归安泰` });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 0.043 商货买卖：盐 / 茶 / 丝 / 铁 / 药（真买真卖，有货有价）
    if (req.method === 'POST' && pathname === '/api/world/trade') {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
        const body = await parseJsonBody(req, 32 * 1024);
        const world = loadState(DATA_DIR);
        const act = String(body.action || 'buy');
        const city = String(body.city || '');
        const good = String(body.good || '');
        const qty = Number(body.qty) || 0;
        const r = act === 'sell'
          ? sellGoods(world, member.actor || 'husband', { city, good, qty })
          : buyGoods(world, member.actor || 'husband', { city, good, qty });
        if (r.ok) saveState(DATA_DIR, world);
        return sendJson(res, 200, r);
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 0.044 善举：施粥 / 平价粜米（花钱买名声，压民怨）
    if (req.method === 'POST' && pathname === '/api/world/charity') {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
        const body = await parseJsonBody(req, 32 * 1024);
        const world = loadState(DATA_DIR);
        const me = world.actors?.[member.actor || 'husband'];
        const amount = Math.max(1, Math.round(Number(body.amount) || 0));
        const city = String(body.city || '临江府');
        if (!world.cities?.[city]) return sendJson(res, 200, { ok: false, error: '没有这座城' });
        if (!spendSilver(world, amount, `施粥·${city}`, member.actor || 'husband').ok) {
          return sendJson(res, 200, { ok: false, error: '银不够' });
        }
        world.cities[city].unrest = Math.max(0, Number(world.cities[city].unrest) - Math.round(amount / 20));
        addFame(world, member.actor || 'husband', Math.min(12, Math.round(amount / 10)), '仁商');
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, text: `在${city}施粥${amount}两，民怨稍平，名声渐起` });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 0.045 外交与自立：结盟 / 断交 / 赠礼 / 称制
    if (req.method === 'POST' && pathname === '/api/world/diplomacy') {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
        const isHusband = member.memberKey === 'husband' || member.role === '相公' || member.actor === 'husband';
        if (!isHusband) {
          return sendJson(res, 403, { ok: false, error: '布衣白身擅掌兵权形同聚众谋逆！唯有一方家主（王相公）方可操盘府邸家兵。' });
        }
        const body = await parseJsonBody(req, 64 * 1024);
        const world = loadState(DATA_DIR);
        ensureFactions(world);
        const me = factionOf(world, 'wangjia');
        const other = factionOf(world, String(body.faction || ''));
        if (!me) return sendJson(res, 404, { ok: false, error: '没有这个势力' });
        if (!other && String(body.action || '') !== 'proclaim') {
          return sendJson(res, 404, { ok: false, error: '没有这个势力' });
        }

        const act = String(body.action || '');
        me.relations = me.relations || {};
        let text = '';
        if (act === 'ally') {
          other.relations = other.relations || {};
          me.relations[other.id] = 60;
          other.relations[me.id] = Math.max(50, Number(other.relations[me.id]) || 0);
          text = `${me.name}与${other.name}结为盟好`;
        } else if (act === 'break') {
          other.relations = other.relations || {};
          me.relations[other.id] = -30;
          other.relations[me.id] = -30;
          addFame(world, 'husband', -6, '乱贼');
          text = `${me.name}与${other.name}断交`;
        } else if (act === 'gift') {
          const amount = Math.max(1, Number(body.amount) || 0);
          if (!spendFactionSilver(world, me, amount)) return sendJson(res, 200, { ok: false, error: '银不够' });
          other.relations = other.relations || {};
          other.relations[me.id] = Math.min(100, (Number(other.relations[me.id]) || 0) + Math.round(amount / 10));
          text = `${me.name}赠${other.name}${amount}两`;
        } else if (act === 'proclaim') {
          const cities = (me.cities || []).length;
          if (cities < 3) return sendJson(res, 200, { ok: false, error: `至少要据三城才能称制（现有 ${cities} 城）` });
          const legit = legitimacy(world, 'husband');
          if (legit < 40) {
            addFame(world, 'husband', -10, '乱贼');
            me.relations.court = -80;
            if (world.factions.court) {
              world.factions.court.relations = world.factions.court.relations || {};
              world.factions.court.relations.wangjia = -80;
            }
            saveState(DATA_DIR, world);
            return sendJson(res, 200, { ok: false, error: `名分不足（${legit}/40），僭号必引天下共讨` });
          }
          me.kind = 'warlord';
          me.stance = 'expand';
          me.stateName = String(body.name || '临江').slice(0, 6);
          me.relations.court = -60;
          if (world.factions.court) {
            world.factions.court.relations = world.factions.court.relations || {};
            world.factions.court.relations.wangjia = -60;
          }
          text = `${me.name}据${cities}城，称制建国，号「${me.stateName}」`;
        } else {
          return sendJson(res, 200, { ok: false, error: '未知动作' });
        }
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, text: cleanText });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }


    // 0.04 兵权：募兵 / 买粮 / 围城 / 招降 / 修城（玩家侧）
    if (req.method === 'POST' && pathname.startsWith('/api/world/military')) {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
        const body = await parseJsonBody(req, 64 * 1024);
        const world = loadState(DATA_DIR);
        ensureFactions(world);
        const fid = 'wangjia';
        const f = factionOf(world, fid);
        if (!f) return sendJson(res, 404, { ok: false, error: '没有这个势力' });

        const act = String(body.action || '');
        // 家主鉴权：王家私兵只能由家主（王甯或该势力首领）调动；读状态不受限
        {
          const leader = String(f.leader || 'husband');
          const who = String(member.actor || 'husband');
          const readOnly = act === '' || act === 'status' || act === 'info';
          if (!readOnly && who !== leader && who !== 'husband') {
            return sendJson(res, 403, { ok: false, error: '王家私兵由家主掌管，你无权调动。' });
          }
        }
        let result = { ok: false, error: '未知动作' };
        if (act === 'recruit') result = recruit(world, fid, Number(body.count) || 0, String(body.city || ''), String(body.kind || 'guard'));
        else if (act === 'grain') result = buyGrain(world, fid, Number(body.shi) || 0, String(body.city || ''));
        else if (act === 'siege') result = besiege(world, { attacker: fid, cityName: String(body.city || ''), troops: Number(body.troops) || 0 });
        else if (act === 'bribe') result = bribeCity(world, fid, String(body.city || ''), Number(body.amount) || 0);
        else if (act === 'fortify') result = fortify(world, fid, String(body.city || ''), Number(body.amount) || 200);
        else if (act === 'march') result = march(world, fid, String(body.from || ''), String(body.city || ''), Number(body.troops) || 0);
        else if (act === 'station') result = stationTroops(world, fid, String(body.from || ''), String(body.city || ''), Number(body.troops) || 0);
        else if (act === 'transfer') result = transferPropertyGrain(world, fid, String(body.prop || ''), String(body.city || ''), Number(body.shi) || 0);
        else if (act === 'gear') result = buyGear(world, fid, String(body.kind || 'weapon'), Number(body.qty) || 0);
        else if (act === 'call') result = callToArms(world, fid, { city: String(body.city || ''), max: Number(body.max) || 60, kind: String(body.kind || 'guard') });
        else if (act === 'pay_arrears') result = payArrears(world, fid);
        else if (act === 'quell_bandits') {
          result = quellBandits(world, String(body.banditId || ''), Number(body.troops) || 0, String(body.city || ''));
          try {
            // 全城通报：剿匪成败都进事件流（客户端 news / 事件卡能读到），并添一条市井风闻
            if (result?.ok && result.win) {
              const ev = nextEvent(world, {
                action: 'bandit_quelled', actor: 'husband', place: result.city || '临江府',
                payload: { text: `【剿匪捷报】临江王家出兵剿平「${result.name || '匪帮'}」，缴银 ${result.lootSilver || 0} 两、粮 ${result.lootGrain || 0} 石${result.loss ? `，折兵 ${result.loss} 人` : ''}，民心大振${result.appoint || ''}` },
                isPublic: true,
              });
              appendEvents(DATA_DIR, [ev]);
            } else if (result?.ok && !result.win) {
              const ev = nextEvent(world, {
                action: 'bandit_failed', actor: 'husband', place: result.city || '临江府',
                payload: { text: `【战报】王家出兵攻「${result.name || '匪帮'}」不利，折兵 ${result.loss || 0} 人` },
                isPublic: true,
              });
              appendEvents(DATA_DIR, [ev]);
            }
          } catch { /* 忽略 */ }
        }
        else if (act === 'army') result = { ok: true, troops: totalTroops(world, factionOf(world, fid)), stationed: factionOf(world, fid)?.stationed || {} };

        if (result.ok) saveState(DATA_DIR, world);
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }


  // 0.05 落地第一幕：新人进世界，天道主动开口（只生成一次）
  if (req.method === 'POST' && (pathname === '/api/world/opening' || pathname === '/dsh-surfcore/pet-api/api/world/opening')) {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
      const actorId = member.actor || member.memberKey;
      const world = loadState(DATA_DIR);
      const a = world.actors?.[actorId];
      if (!a) return sendJson(res, 404, { ok: false, error: '世界里没有这个角色' });
      if (a.opened) return sendJson(res, 200, { ok: true, text: '', done: true });
      if (!llmClient.isReady()) return sendJson(res, 200, { ok: false, error: '天道未就绪' });

      const facts = buildOpeningFacts(world, actorId);
      const { system, user } = buildOpeningPrompt(facts);
      const out = await llmClient.complete({ system, messages: [{ role: 'user', content: user }], temperature: 0.85, maxTokens: 400 });
      const text = (typeof out === 'string' ? out : (out?.text || out?.content || out?.reply || '')).trim();
      if (!text) return sendJson(res, 200, { ok: false, error: '天道没写出第一幕' });

      // 开场里的人：天道声明了就用引擎真立起来，并放到他身边
      let spawnedName = '';
      try {
        const spawnTags = String(text).match(/\[\[spawn:([^\]]+)\]\]/g);
        if (spawnTags) {
          for (const tag of spawnTags) {
            const mm = /\[\[spawn:([^|\]]+)(?:\|([^\]]+))?\]\]/.exec(tag);
            if (!mm) continue;
            const whoName = String(mm[1]).trim().slice(0, 4);
            const whoRole = String(mm[2] || '街坊').trim().slice(0, 10);
            if (!/^[\u4e00-\u9fa5]{2,4}$/.test(whoName)) continue;
            if (Object.values(world.actors || {}).some((x) => x && x.name === whoName)) { spawnedName = whoName; continue; }
            const nid = `npc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            // 过门人：有自己的家、有作息；绝不把玩家的私宅当自己家
            const isHomeOfPlayer = Boolean(world.places?.[a.location]?.residence);
            world.actors[nid] = {
              id: nid, name: whoName, role: whoRole,
              gender: inferGenderFromIdentity(whoName, whoRole, 'male'),
              age: inferAgeFromIdentity(whoName, whoRole, '', nid),
              money: round2(0.3 + Math.random() * 2),
              relations: {},
              origin: 'dm_opening', createdDay: world.clock?.day || 1,
            };
            const nearId = String(a.location || 'street');
            const ownHome = ensureDwelling(world, nid, whoName, nearId);
            world.actors[nid].home = ownHome;
            world.actors[nid].location = nearId === 'street' ? ownHome : nearId;
            world.actors[nid].schedule = defaultSchedule(whoRole, nearId, ownHome);
            spawnedName = whoName;
            console.log(`[Opening] 天道立了个过门人：${whoName}（${whoRole}）`);
          }
        }
      } catch { /* 忽略 */ }

      // 天道没写"过门人"：就从街上叫一个真邻居过来串门（不凭空造人）
      if (!spawnedName) {
        try {
          const neighbors = Object.values(world.actors || {}).filter((x) => x && !x.dead
            && !x.humanBound && !x.household && !String(x.id).startsWith('usr_') && x.id !== actorId
            && (x.home === a.home || /街|巷|坊|院/.test(String(world.places?.[x.location]?.name || ''))));
          if (neighbors.length) {
            const pick = neighbors[Math.floor(Math.random() * Math.min(neighbors.length, 8))];
            moveActor(world, pick.id, a.location, 'world', '邻人过门');
            spawnedName = pick.name;
            console.log(`[Opening] 天道没立人，叫了街坊 ${pick.name} 过来`);
          }
        } catch { /* 忽略 */ }
      }

      // 先清洗正文（去掉机器标记），再落历史，免得标记被存下来反复显示
      const cleanText = String(text).replace(/\[\[[^\]]+\]\]/g, '').replace(/\n{3,}/g, '\n\n').trim();

      a.opened = { day: world.clock?.day || 1, hour: world.clock?.hour || 0 };
      saveState(DATA_DIR, world);

      try {
        const h = petService.readHistory(actorId) || {};
        const msgs = Array.isArray(h.messages) ? h.messages : [];
        // 按【说话人】拆开存：旁白归旁白，人物归人物，客户端才会分成两个气泡
        const parts = cleanText.split(/(?=【[^】\n]{1,12}】)/).map((x) => x.trim()).filter(Boolean);
        for (const part of parts) {
          const m0 = /^【([^】\n]{1,12})】/.exec(part);
          msgs.push({
            role: 'assistant',
            text: part,
            speaker: m0 ? m0[1] : '旁白',
            at: Date.now(),
          });
        }
        petService.saveHistory(actorId, { ...h, messages: msgs });
      } catch { /* 忽略 */ }

      console.log(`[Opening] ${a.name} 落地第一幕已生成（${text.length} 字）`);
      return sendJson(res, 200, { ok: true, text: cleanText });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }


  // 0.1 AI 助手专属解耦接口（物理级隔离于虚拟世界之外，只做纯净知性问答）
  // POST /api/assistant/chat
  if (req.method === 'POST' && matchRoute('/assistant/chat')) {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效或尚未立牒入世' });
      const memberKey = member.memberKey;
      const body = await parseJsonBody(req, 6 * 1024 * 1024);
      let asked = String(body.text || '');
      // 带了图：先让视觉看一遍，再把"看到的"交给助手，图不落盘
      if (body.imageBase64) {
        try {
          const seen = await visionService.analyzeVisualFrame({ imageBase64: String(body.imageBase64), mimeType: String(body.mimeType || 'image/jpeg') });
          const desc = String(seen?.description || seen?.text || seen?.visualFact || '').trim();
          if (desc) asked = `${asked}\n（我刚看过一张图：${desc}）`;
        } catch (err) { console.log('[Assistant] 看图失败：', err.message); }
      }
      const replyObj = await assistantService.chat(memberKey, asked, { newSession: Boolean(body.newSession) });
      return sendJson(res, 200, replyObj);
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // GET /api/assistant/history
  if (req.method === 'GET' && matchRoute('/assistant/history')) {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效或尚未立牒入世' });
      const memberKey = member.memberKey;
      const limit = parseInt(url.searchParams.get('limit') || '30', 10);
      const history = assistantService.getHistory(memberKey, limit);
      return sendJson(res, 200, { ok: true, history });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // POST /api/assistant/clear
  if (req.method === 'POST' && matchRoute('/assistant/clear')) {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效或尚未立牒入世' });
      const memberKey = member.memberKey;
      assistantService.clearHistory(memberKey);
      return sendJson(res, 200, { ok: true });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
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
    // 约定的地点：优先记下的地点，否则就是对方此刻所在（老记录没 actorId 就按名字找）
    const apTargetPlace = (w, ap) => {
      if (!ap) return null;
      if (ap.place && w.places?.[ap.place]) return ap.place;
      const byId = ap.actorId ? w.actors?.[ap.actorId] : null;
      if (byId?.location) return byId.location;
      const byName = Object.values(w.actors || {}).find((a) => a && a.name === ap.name);
      return byName?.location || null;
    };

    // 原话里提到的地点：约定里写了"雅阁/茶摊/铺子"，就该去那儿，不该随机
    const placeFromText = (world, text, fallbackParent) => {
      const t = String(text || '');
      if (!t) return null;
      // ① 原话里点了世上已有的地名 → 就去那儿
      let best = null;
      for (const [id, pl] of Object.entries(world.places || {})) {
        const nm = String(pl?.name || '');
        if (nm.length < 2) continue;
        if (!t.includes(nm)) continue;
        if (!best || nm.length > best.nm.length) best = { id, nm };
      }
      if (best) return best.id;

      // ② 原话点了一个"雅阁/暖房/西厢"这类具体的屋，世上还没有 → 照原话把它立起来
      //    （这不是乱起名，是剧情里已经说定的地方，只是还没入册）
      // 只认"到/去/往/在/回/进/于/至 + 名 + 屋"，或"名 + 屋"两字名
      const SUF = '(阁|房|间|轩|堂|园|楼|居|斋|厅)';
      let roomName = null;
      const m1 = t.match(new RegExp(`(?:到|去|往|在|回|进|于|至)([\\u4e00-\\u9fa5]{1,3}?)${SUF}`));
      if (m1) roomName = (m1[1] + m1[2]).replace(/^[的了着个间]/, '');
      if (!roomName) {
        const m2 = t.match(new RegExp(`([\\u4e00-\\u9fa5]{2})${SUF}`));
        if (m2) roomName = m2[0];
      }
      if (roomName && !isPlaceName(roomName).ok) roomName = null;
      if (roomName) {
        world.places = world.places || {};
        world.flags = world.flags || {};
        world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;
        const id = `place_${world.flags.placeSeq}`;
        const parent = fallbackParent && world.places[fallbackParent] ? fallbackParent : 'street';
        world.places[id] = {
          id, name: roomName, exits: [parent], dynamic: true, private: true,
          desc: '剧情里说定的地方，记录在册',
          createdDay: world.clock?.day || 1,
        };
        world.dynamicPlaces = world.dynamicPlaces || {};
        world.dynamicPlaces[id] = world.places[id];
        console.log(`[Place] 原话里的「${roomName}」入册`);
        return id;
      }
      return null;
    };

    // 约定没地点时：当场请天道从"世上已有的地方"里挑一个（它挑，引擎不猜）
    const askDmForPlace = async (world, ap) => {
      try {
        // 先看原话里有没有现成地点
        const otherActor = Object.values(world.actors || {}).find((a) => a && a.name === ap?.name);
        const fromText = placeFromText(world, ap?.text, otherActor?.location);
        if (fromText) {
          ap.place = fromText;
          world.notes = Array.isArray(world.notes) ? world.notes : [];
          world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `与${ap.name || '人'}的约定在「${world.places[fromText].name}」（原话就说的这儿）` });
          return fromText;
        }
        if (!llmClient.isReady()) return null;
        const places = Object.entries(world.places || {})
          .filter(([, pl]) => pl && pl.name && !pl.private)
          .map(([, pl]) => pl.name)
          .slice(0, 80)
          .join('、');
        const sys = '你是这个世界的天道。只输出一个地点名，别的都不许写。';
        const other = Object.values(world.actors || {}).find((a) => a && a.name === ap.name);
        const otherPlace = other ? (world.places?.[other.location]?.name || '') : '';
        const usr = [
          `第${world.clock?.day}日 ${world.clock?.hour}时，有一桩约要去赴：`,
          `与${ap.name || '某人'}（她此刻在「${otherPlace || '不知何处'}」）：${String(ap.text || '').slice(0, 60)}`,
          `世上现有的地方：${places}`,
          '先看这桩事的原话里提到了哪处（比如"雅阁/茶摊/铺子/货栈"）；提到了就用那处。',
          '原话没提，就用当事人此刻所在处，或与这事最相关的铺子。',
          '不许随机挑、不许另起地名。只回一个上面列表里的地点名。',
        ].join('\n');
        const out = await llmClient.complete({ system: sys, messages: [{ role: 'user', content: usr }], temperature: 0.2, maxTokens: 40 });
        const text = typeof out === 'string' ? out : (out?.text || out?.content || out?.reply || '');
        const name = String(text || '').trim().split(/[\s，。,.、\n]/)[0];
        const hit = Object.entries(world.places || {}).find(([, pl]) => pl && String(pl.name) === name);
        if (hit) {
          ap.place = hit[0];
          world.notes = Array.isArray(world.notes) ? world.notes : [];
          world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `与${ap.name || '人'}的约定定在「${name}」` });
          console.log(`[Place] 天道定下地点：${name}`);
          return hit[0];
        }
        console.log(`[Place] 天道给的「${name}」不在名册里，不用`);
      } catch (err) {
        console.warn('[Place] 问地点失败：', err.message);
      }
      return null;
    };

    // ═══ 交互层：去哪 / 找人 / 约定（只读 + 走同一条管道） ═══

    // GET /api/world/menu  → 一次取回：我在哪、可去的地方、可找的人、待办
    if (req.method === 'GET' && matchRoute('/world/menu')) {
      try {
        const world = peek(DATA_DIR);
        // 谁在请求，就以谁的身份看世界（她的号看她的位置）
        const member = resolveMember(req, url);
        const actorId = member?.actor || 'husband';
        const me = world.actors?.[actorId] || world.actors?.husband;
        const curId = me?.location || 'husband_room';
        const curName = world.places?.[curId]?.name || curId;

        const placeName = (id) => world.places?.[id]?.name || id;
        const people = Object.values(world.actors || {}).filter((a) => a && !a.dead && a.id !== actorId);

        // 可去的地方：当前出口 + 自有产业 + 有人的地方
        const exits = (world.places?.[curId]?.exits || []).map((id) => ({ id, name: placeName(id) }));
        // 产业只给"自己的"：相公看相公的，其他人只看自己名下或自己管的；把旗下各层与雅间房间一并带出
        const props = visiblePropertiesOf(world, actorId)
          .map((x) => {
            const pid = x.placeId || x.id;
            const p = world.places?.[pid] || Object.values(world.places || {}).find((pl) => pl && pl.name === x.name);
            const parentKey = (p && p.id) || pid || (p ? Object.keys(world.places || {}).find((k) => world.places[k] === p) : null);
            const subRooms = [];
            if (p?.rooms) {
              for (const [rid, r] of Object.entries(p.rooms)) {
                if (r && r.name) {
                  const targetId = r.id || (parentKey ? `${parentKey}__${rid}` : rid);
                  subRooms.push({ id: targetId, name: r.name });
                }
              }
            }
            if (parentKey) {
              for (const [subId, subPl] of Object.entries(world.places || {})) {
                if (subPl && subPl.parent && (subPl.parent === parentKey || (p?.id && subPl.parent === p.id))) {
                  const sName = String(subPl.name || '').split('·').slice(-1)[0];
                  if (!subRooms.some((r) => r.id === subId || r.name === sName)) {
                    subRooms.push({ id: subId, name: sName });
                  }
                }
              }
            }
            return {
              id: x.id,
              name: x.name,
              income: x.incomePerDay || 0,
              placeId: pid,
              rooms: subRooms,
            };
          });
        const occupied = {};
        for (const a of people) {
          if (!a.location || !a.name) continue;
          occupied[a.location] = occupied[a.location] || [];
          if (occupied[a.location].length < 3) occupied[a.location].push(a.name);
        }
        // 全城名册都算可去：有人的排前面，其次按名字排；私密房间（客栈房）不进公共列表
        // 先给"眼前这片"排前面：同宅的院子 → 同城 → 有人的 → 其它
        const curPlace = world.places?.[curId] || {};
        const myHome = world.actors?.[actorId]?.home || '';
        const labelOf = (nm) => {
          const seg = String(nm || '').split('·')[0];
          if (/府$|州$|县$/.test(seg) && world.cities?.[seg]) return seg;
          return '临江府';
        };
        const myCity = curPlace ? labelOf(curPlace.name) : '';
        const nearScore = ([id, pl]) => {
          if (id === myHome) return 0;
          if (pl.parent && (pl.parent === curId || pl.parent === myHome)) return 1;
          if (pl.parent) return 2;
          if (curPlace.city && pl.city && pl.city === curPlace.city) return 3;
          return 4;
        };
        // 私宅里的院子只列"自己这座宅子"的；公共地点全列
        const places = Object.entries(world.places || {})
          .filter(([id, pl]) => {
            if (id === curId || !pl || !pl.name || pl.private || pl.hidden) return false;
            // 只列本城的地方：成都的人不该看见临江的铺子
            if (myCity && labelOf(pl.name) !== myCity) return false;
            // 区分私密住所与公开商业/自有产业：酒楼、茶坊、茶肆的雅阁、天字阁、清幽雅间、单间、内账房全部放行
            const par = pl.parent ? world.places?.[pl.parent] : null;
            const isCommercialOrMine = Boolean(
              pl.owner === 'husband' ||
              pl.access === 'public_shop' ||
              (par && (
                par.owner === 'husband' ||
                par.use === 'restaurant' ||
                par.use === 'shop' ||
                /酒楼|酒肆|茶坊|茶肆|货栈|客栈/.test(String(par.name || ''))
              ))
            );
            if (!isCommercialOrMine && /后坊|库房|后厨|酒窖|雅间|上房|暖阁|厢房|卧房|下房|值房|账房|书房|祠堂|仓房|柴房|马厩/.test(String(pl.name || ''))) return false;
            if (pl.parent) {
              // 只列公开的地方：前堂、门厅、院子；后厨库房雅间卧房一律不列
              const pubAccess = pl.access === 'public_outer' || pl.access === 'guest_main' || pl.access === 'guest_outer' || pl.access === 'public_shop';
              const pubUse = pl.use === 'shop_floor' || pl.use === 'hall' || pl.use === 'gate' || pl.use === 'yard';
              if (!(pubAccess && pubUse)) return false;
              if (pl.parent === myHome || pl.parent === curId) return true;
              // 公开营业场所（酒楼/茶坊/衙署/客栈）的院子也列出来，雅阁、天字阁才搜得到
              const par = world.places?.[pl.parent];
              const pub = par && (par.use === 'restaurant' || par.use === 'shop' || par.use === 'court'
                || /酒楼|酒肆|饭庄|茶坊|茶肆|茶楼|茶栈|客栈|衙署|县衙|码头|货栈|商行/.test(String(par.name || '')));
              return Boolean(pub);
            }
            return true;
          })
          .map(([id, pl]) => ({ id, name: pl.name, names: occupied[id] || [], count: (occupied[id] || []).length, near: nearScore([id, pl]) }))
          .sort((x, y) => (x.near - y.near) || (y.count - x.count) || x.name.localeCompare(y.name, 'zh'))
          .slice(0, 400);

        // 院子平时只记在父地点的账上（不占地点表）；列菜单时按 id 补进来，人真去了才展开
        try {
          const wantedParents = new Set([myHome, curId].filter(Boolean));
          // 公开营业的场所（酒楼/茶坊/茶栈/客栈/衙署），不论在哪个城，院子都进菜单，雅阁才搜得到
          for (const [pid, pl] of Object.entries(world.places || {})) {
            if (!pl || !pl.rooms) continue;
            if (wantedParents.has(pid)) continue;
            const pub = pl.use === 'restaurant' || pl.use === 'shop' || pl.use === 'court'
              || /酒楼|酒肆|饭庄|茶坊|茶肆|茶楼|茶栈|客栈|衙署|县衙|码头|货栈|商行/.test(String(pl.name || ''));
            if (pub) wantedParents.add(pid);
            if (wantedParents.size > 80) break;
          }
          let addedRooms = 0;
          for (const pid of wantedParents) {
            const parent = world.places?.[pid];
            if (!parent?.rooms) continue;
            const houseName = String(parent.name || '').split('·').slice(0, 2).join('·');
            for (const [key, rec] of Object.entries(parent.rooms)) {
              if (!rec || !rec.id) continue;
              if (world.places[rec.id]) continue;   // 已展开的已经在列表里
              if (places.some((x) => x.id === rec.id)) continue;
              // 虚拟补进来的院子也要过私房这一关：后厨、库房、雅间、上房，一律不列
              const fullName = `${houseName}·${rec.name}`;
              // 虚拟补进来的院子也要与本城一致（别把临江的衙署房间列到外城）
              if (myCity) {
                const seg0 = String(parent.name || '').split('·')[0];
                const pCity = /府$|州$|县$/.test(seg0) ? seg0 : '临江府';
                if (pCity !== myCity) continue;
              }
              const isCommOrMine = Boolean(
                parent?.owner === 'husband' ||
                parent?.use === 'restaurant' ||
                parent?.use === 'shop' ||
                /酒楼|酒肆|茶坊|茶肆|货栈|客栈/.test(String(parent?.name || ''))
              );
              if (!isCommOrMine && /后坊|库房|后厨|酒窖|雅间|上房|暖阁|厢房|卧房|下房|值房|账房|书房|祠堂|仓房|柴房|马厩/.test(fullName)) continue;
              const acc = String(rec.access || '');
              if (acc && !['public_outer', 'guest_main', 'guest_outer', 'public_shop'].includes(acc)) continue;
              places.push({
                id: rec.id,
                name: `${houseName}·${rec.name}`,
                names: occupied[rec.id] || [],
                count: (occupied[rec.id] || []).length,
                near: 1,
              });
            }
            places.sort((x, y) => (x.near - y.near) || (y.count - x.count) || x.name.localeCompare(y.name, 'zh'));
            if (addedRooms === 0 || true) addedRooms += Object.keys(parent.rooms).length;
          }
          console.log(`[Menu] 补入院子：父地点 ${wantedParents.size} 处，菜单 ${places.length} 条`);
        } catch (e) { console.log('[Menu] 补院子失败：', e.message); }

        // 常来往：关系网里处得来的人（不是仇家），加进"找人"的第一组
        const friendIds = new Set();
        try {
          const myBonds = world.bonds?.[actorId] || {};
          for (const [otherId, b] of Object.entries(myBonds)) {
            if (!b || b.type === '仇家' || b.type === '主仆') continue;
            if (Number(b.score) >= 20 && world.actors?.[otherId] && !world.actors[otherId].dead) friendIds.add(otherId);
          }
        } catch { /* 忽略 */ }

        // 可找的人：府内 / 相好 / 其他
        const rel = (a) => a.relations?.husband || {};
        // 相好 = 真有过肌肤之亲（或明写了相好关系）；光"信任高、合作多"只是常来往
        const isIntimate = (a) => Boolean(a.intimacy?.consummated)
          || String(a.bondsWithHusband || '') === '相好'
          || Number(a.relations?.husband?.intimate) === 1;
        const isHusbandViewer = actorId === 'husband';
        // 分组按"看的人"来定：三种视角，绝不混用
        const isWifeOfHusband = Boolean(me?.spouse === 'husband' || me?.household);
        const group = (a) => {
          if (isHusbandViewer) {
            if (a.household) return '府内眷属';
            if (isIntimate(a) || (Number(a.relations?.husband?.desire) >= 50 && Number(a.relations?.husband?.trust) >= 50)) return '红颜知己';

            const roleStr = `${a.role || ''} ${a.name || ''}`;
            // 官府权贵
            if (/知县|县令|知府|官员|通判|同知|巡抚|巡按|总兵|县丞|主簿|布政使|按察使|官爷|大人/.test(roleStr) || a.id.startsWith('county_') || a.id.includes('official')) {
              return '官府权贵';
            }
            // 名流士绅
            if (/士绅|富商|名门|巨贾|盐商|总商|崔府|杨府|举人|进士|夫子|先生|名士|闺秀/.test(roleStr) || a.id.includes('gentry') || a.id.includes('tycoon')) {
              return '名流士绅';
            }
            // 产业掌柜与主事
            if (/掌柜|大厨|账房|书办|管事|头领|主事/.test(roleStr) || a.id.startsWith('staff_') || a.id.includes('manager') || a.id === 'npc_49' || a.id === 'npc_accountant_zhou') {
              return '产业掌柜';
            }
            if (friendIds.has(a.id) || Number(a.relations?.husband?.trust || 0) >= 30) return '熟络之交';
            return '市井百态';
          }
          // 女眷视角（婉儿、芸娘、小翠等真正的内室）
          if (isWifeOfHusband) {
            if (a.id === 'husband') return '我的人';
            if (a.household) return '王家';
            if (a.id === actorId) return '我的人';
            return '其他人';
          }
          // 独立市井平民视角（离析、新角色、路人男丁）
          if (a.id === actorId) return '我的人';
          if (a.spouse === actorId) return '我的人';
          if (a.id === 'husband') return '王东家';
          if (a.household) return '王府家眷';
          if (friendIds.has(a.id)) return '熟人';
          return '其他人';
        };
        const peopleOut = people
          .map((a) => ({
            id: a.id, name: a.name,
            // 王甯的头衔：他的妻妾看到"相公"，外人只看到"东家"
            role: (a.id === 'husband' && !isHusbandViewer && !isWifeOfHusband)
              ? '临江茶坊少东家'
              : (a.role || ''),
            gender: a.gender || 'female',
            place: placeName(a.location || ''),
            here: a.location === curId, group: group(a),
            trust: Number(rel(a).trust) || 0, grievance: Number(rel(a).grievance) || 0,
            // 相公是真人账号，不能被别人"叫过来"——只能自己过去
            canSummon: !isHusbandViewer ? a.id !== 'husband' : true,
          }))
          .sort((x, y) => {
            const o = isHusbandViewer
              ? { 府内眷属: 0, 府内: 0, 红颜知己: 1, 相好: 1, 产业掌柜: 2, 官府权贵: 3, 名流士绅: 4, 熟络之交: 5, 常来往: 5, 市井百态: 6, 其他人: 7 }
              : (isWifeOfHusband
                ? { 我的人: 0, 王家: 1, 其他人: 3 }
                : { 我的人: 0, 熟人: 1, 王东家: 2, 王府家眷: 3, 其他人: 4 });
            const ax = o[x.group] ?? 9;
            const ay = o[y.group] ?? 9;
            if (ax !== ay) return ax - ay;
            // 同组：在跟前的排前，其次信任高的
            if (x.here !== y.here) return x.here ? -1 : 1;
            return y.trust - x.trust;
          });

        // 待办：约定 + 承诺
        const todos = [];
        const viewerTodoOwner = actorId || 'husband';
        const mineTodo = (x) => {
          if (!x) return false;
          const owner = x.owner || 'husband';
          if (owner === viewerTodoOwner) return true;
          // 约定里另一方也算当事人
          if (x.actorId && x.actorId === viewerTodoOwner) return true;
          return false;
        };
        for (const ap of (world.appointments || [])) {
          if (!ap) continue;
          if (!mineTodo(ap)) continue;
          todos.push({
            kind: '约定', id: ap.id || `${ap.day}-${ap.hour}-${ap.name}`,
            when: `第${ap.day}日${ap.hour}时`,
            who: (() => {
              const byId = ap.actorId ? world.actors?.[ap.actorId]?.name : null;
              if (byId) return byId;
              const rawName = String(ap.name || '');
              // 老数据把 id 当名字存进来了：能对上人就用真名
              const byName = world.actors?.[rawName]?.name;
              if (byName) return byName;
              const hit = Object.values(world.actors || {}).find((a) => a && a.name === rawName);
              if (hit) return hit.name;
              // 老数据里可能是拼音/拉丁写法（jing'er）：按 id 片段认人
              const frag = rawName.toLowerCase().replace(/[^a-z]/g, '');
              if (frag.length >= 3) {
                const byIdFrag = Object.entries(world.actors || {}).find(([aid]) => aid.toLowerCase().includes(frag));
                if (byIdFrag?.[1]?.name) return byIdFrag[1].name;
              }
              return '';
            })(),
            text: ap.text || '', day: ap.day, hour: ap.hour,
            place: apTargetPlace(world, ap) || '',
            status: ap.engaged ? 'engaged' : 'open',
            placeName: (() => {
              const pid = apTargetPlace(world, ap);
              return pid ? (world.places?.[pid]?.name || '') : '';
            })(),
            overdue: Number(ap.day) * 24 + Number(ap.hour) < (Number(world.clock?.day) || 1) * 24 + (Number(world.clock?.hour) || 0),
          });
        }
        for (const pr of (world.promises || [])) {
          if (!pr || pr.done) continue;
          if (!mineTodo(pr)) continue;
          todos.push({
            kind: '承诺', id: pr.id || String(pr.text || '').slice(0, 20),
            when: `第${pr.due}日`, who: '', text: String(pr.text || '').slice(0, 40), due: pr.due,
            place: '', placeName: '', overdue: Number(pr.due) < (Number(world.clock?.day) || 1),
            status: pr.engaged ? 'engaged' : 'open',
          });
        }
        // 仆人手上的差事
        for (const t of (world.tasks || [])) {
          if (!t || t.status !== 'doing') continue;
          const ownerOk = (t.owner || t.by || 'husband') === viewerTodoOwner || t.actorId === viewerTodoOwner;
          if (!ownerOk) continue;
          todos.push({
            kind: '差事',
            id: t.id,
            when: `第${t.dueDay}日办完`,
            who: t.name,
            text: `${t.what}${(t.log || []).slice(-1)[0]?.text ? '（' + (t.log || []).slice(-1)[0].text + '）' : ''}`,
            place: '', placeName: '', status: 'engaged',
          });
        }

        // 天道最近该知道的事（你的决定会记在这里）
        const brief = (world.notes || []).slice(-8).map((n) => String(n.text || n).slice(0, 60));

        return sendJson(res, 200, {
          ok: true,
          where: { id: curId, name: curName },
          places, homes: props, people: peopleOut, todos,
          clock: { day: world.clock?.day, hour: world.clock?.hour },
          brief,
        });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // GET /api/world/relationships  → 全城世情人物名录与好感羁绊（含城市分类、心性条、态度评语，给 App 展现）
    if (req.method === 'GET' && matchRoute('/world/relationships')) {
      try {
        const world = peek(DATA_DIR);
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效：请先登录' });

        const actorId = member.actor || 'husband';
        const me = world.actors?.[actorId] || world.actors?.husband;
        const curLocation = me?.location || 'husband_room';

        const placeName = (id) => world.places?.[id]?.name || id;
        const citiesList = Object.keys(world.cities || {});

        const cityOf = (a) => {
          if (a.city) return a.city;
          const pName = placeName(a.location || '');
          const text = `${pName} ${a.role || ''} ${a.name || ''}`;
          for (const c of citiesList) {
            if (text.includes(c)) return c;
          }
          for (const c of citiesList) {
            const s = c.replace(/府|州|县/, '');
            if (s.length >= 2 && text.includes(s)) return c;
          }
          return '临江府';
        };

        const attitudeOf = (a) => {
          const r = a.relations?.husband || {};
          const d = Number(r.desire) || 0;
          const t = Number(r.trust) || 0;
          const g = Number(r.grievance) || 0;
          if (a.servant) {
            if (g >= 60) return '心里有气，但不敢违拗';
            if (t >= 60) return a.gender === 'male' ? '忠心办事的伙计，最得力' : '贴心的丫头，最得力';
            return a.gender === 'male' ? '府里的伙计，听你差遣' : '府里的丫头，听你差遣';
          }
          if (a.gender === 'male' && a.household) {
            if (g >= 60) return '心里有气，但不敢违拗';
            if (t >= 60) return '忠心办事的伙计，最得力';
            return '府里的伙计，听你差遣';
          }
          if (a.gender === 'male') {
            if (g >= 60) return '对你有敌意，见面就要生事';
            if (g >= 30) return '心里有疙瘩，面上还应酬';
            if (t >= 60) return '称兄道弟，未必真心';
            return '点头之交，各怀算盘';
          }
          if (a.household) {
            if (g >= 60) return '心里有气，会闹一场、要哄';
            if (d >= 60) return '心里有你，主动迎合';
            if (d >= 30) return '愿意服侍，会撒撒娇';
            return '虽有些倦，仍会应下';
          }
          if (g >= 60) return '心里有怨，轻易不松口';
          const isCons = Boolean(a.intimacy?.consummated) || String(a.bondsWithHusband || '') === '相好' || Number(r.intimate) === 1 || (t >= 75 && d >= 60);
          if (isCons) return d >= 50 ? '已是相好，嘴上推拒身子应' : '已是相好，脸皮薄';
          if (d >= 70 && t >= 55) return '心里已有你，半推半就';
          if (d >= 45) return '有点意动，要给由头';
          if (t >= 45) return '可信的人，但到此为止';
          if (d <= 20 && t <= 30) return '只是相识，第一次必拒';
          return '点头之交，各怀算盘';
        };

        const intimacyOf = (a) => {
          if (a.gender !== 'female') return '—';
          if (a.pregnancy && !a.pregnancy.born) {
            const days = Number(a.pregnancy.days || 0);
            const months = Math.floor(days / 30);
            return months >= 1 ? `有孕·${months}个月` : `有孕·${days}天`;
          }
          if (a.menses?.on || a.onPeriod) return '月事中';
          const r = a.relations?.husband || {};
          const t = Number(r.trust) || 0;
          const d = Number(r.desire) || 0;
          const isCons = Boolean(a.intimacy?.consummated) || String(a.bondsWithHusband || '') === '相好' || Number(r.intimate) === 1 || (t >= 75 && d >= 60);
          if (isCons) {
            if (/正妻/.test(String(a.role || ''))) return '琴瑟和鸣';
            if (/如夫人|二房|妾/.test(String(a.role || ''))) return '雨意云情';
            if (a.household) return '承欢侍寝';
            return '红颜相好';
          }
          return a.household ? '端庄' : '守礼';
        };

        const categoryOf = (a) => {
          if (a.household) return 'house';
          const r = a.relations?.husband || {};
          const t = Number(r.trust) || 0;
          const d = Number(r.desire) || 0;
          const isLove = Boolean(a.intimacy?.consummated) || String(a.bondsWithHusband || '') === '相好' || Number(a.relations?.husband?.intimate) === 1 || (t >= 75 && d >= 60);
          if (isLove) return 'love';
          if (/官|府尹|知府|通判|同知|县令|提点|总督|尚书|侍郎|主簿|捕头|衙役/.test(String(a.role || ''))) return 'court';
          return 'all';
        };

        const cityCounts = {};
        const actorsList = [];

        for (const [id, a] of Object.entries(world.actors || {})) {
          if (!a || a.dead) continue;
          if (id === 'husband') continue;
          const c = cityOf(a);
          cityCounts[c] = (cityCounts[c] || 0) + 1;
          const r = a.relations?.husband || {};
          const isHere = a.location === curLocation;
          actorsList.push({
            id,
            name: a.name || id,
            city: c,
            role: a.role || '市井百姓',
            marital: maritalTextOf(a, a.spouse ? (world.actors?.[a.spouse]?.name || '') : ''),
            place: placeName(a.location || ''),
            locationId: a.location || '',
            money: typeof a.money === 'number' ? Number(a.money.toFixed(1)) : 0,
            debt: Number(a.debt) || 0,
            trust: Math.max(0, Math.min(100, Number(r.trust) || 0)),
            desire: Math.max(0, Math.min(100, Number(r.desire) || 0)),
            grievance: Math.max(0, Math.min(100, Number(r.grievance) || 0)),
            attitude: attitudeOf(a),
            intimacy: intimacyOf(a),
            category: categoryOf(a),
            gender: a.gender || 'female',
            here: isHere,
            household: Boolean(a.household),
            canSummon: id !== 'husband',
          });
        }

        actorsList.sort((a, b) => {
          const rank = (x) => {
            if (x.household) return 0;
            if (x.category === 'love' || x.trust >= 50) return 1;
            return 2;
          };
          const ra = rank(a), rb = rank(b);
          if (ra !== rb) return ra - rb;
          if (a.here !== b.here) return a.here ? -1 : 1;
          return b.trust - a.trust;
        });

        const sortedCities = Object.keys(cityCounts).sort((x, y) => cityCounts[y] - cityCounts[x]);
        const cities = [
          { name: '全部', count: actorsList.length },
          ...sortedCities.map((c) => ({ name: c, count: cityCounts[c] }))
        ];

        return sendJson(res, 200, {
          ok: true,
          total: actorsList.length,
          cities,
          actors: actorsList,
        });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // GET /api/world/beauties - 天下妙龄佳丽搜罗（35岁以下），方便相公攻略
    if (req.method === 'GET' && matchRoute('/world/beauties')) {
      try {
        const world = peek(DATA_DIR);
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效：请先登录' });

        const me = world.actors?.husband || world.actors?.[member.actor || 'husband'];
        const curLocation = me?.location || 'husband_room';
        const placeName = (id) => world.places?.[id]?.name || id;
        const citiesList = Object.keys(world.cities || {});

        const cityOf = (a) => {
          if (a.city) return a.city;
          const pName = placeName(a.location || '');
          const text = `${pName} ${a.role || ''} ${a.name || ''}`;
          for (const c of citiesList) {
            if (text.includes(c)) return c;
          }
          return '临江府';
        };

        const attitudeOf = (a) => {
          const r = a.relations?.husband || {};
          const d = Number(r.desire) || 0;
          const t = Number(r.trust) || 0;
          const g = Number(r.grievance) || 0;
          if (a.household) {
            if (g >= 60) return '心里有气，会闹一场、要哄';
            if (d >= 60) return '心里有你，主动迎合';
            if (d >= 30) return '愿意服侍，会撒撒娇';
            return '虽有些倦，仍会应下';
          }
          if (g >= 60) return '心里有怨，轻易不松口';
          const isCons = Boolean(a.intimacy?.consummated) || String(a.bondsWithHusband || '') === '相好' || Number(r.intimate) === 1 || (t >= 75 && d >= 60);
          if (isCons) return d >= 50 ? '已是相好，嘴上推拒身子应' : '已是相好，脸皮薄';
          if (d >= 70 && t >= 55) return '心里已有你，半推半就';
          if (d >= 45) return '有点意动，要给由头';
          if (t >= 45) return '可信的人，但到此为止';
          if (d <= 20 && t <= 30) return '只是相识，第一次必拒';
          return '点头之交，各怀算盘';
        };

        const intimacyOf = (a) => {
          if (a.pregnancy && !a.pregnancy.born) {
            const days = Number(a.pregnancy.days || 0);
            const months = Math.floor(days / 30);
            return months >= 1 ? `有孕·${months}个月` : `有孕·${days}天`;
          }
          if (a.menses?.on || a.onPeriod) return '月事中';
          const r = a.relations?.husband || {};
          const t = Number(r.trust) || 0;
          const d = Number(r.desire) || 0;
          const isCons = Boolean(a.intimacy?.consummated) || String(a.bondsWithHusband || '') === '相好' || Number(r.intimate) === 1 || (t >= 75 && d >= 60);
          if (isCons) {
            if (/正妻/.test(String(a.role || ''))) return '琴瑟和鸣';
            if (/如夫人|二房|妾/.test(String(a.role || ''))) return '雨意云情';
            if (a.household) return '承欢侍寝';
            return '红颜相好';
          }
          return a.household ? '端庄' : '守礼';
        };

        const beautyAgeOf = (id, a) => {
          if (typeof a.age === 'number' && a.age > 0) return a.age;
          if (id === 'waner' || id === 'shenwaner') return 19;
          if (id === 'yunnia' || id === 'linyunniang') return 18;
          if (id === 'cuiwanning') return 20;
          if (id === 'yangzhenhua') return 21;
          if (id === 'suyingxue') return 27;
          if (id === 'yangcaier' || id === 'yangcaiyun') return 22;
          if (id === 'xiaocui') return 17;
          if (id === 'jinniang') return 24;
          if (id === 'liuwenxia') return 23;
          if (id === 'zhanjing') return 21;
          if (id === 'zixiu') return 17;
          if (id === 'bihuan') return 16;
          let hash = 0;
          for (let i = 0; i < (a.name || id).length; i++) hash = ((hash << 5) - hash) + (a.name || id).charCodeAt(i);
          return 18 + Math.abs(hash % 9);
        };

        const appearanceOf = (a) => {
          if (a.desc || a.look || a.appearance) return String(a.desc || a.look || a.appearance).slice(0, 80);
          if (/知府千金|名门闺秀|小姐/.test(a.role || '')) return '眉目如画，通体矜贵名媛气度，身段清雅婀娜';
          if (/正妻|娘子/.test(a.role || '')) return '容貌温婉端庄，眼波脉脉含情，持家有度的大家风范';
          if (/二房|妾|如夫人/.test(a.role || '')) return '柔情似水，体态轻盈袅娜，一双秋水剪瞳顾盼生姿';
          if (/名妓|清倌人|琴姬|歌姬|风尘|掌事/.test(a.role || '')) return '身段妖娆多姿，媚态天成，轻颦浅笑间摄人心魄';
          if (/丫鬟|侍女|丫头/.test(a.role || '')) return '年方二八，肤若凝脂，娇俏灵动，一团稚气活泼';
          if (/女捕|女将|侠女/.test(a.role || '')) return '英姿飒爽，细腰长腿，眉宇间有一股英武与傲雪之气';
          return '亭亭玉立，姿容秀美，肌理如雪，身段窈窕';
        };

        const secretOf = (a) => {
          if (a.secret) return a.secret;
          const r = a.relations?.husband || {};
          const d = Number(r.desire) || 0;
          const isCons = Boolean(a.intimacy?.consummated) || String(a.bondsWithHusband || '') === '相好' || Number(r.intimate) === 1;
          if (isCons) return '【已入罗帏】对相公情根深种，凡相公吩咐无不依从，私下极盼相公常来疼惜。';
          if (d >= 50) return '【暗送秋波】私下对相公极具好感，稍加撩拨、送些体己礼数便能水到渠成。';
          if (/千金|名门/.test(a.role || '')) return '【名门心事】自幼长于闺阁，心高气傲，喜雅致诗画与风雅之士，敬重顶天立地的男儿。';
          if (/商|掌柜|东家/.test(a.role || '')) return '【求财与依附】商贾之女精明能干，最重相公在两淮盐铁运河上的通天手段与银两实力。';
          return '【待君采撷】待字闺中或流寓市井，常有难解心事，相公若常去探望关切，必成入幕之宾。';
        };

        const beauties = [];
        for (const [id, a] of Object.entries(world.actors || {})) {
          if (!a || a.dead) continue;
          if (id === 'husband') continue;
          if (a.gender !== 'female') continue;
          if (/(老妪|婆|嬷嬷|老太|大娘|老妇|师太|老母|姑子)/.test((a.role || '') + (a.name || ''))) continue;

          const age = beautyAgeOf(id, a);
          if (age > 35) continue;

          const r = a.relations?.husband || {};
          const isHere = a.location === curLocation;
          const isLove = Boolean(a.intimacy?.consummated) || String(a.bondsWithHusband || '') === '相好' || Number(r.intimate) === 1;

          beauties.push({
            id,
            name: a.name || id,
            age,
            city: cityOf(a),
            place: placeName(a.location || ''),
            locationId: a.location || '',
            role: a.role || '名媛佳丽',
            marital: maritalTextOf(a, a.spouse ? (world.actors?.[a.spouse]?.name || '') : ''),
            trust: Math.max(0, Math.min(100, Number(r.trust) || 0)),
            desire: Math.max(0, Math.min(100, Number(r.desire) || 0)),
            grievance: Math.max(0, Math.min(100, Number(r.grievance) || 0)),
            attitude: attitudeOf(a),
            intimacy: intimacyOf(a),
            appearance: appearanceOf(a),
            secret: secretOf(a),
            here: isHere,
            household: Boolean(a.household),
            consummated: isLove,
          });
        }

        beauties.sort((a, b) => {
          if (a.here !== b.here) return a.here ? -1 : 1;
          if (a.consummated !== b.consummated) return a.consummated ? -1 : 1;
          const scoreA = a.trust + a.desire * 1.5;
          const scoreB = b.trust + b.desire * 1.5;
          return scoreB - scoreA;
        });

        return sendJson(res, 200, {
          ok: true,
          total: beauties.length,
          beauties,
        });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // GET /api/world/actors/search?q=xxx - 全域全量人物搜索（无300截断）
    if (req.method === 'GET' && matchRoute('/world/actors/search')) {
      try {
        const world = peek(DATA_DIR);
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效：请先登录' });

        const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
        if (!q) return sendJson(res, 200, { ok: true, total: 0, actors: [] });

        const me = world.actors?.husband || world.actors?.[member.actor || 'husband'];
        const curLocation = me?.location || 'husband_room';
        const placeName = (id) => world.places?.[id]?.name || id;

        const matched = [];
        for (const [id, a] of Object.entries(world.actors || {})) {
          if (!a || a.dead) continue;
          if (id === 'husband') continue;
          const name = String(a.name || '').toLowerCase();
          const role = String(a.role || '').toLowerCase();
          const alias = String(a.alias || '').toLowerCase();
          const pName = String(placeName(a.location || '')).toLowerCase();
          const city = String(a.city || '').toLowerCase();
          const tags = Array.isArray(a.tags) ? a.tags.join(' ').toLowerCase() : '';

          if (name.includes(q) || role.includes(q) || alias.includes(q) || pName.includes(q) || city.includes(q) || tags.includes(q) || id.toLowerCase().includes(q)) {
            const r = a.relations?.husband || {};
            matched.push({
              id,
              name: a.name || id,
              role: a.role || '市井百姓',
              place: placeName(a.location || ''),
              locationId: a.location || '',
              city: a.city || '临江府',
              gender: a.gender || 'male',
              trust: Math.max(0, Math.min(100, Number(r.trust) || 0)),
              desire: Math.max(0, Math.min(100, Number(r.desire) || 0)),
              here: a.location === curLocation,
              household: Boolean(a.household),
            });
          }
        }

        matched.sort((a, b) => {
          if (a.here !== b.here) return a.here ? -1 : 1;
          return b.trust - a.trust;
        });

        return sendJson(res, 200, { ok: true, total: matched.length, actors: matched });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // GET /api/world/items - 随身行囊与储物空间（含相公随身物与在场之人持有物）
    if (req.method === 'GET' && matchRoute('/world/items')) {
      try {
        const world = loadState(DATA_DIR);
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效：请先登录' });

        // 确保相公随身行囊中已备有自家紫阳山头春茶（明前锡罐与雨前青瓷），呼应茶山产业与婉儿奉茶
        const existingTea = Object.values(world.items || {}).some((it) => it && /春茶|茗茶/.test((it.name || '') + (it.kind || '')));
        if (!existingTea) {
          addItem(world, {
            name: '紫阳山头春茶（明前极品锡罐）',
            kind: '茗茶',
            holder: 'husband',
            note: '自家紫阳山茶园头采明前嫩芽，沈婉儿亲手以锡罐封存备妥',
          });
          addItem(world, {
            name: '紫阳山头春茶（雨前嫩芽青瓷瓮）',
            kind: '茗茶',
            holder: 'husband',
            note: '自家紫阳山茶园雨前鲜焙嫩芽，青瓷小瓮装盛，清冽回甘',
          });
          saveState(DATA_DIR, world);
        }

        const me = world.actors?.husband || world.actors?.[member.actor || 'husband'];
        const curLocation = me?.location || 'husband_room';
        const husbandItems = itemsOf(world, 'husband');

        const hereActors = [];
        const presentItems = [];
        for (const [id, a] of Object.entries(world.actors || {})) {
          if (!a || a.dead || id === 'husband') continue;
          if (a.location === curLocation) {
            hereActors.push({ id, name: a.name || id, role: a.role || '', gender: a.gender || 'male' });
            const theirItems = itemsOf(world, id);
            for (const it of theirItems) {
              presentItems.push({ ...it, holderName: a.name || id, holderRole: a.role || '' });
            }
          }
        }

        return sendJson(res, 200, {
          ok: true,
          total: husbandItems.length,
          items: husbandItems,
          presentItems,
          hereActors,
          supplyPresets: HOUSEHOLD_SUPPLY_PRESETS.map((p) => ({
            key: p.key,
            name: p.name,
            kind: p.kind,
            note: p.note,
          })),
        });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // POST /api/world/items/action { action: 'give'|'show'|'ask'|'prepare', itemId, targetActorId, itemKey }
    if (req.method === 'POST' && matchRoute('/world/items/action')) {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效：请先登录' });

        const action = String(body.action || '').trim();
        const itemId = String(body.itemId || '').trim();
        const itemKey = String(body.itemKey || body.itemName || itemId || '').trim();
        const targetActorId = String(body.targetActorId || '').trim();

        if (!action || (!itemId && !itemKey)) {
          return sendJson(res, 400, { ok: false, error: '参数不齐：缺少 action 或 itemId' });
        }

        const world = loadState(DATA_DIR);
        let result = null;

        if (action === 'prepare') {
          const prep = prepareHouseholdItem(world, itemKey, '府库总管');
          if (prep?.item) {
            saveState(DATA_DIR, world);
            result = {
              ok: true,
              line: prep.created
                ? `（已从自家府库/茶坊备妥《${prep.item.name}》，放入您的随身储物空间。）`
                : `（《${prep.item.name}》已在您的随身储物空间中，可随时出示或赠人。）`,
              item: prep.item,
            };
          } else {
            result = { ok: false, line: '（备物未成。）' };
          }
        } else if (action === 'give') {
          if (!targetActorId) return sendJson(res, 400, { ok: false, error: '请指定赠予的对象' });
          result = giveItem(world, 'husband', targetActorId, itemId);
          if (result.ok) {
            saveState(DATA_DIR, world);
            const toActor = world.actors?.[targetActorId];
            const toName = toActor?.name || targetActorId;
            appendEvents(DATA_DIR, [nextEvent(world, 'item_give', {
              desc: `相公将《${result.item?.name}》赠予${toName}`,
              actor: 'husband',
              target: targetActorId,
            })]);
          }
        } else if (action === 'show') {
          result = showItem(world, 'husband', targetActorId, itemId);
        } else if (action === 'ask') {
          if (!targetActorId) return sendJson(res, 400, { ok: false, error: '请指定索取的对象' });
          result = askItem(world, 'husband', targetActorId, itemId);
          if (result.ok) {
            saveState(DATA_DIR, world);
            const fromActor = world.actors?.[targetActorId];
            const fromName = fromActor?.name || targetActorId;
            appendEvents(DATA_DIR, [nextEvent(world, 'item_take', {
              desc: `相公自${fromName}手中取回《${result.item?.name}》`,
              actor: 'husband',
              target: targetActorId,
            })]);
          }
        } else {
          return sendJson(res, 400, { ok: false, error: '未知物品操作：' + action });
        }

        return sendJson(res, 200, {
          ok: Boolean(result?.ok),
          refused: Boolean(result?.refused),
          line: result?.line || '',
          item: result?.item || null,
          trustDelta: result?.trustDelta || 0,
          desireDelta: result?.desireDelta || 0,
        });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // POST /api/world/go { place }  → 我去某处（走 applyAction，单一写者）
    if (req.method === 'POST' && matchRoute('/world/go')) {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        let target = String(body.place || '').trim();
        if (!target) return sendJson(res, 400, { ok: false, error: '没说要哪儿' });
        const world = loadState(DATA_DIR);
        const member = resolveMember(req, url);
        // 没令牌就是外人：绝不允许"空令牌默认当相公"（否则任何人都能把王甯挪走）
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效：请先登录' });
        const actorId = member.actor || 'husband';
        // 记录相公移动前的位置，用于判定是否发生物理转场
        const prevLocation = (world.actors?.[actorId] || world.actors?.husband)?.location || '';

        // 说"回家/回府/回宅"（仅当未指定具体子院落/房间时）：夫妻同归一处，直达正房家眷守候之所
        const isGenericHome = target === 'home' || /^(回家|回府|回宅|回王宅|王宅)$/.test(target);
        const hasSpecificRoom = /(西厢|东跨院|书房|书斋|厨房|柴房|后院|暖阁|客房|门房|garden|wing|study)/i.test(target);
        if (isGenericHome && !hasSpecificRoom) {
          const meH = world.actors?.[actorId];
          const homeId = meH?.home || 'husband_room';
          const wanerLoc = world.actors?.waner?.location;
          // 若大娘子婉儿在王宅正房各室内，相公回府直接夫妻团聚到婉儿处；否则归于主宅
          if (wanerLoc && (wanerLoc === homeId || wanerLoc.startsWith(`${homeId}__`))) {
            target = wanerLoc;
          } else {
            target = homeId;
          }
        }

        // 运河大酒楼及各楼层雅阁/天字阁专属归一映射（彻底消除幽灵空壳 canal_restaurant，直达真实实体 place_44 及其房间）
        if (/天字阁/.test(target)) {
          if (world.places?.['place_44__f3']) target = 'place_44__f3';
          else if (world.places?.['place_44']) target = 'place_44';
        } else if (/雅阁/.test(target)) {
          if (world.places?.['place_44__f2']) target = 'place_44__f2';
          else if (world.places?.['place_44']) target = 'place_44';
        } else if (/大堂/.test(target) && /酒楼/.test(target)) {
          if (world.places?.['place_44__f1']) target = 'place_44__f1';
          else if (world.places?.['place_44']) target = 'place_44';
        } else if (/运河.*酒楼|大酒楼|canal_restaurant/.test(target)) {
          if (world.places?.['place_44']) target = 'place_44';
        }
        // 说的是哪座城：先到那座城的主街（没有基底就现铺一座）
        try {
          for (const cn of Object.keys(world.cities || {})) {
            const base = cn.replace(/府$|县$|州$/g, '');
            const t2 = String(target).trim();
            const isBareCity = t2 === cn || t2 === base || (!t2.includes('·') && t2.includes(cn));
            if (!isBareCity) continue;
            let sid = streetOfCity(world, cn);
            if (!sid) { ensureCityBase(world, cn); sid = streetOfCity(world, cn); }
            if (sid) { target = sid; break; }
          }
        } catch { /* 忽略 */ }

        // 说的是本城某个地方（集市/客栈/米行…）：先在本城找，不要跑到临江去
        try {
          const labelOf2 = (nm) => {
            const seg = String(nm || '').split('·')[0];
            return /府$|州$|县$/.test(seg) ? seg : '临江府';
          };
          const meNow0 = world.actors?.[actorId] || world.actors?.husband;
          const myCity2 = labelOf2(world.places?.[meNow0?.location]?.name);
          // 优先看是否直接命中已有的地点 ID 或完整名称
          if (world.places?.[target]) {
            // target 本身就是合法地点 ID
          } else {
            const exactPl = Object.entries(world.places || {}).find(([k, pl]) => pl && (k === target || pl.name === target));
            if (exactPl) {
              target = exactPl[0];
            } else {
              const alreadyCity = /府|州|县/.test(String(target));
              if (!alreadyCity) {
                const hit = Object.entries(world.places || {}).find(([, pl]) => pl && pl.name
                  && labelOf2(pl.name) === myCity2 && (String(pl.name).includes(target) || target.includes(String(pl.name).split('·').pop())));
                if (hit) target = hit[0];
              }
            }
          }
        } catch { /* 忽略 */ }

        // 说的是人（去找王甯）：先换成他此刻所在的地方，再由门禁决定能不能进
        {
          const meName = String((world.actors?.[actorId] || world.actors?.husband)?.name || '');
          const person = Object.values(world.actors || {}).find(
            (a) => a && !a.dead && a.name && a.name !== meName && (a.name === target || target.includes(a.name)),
          );
          if (person && world.places?.[person.location]) target = person.location;
        }
        // 叫门：要去的是别人的内院，先在门口递帖，允了才进
        let knockLine = '';
        {
          const dest = world.places?.[target];
          const home = dest ? residenceOf(world, dest.id) : null;
          const gateId0 = home?.rooms?.gate?.id || null;
          if (home && String(home.owner || '') !== actorId && target !== gateId0) {
            const verdict = knock(world, actorId, home.id);
            if (!verdict.allowed) {
              // 门房拦住：直接落在大门，把门房的话原样回给相公
              const gateId = world.places?.[home.id]?.rooms?.gate?.id || home.id;
              try { moveActor(world, actorId, gateId, 'world', '叩门被拦'); saveState(DATA_DIR, world); } catch { /* 忽略 */ }
              const gateName = world.places?.[gateId]?.name || '';
              return sendJson(res, 200, {
                ok: true,
                applied: false,
                denied: true,
                place: gateName,
                line: `（${verdict.reason}）你到了「${gateName}」，门房没让进。`,
              });
            } else {
              grantPass(world, actorId, home.id, world.clock?.day);
              if (verdict.place) target = verdict.place;
              knockLine = `（${verdict.reason}）`;
            }
          }
        }
        // 目标若是尚未展开的房间 id（如 yang_mansion__hall），先落地；落不了就退回父地点
        try {
          if (target && !world.places?.[target] && String(target).includes('__')) {
            const [parentId, roomKey] = String(target).split('__');
            const { materializeRoom } = await import('./world/residence.js');
            const made = materializeRoom(world, parentId, roomKey);
            target = (made && world.places?.[made]) ? made : (world.places?.[parentId] ? parentId : target);
            console.log(`[Go] 房间实体落地：${target}`);
          }
        } catch { /* 忽略 */ }
        const intent = {
          id: `ui_go_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          actor: actorId, verb: 'MOVE', target, companions: [],
          params: { byUi: true }, origin: 'ui',
        };
        const res2 = applyAction({ dataDir: DATA_DIR, world, intent, verdict: { companionConsented: true } });
        const after = peek(DATA_DIR);
        // 人走进铺子时立刻补客流/当值，不等下一个世界小时，避免进门先看到空楼
        try { runBusinessTraffic(after); saveState(DATA_DIR, after); } catch { /* 忽略 */ }
        const me2 = after.actors?.[actorId] || after.actors?.husband;
        const placeName2 = after.places?.[me2?.location]?.name || me2?.location || '';
        const isWifeChamber = (loc) => loc === 'husband_room' || loc === 'husband_room__main';
        const isHere = (loc) => loc === me2?.location || (isWifeChamber(me2?.location) && isWifeChamber(loc));
        const hereList = Object.values(after.actors || {})
          .filter((a) => a && !a.dead && a.name && isHere(a.location) && a.id !== (me2?.id || 'husband'))
          .slice(0, 5)
          .map((a) => {
            const act = String(a.activity?.text || '').trim();
            // activity 若是过期的位移文本（如"去了X"），但人就在眼前，绝不拼出"在去了X"
            if (!act || act.startsWith('去了') || act.startsWith('回了') || act.includes('离开')) {
              return a.name;
            }
            const actClean = act.startsWith('在') ? act.slice(1) : act;
            return `${a.name}（在${actClean}）`;
          });
        const line = `${knockLine}（你到了「${placeName2}」。${hereList.length ? '此处：' + hereList.join('，') + '。' : '此处无人。'}）`;
        let activeGreeter = null;
        let activeGreetText = '';
        // 走到有人处，让在场的人先开口；文字世界不能靠动画，只靠一句搭话
        try {
          if (res2?.applied && me2?.location) {
            after.flags = after.flags || {};
            after.flags.lastArrivalAt = after.flags.lastArrivalAt || {};
            const lastGreetTime = Number(after.flags.lastArrivalAt[actorId]) || 0;
            const isFreshTransfer = prevLocation !== me2.location;
            const isCooldownPassed = (Date.now() - lastGreetTime) > 8000;

            if (isFreshTransfer || isCooldownPassed) {
              // 1. 查找在场的所有合法 NPC（王宅正房暖阁内室视为同室在场）
              let candidates = Object.values(after.actors || {}).filter((x) =>
                x && !x.dead && x.id !== me2.id && isHere(x.location) && x.name && !x.humanBound
              );

              // 2. 特殊温暖机制：若相公身处王宅大厅或内院而此处恰好无人，自动感应正房/内寝候着的内眷
              let isCallingFromInnerRoom = false;
              if (candidates.length === 0 && (me2.location.includes('husband_room') || me2.location.includes('王宅'))) {
                const innerHousehold = Object.values(after.actors || {}).filter((x) =>
                  x && !x.dead && x.id !== me2.id && (x.location === 'husband_room' || x.location === 'husband_room__main' || String(after.places?.[x.location]?.name || '').includes('正房')) && !x.humanBound
                );
                if (innerHousehold.length > 0) {
                  candidates = innerHousehold;
                  isCallingFromInnerRoom = true;
                }
              }

              if (candidates.length > 0) {
                // 3. 智能权重择选迎候发言人：正妻 > 侧室 > 贴身丫鬟 > 掌柜/大厨/账房 > 伙计 > 宾客
                candidates.sort((a, b) => {
                  const score = (x) => {
                    const r = String(x.role || '');
                    const n = String(x.name || '');
                    if (x.id === 'waner' || /正妻|大娘子/.test(r)) return 100;
                    if (x.id === 'yunnia' || /二房|如夫人/.test(r)) return 90;
                    if (x.id === 'xiaocui' || /丫鬟/.test(r)) return 80;
                    if (/侧室|崔婉宁/.test(r) || /婉宁/.test(n)) return 85;
                    if (/掌柜|账房|大厨|管事|头领|罗叔/.test(r) || /满仓|有财|何顺/.test(n)) return 75;
                    if (/伙计|跑堂|小二|小厮/.test(r)) return 60;
                    return 50;
                  };
                  return score(b) - score(a);
                });

                const greeter = candidates[0];
                const r = String(greeter.role || '');
                const n = String(greeter.name || '');
                let greet = '';

                if (isCallingFromInnerRoom) {
                  greet = greeter.id === 'waner'
                    ? '夫君回府了？快进正房内寝来暖暖身子，妾身备了热茶。'
                    : (greeter.id === 'xiaocui' ? '掌柜的回府啦！奴婢这就去正房打帘备温水！' : '相公回府了？快进正房内寝歇歇脚。');
                } else if (greeter.id === 'waner' || /正妻|大娘子/.test(r)) {
                  greet = '夫君回来了。外头风大，快进屋暖暖身子，小翠，快给相公奉上热茶。';
                } else if (greeter.id === 'yunnia' || /二房|如夫人/.test(r)) {
                  greet = '相公回来了！芸娘方才刚沏好紫阳山的新茶，还热着呢，相公快尝尝。';
                } else if (/侧室|崔婉宁/.test(r) || /婉宁/.test(n)) {
                  greet = '相公回府了，妾身给相公请安，相公快进屋用茶。';
                } else if (greeter.id === 'xiaocui' || /丫鬟/.test(r)) {
                  greet = '掌柜的回来啦！奴婢这就给掌柜的添热炭、沏香茶！';
                } else if (/掌柜|钱满仓/.test(r) || /满仓/.test(n)) {
                  greet = '东家您来了！快请雅阁上坐，小的这就张罗最新鲜的水席与明前！';
                } else if (/大厨|何顺/.test(r) || /何顺/.test(n)) {
                  greet = '东家来了！后厨正备着两淮硬席，东家稍坐，小的这就给您呈上新菜！';
                } else if (/账房|周有财/.test(r) || /周有财/.test(n)) {
                  greet = '东家亲临！流水账房清点得明白，东家先用热茶，小的随时呈账！';
                } else if (/伙计|跑堂|小二/.test(r)) {
                  greet = '客官快里边请！楼上临窗雅座还空着，小的这就给您沏茶！';
                } else if (/紫嫣|刘文霞|老板娘/.test(n) || /紫嫣|刘文霞/.test(r)) {
                  greet = '郎君可算舍得来看奴家了，快请进，奴家正念着你呢。';
                } else {
                  greet = `${n}上前作揖迎道：“东家您来了，快请坐。”`;
                }

                activeGreeter = greeter;
                activeGreetText = greet;

                // 迎候台词送入推送事件
                queueProactive(after, {
                  to: actorId, speaker: greeter.name, actorId: greeter.id,
                  placeId: me2.location, place: placeName2, reason: 'arrival',
                  text: greet, fallback: greet, force: true, kind: 'report', privacy: 'public',
                });
                after.flags.lastArrivalAt[actorId] = Date.now();
              }
            }
          }
        } catch (err) {
          console.warn('[ArrivalGreet] 迎候异常:', err.message);
        }
        // 手动位移在聊天里留一条"你到了某处"与在场正主迎候，不只靠顶部地点刷新
        try {
          if (res2?.applied) {
            queueProactive(after, {
              to: actorId, speaker: '提示', type: 'proactive', isLetter: false,
              text: line, fallback: line, force: true,
            });
            saveState(DATA_DIR, after);

            // 同时将位移提示与迎候台词落盘至相公真实聊天历史中，确保无论何时进出都清晰可见、沉浸有声
            try {
              const h = petService.readHistory(actorId) || { messages: [] };
              h.messages = Array.isArray(h.messages) ? h.messages : [];
              const nowMs = Date.now();
              h.messages.push({
                id: `u-step-${nowMs}`,
                role: 'assistant',
                text: `${line}`,
                time: nowMs,
                at: nowMs,
                modality: 'text',
              });
              if (activeGreetText && activeGreeter) {
                const spkLabel = activeGreeter.label || activeGreeter.name;
                h.messages.push({
                  id: `u-greet-${nowMs + 1}`,
                  role: 'assistant',
                  speaker: activeGreeter.name,
                  text: `【${spkLabel}】：${activeGreetText}`,
                  time: nowMs + 1,
                  at: nowMs + 1,
                  modality: 'text',
                });
              }
              if (h.messages.length > 100) h.messages = h.messages.slice(-100);
              petService.saveHistory(actorId, h);
            } catch (errHist) {
              console.warn('[GoHistory] 写入历史异常:', errHist.message);
            }
          }
        } catch { /* 忽略 */ }
        // 随行的护院/家丁跟着主人走
        try {
          const wEsc = loadState(DATA_DIR);
          const meEsc = wEsc.actors?.[actorId];
          if (meEsc?.location) {
            let moved = 0;
            for (const g of Object.values(wEsc.actors || {})) {
              if (!g || g.dead || g.following !== actorId) continue;
              const mv = moveActor(wEsc, g.id, meEsc.location, 'world', '随主出行');
              if (mv?.ok) moved += 1;
            }
            if (moved) saveState(DATA_DIR, wEsc);
          }
        } catch { /* 忽略 */ }
        return sendJson(res, 200, { ok: true, applied: Boolean(res2.applied), place: placeName2, line });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // POST /api/world/confirm { actionId, option } → 确认一笔待付款
    // 开房、买东西、打点、赏钱、聘礼……凡是花银子的，都走这里
    if (req.method === 'POST' && (matchRoute('/world/confirm') || matchRoute('/world/pay'))) {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        const world = loadState(DATA_DIR);
        const member = resolveMember(req, url);
        const actorId = member?.actor || 'husband';
        const me = world.actors?.[actorId] || world.actors?.husband;
        const pend = world.pendingAction;

        // 没有天道报的价，也可以自己记一笔（手动付账）
        if (!pend) {
          const amount = Math.max(0.01, Math.round((Number(body.amount) || 0) * 100) / 100);
          const title = String(body.title || '花销').slice(0, 20);
          if (!body.amount) return sendJson(res, 200, { ok: false, error: '没有待付的账' });
          const silver0 = Number(world.assets?.silver) || 0;
          if (silver0 < amount) {
            return sendJson(res, 200, { ok: false, error: `钱不够：要 ${amount} 两，手头 ${silver0.toFixed(2)} 两` });
          }
          const spent0 = spendSilver(world, amount, title, me?.id || 'husband');
          if (!spent0.ok) return sendJson(res, 200, { ok: false, error: spent0.error });
          world.notes = Array.isArray(world.notes) ? world.notes : [];
          world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${me?.name || '相公'}花了${amount}两：${title}` });
          world.events = Array.isArray(world.events) ? world.events : [];
          world.events.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${me?.name || '相公'}花${amount}两${title}` });
          saveState(DATA_DIR, world);
          return sendJson(res, 200, { ok: true, line: `（付了 ${amount} 两：${title}。余 ${world.assets.silver.toFixed(2)} 两）`, paid: amount });
        }
        if (body.actionId && pend.id && String(body.actionId) !== String(pend.id)) {
          return sendJson(res, 200, { ok: false, error: '这笔账已经过时了' });
        }

        // 兵事单：募兵/军械自己扣钱（走同一入口），不重复收
        if (pend.kind === 'military') {
          ensureFactions(world);
          const rMil = pend.action === 'gear'
            ? buyGear(world, 'wangjia', String(pend.gearKind || 'weapon'), Number(pend.qty) || 0)
            : (pend.action === 'call'
              ? callToArms(world, 'wangjia', { city: String(pend.city || ''), max: Number(pend.qty) || 20, kind: String(pend.recruitKind || 'guard') })
              : recruit(world, 'wangjia', Number(pend.qty) || 0, String(pend.city || ''), String(pend.recruitKind || 'guard')));
          if (!rMil.ok) return sendJson(res, 200, { ok: false, error: rMil.error });
          delete world.pendingAction;
          saveState(DATA_DIR, world);
          const line = pend.action === 'gear'
            ? `（已购军械，银两照扣。现存：${JSON.stringify(rMil.gear || {})}）`
            : (pend.action === 'call'
              ? `（一呼百应，来投 ${rMil.came} 人。现总兵 ${rMil.troops}，驻 ${rMil.city}，全军月饷 ${rMil.armyMonthlyPay ?? rMil.monthlyPay} 两。）`
              : `（已募 ${pend.qty} 人，成军需七日。现总兵 ${rMil.troops}，驻 ${rMil.city}。）`);
          return sendJson(res, 200, { ok: true, line });
        }

        // 选哪一档
        const options = Array.isArray(pend.options) ? pend.options : [];
        const opt = options.find((o) => String(o.key || o.label) === String(body.option))
          || options.find((o) => String(o.label) === String(body.option))
          || options[0];
        const price = Number(opt?.price) || 0;

        const silver = getMoney(world, actorId);
        if (silver < price) {
          return sendJson(res, 200, { ok: false, error: `钱不够：要 ${price} 两，手头只有 ${silver.toFixed(2)} 两` });
        }

        // 扣钱
        if (actorId === 'husband') {
          const spent1 = spendSilver(world, price, `${pend.title || '花销'}·${opt?.label || ''}`, 'husband');
          if (!spent1.ok) return sendJson(res, 200, { ok: false, error: spent1.error });
        } else {
          const spent2 = spendMoney(world, actorId, price, `${pend.title || '花销'}·${opt?.label || ''}`);
          if (!spent2.ok) return sendJson(res, 200, { ok: false, error: spent2.error });
        }

        let line = `（付了 ${price} 两。）`;
        const comers = [];

        if (pend.kind === 'lodging') {
          const innId = pend.inn || 'inn';
          // 住店价按城分级（临江府贵、小县便宜）
          const cityOfInn = world.cities?.临江府 ? '临江府' : Object.keys(world.cities || {})[0];
          const fair = roomPriceAt(world, cityOfInn);
          if (fair > 0) {
            // 差价退补：天道报贵了就退，报便宜了就按城价补
            const diff = Math.round((price - fair) * 100) / 100;
            if (Math.abs(diff) > 0.005) {
              if (diff > 0) world.assets.silver = Math.round((Number(world.assets.silver) + diff) * 100) / 100;
              else if (Number(world.assets.silver) >= -diff) world.assets.silver = Math.round((Number(world.assets.silver) + diff) * 100) / 100;
            }
          }
          const roomName = opt?.label || '上房';
          const roomId = `${innId}_room`;
          world.places = world.places || {};
          if (!world.places[roomId]) {
            world.places[roomId] = {
              id: roomId,
              name: `${world.places[innId]?.name || '临江客栈'}·${roomName}`,
              exits: [innId], dynamic: true, private: true,
            };
            world.dynamicPlaces = world.dynamicPlaces || {};
            world.dynamicPlaces[roomId] = world.places[roomId];
          } else {
            world.places[roomId].name = `${world.places[innId]?.name || '临江客栈'}·${roomName}`;
          }
          moveActor(world, me.id, roomId, 'ui', '开房');
          const partnerId = String(pend.with || (world.chatPartners || {})[actorId] || '');
          const partyIds = Array.isArray(world.party?.[actorId]) ? world.party[actorId] : [];
          for (const pid of [partnerId, ...partyIds]) {
            const a = world.actors?.[pid];
            if (!a || a.dead || a.id === actorId) continue;
            if (a.location !== innId && a.location !== roomId && !partyIds.includes(a.id)) continue;
            moveActor(world, a.id, roomId, 'world', '同行进房');
            a.activity = { text: '进房歇息', day: world.clock?.day || 1, hour: world.clock?.hour || 0 };
            comers.push(a.name);
          }
          line = `（你付了 ${price} 两，进了「${world.places[roomId].name}」。${comers.length ? comers.join('、') + '也进来了。' : ''}）`;
        } else {
          // 其它花销：只记账 + 事件，具体效果交给天道下一轮演
          world.events = world.events || [];
          world.events.push({
            day: world.clock?.day, hour: world.clock?.hour,
            text: `${me?.name || '相公'}${pend.title || '花钱'}：${opt?.label || ''} ${price} 两`,
          });
          line = `（${pend.title || '付了账'}：${opt?.label || ''}，${price} 两。）`;
        }

        delete world.pendingAction;
        saveState(DATA_DIR, world);
        console.log(`[Pay] ${pend.kind} ${opt?.label || ''} ${price} 两 → ${line.slice(0, 40)}`);
        return sendJson(res, 200, { ok: true, line, paid: price, place: world.places?.[me?.location]?.name || '' });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // POST /api/world/summon { id }  → 叫她过来（她走到我这）
    // 独立来信/回话通道：不碰主聊天，不替相公回信
    if (req.method === 'GET' && matchRoute('/correspondence')) {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
        const actorId = member.actor || 'husband';
        const world = peek(DATA_DIR);
        const threads = listCorrespondence(world, actorId);
        return sendJson(res, 200, { ok: true, threads, unread: threads.filter((t) => t.unread).length });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    if (req.method === 'GET' && matchRoute('/correspondence/thread')) {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
        const actorId = member.actor || 'husband';
        const world = peek(DATA_DIR);
        const thread = getCorrespondence(world, String(url.searchParams.get('id') || ''), actorId);
        if (!thread) return sendJson(res, 404, { ok: false, error: '没有这封信' });
        const marked = markCorrespondence(world, thread.id, actorId);
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, thread: marked, source: marked?.source || '', kind: marked?.kind || 'letter' });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    if (req.method === 'POST' && matchRoute('/correspondence/reply')) {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
        const actorId = member.actor || 'husband';
        const body = await parseJsonBody(req, 64 * 1024);
        const world = peek(DATA_DIR);
        const replyText = String(body.text || '').trim().slice(0, 500);
        const thread = appendCorrespondence(world, String(body.id || ''), 'me', replyText);
        if (!thread || thread.to !== actorId) return sendJson(res, 404, { ok: false, error: '没有这封信' });
        thread.status = 'replied';
        thread.unread = false;

        // 1. 记忆沉淀：让发信人（如二房芸娘）永久记住相公亲笔写的手书内容
        const senderId = thread.fromId || '';
        const senderName = thread.fromName || '对方';
        if (replyText) {
          addMemory(world, {
            text: `相公亲笔给${senderName}手书回信：“${replyText}”`,
            about: [senderId, actorId, 'husband'].filter(Boolean),
            kind: 'letter',
          });
          // 2. 好感与心意沉淀：相公亲笔回信，对方内心踏实温存
          const sender = world.actors?.[senderId] || Object.values(world.actors || {}).find((a) => a && a.name === senderName);
          if (sender) {
            sender.relations = sender.relations || {};
            sender.relations.husband = sender.relations.husband || { trust: 50, desire: 30, fear: 0, grievance: 0 };
            sender.relations.husband.trust = Math.min(100, (Number(sender.relations.husband.trust) || 0) + 3);
            sender.relations.husband.desire = Math.min(100, (Number(sender.relations.husband.desire) || 0) + 2);
          }
          // 3. 事件流记录
          world.events = world.events || [];
          world.events.push({
            day: world.clock?.day || 1,
            hour: world.clock?.hour || 0,
            text: `信使将相公手书送抵${senderName}处，信中写道：“${replyText}”`,
          });
        }

        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, thread });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    if (req.method === 'POST' && matchRoute('/correspondence/action')) {
      try {
        const member = resolveMember(req, url);
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
        const actorId = member.actor || 'husband';
        const body = await parseJsonBody(req, 16 * 1024);
        const world = peek(DATA_DIR);
        const thread = getCorrespondence(world, String(body.id || ''), actorId);
        if (!thread) return sendJson(res, 404, { ok: false, error: '没有这封信' });
        const action = String(body.action || '').trim();
        if (action === 'wait') setCorrespondenceStatus(world, thread.id, actorId, 'waiting');
        else if (action === 'decline') setCorrespondenceStatus(world, thread.id, actorId, 'declined');
        else if (action === 'allow') {
          if (thread.kind !== 'visit') return sendJson(res, 400, { ok: false, error: '这一封不是求见' });
          const who = world.actors?.[thread.fromId];
          if (!who || who.dead) return sendJson(res, 404, { ok: false, error: '来人已不在' });
          if (isHumanBound(world, who.id)) return sendJson(res, 409, { ok: false, error: '真人在线/离线由本人决定，不能由天道代进' });
          // 私密处默认门外候着；点了“见”才真正移动进来
          const me = world.actors?.[actorId] || world.actors?.husband;
          const mv = moveActor(world, who.id, me?.location || 'husband_room', 'ui', '应允入见');
          if (!mv?.ok) return sendJson(res, 409, { ok: false, error: mv?.error || '没能进来' });
          setCorrespondenceStatus(world, thread.id, actorId, 'approved');
          thread.messages.push({
            id: `${Date.now()}_allow`, role: 'system',
            text: `（${me?.name || '相公'}允了${who.name}进来。）`,
            at: Date.now(), day: world.clock?.day || 1, hour: world.clock?.hour || 0,
          });
          thread.messages = thread.messages.slice(-80);
        } else {
          markCorrespondence(world, thread.id, actorId);
        }
        saveState(DATA_DIR, world);
        return sendJson(res, 200, { ok: true, thread });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    if (req.method === 'POST' && matchRoute('/world/summon')) {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        const id = String(body.id || '');
        const world = loadState(DATA_DIR);
        const member = resolveMember(req, url);
        const actorId = member?.actor || 'husband';
        const me = world.actors?.[actorId] || world.actors?.husband;
        const her = world.actors?.[id];
        if (!her || her.dead) return sendJson(res, 404, { ok: false, error: '没有这个人' });
        if (id === 'husband' && actorId !== 'husband') {
          return sendJson(res, 200, { ok: false, error: '相公是真人，得你自己过去找他' });
        }
        // 真人角色：在线时相公走过去寻访；离线时由 AI 神识代演应召前来，不让世界停滞断层
        if (isHumanBound(world, id)) {
          const isOnline = isHumanOnline(id);
          if (isOnline) {
            const dest = her.location;
            if (!dest || !world.places?.[dest]) {
              return sendJson(res, 200, { ok: false, error: '她此刻行踪不明，找不着' });
            }
            const mv = moveActor(world, actorId, dest, 'ui', '去寻访');
            saveState(DATA_DIR, world);
            const destName = world.places?.[dest]?.name || dest;
            return sendJson(res, 200, {
              ok: true, applied: Boolean(mv?.ok), found: true, place: destName,
              line: `（你到了「${destName}」。）`,
            });
          }
          // 真人离线：允许相公召见，由 AI 神识代演应召前来
          const myLoc = me?.location;
          if (myLoc && world.places?.[myLoc]) {
            const mv = moveActor(world, id, myLoc, 'world', '相公召见');
            saveState(DATA_DIR, world);
            const hereName = world.places?.[myLoc]?.name || myLoc;
            return sendJson(res, 200, {
              ok: true, applied: Boolean(mv?.ok), found: true, place: hereName,
              line: `（${her.name}此刻本尊未在线，其神识依其性情立场应召来到「${hereName}」。）`,
            });
          }
        }
        const hereName = world.places?.[me?.location]?.name || '';
        const intent = {
          id: `ui_come_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          actor: id, verb: 'MOVE', target: hereName, companions: [],
          params: { byUi: true, summonedBy: 'husband' }, origin: 'ui',
        };
        const r = applyAction({ dataDir: DATA_DIR, world, intent, verdict: { companionConsented: true } });
        const after = peek(DATA_DIR);
        return sendJson(res, 200, { ok: true, applied: Boolean(r.applied), place: after.places?.[after.actors?.[id]?.location]?.name || '' });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // POST /api/world/todo { id, action: do|drop|later } → 秘书式行程
    if (req.method === 'POST' && matchRoute('/world/todo')) {
      try {
        const body = await parseJsonBody(req, 32 * 1024);
        const world = loadState(DATA_DIR);
        const member = resolveMember(req, url);
        const actorId = member?.actor || 'husband';
        const me = world.actors?.[actorId] || world.actors?.husband;
        const id = String(body.id || '');
        const action = String(body.action || 'done');
        world.notes = Array.isArray(world.notes) ? world.notes : [];
        const apt = (world.appointments || []).find((x) => x && (x.id === id || `${x.day}-${x.hour}-${x.name}` === id));
        let line = '';

        if (action === 'later') {
          if (apt) { apt.day = Number(apt.day) + 1; line = `（改到第${apt.day}日，记下了。）`; }
          else {
            for (const pr of (world.promises || [])) {
              const key = pr.id || String(pr.text || '').slice(0, 20);
              if (key === id) { pr.due = Number(pr.due) + 1; line = `（改到第${pr.due}日，记下了。）`; }
            }
          }
          world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${me?.name || '相公'}把一件事改天了` });
        } else if (action === 'do') {
          // 启程去办：只把人送过去、记成"进行中"；成不成由天道在后面判
          if (apt) {
            let pid = apTargetPlace(world, apt);
            if (!pid) pid = await askDmForPlace(world, apt);   // 没有地点就当场请天道定
            if (pid && world.places?.[pid]) {
              moveActor(world, me.id, pid, 'ui', '赴约');
              line = `（你动身去了「${world.places[pid].name}」。）`;
            } else {
              line = '（你动身去办这事了，地点还没个准。）';
            }
            apt.engaged = { day: world.clock?.day || 1, hour: world.clock?.hour || 0 };
            world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${me?.name || '相公'}已去赴${apt.name || '人'}的约（${String(apt.text || '').slice(0, 20)}），能不能成没说定` });
          } else {
            for (const pr of (world.promises || [])) {
              const key = pr.id || String(pr.text || '').slice(0, 20);
              if (key !== id) continue;
              pr.engaged = { day: world.clock?.day || 1, hour: world.clock?.hour || 0 };
              // 承诺也得动身：去哪儿由天道定
              const fakeAp = { name: '', text: pr.text, place: pr.place || null };
              let pid2 = apTargetPlace(world, fakeAp);
              if (!pid2) pid2 = await askDmForPlace(world, fakeAp);
              if (pid2 && world.places?.[pid2]) {
                moveActor(world, me.id, pid2, 'ui', '去办差事');
                line = `（你动身去了「${world.places[pid2].name}」，去办这桩事。）`;
              } else {
                line = '（你动身去办这桩事了，去处还没定准。）';
              }
              world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${me?.name || '相公'}动身去办一桩旧诺（${String(pr.text || '').slice(0, 20)}），结果未定` });
            }
          }
        } else {
          if (apt) {
            world.appointments = (world.appointments || []).filter((x) => x !== apt);
            line = '（推了这桩约。）';
            world.notes.push({ day: world.clock?.day, hour: world.clock?.hour, text: `${me?.name || '相公'}推掉了${apt.name || '人'}的约` });
            const other = Object.values(world.actors || {}).find((a) => a?.name === apt.name);
            if (other) {
              other.relations = other.relations || {};
              const rel = other.relations.husband || { trust: 30, desire: 20, grievance: 0 };
              rel.grievance = Math.min(100, Number(rel.grievance || 0) + 6);
              other.relations.husband = rel;
            }
          } else {
            for (const pr of (world.promises || [])) {
              const key = pr.id || String(pr.text || '').slice(0, 20);
              if (key === id) { pr.done = true; pr.dropped = true; line = '（这桩诺言作罢了。）'; }
            }
          }
        }

        world.notes = world.notes.slice(-40);
        saveState(DATA_DIR, world);
        if (!line) line = '（没找到这件事，可能已经了了。）';
        return sendJson(res, 200, { ok: true, line });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }


    // 9.9b 大模型通道连通性与测速 (GET/POST /api/admin/llm/test 或 /api/llm/test，免token直测)
    if ((pathname === '/api/admin/llm/test' || pathname === '/api/llm/test') && (req.method === 'GET' || req.method === 'POST')) {
      try {
        let testMode = url.searchParams.get('mode') || '';
        let customDeepseek = null;
        let customQwen = null;
        let customMessages = null;
        if (req.method === 'POST') {
          try {
            const body = await parseJsonBody(req, 16 * 1024);
            if (body.mode) testMode = body.mode;
            if (body.deepseek) customDeepseek = body.deepseek;
            if (body.qwen) customQwen = body.qwen;
            if (Array.isArray(body.messages)) customMessages = body.messages;
          } catch (_) {}
        }

        const t0 = Date.now();
        let clientToUse = petService.llmClient;
        if (customDeepseek || customQwen || testMode) {
          clientToUse = new LlmClient({
            deepseek: customDeepseek || config.deepseek,
            qwen: customQwen || config.qwen,
            llmMode: testMode || config.llmMode || 'deepseek',
            proxy: config.gemini?.proxy,
            useProxy: config.gemini?.useProxy,
          });
        }

        const llmResult = await clientToUse.complete({
          messages: customMessages || [{ role: 'user', content: '相公下令，速速娇羞回答四个字！' }],
          maxTokens: 30,
        });

        return sendJson(res, 200, {
          ok: true,
          channel: llmResult.channel,
          model: llmResult.model,
          llmMode: llmResult.llmMode,
          elapsedMs: Date.now() - t0,
          reply: llmResult.text,
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
      // 此处有谁：站在同一地点的人（不含自己）
      const hereNames = Object.values(world.actors || {})
        .filter((a) => a && !a.dead && a.name && a.location === me?.location && a.id !== (actorId || 'husband'))
        .map((a) => ({ name: a.name, role: a.role || '', activity: a.activity?.text || '' }))
        .slice(0, 8);
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
      // 产业归属解耦：相公看相公产业，女眷看女眷私产
      const props = visiblePropertiesOf(world, actorId || 'husband');
      const arc = actorId ? world.arcs?.[actorId] : null;
      const f = actorId ? world.forces?.[actorId] : world.military;
      const troops = f ? (Number(f.guards) || 0) + (Number(f.militia) || 0) + (Number(f.army) || 0) : 0;
      return sendJson(res, 200, {
        ok: true,
        version: Number(world.version) || 1,
        party: (() => {
          const nameOf = (id) => world.actors?.[id]?.name || id;
          const ids = Array.isArray(world.party?.husband) ? world.party.husband : [];
          const here = ids.filter((id) => world.actors?.[id] && !world.actors[id].dead);
          if (isHusband) {
            return { members: here, names: here.map(nameOf) };
          }
          const leading = here.includes(actorId) ? 'husband' : null;
          // 她那边：告诉你正跟着谁、还有谁一起
          return {
            leading,
            leaderName: leading ? (world.actors?.husband?.name || '相公') : null,
            names: leading ? here.filter((id) => id !== actorId).map(nameOf) : [],
          };
        })(),
        self: (() => {
          const maritalMap = { single: '未婚', married: '已婚', widowed: '寡居', concubine: '侧室' };
          const spouseName = me?.spouse ? (world.actors?.[me.spouse]?.name || '') : '';
          const res = me?.residence || null;
          const resName = res?.placeId ? (world.places?.[res.placeId]?.name || '') : '';
          const resText = res?.type === 'own' ? `自有${resName || '民宅'}`
            : res?.type === 'rent' ? `租住${resName || ''}`
            : res?.type === 'inn' ? '住客栈'
            : res?.type === 'family' ? `寄居${resName || ''}` : '';
          return {
            name: me?.name || '', role: me?.role || '', place: place?.name || '', isHusband,
            homeId: me?.home || null,
            homeName: me?.home ? (world.places?.[me.home]?.name || '') : '',
            married: maritalMap[me?.marital || 'single'] || '未婚',
            spouseName,
            residence: resText,
            isHusband,
          };
        })(),
        marriages: (() => {
          if (!isHusband) {
            return me?.spouse === 'husband' ? [{ name: '王甯', role: '夫君' }] : [];
          }
          const list = [];
          const seen = new Set();
          for (const m of (world.marriages || [])) {
            if (!m || !m.name) continue;
            list.push({
              id: m.id || m.who,
              name: m.name,
              role: m.rank || '侧室',
            });
            seen.add(m.name);
            if (m.who) seen.add(m.who);
          }
          for (const [aid, a] of Object.entries(world.actors || {})) {
            if (!a || a.dead || aid === 'husband') continue;
            if (seen.has(a.name) || seen.has(aid)) continue;
            const r = String(a.role || '');
            const isWife = a.spouse === 'husband'
              || (a.household && (/妻|妾|如夫人|侧室|通房/.test(r) || /妻|妾|concubine/.test(String(a.marital || ''))));
            if (isWife) {
              list.push({
                id: aid,
                name: a.name,
                role: r || '侧室',
              });
              seen.add(a.name);
            }
          }
          return list;
        })(),
        here: hereNames,
        // 待付款只给当事人看：别人的账单不能弹到新人头上
        pendingAction: (() => {
          const p = world.pendingAction;
          if (!p) return null;
          const meId = String(actorId || 'husband');
          const owner = String(p.by || 'husband');
          return owner === meId ? p : null;
        })(),
        tasks: (world.tasks || []).filter((t) => t && t.status === 'doing').map((t) => ({
          id: t.id, who: t.name, what: t.what,
          dueDay: t.dueDay, last: (t.log || []).slice(-1)[0]?.text || '',
        })),
        // 我这一日：只给"我自己"的事，绝不广播别人的私事
        daily: (() => {
          try {
            const evs = readRecentEvents(DATA_DIR, 200) || [];
            const today = Number(world.clock?.day) || 1;
            const myName = me?.name || '';
            if (!myName) return [];
            const lines = evs
              .filter((e) => e && Number(e.day) >= today - 1 && String(e.text || '').includes(myName))
              .slice(-5)
              .map((e) => String(e.text || '').slice(0, 48));
            return [{ name: myName, place: place?.name || '', lines }];
          } catch { return []; }
        })(),
        date: { day: world.clock?.day, hour: world.clock?.hour, text: wd?.iso || '', lunar: wd?.lunar?.text || '' },
        assets: {
          silver: getMoney(world, actorId),
          properties: props.map((p) => {
            const open = ['已开张', '正常营业'].includes(String(p.status || ''));
            const floor = Math.max(0.15, (Number(p.rent || p.monthlyRent) || 0) / 30 * 1.2, (Number(p.staff) || 0) * 0.05);
            const shown = open ? Math.max(Number(p.incomePerDay) || 0, Math.round(floor * 100) / 100) : 0;
            return { name: p.name, income: shown, status: p.status || '', staff: p.staff || 0, city: p.city || '' };
          }),
          daily: props.reduce((s, p) => {
            const open = ['已开张', '正常营业'].includes(String(p.status || ''));
            const floor = Math.max(0.15, (Number(p.rent || p.monthlyRent) || 0) / 30 * 1.2, (Number(p.staff) || 0) * 0.05);
            return s + (open ? Math.max(Number(p.incomePerDay) || 0, Math.round(floor * 100) / 100) : 0);
          }, 0),
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
        market: marketSnapshot(world),
        // 今日看板：把一天里值得看的事收成一张单子（聚合事件流与大额账目变动，告别空白）
        digest: (() => {
          try {
            const day = Number(world.clock?.day) || 1;
            const hour = Number(world.clock?.hour) || 0;
            const meNow = (actorId && world.actors?.[actorId]) || me || world.actors?.husband;
            const isBoss = meNow?.id === 'husband' || meNow?.household || meNow?.spouse === 'husband';
            const noisy = /回了|待久了|自己宅里走动|按作息走动|归位/;
            const evs = readRecentEvents(DATA_DIR, 60) || [];
            const myName = String(meNow?.name || '');
            let today = evs
              .filter((e) => e && Number(e.day) === day)
              .map((e) => ({ text: String(e?.payload?.text || ''), day: e.day, hour: e.hour || 0, action: e.action || '' }))
              .filter((x) => x.text && !noisy.test(x.text))
              // 只看与自己有关的：本人/王家（家眷）
              .filter((x) => (myName && x.text.includes(myName)) || (isBoss && /王家|王宅|相公|府里|酒楼|船队|茶坊/.test(x.text)));

            // 聚合今日收支流水与产业动作（如置办船队、采办、大额进账）
            if (isBoss && Array.isArray(world.ledger)) {
              const todayLedger = world.ledger
                .filter((l) => l && Number(l.day) === day && Math.abs(Number(l.delta) || 0) >= 5)
                .slice(-6)
                .map((l) => ({
                  text: `${l.title}（${Number(l.delta) > 0 ? '+' : ''}${l.delta} 两）`,
                  day: l.day,
                  hour: l.hour || 0,
                  action: 'ledger',
                }));
              today = [...today, ...todayLedger];
            }

            today.sort((a, b) => (Number(b.hour) || 0) - (Number(a.hour) || 0));
            today = today.slice(0, 8);

            // 若今日尚未有大事记入，根据王家产业经营与府邸平安生成今日实录
            if (today.length === 0 && isBoss) {
              const totalInc = (world.assets?.properties || []).reduce((s, p) => s + (Number(p?.incomePerDay) || 0), 0);
              today.push({
                text: `临江王宅各房安好，茶坊老店、大酒楼与各处铺面营运稳妥，日入约 +${Math.round(totalInc * 10) / 10} 两白银。`,
                day,
                hour,
                action: 'routine',
              });
            }

            // 大事记是王家的账，只有王家人看得到（展现全部已完成重大里程碑）
            const big = isBoss
              ? (world.milestones || []).map((m) => (typeof m === 'string' ? m : (m?.text || m?.title || ''))).filter(Boolean).slice(0, 10)
              : [];
            const hist = (world.history || []).slice(-3);
            const h1 = hist[hist.length - 1];
            const h0 = hist[hist.length - 2];
            const priceMove = h1 && h0 ? Math.round((Number(h1.price) - Number(h0.price)) * 10) / 10 : 0;
            const unrestMove = h1 && h0 ? Number(h1.unrest) - Number(h0.unrest) : 0;
            // 府里人：是王家人就看全府，不是就只看自己身边
            const kinRaw = Object.values(world.actors || {}).filter((a) => a && !a.dead);
            const householdList = kinRaw
              .filter((a) => (isBoss
                ? (a.household || a.spouse === 'husband')
                : (a.id === meNow?.spouse || (Array.isArray(a.parents) && a.parents.includes(meNow?.id)))))
              .map((a) => ({
                name: a.name,
                role: a.role || '',
                status: a.pregnancy && !a.pregnancy.born
                  ? (() => {
                      const d = Number(a.pregnancy.days) || 0;
                      return d < 30 ? `有孕${d}天` : `有孕${Math.floor(d / 30)}月（${d}天）`;
                    })()
                  : (a.quarters ? '在府' : ''),
              }));
            return {
              day,
              hour: Number(world.clock?.hour) || 0,
              weather: world.clock?.weather || '',
              season: world.clock?.season || '',
              place: world.places?.[meNow?.location]?.name || '',
              silver: getMoney(world, meNow?.id || 'husband'),
              grain: isBoss ? (Number(world.factions?.wangjia?.grain) || 0) : null,
              troops: isBoss ? (Number(world.factions?.wangjia?.troops) || 0) : null,
              priceMove,
              unrestMove,
              household: householdList,
              today,
              big,
              decree: isBoss ? (world.decrees?.[world.decrees.length - 1]?.text || '') : '',
            };
          } catch { return null; }
        })(),
        prices: (() => {
          try {
            const out = {};
            for (const k of ['weapon', 'armor', 'horse', 'siege', 'inn_room', 'inn_bed', 'meal', 'wine', 'wage_day', 'servant_month', 'shop', 'mansion']) {
              out[k] = priceOf(k);
            }
            const c0 = Object.keys(world.cities || {})[0];
            out.grain = grainPrice(world, c0);
            // 招募安家银也从兵制表里取，App 不再写死
            out.guard_gift = RECRUIT_KINDS.guard.cost;
            out.retainer_gift = RECRUIT_KINDS.retainer.cost;
            return out;
          } catch { return {}; }
        })(),
        room: (() => {
          try {
            const meId = actorId || 'husband';
            const meNow = world.actors?.[meId] || world.actors?.husband;
            return describeRoom(world, meNow?.location) || null;
          } catch { return null; }
        })(),
        bandits: Object.values(world.bandits || {}).map((b) => ({
          id: b.id, name: b.name, kind: b.kind, tier: b.tier,
          strength: Number(b.strength) || 0, leader: b.leader, city: b.homeCity,
          silver: Number(b.silver) || 0, grain: Number(b.grain) || 0,
        })),
        banditsTotal: banditStrengthTotal(world),
        household: (isHusband || (me?.household && me?.spouse === 'husband'))
          ? {
            allowance: Number(world.assets?.householdAllowance) || 4.0,
            arrears: world.assets?.householdArrears || { months: 0, owed: 0 },
            silver: Number(world.assets?.silver) || 0,
          }
          : null,
        fame: { value: fameOf(world, me?.id || 'husband'), tags: (world.actors?.[me?.id || 'husband']?.fame?.tags || []) },
        clans: (() => {
          const rel = relatedClanIds(world);
          return Object.values(world.clans || {})
            .filter((c) => c && rel.has(c.id))
            .map((c) => ({ id: c.id, name: c.name, relation: c.relation, influence: c.influence }));
        })(),
        season: { season: world.clock?.season || '', weather: world.clock?.weather || '', canalFrozen: canalFrozen(world) },
        factions: (() => {
          const meId = actorId || 'husband';
          const isBoss = meId === 'husband' || world.factions?.wangjia?.leader === meId;
          return Object.values(world.factions || {}).map((f) => {
            const visible = Boolean(f) && (f.id !== 'wangjia' || isBoss);
            return {
              id: f.id, name: f.name, kind: f.kind, leader: f.leader,
              troops: visible ? (Number(f.troops) || 0) : null,
              grain: visible ? Math.round((Number(f.grain) || 0) * 10) / 10 : null,
              silver: visible ? Math.round(factionSilver(world, f) * 100) / 100 : null,
              morale: Number(f.morale) || 0,
              ambition: Number(f.ambition) || 0,
              strength: visible ? factionStrength(world, f) : null,
              cities: (f.cities || []).slice(0, 12),
              gear: visible ? (f.gear || {}) : {},
              kinds: visible ? (f.kinds || {}) : {},
              monthlyPay: visible ? Math.round((Number(f.troops) || 0) * 1.0 * 100) / 100 : null,
              monthlyGrain: visible ? Math.round((Number(f.troops) || 0) * 0.02 * 30 * 100) / 100 : null,
              arrears: visible ? (f.arrears || { months: 0, owed: 0 }) : null,
              fresh: Number(f.fresh) || 0,
              freshUntilDay: Number(f.freshUntilDay) || 0,
              stationed: visible ? (f.stationed || {}) : {},
              hidden: !visible,
            };
          });
        })(),
        life: (() => {
          const meL = actorId ? world.actors?.[actorId] : world.actors?.husband;
          const house = Object.values(world.actors || {}).filter(
            (a) => a && !a.dead && a.id !== 'husband'
              // 后院内容 = 妻妾与贴身丫鬟；护院家丁在"府内当差"，不算内眷
              && (a.spouse === 'husband'
                || (/妻|夫人|妾|姨娘|通房|丫鬟|婆子|嬷嬷|姑娘|小姐/.test(String(a.role || ''))
                  && (() => {
                    const estate = String(world.places?.[meL?.home]?.name || '').split('·').slice(0, 2).join('·');
                    const locName = String(world.places?.[a.location]?.name || '');
                    if (!estate || !locName.startsWith(estate)) return false;   // 人不在宅里，不算家仆
                    return true;
                  })())),
          );
          return {
            age: Number(meL?.age) || null,
            pregnant: Boolean(meL?.pregnancy && !meL.pregnancy.born),
            pregnancyDays: Number(meL?.pregnancy?.days) || 0,
            house: house.slice(0, 12).map((a) => ({
              name: a.name, role: a.role || '', age: Number(a.age) || null,
              pregnant: Boolean(a.pregnancy && !a.pregnancy.born),
              days: Number(a.pregnancy?.days) || 0,
            })),
          };
        })(),
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
        items: itemsOf(world, actorId || 'husband').map((it) => ({ id: it.id, name: it.name, kind: it.kind })),
        military: (() => {
          // 兵额以 factions.wangjia 为准（真人与账对齐后的唯一账本）；world.military 只是旧镜像
          const wf = world.factions?.wangjia || null;
          const kinds = (wf?.kinds && Object.keys(wf.kinds).length) ? wf.kinds : (f.kinds || {});
          const total = Number(wf?.troops) || Number(wf?.army) || Number(f.troops) || Number(f.army) || 0;
          if (!(total > 0)) return null;
          return {
            guards: Math.round(Number(kinds.guard) || 0),
            militia: Number(wf?.militia) || Number(f.militia) || 0,
            army: total,
            kinds,
            retainers: (() => { let n = 0; for (const a of Object.values(world.actors || {})) { if (a && !a.dead && a.role === '护院') n += 1; } return n; })(),
            houseGuards: (() => { let n = 0; for (const a of Object.values(world.actors || {})) { if (a && !a.dead && a.role === '家丁') n += 1; } return n; })(),
            privateArmy: (() => { let n = 0; for (const a of Object.values(world.actors || {})) { if (a && !a.dead && /私兵/.test(String(a.role || ''))) n += 1; } return n; })(),
            troops: total,
            quellReady: total,
            quelled: Number(world.flags?.quelledTotal) || 0,
            nextRank: (() => { try { return nextPromotion(world); } catch { return null; } })(),
            supplies: Number(wf?.grain) || Number(f.supplies) || 0,
          };
        })(),
        standing: { reputation: world.reputation ?? 50, wanted: world.wanted ?? 0 },
        // 官职/衔头：剿匪授的团练使这类"朝廷给的位子"，客户端看板直接读这里
        offices: (() => {
          try {
            return Object.entries(world.court?.offices || {})
              .filter(([, o]) => o && String(o.holder || '') === String(actorId || 'husband'))
              .map(([key, o]) => ({ key, title: o.title || '', note: o.note || '', at: o.at || null }));
          } catch { return []; }
        })(),
      });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }


    // 9.9b 大模型通道连通性与测速 (GET/POST /api/admin/llm/test 或 /api/llm/test，免token直测)
    if ((pathname === '/api/admin/llm/test' || pathname === '/api/llm/test') && (req.method === 'GET' || req.method === 'POST')) {
      try {
        let testMode = url.searchParams.get('mode') || '';
        let customDeepseek = null;
        let customQwen = null;
        let customMessages = null;
        if (req.method === 'POST') {
          try {
            const body = await parseJsonBody(req, 16 * 1024);
            if (body.mode) testMode = body.mode;
            if (body.deepseek) customDeepseek = body.deepseek;
            if (body.qwen) customQwen = body.qwen;
            if (Array.isArray(body.messages)) customMessages = body.messages;
          } catch (_) {}
        }

        const t0 = Date.now();
        let clientToUse = petService.llmClient;
        if (customDeepseek || customQwen || testMode) {
          clientToUse = new LlmClient({
            deepseek: customDeepseek || config.deepseek,
            qwen: customQwen || config.qwen,
            llmMode: testMode || config.llmMode || 'deepseek',
            proxy: config.gemini?.proxy,
            useProxy: config.gemini?.useProxy,
          });
        }

        const llmResult = await clientToUse.complete({
          messages: customMessages || [{ role: 'user', content: '相公下令，速速娇羞回答四个字！' }],
          maxTokens: 30,
        });

        return sendJson(res, 200, {
          ok: true,
          channel: llmResult.channel,
          model: llmResult.model,
          llmMode: llmResult.llmMode,
          elapsedMs: Date.now() - t0,
          reply: llmResult.text,
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
          id: a.id,
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

  // ── 管理控制台专属 API（已解耦至 src/routes/admin-routes.js）─────
  if (pathname.startsWith('/api/admin')) {
    await handleAdminRoutes(req, res, {
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
    });
    return;
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
        // 若当前未满/队列空，且满足现实自然间隔，自动动态分发主动事件（告别冷清死寂）
        try {
          if (dispatchNaturalProactive(world, Date.now())) {
            saveState(DATA_DIR, world);
          }
        } catch (err) { /* 忽略分发异常 */ }

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
            events: due.map((item, i) => {
              const textSpk = String(item.text || '').match(/^\s*【([^】\n]{1,16})】/);
              let spk = (textSpk ? textSpk[1].trim() : item.speaker) || '';
              // 彻底杜绝拼音变量、系统代号或裸露英文污染（如 an, usr_, ancient, system）
              // 关键铁律：凡台词在向东家汇报（"东家"、"等您示下"、"回来了"），绝不可被标为「提示」沦为居中小灰条！
              const isSpokenErrand = /东家|掌柜|相公|少掌柜/.test(item.text || '') && /等您示下|请东家示下|留个心眼|不敢擅自|回来了|暗账|码头/.test(item.text || '');
              if (!spk || /^(an|usr_.*|ancient.*|system|ai|unknown|提示)$/i.test(spk) || (isSpokenErrand && spk === '提示')) {
                const textStr = String(item.text || '');
                const mWho = textStr.match(/(伍兰|纪生|常木|熊河|樊生|傅生|盛哥|阿福|阿吉|陈二|老周)/);
                if (mWho) {
                  spk = `家丁·${mWho[1]}`;
                } else if (/酒肆|续酒|旧账纸|紫嫣/.test(textStr)) spk = '酒肆伙计';
                else if (/客栈|住处|打探|孙进/.test(textStr)) spk = '客栈掌柜·孙进';
                else if (/货栈|水路|茶价|采云/.test(textStr)) spk = '货栈总管·采云';
                else if (/县衙|茶税|公文|静儿/.test(textStr)) spk = '县衙书吏·静儿';
                else if (/窑厂|砖瓦|鲁青/.test(textStr)) spk = '窑厂工头·鲁青';
                else if (isSpokenErrand) spk = '当差仆役';
                else if (!spk || /^(an|usr_.*|ancient.*|system|ai|unknown)$/i.test(spk)) spk = '传信小厮';
              }
              let finalText = String(item.text || '').trim();
              if (finalText && !finalText.startsWith('【') && !finalText.startsWith('[') && spk && spk !== '提示') {
                finalText = `【${spk}】：${finalText}`;
              }
              // 没有署名的回话，至少把出处补在末尾，别让它冒充系统提示
              let itemSrc = item.source || (isSpokenErrand ? `差事回话·${spk}` : '');
              if (itemSrc === '系统提示' && isSpokenErrand) itemSrc = `差事回话·${spk}`;
              if (!textSpk && itemSrc && itemSrc !== '系统提示') {
                finalText = `${finalText}\n（来源：${itemSrc}）`;
              }

              // 判定发言人当前真实位置与相公位置（严禁当面当场面对面说话还变成递信）
              const husLoc = world.actors?.husband?.location || 'husband_room';
              let actorLoc = null;
              for (const [aId, a] of Object.entries(world.actors || {})) {
                if (a && a.name && (spk.includes(a.name) || a.name.includes(spk))) {
                  actorLoc = a.location;
                  break;
                }
              }

              // 府内女眷（婉儿、小翠、婉宁），默认常在府内
              const isInnerHousehold = /婉儿|小翠|婉宁/.test(spk);

              let place = item.place || null;
              if (!place && (!isInnerHousehold || /大酒楼|酒楼|茶坊|商铺|货栈/.test(spk || finalText))) {
                if (/大酒楼|酒楼|账房|汪总商/.test(spk || finalText)) place = '运河码头三层大酒楼';
                else if (/紫嫣|酒肆/.test(spk || finalText)) place = '于家酒肆';
                else if (/静儿|县衙/.test(spk || finalText)) place = '县衙';
                else if (/采云|货栈/.test(spk || finalText)) place = '翟家货栈';
                else if (/孙进|客栈/.test(spk || finalText)) place = '临江客栈';
                else if (/鲁青|窑厂/.test(spk || finalText)) place = '城南窑厂';
                else if (/茶山|紫阳山/.test(spk || finalText)) place = '紫阳茶山';
                else if (/茶坊/.test(spk || finalText)) place = '临江茶坊老店';
              }

              // 同场判定：在相公同处、同为王宅或没有外地地点时，100% 当面对话，绝非递信
              const isSamePlace = actorLoc
                ? (actorLoc === husLoc)
                : (place ? (husLoc.includes(place) || (world.places?.[husLoc]?.name || '').includes(place)) : isInnerHousehold);
              const isLetter = (item.isLetter !== undefined)
                ? (item.isLetter && !isSamePlace)
                : (!isSamePlace && Boolean(place));

              return {
                type: item.type || 'proactive',
                text: finalText,
                speaker: spk || null,
                place: isLetter ? place : null,
                actorId: item.actorId || null,
                placeId: item.placeId || null,
                isLetter: Boolean(isLetter),
                source: item.source || (isLetter ? '来信' : '回话'),
                kind: item.kind || (isLetter ? 'letter' : 'report'),
                privacy: item.privacy || 'private',
                threadId: item.threadId || null,
                requiresConsent: Boolean(item.requiresConsent),
                status: 'pending',
                audioKey: item.audioKey || null,
                messageId: `push_${now}_${i}`,
                modality: item.audioKey ? 'audio' : 'text',
              };
            }),
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
      const t0 = Date.now();
      // 不再用整轮批量写：批量快照会在收尾时把聊天里发生的真实变更（送客/进门/门第）覆盖掉
      let result;
      try {
        result = await runInStateTurn(() => petService.chat({
          text: body.text,
          modality: body.modality || 'text',
          profileKey: currentMember.memberKey,
          roleName: currentMember.role,
          actorId: currentMember.actor || null,
        }));
      } finally {
        /* 单次写入口 saveState 已经落盘 */
      }
      // 体检：本轮耗时记账（只留最近 20 轮）
      try {
        const c = globalThis.__chatStats = globalThis.__chatStats || { n: 0, lastMs: [], maxMs: 0, avgMs: 0 };
        const ms = Date.now() - t0;
        c.n += 1;
        c.lastMs.push(ms);
        if (c.lastMs.length > 20) c.lastMs.shift();
        c.maxMs = Math.max(c.maxMs, ms);
        c.avgMs = Math.round(c.lastMs.reduce((a, b) => a + b, 0) / c.lastMs.length);
      } catch { /* 忽略 */ }
      // 出口最后一道：别的真人玩家号不许被 AI 代他说话（按数据判定，不写死名字）
      try {
        const txt = String(result?.reply?.text || '');
        const wOut = loadState(DATA_DIR);
        const meId = currentMember.actor || 'husband';
        let lastAssistantSpeaker = null;
        try {
          const hh = petService.readHistory(currentMember.memberKey)?.messages || [];
          for (let k = hh.length - 1; k >= 0; k--) {
            if (hh[k].role === 'user') continue;
            const mm = String(hh[k].text || '').match(/^【([^】\n]{1,16})】/);
            if (mm) { lastAssistantSpeaker = mm[1].trim(); break; }
          }
        } catch {}

        const segs = txt.split(/(?=【[^】\n]{1,12}】)/).filter(Boolean);
        const kept = [];
        const dropped = [];
        for (const seg of segs) {
          const m = seg.match(/^【([^】\n]{1,12})】/);
          if (!m) { kept.push(seg); continue; }
          // 旁白式说话人（客卿·府中/系统/数据库…）不是人，整段剔掉
          if (/客卿|府中|系统|数据库|天机局/.test(m[1]) && !Object.values(wOut.actors || {}).some((a) => a && a.name && m[1].includes(a.name))) {
            dropped.push(m[1]);
            continue;
          }
          const spk = m[1].trim();
          // 服务端出口铁律：只在当前地点的人能开口（本人除外）；但若上一轮为异地递信/请示，允许领命回执
          const baseName = spk.includes('·') ? spk.split('·').pop().trim() : spk;
          const meNow = wOut.actors?.[meId];
          const isLetterPartner = lastAssistantSpeaker && (lastAssistantSpeaker.includes(baseName) || baseName.includes(lastAssistantSpeaker) || lastAssistantSpeaker.includes(spk) || spk.includes(lastAssistantSpeaker));
          const who = Object.values(wOut.actors || {}).find((a) => a && !a.dead && a.name === baseName);
          if (who && who.id !== meId && who.location !== meNow?.location && !isLetterPartner) {
            console.log(`[Presence:出口] 剔除非在场发言：${spk}`);
            dropped.push(String(seg).replace(/^【[^】\n]{1,12}】/, '').trim());
            continue;
          }
          const isRealOther = Object.values(wOut.actors || {}).some(
            (a) => a && !a.dead && a.name === baseName && a.id !== meId && /^usr_/.test(String(a.id)),
          );
          if (isRealOther) { console.log(`[Presence:出口] 剔除非本人操控的真人发言：${spk}`); continue; }
          kept.push(seg);
        }
        let merged = kept.join('').trim();
        // 末尾残缺括号 / 孤立左括号，一律清掉（观感）
        merged = merged.replace(/[（(]\s*$/g, '').replace(/\n{3,}/g, '\n\n').trim();
        // 引擎标签绝不能漏到戏里给相公看（[[spawn:柳婶|…]] 这类）
        merged = merged.replace(/\[\[[^\]\n]{1,60}\]\]/g, '').replace(/\n{3,}/g, '\n\n').trim();
        // 全被剔掉：把话留下、把人名去掉，改成旁白，绝不可裸露无标签（防止客户端误标为"娘子"）
        if (!merged && dropped.length) {
          const content = dropped.join(' ').replace(/^[：:]+/, '').trim();
          merged = content.startsWith('【') ? content : `【旁白】：${content}`;
        }
        if (merged && merged !== txt) result.reply.text = merged;
        // 给客户端留的接口：把【提示】单独抽出来，App 可渲染成系统提示样式
        try {
          const tipLines = String(result.reply?.text || '').split('\n')
            .filter((ln) => /^【提示】/.test(ln.trim()))
            .map((ln) => ln.replace(/^【提示】/, '').trim())
            .filter(Boolean);
          result.reply.notices = tipLines;
          result.reply.noticeSpeaker = '提示';
        } catch { /* 忽略 */ }
      } catch (e) { /* 忽略 */ }



      // 站在别人门口说「通禀/求见」：服务端真去叩门，门房的话直接写在回话最前面
      try {
        if (/通禀|通报|求见|递帖|叫门|叩门|拜见|拜访|请见|能进去|让我进去|进屋/.test(String(body.text || ''))) {
          const wK = loadState(DATA_DIR);
          const meK = wK.actors?.[String(currentMember.actor || 'husband')] || wK.actors?.husband;
          const hereK = wK.places?.[meK?.location];
          // 是不是站在大门：看结构（门房那一间 / 外院层级），不靠名字里有没有"大门"两个字
          const parentK = hereK?.parent ? wK.places?.[hereK.parent] : null;
          const atGate = Boolean(hereK) && (
            hereK.use === 'gate'
            || parentK?.rooms?.gate?.id === hereK.id
            || hereK.access === 'public_outer'
          );
          if (atGate) {
            const homeK = residenceOf(wK, hereK.id) || wK.places?.[hereK.parent];
            if (homeK?.residence && String(homeK.owner || '') !== String(meK?.id || '')) {
              const vK = knock(wK, meK.id, homeK.id);
              if (vK.allowed && vK.place) {
                grantPass(wK, meK.id, homeK.id, wK.clock?.day);
                moveActor(wK, meK.id, vK.place, 'world', '通禀允入');
                saveState(DATA_DIR, wK);
                result.reply.text = `（门房进去回了话，回身让开：「${vK.reason}」你进了${wK.places?.[vK.place]?.name || ''}。）\n` + String(result.reply.text || '');
              } else {
                saveState(DATA_DIR, wK);
                result.reply.text = `（门房拦住：「${vK.reason}」）\n` + String(result.reply.text || '');
              }
            }
          }
        }
      } catch (errK) { console.log('[Knock] 叩门异常：', errK.message); }

      // 双向合意领路转场与私密独处（找没人的地方/去账房/去雅阁/带我去）
      try {
        const sayText = String(body.text || '');
        const isEscortIntent = /(?:带我去|领我去|领路|跟我来|随我去|去后头|找个没人的地方|清静账房|去账房|去雅间|换个地方|没人的地方|私下说|到了吗)/.test(sayText);
        if (isEscortIntent) {
          const wEsc = loadState(DATA_DIR);
          const meEsc = wEsc.actors?.[String(currentMember.actor || 'husband')] || wEsc.actors?.husband;
          const myLoc = meEsc?.location || '';
          const myPlace = wEsc.places?.[myLoc] || {};
          const myParent = myPlace.parent || myLoc;
          const myPlaceName = myPlace.name || '';
          const myParentName = wEsc.places?.[myParent]?.name || myPlaceName;

          // 核心防御：领路人必须是当前同一建筑或同一房间内的在场之人，严禁跨场景找人！
          const hereActors = Object.values(wEsc.actors || {}).filter((a) => {
            if (!a || a.dead || a.id === meEsc?.id) return false;
            const aLoc = a.location || '';
            const aParent = wEsc.places?.[aLoc]?.parent || aLoc;
            return aLoc === myLoc || aLoc === myParent || aParent === myLoc || (aParent && aParent === myParent);
          });

          const pickPartner = () => {
            if (!hereActors.length) return null;
            // 1) 当前回复里说话的人
            const replySpeaker = String(result.reply?.text || '').match(/【([^】\n]{1,16})】/);
            if (replySpeaker) {
              const spkName = replySpeaker[1].includes('·') ? replySpeaker[1].split('·').pop().trim() : replySpeaker[1].trim();
              const found = hereActors.find((a) => a.name === spkName || replySpeaker[1].includes(a.name));
              if (found) return found;
            }
            // 2) 相公话里点名或称谓（仅在在场之人中匹配！）
            const named = hereActors.find((a) =>
              (a.name && sayText.includes(a.name))
              || (a.role && sayText.includes(a.role))
              || (/老板娘/.test(sayText) && /老鸨|老板娘|掌柜/.test(String(a.role || '')))
              || (/妈妈|鸨母/.test(sayText) && /老鸨/.test(String(a.role || '')))
              || (/掌柜|东家/.test(sayText) && /掌柜|东家/.test(String(a.role || '')))
            );
            if (named) return named;
            // 3) 若在场只有一人，直接是该同伴
            if (hereActors.length === 1) return hereActors[0];
            return null;
          };

          const partner = pickPartner();

          if (partner) {
            let targetRoomId = null;
            let targetRoomName = '';
            let targetDesc = '';

            // 核心铁律：目标房间 100% 由相公当前所处建筑决定，严禁跨店铺位移！
            const isBrothel = myLoc === 'brothel' || myParent === 'brothel' || /万花楼|青楼/.test(myPlaceName + myParentName) || partner.id === 'suyingxue';
            const isRestaurant = myLoc === 'place_44' || myParent === 'place_44' || /酒楼/.test(myPlaceName + myParentName);
            const isTeaHouse = myLoc === 'tea_house' || myParent === 'tea_house' || /茶坊/.test(myPlaceName + myParentName);
            const isGoodsShop = myLoc === 'goods_shop' || myParent === 'goods_shop' || /货栈/.test(myPlaceName + myParentName);
            const isHome = myLoc === 'husband_room' || /王宅|正房/.test(myPlaceName + myParentName);

            if (isBrothel) {
              targetRoomId = 'brothel__yajian';
              targetRoomName = '万花楼·二层温香雅阁';
              targetDesc = '万花楼二层深处温香雅阁，茜纱半掩，重锦厚帘隔绝楼下喧嚣，最是私密清幽，软榻香暖。';
              if (!wEsc.places[targetRoomId]) {
                wEsc.places[targetRoomId] = {
                  id: targetRoomId,
                  name: targetRoomName,
                  parent: 'brothel',
                  use: 'private_room',
                  access: 'private',
                  desc: targetDesc,
                  exits: ['brothel'],
                };
              }
            } else if (isRestaurant) {
              targetRoomId = 'place_44__f2';
              targetRoomName = '运河码头三层大酒楼·二层雅阁';
              targetDesc = '临水二层雅阁，轩窗外见运河点点渔火，屏风将外廊隔开，雅致安静。';
              if (!wEsc.places[targetRoomId]) {
                wEsc.places[targetRoomId] = {
                  id: targetRoomId,
                  name: targetRoomName,
                  parent: 'place_44',
                  use: 'private_room',
                  access: 'private',
                  desc: targetDesc,
                  exits: ['place_44'],
                };
              }
            } else if (isTeaHouse) {
              targetRoomId = 'tea_house__room';
              targetRoomName = '临江茶坊老店·二层雅间';
              targetDesc = '茶坊二层幽静雅室，竹帘垂挂，炉香袅袅，品茗清谈极佳。';
              if (!wEsc.places[targetRoomId]) {
                wEsc.places[targetRoomId] = {
                  id: targetRoomId,
                  name: targetRoomName,
                  parent: 'tea_house',
                  use: 'private_room',
                  access: 'private',
                  desc: targetDesc,
                  exits: ['tea_house'],
                };
              }
            } else if (isGoodsShop) {
              targetRoomId = 'goods_shop__office';
              targetRoomName = '翟家货栈·清静账房';
              targetDesc = '货栈深处清静账房，两重货架隔开市井喧嚣，门一掩，外头听不见里头说话。';
              if (!wEsc.places[targetRoomId]) {
                wEsc.places[targetRoomId] = {
                  id: targetRoomId,
                  name: targetRoomName,
                  parent: 'goods_shop',
                  use: 'office',
                  access: 'private',
                  desc: targetDesc,
                  exits: ['goods_shop'],
                };
              }
            } else if (isHome) {
              targetRoomId = 'husband_room__study';
              targetRoomName = '临江·王宅·书斋';
            }

            // 若当前已经在目标房间，不再重复提示和转移
            if (targetRoomId && myLoc !== targetRoomId && wEsc.places[targetRoomId]) {
              const fromMe = meEsc.location;
              const fromPartner = partner.location;
              const mvMe = moveActor(wEsc, meEsc.id, targetRoomId, 'world', '领路转场');
              const mvPartner = moveActor(wEsc, partner.id, targetRoomId, 'world', '随行带路');
              if (!mvMe?.ok || !mvPartner?.ok) {
                // 同行没跟上，就不许把相公一个人搬进去：原地退回，避免"人不在跟前却能说话"
                if (mvMe?.ok && fromMe) moveActor(wEsc, meEsc.id, fromMe, 'world', '领路失败退回');
                if (mvPartner?.ok && fromPartner) moveActor(wEsc, partner.id, fromPartner, 'world', '领路失败退回');
                saveState(DATA_DIR, wEsc);
                console.log(`[Escort] 同行失败，已退回：${partner.name} ${mvPartner?.error || ''}`);
              } else {
                saveState(DATA_DIR, wEsc);
                const escortHint = `【提示】你随${partner.name}避开外人，到了「${targetRoomName}」。此处只有你与${partner.name}二人，清静私密。\n`;
                result.reply.text = escortHint + String(result.reply.text || '');
                result.reply.place = targetRoomName;
                result.reply.placeId = targetRoomId;
                console.log(`[Escort] 双向领路转场成功：相公与 ${partner.name} 进入 ${targetRoomName}`);
              }
            }
          }
        }
      } catch (errEsc) { console.warn('[Escort] 领路转场失败：', errEsc.message); }

      // 出口：说话的人若不在跟前，把实情补一句（不搬人，只说实话）
      try {
        const wS = loadState(DATA_DIR);
        const meS = wS.actors?.[actorId] || wS.actors?.husband;
        const herePlace = wS.places?.[meS?.location]?.name || '';
        const spk = [...String(result.reply?.text || '').matchAll(/【([^】]{1,14})】/g)].map((m) => m[1]);
        const far = [];
        for (const sp of spk) {
          const nm = sp.includes('·') ? sp.split('·').pop().trim() : sp;
          if (!nm || nm === '旁白' || nm === meS?.name) continue;
          const a = Object.values(wS.actors || {}).find((x) => x && !x.dead && x.name === nm);
          if (!a) continue;
          const pn = wS.places?.[a.location]?.name || '';
          if (pn && herePlace && pn !== herePlace) far.push(`${a.name}（在${pn}）`);
        }
        if (far.length) {
          result.reply.text = `${result.reply.text}\n（${[...new Set(far)].join('、')}并不在这间，是隔着屋子/街面应的声。）`;
        }
      } catch { /* 忽略 */ }

      // 出口最后一道观感清理：残缺括号、空的差事回执行
      try {
        let txt = String(result.reply?.text || '');
        txt = txt.split('\n').filter((ln) => !/^\s*[^\n]{0,40}·\s*限\d+日）?\s*$/.test(ln)).join('\n');
        txt = txt.replace(/[（(]\s*$/g, '').replace(/\n{3,}/g, '\n\n').trim();
        if (txt) result.reply.text = txt;
      } catch { /* 忽略 */ }
      console.log(`[ExitProbe] 出口到达 text=${String(body.text||'').slice(0,20)} actor=${currentMember.actor}`);



      console.log(`[ChatTotal] 服务端总耗时 ${Date.now() - t0}ms（成员 ${currentMember.memberKey}）`);
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

  // 世界日报：今天世界自己发生了什么
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
        .map((a) => ({ name: a.name, doing: a.goal.text, due: a.goal.due }));
      return sendJson(res, 200, { ok: true, day, log, goals });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // 院子里有什么：GET /api/world/room?place=xxx（顶层路由，绝不能放进 /api/admin 的块里）
  if (req.method === 'GET' && matchRoute('/world/room')) {
    try {
      const world = loadState(DATA_DIR);
      const member = resolveMember(req, url);
      const actorId = member?.actor || 'husband';
      const want = String(url.searchParams.get('place') || '').trim();
      const me = world.actors?.[actorId] || world.actors?.husband;
      const placeId = want || me?.location;
      const info = describeRoom(world, placeId);
      if (!info) return sendJson(res, 404, { ok: false, error: '没有这处地方' });
      return sendJson(res, 200, { ok: true, room: info, here: placeId === me?.location });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }




  return sendJson(res, 404, { ok: false, error: `未找到对应接口: ${pathname}` });
});

try { dns.setServers(['223.5.5.5', '119.29.29.29']); console.log('[DNS] 使用公共 DNS 解析'); } catch (e) { console.warn('[DNS] 设置失败', e.message); }

console.log('BUILD_TAG_20261106B');

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
    try { seedPersonalMoney(wA); } catch { /* 忽略 */ }
      // 登记真人登着的角色：世界不许引擎搬他们
      try {
        const cfgH = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : {};
        const humans = Object.values(cfgH.family || {}).map((m) => m?.actor).filter(Boolean);
        wA.flags = wA.flags || {};
        wA.flags.humanActors = humans;
        for (const hid of humans) if (wA.actors?.[hid]) wA.actors[hid].humanBound = true;
        if (humans.length) console.log(`[World] 真人角色 ${humans.length} 位：${humans.join('、')}`);
      } catch { /* 忽略 */ }
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

  // 御案折子：天道（皇帝）批：查实罢官，或留任
  async function resolveMemorials() {
    try {
      const w = peek(DATA_DIR);
      const m = (w.memorials || []).find((x) => x && x.status === 'pending');
      if (!m) return;
      const official = w.actors?.[m.againstId];
      if (!official) { return; }
      const prompt = [
        '你是天道，扮演天子批折子。',
        `有人弹劾${m.office || ''}${m.against}：${m.claim}。`,
        `此人风评：对相公信任 ${official.relations?.husband?.trust ?? 30}，怨怼 ${official.relations?.husband?.grievance ?? 0}。`,
        '只输出 JSON：{"action":"dismiss|keep","reason":"一句批语(16字内)"}',
      ].join('\n');
      const res = await petService.llmClient.complete({
        system: '只输出一行 JSON，不要解释。',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 120,
        temperature: 0.7,
      });
      const raw = String(res?.text || '');
      const mm = raw.match(/\{[\s\S]*\}/);
      let d = { action: 'keep', reason: '查无实据' };
      try { if (mm) d = { ...d, ...JSON.parse(mm[0]) }; } catch { /* 默认 */ }
      const w2 = peek(DATA_DIR);
      const m2 = (w2.memorials || []).find((x) => x && x.id === m.id);
      if (!m2) return;
      m2.status = d.action === 'dismiss' ? 'dismissed' : 'kept';
      m2.reason = String(d.reason || '').slice(0, 30);
      if (d.action === 'dismiss') {
        for (const [key, off] of Object.entries(w2.court?.offices || {})) {
          if (off && off.holder === m.againstId) {
            off.holder = null;
            off.vacant = true;
            (w2.court.vacancies = w2.court.vacancies || []).push({ key, title: off.title, day: w2.clock.day });
          }
        }
        const a = w2.actors?.[m.againstId];
        if (a) { a.role = '罢官闲居'; a.home = a.home || 'street'; }
      }
      saveState(DATA_DIR, w2);
      console.log(`[Court] 批折子：${m.against}——${m2.reason}（${m2.status}）`);
    } catch (err) {
      console.warn('[Court] 批折子失败：', err.message);
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
          culprit.activity = { text: '大牢服刑', day: w3.clock?.day || 1, hour: w3.clock?.hour || 0 };
          if (Array.isArray(w3.party?.husband)) {
            w3.party.husband = w3.party.husband.filter((pid) => pid !== culprit.id);
          }
          const cityName = String(cc.city || '');
          if (cityName && cityName !== '临江府') {
            const jailName = `${cityName}·大牢`;
            let jp = Object.keys(w3.places || {}).find((k) => w3.places[k]?.name === jailName);
            if (!jp) {
              w3.flags.placeSeq = (Number(w3.flags.placeSeq) || 0) + 1;
              jp = `place_${w3.flags.placeSeq}`;
              w3.places[jp] = { name: jailName, exits: ['street'], owner: 'court', dynamic: true, city: cityName };
            }
            moveActor(w3, culprit.id, jp, 'world', '收监');
          } else {
            moveActor(w3, culprit.id, culprit.gender === 'male' ? 'jail_male' : 'jail_female', 'world', '收监');
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

      // 退堂：没下狱的人各回各家，别一直杵在衙门
      try {
        for (const pid of [cc.whoId, cc.againstId]) {
          const a = w3.actors?.[pid];
          if (!a || pid === 'husband') continue;
          if (a.jailed) continue;
          if (a.location === 'yamen') moveActor(w3, a.id, a.home || 'street', 'world', '下值回家');
        }
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

  // 手动步进：推进 N 个世界日，并把依赖天道的那几套（案子/判决/折子/朝议/补街）跑一遍
  async function stepWorld(days = 1) {
    const { tick } = await import('./world/clock.js');
    const msPerHour = Number(config.world?.msPerWorldHour) || 60 * 60 * 1000;
    const done = [];
    for (let i = 0; i < Math.max(1, Math.min(30, days)); i += 1) {
      const before = peek(DATA_DIR).clock?.day || 1;
      const last = Number(peek(DATA_DIR).lastRealAt) || Date.now();
      tick(DATA_DIR, { now: last + 24 * msPerHour, msPerWorldHour: msPerHour });
      // 没有模型密钥时，只跑规则部分，不让请求卡死
      const aiReady = (() => { try { return petService.llmClient.isReady(); } catch { return false; } })();
      if (aiReady) {
        try { await generateCase(); } catch (e) { /* 忽略 */ }
        try { await judgeCases(); } catch (e) { /* 忽略 */ }
        try { await resolveMemorials(); } catch (e) { /* 忽略 */ }
        try { await generateDecree(); } catch (e) { /* 忽略 */ }
        try { await generateCityShops(); } catch (e) { /* 忽略 */ }
        try { await generateNpcArcs(); } catch (e) { /* 忽略 */ }
      } else {
        done.push('（无模型密钥，仅推进规则）');
      }
      const after = peek(DATA_DIR).clock?.day || 1;
      done.push(`${before}→${after}`);
    }
    return done;
  }

  globalThis.__stepWorld = stepWorld;
  globalThis.__worldGenerators = { generateCase, judgeCases, resolveMemorials, generateDecree, generateCityShops, generateNpcArcs };

  // 每日自检：查"不成立"的事实，请天道修；它没修的按最保守办法兜底
  const dailyAuditWorld = async () => {
    try {
      const world = loadState(DATA_DIR);
      ensureRealms(world);
      const issues = inspectStructure(world);
      if (!issues.length) return;
      const today = Number(world.clock?.day) || 1;
      if (Number(world.flags?.lastAuditDay || 0) === today) return;   // 一天只查一次
      let fixed = 0;
      if (llmClient.isReady()) {
        const { system, user } = buildRepairPrompt(world, issues);
        const out = await llmClient.complete({ system, messages: [{ role: 'user', content: user }], temperature: 0.3, maxTokens: 1200 });
        const text = typeof out === 'string' ? out : (out?.text || out?.content || out?.reply || '');
        const r = applyRepairs(world, text);
        fixed = r.fixed;
      } else {
        const r = applyRepairs(world, '');
        fixed = r.fixed;
      }
      world.flags = world.flags || {};
      world.flags.lastAuditDay = today;
      saveState(DATA_DIR, world);
      console.log(`[Audit] 自检 ${issues.length} 处不成立，修 ${fixed} 处`);
    } catch (err) {
      console.warn('[Audit] 自检失败：', err.message);
    }
  };
  globalThis.__dailyAuditWorld = dailyAuditWorld;

  // 人间自愈：人挤在一处、铺子空着时，请天道重新安顿一次（它决定，引擎只落账）
  const selfHealWorld = async () => {
    try {
      const world = loadState(DATA_DIR);
      const drift = detectDrift(world) || collectDrifters(world);
      if (!drift) return;
      if (!shouldHeal(world, false)) return;
      if (!llmClient.isReady()) return;
      const { system, user } = buildDriftPrompt(world, drift);
      const out = await llmClient.complete({
        system,
        messages: [{ role: 'user', content: user }],
        temperature: 0.4,
        maxTokens: 1500,
      });
      const text = typeof out === 'string' ? out : (out?.text || out?.content || out?.reply || JSON.stringify(out || {}));
      const r = applyPlacements(world, text);
      world.flags = world.flags || {};
      world.flags.lastSelfHealDayHour = (Number(world.clock?.day) || 1) * 24 + (Number(world.clock?.hour) || 0);
      saveState(DATA_DIR, world);
      console.log(`[Society] 天道安顿人间：动 ${r.changed} 人 ${r.error ? '（' + r.error + '）' : ''}`);
    } catch (err) {
      console.warn('[Society] 自愈失败：', err.message);
    }
  };
  globalThis.__selfHealWorld = selfHealWorld;

  // 来客：由天道定名与来历；三天没有天道应答，就由引擎草草落下（不至于卡住）
  async function processMigrants() {
    try {
      // 第一段：只读，取出待定名的人（读完就丢，不在这份 world 上写）
      const snapshot = peek(DATA_DIR);
      const pending = Array.isArray(snapshot.pendingMigrants) ? snapshot.pendingMigrants.slice() : [];
      if (!pending.length) return;
      const today = Number(snapshot.clock?.day) || 1;

      const staleIds = pending.filter((m) => m && today - Number(m.day) >= 3).map((m) => m.id);
      const fresh = pending.filter((m) => m && !m.asked).slice(0, 3);

      let named = [];
      if (petService.llmClient?.isReady?.() && fresh.length) {
        const list = fresh.map((m, i) => `${i + 1}. ${m.role}（${m.gender === 'female' ? '女' : '男'}，约${m.age}岁，${m.cause === 'refugee' ? '逃荒来的' : m.cause === 'merchant' ? '行商' : m.cause === 'bride' ? '投亲' : '投工'}）`).join('\n');
        const system = '你是这个世界的天道，为刚进城的人定名与来历。只输出 JSON，不要解释。';
        const user = `第${today}日，临江府来了这些人：\n${list}\n\n请给每个人取一个合乎古代身份的名字，并写一句来历（20字以内）。\n输出：{"people":[{"index":1,"name":"张三","age":32,"background":"淮北逃荒来的，带着一个孩子"}]}`;
        try {
          const out = await petService.llmClient.complete({ system, messages: [{ role: 'user', content: user }], temperature: 0.8, maxTokens: 400 });
          const text = typeof out === 'string' ? out : (out?.text || out?.content || '');
          const m = text.match(/\{[\s\S]*\}/);
          if (m) {
            const data = JSON.parse(m[0]);
            named = (data.people || []).map((p) => ({ pmId: fresh[Number(p.index) - 1]?.id, name: p.name, age: p.age, background: p.background }))
              .filter((x) => x.pmId);
          }
        } catch (e) { console.warn('[Migrate] 天道定名失败：', e.message); }
      }

      // 第二段：异步结束之后重新读盘，再把结果合并进去（绝不用旧 world 覆盖）
      const world = loadState(DATA_DIR);
      world.pendingMigrants = Array.isArray(world.pendingMigrants) ? world.pendingMigrants : [];
      const byId = new Map(world.pendingMigrants.map((m) => [m.id, m]));

      // 1) 天道定名的
      for (const item of named) {
        const pm = byId.get(item.pmId);
        if (!pm) continue;
        const a = materializeMigrant(world, pm, { name: item.name, age: item.age, background: item.background });
        if (a) {
          console.log(`[Migrate] 天道定名：${a.name}（${pm.role}）${item.background || ''}`);
          world.pendingMigrants = world.pendingMigrants.filter((x) => x.id !== pm.id);
        }
      }

      // 2) 标记已问过（只标记真正问过、且还没落下的）
      if (fresh.length) {
        for (const pm of world.pendingMigrants) {
          if (fresh.some((f) => f.id === pm.id) && !named.some((n) => n.pmId === pm.id)) pm.asked = true;
        }
      }

      // 3) 等了三天还没定名的：引擎兜底落下
      for (const id of staleIds) {
        const pm = byId.get(id);
        if (!pm) continue;
        const a = materializeMigrant(world, pm, { name: fallbackName(world, pm.gender) });
        if (a) {
          console.log(`[Migrate] 兜底落下 ${a.name}（${pm.role}）`);
          world.pendingMigrants = world.pendingMigrants.filter((x) => x.id !== pm.id);
        } else {
          // 名字实在取不出：放宽为不重名即可，丢弃这条，避免无限挂起
          world.pendingMigrants = world.pendingMigrants.filter((x) => x.id !== pm.id);
        }
      }

      saveState(DATA_DIR, world);
    } catch (err) {
      console.warn('[Migrate] 来客处理失败：', err.message);
    }
  }



  // 世界引擎：启动天道时钟（离线补算 + 定时心跳）
  try {
    startWorldClock(DATA_DIR, {
      enabled: config.world?.enabled !== false,
      intervalMs: Number(config.world?.tickIntervalMs) || 2 * 60 * 1000,
      msPerWorldHour: Number(config.world?.msPerWorldHour) || 60 * 60 * 1000,
      onAfterTick: async () => {
        await processMigrants();
        // 天下推演：每 7 个世界日一次，有天道就让它定夺，没有就交给规则
        // 两段式：await LLM 期间不留可写世界；回来重新读盘再合并
        try {
          const snap = peek(DATA_DIR);
          const day0 = Number(snap.clock?.day) || 1;
          const lastRun = Number(snap.flags?.lastStrategyDay) || 0;
          if (day0 !== lastRun && day0 % 7 === 0) {
            let decisions = null;
            if (petService.llmClient?.isReady?.()) {
              const promptWorld = peek(DATA_DIR);
              ensureFactions(promptWorld);
              const { system, user } = buildStrategyPrompt(promptWorld);
              try {
                const out = await petService.llmClient.complete({
                  system, messages: [{ role: 'user', content: user }], temperature: 0.7, maxTokens: 700,
                });
                const text = typeof out === 'string' ? out : (out?.text || out?.content || '');
                const m = text.match(/\[[\s\S]*\]/);
                if (m) decisions = JSON.parse(m[0]);
              } catch (e) { console.warn('[Strategy] 决策获取失败:', e.message); }
            }
            const world = loadState(DATA_DIR);
            const dayNow = Number(world.clock?.day) || 1;
            if (dayNow === day0 && Number(world.flags?.lastStrategyDay) !== day0) {
              ensureFactions(world);
              let applied = [];
              if (Array.isArray(decisions) && decisions.length) {
                world.flags = world.flags || {};
                world.flags.strategyByLLM = true;
                applied = applyStrategyDecisions(world, decisions, (w, ev) => {
                  try { w.events = Array.isArray(w.events) ? w.events : []; } catch { /* 忽略 */ }
                });
              }
              world.flags = world.flags || {};
              world.flags.lastStrategyDay = day0;
              saveState(DATA_DIR, world);
              if (applied.length) console.log('[Strategy] 天下推演：' + applied.join('；'));
            }
          }
        } catch (err) {
          console.warn('[Strategy] 推演失败：', err.message);
        }

        await dailyAuditWorld();
        await selfHealWorld();
        await fillProactiveTexts();
        await generateNpcArcs();
        await generateDecree();
        await generateCityShops();
        await generateCase();
        await judgeCases();
        await resolveMemorials();
        // 上午 9 时 / 下午 16 时：让天道替有名有姓的人安排一次行止
        try {
          const wPlan = peek(DATA_DIR);
          const hh = Number(wPlan.clock?.hour) || 0;
          if (hh === 9 || hh === 16) await planNamedNpcMoves(petService);
        } catch (err) { console.warn('[Plan] 定时调度失败：', err.message); }
      },
    });
  } catch (err) {
    console.warn('[World] 世界时钟启动失败：', err.message);
  }
});


