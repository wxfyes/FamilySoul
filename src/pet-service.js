import { matchScenarioTrigger } from './chat/scenario-triggers.js';
import { buildEnvironmentHints } from './chat/environment-hints.js';
import { enforcePresence, normalizeSpeakers, applyStatedIncome, compactMemories, extractReceipt } from './chat/dialogue-postprocess.js';
import { executeNarrativeTags } from './chat/narrative-engine.js';
import { resolveVoiceCasting } from './world/voice-casting.js';
import fs from 'node:fs';
import { personFacts } from './world/person-facts.js';
import { getPlaceDisplayName } from './world/naming.js';
import { moveActor, isHumanBound, healInnerFamilyAtNight } from './world/position.js';
import { applyChatActions } from './world/chat-actions.js';
import path from 'node:path';

import { buildStateSummary } from './world/summarize.js';
import { loadState, saveState } from './world/state.js';
import { parseWorldTags, applyWorldTags, recordReceipt, markReceiptHit } from './world/dispatch.js';
import { prepareRitual, enforceRitualAnswer } from './world/ritual.js';
import { evaluateBedIntent, resolveBedPartner, buildBedChamberPrompt } from './world/bedchamber.js';
import { ensurePresence } from './world/scene.js';
import { applySummon } from './world/summon.js';
import { auditReply } from './world/audit.js';
import { buildMemberCard } from './world/member-card.js';
import { placeFacts } from './world/state.js';
import { arcStepPrompt } from './world/arcs.js';
import { normalizeMemberReply } from './world/member-reply.js';
import { resolveTurnTarget } from './world/turn-target.js';
import { describeBonds } from './world/bonds.js';
import { rumorsKnownBy } from './world/rumors.js';
import { recordHumanLine, memberKeyOfActor } from './world/co-presence.js';
import { buildProxyPrompt, wrapProxyLine } from './world/proxy-actor.js';
import { parseIntent, VERBS } from './world/intent.js';
import { checkGate } from './world/gate.js';
import { applyAction } from './world/apply.js';
import { addMemory, recallMemories } from './world/memory.js';
import { stripForVoice, mergeSameSpeaker } from './chat/text-utils.js';
import { cleanReply } from './chat/reply-sanitizer.js';
import { composeViewerPersona, composeWorldRules } from './chat/prompt-composer.js';
import {
  parseSummonTarget, pickSummonActor,
  parseDismissIntent, isMassDismiss, homeRoomForName,
  parsePayTag, isActionHandledPay,
} from './chat/intent-pipeline.js';
import { composeSystemPrompt } from './chat/system-prompt.js';
import { runChat } from './chat/chat-flow.js';


export class PetService {
  constructor({ rolesManager, llmClient, ttsService, visionService, dataDir, historyTurns = 4, promptMode = 'full' } = {}) {
    this.rolesManager = rolesManager;
    this.llmClient = llmClient;
    this.ttsService = ttsService;
    this.visionService = visionService;
    this.dataDir = dataDir || path.resolve(process.cwd(), 'data');
    this.chatDir = path.join(this.dataDir, 'chat');
    // 【省 token】进 prompt 的历史条数上限：世界状态已由天机摘要承载，不需要塞 30 条
    // 历史窗口越小，未命中缓存的全价 token 越少（窗口每轮滑动，永远无法命中缓存）
    this.historyTurns = Math.max(4, Math.min(40, Number(historyTurns) || 4));
    // lean：跳过 9000 字的世界设定规则段（闲聊用不到），省约四成 token；full：全量
    this.promptMode = promptMode === 'lean' ? 'lean' : 'full';
    fs.mkdirSync(this.chatDir, { recursive: true });
  }

  getHistoryFile(profileKey = 'husband') {
    return path.join(this.chatDir, `history-${profileKey}.json`);
  }

  readMilestones() {
    const file = path.join(this.dataDir, 'world', 'milestones.json');
    try {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      }
    } catch (_) {}
    return null;
  }

  readHistory(profileKey = 'husband') {
    const file = this.getHistoryFile(profileKey);
    try {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      }
    } catch (_) {}
    return { messages: [], lastUserAt: 0, lastAssistantAt: 0 };
  }

  saveHistory(profileKey = 'husband', history = {}) {
    const file = this.getHistoryFile(profileKey);
    try {
      fs.writeFileSync(file, JSON.stringify(history, null, 2), 'utf8');
    } catch (_) {}
  }

  getTemporalContext() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const bj = new Date(utc + (3600000 * 8));
    
    const year = bj.getFullYear();
    const month = bj.getMonth() + 1;
    const day = bj.getDate();
    const hour = bj.getHours();
    const minute = bj.getMinutes();
    
    const shichens = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    const shichen = shichens[Math.floor(((hour + 1) % 24) / 2)] + '时';

    let timeDesc = '白天';
    if (hour >= 23 || hour < 5) timeDesc = '子夜深更，万籁俱寂，四野宵禁';
    else if (hour >= 5 && hour < 8) timeDesc = '清晨拂晓，晨光熹微微凉';
    else if (hour >= 8 && hour < 11) timeDesc = '上午辰巳，日光融融';
    else if (hour >= 11 && hour < 14) timeDesc = '正午晌午，日头高照';
    else if (hour >= 14 && hour < 17) timeDesc = '午后未申，暖阳西斜';
    else if (hour >= 17 && hour < 19) timeDesc = '傍晚日暮，炊烟初起掌灯';
    else timeDesc = '入夜掌灯，夜色深沉温热';

    let season = '秋末金秋微凉';
    if (month >= 3 && month <= 5) season = '阳春三月，春风抚面';
    else if (month >= 6 && month <= 8) season = '盛夏蝉鸣，草木茂盛';
    else if (month >= 9 && month <= 11) season = '金秋十月，天高气爽微凉';
    else season = '寒冬腊月，北风微冷';

    return {
      currentFull: `${year}年${month}月${day}日 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      year,
      month,
      day,
      shichen,
      timeDesc,
      season,
    };
  }

  buildSystemPrompt(roleName, modality = 'text', memberKey = 'husband', currentEpoch = 'ancient', history = null) {
    const res = composeSystemPrompt({
      roleName, modality, memberKey, currentEpoch, history,
      dataDir: this.dataDir,
      promptMode: this.promptMode,
      viewerActorId: this._viewerActorId || null,
      viewerName: this._viewerName || '',
      actorPersonaOverride: this._actorPersonaOverride || null,
      rolesManager: this.rolesManager,
      milestones: this.readMilestones(),
      timeCtx: this.getTemporalContext(),
    });
    if (res.summaryDay && res.summaryDay !== this._lastSummaryDay) {
      this._lastSummaryDay = res.summaryDay;
      console.log(`[World] 已注入天机（第${res.summaryDay}日）`);
    }
    return res.prompt;
  }


  processNarrativeTags(replyText, sayText = '') {
    const res = executeNarrativeTags({
      replyText,
      sayText,
      dataDir: this.dataDir,
      viewerActorId: this._viewerActorId || 'husband',
      lastSummonNotice: this._lastSummonNotice,
    });
    this._lastSummonNotice = res.lastSummonNotice;
    return res.reply;
  }

  /** 这一句里提到了谁：给代演的人一句底细（谁、做什么的、此刻在哪） */
  _mentionFacts(world, text, exceptId) {
    try {
      const out = [];
      for (const a of Object.values(world?.actors || {})) {
        if (!a || a.dead || !a.name || a.id === exceptId) continue;
        if (!String(text || '').includes(a.name)) continue;
        const where = world.places?.[a.location]?.name || '别处';
        const rel = a.id === 'husband' ? '临江茶坊东家' : (a.role || '城中人');
        out.push(`${a.name}：${rel}，此刻在${where}`);
        if (out.length >= 3) break;
      }
      return out;
    } catch { return []; }
  }

  /** 最近几句对话，供代演/兜底时接住指代（"他""那个人"） */
  _recentSnippet(profileKey, n = 4) {
    try {
      const h = this.readHistory(profileKey).messages || [];
      return h.slice(-n).map((m) => `${m.role === 'user' ? '客' : '答'}：${String(m.text || '').slice(0, 60)}`).join('\n');
    } catch { return ''; }
  }

  /** 把"不该开口的人"的段落剔掉：不在场的人、以及不是本人操控的真人号 */
  _stripIllegalSpeakers(reply) {
    try {
      const w = loadState(this.dataDir);
      const me = this._viewerActorId ? w.actors?.[this._viewerActorId] : w.actors?.husband;
      const here = me?.location;
      const segs = String(reply || '').split(/(?=【[^】\n]{1,12}】)/).filter(Boolean);
      const kept = [];
      for (const seg of segs) {
        const m = seg.match(/^【([^】\n]{1,12})】/);
        if (!m) { kept.push(seg); continue; }
        const spk = m[1].trim();
        // 系统/差事类标头不是人（如「领受差事 · 林芸娘」），原样留着
        if (/[·・]/.test(spk) || /天道|旁白|众人|差事|任务|系统|回执|结算/.test(spk) || spk === (me?.name || '')) {
          kept.push(seg);
          continue;
        }
        const who = Object.values(w.actors || {}).find((a) => a && !a.dead && a.name && (a.name === spk || spk.includes(a.name) || a.name.includes(spk)));
        if (!who) { kept.push(seg); continue; }
        // 同名可能既有 NPC 又有真人号：只要这个名字底下有真人号，就不许 AI 替他说话
        const sameNameReal = Object.values(w.actors || {}).some(
          (a) => a && !a.dead && a.name === who.name && (/^usr_/.test(String(a.id)) || isHumanBound(w, a.id)),
        );
        const rel = me?.relations?.[who.id] || who.relations?.[me?.id] || {};
        const kin = Boolean(me?.spouse === who.id || who.spouse === me?.id
          || (me?.household && who.household)
          || rel.lover || Number(rel.desire) >= 40 || Number(rel.trust) >= 55);
        const isRealUser = /^usr_/.test(String(who.id)) || isHumanBound(w, who.id) || sameNameReal;
        if (isRealUser && !kin) {
          console.log(`[Presence] 剔除非本人操控的真人发言：${spk}`);
          continue;
        }
        if (who.location !== here && !(isRealUser && kin)) {
          console.log(`[Presence] 剔除非在场发言：${spk}`);
          continue;
        }
        kept.push(seg);
      }
      const merged = kept.join('').trim();
      return merged || '';
    } catch {
      return String(reply || '');
    }
  }

  async chat(args = {}) {
    return runChat(this, args);
  }

  /**
   * 天道主动开口：根据当前世界状态现写一句话。
   * 引擎只负责「该她说话了」这个事实，措辞由天道裁定（不套模板、不写死台词）。
   */
  async generateProactive({ memberKey = 'husband', roleName = null, asName = null, reason = 'proactive', facts = {} } = {}) {
    try {
      if (!this.llmClient.isReady()) return null;
      const activeRole = roleName || this.rolesManager.getActiveRole();
      const world = buildStateSummary(this.dataDir, { roleName: activeRole, memberKey });
      const hookLine =
        reason === 'hook'
          ? '这一条是【钩子】：必须抛出一件**需要相公当场决断**的事——有人在等他回话、有买卖要拍板、有人找上门、账上出了岔子。要具体到人、地、事，别只说"要不要去看看"。'
          : '';
      let cleanAsName = asName ? String(asName).trim() : null;
      // 真人号不许被"主动推送"代他说话（他不是 NPC）
      try {
        const wGuard = loadState(this.dataDir);
        const who0 = cleanAsName
          ? (wGuard.actors?.[cleanAsName] || Object.values(wGuard.actors || {}).find((a) => a && a.name === cleanAsName))
          : null;
        if (who0 && (/^usr_/.test(String(who0.id)) || isHumanBound(wGuard, who0.id))) {
          console.log(`[Push] 跳过真人角色 ${who0.name}，不替他说话`);
          return null;
        }
      } catch { /* 忽略 */ }
      const wSnap = loadState(this.dataDir);
      let speakerActor = null;
      if (cleanAsName) {
        const pureName = cleanAsName.includes('·') ? cleanAsName.split('·')[1].trim() : cleanAsName;
        speakerActor = wSnap.actors?.[cleanAsName] ||
          wSnap.actors?.[pureName] ||
          Object.values(wSnap.actors || {}).find((a) => a && (a.name === pureName || pureName.includes(a.name) || a.id === cleanAsName));
      }

      // 是否眷属/红颜知己（妻妾或心意相通的红颜，如婉儿、芸娘、紫嫣、静儿）
      const isBeloved = Boolean(
        speakerActor && (
          speakerActor.household ||
          speakerActor.spouse === 'husband' ||
          /正妻|二房|如夫人|发妻|妾|紫嫣|文霞|静儿|婉儿|芸娘/.test(cleanAsName) ||
          /正妻|二房|如夫人|发妻|妾|紫嫣|文霞|静儿|婉儿|芸娘/.test(String(speakerActor.role || ''))
        )
      );

      const identity = cleanAsName
        ? (isBeloved
            ? `你现在是「${cleanAsName}」本人。你与相公王甯情深意重。没有人跟你说话，是你主动差人送信或开口找相公。用「${cleanAsName}」温婉亲近、暗自关切的口吻说话，称呼王甯为「相公」或「夫君」。`
            : `你现在是「${cleanAsName}」，市井营生掌柜/雇工/名门千金。你称呼王甯为「东家」或「王掌柜」（绝不可称呼相公）！你不在内宅私房，是差人送口信或在外头当差回话，就事论事禀报商情、官府风闻或客商要事。`)
        : `你现在是「${activeRole}」这个角色本人，正在家中。没有人跟你说话，是你主动开口找相公。`;
      const system = [
        identity,
        hookLine,
        '要求：一到两句话，30~70 字，具体、有信息量、像真人在说话。可以报一件事、提一句提醒、或说一句心里话。',
        '禁止使用【角色名】这种分角格式；禁止括号动作与旁白；只输出你要说的那句话。',
        '',
        world,
      ].join('\n');

      const res = await this.llmClient.complete({
        system,
        messages: [
          {
            role: 'user',
            content: `主动开口。触发原因：${reason}；已知事实：${JSON.stringify(facts)}`,
          },
        ],
        maxTokens: 220,
        temperature: 0.95,
      });
      const text = cleanReply(res.text, '', false);
      return text || null;
    } catch (err) {
      console.warn('[Push] 主动生成失败：', err.message);
      return null;
    }
  }

  /**
   * 硬性在场过滤：不在场的人，其分角段落直接从回复里删掉。
   * 只放行「此刻就在相公所在之处」的人，以及相公明说要请/叫的人。
   */
  enforcePresence(text, allowedNames) {
    return enforcePresence(text, allowedNames, this._knownNames || []);
  }

  normalizeSpeakers(text) {
    return normalizeSpeakers(text, this.dataDir);
  }

  applyStatedIncome(userText) {
    return applyStatedIncome(userText, this.dataDir);
  }

  async compactMemories(batch) {
    return compactMemories(batch, { llmClient: this.llmClient, dataDir: this.dataDir });
  }

  async extractReceipt({ userText = '', replyText = '', memberKey = 'husband', roleName = null } = {}) {
    return extractReceipt({
      userText,
      replyText,
      memberKey,
      roleName,
      llmClient: this.llmClient,
      dataDir: this.dataDir,
      viewerActorId: this._viewerActorId,
    });
  }

  async videoChat({ text = '', imageBase64 = null, modality = 'voice', profileKey = 'husband', roleName = null, actorId = null } = {}) {
    const say = String(text || '').trim();
    const hasClientVision = say.includes('【系统视觉已看清') || say.includes('【手机原生离线视觉');
    const visualFact = hasClientVision ? say : '';

    let targetTitle = '相公';
    if (profileKey === 'wife') targetTitle = '女主人/夫人';
    else if (profileKey === 'kid') targetTitle = '小朋友';

    let promptSay = say;
    if (hasClientVision) {
      console.log(`[Vision] 📱 收到成员 [${profileKey}] 手机原生离线视觉识别，0代理直通 DeepSeek`);
      promptSay = say;
    } else if (imageBase64) {
      promptSay = say
        ? `【${targetTitle}发来了一张图片并问你：“${say}”。请根据${targetTitle}的话语温柔回应，并询问${targetTitle}图中的关键细节（绝不要发自拍，也不要死板评判皮肤）】`
        : `【${targetTitle}刚刚发来了一张图片，还没有附带文字说明。请用1~2句温柔自然的话告诉${targetTitle}你收到了图片，并询问${targetTitle}想让你看图里的什么内容或有什么吩咐（绝不要发自拍，也不要死板评判皮肤）】`;
    } else {
      promptSay = say || `请以你的专属身份主动向${targetTitle}温柔问候一声。`;
    }

    const result = await this.chat({ text: promptSay, modality, profileKey, roleName, isVideoCall: true, actorId });
    if (result.ok) {
      const replyText = result.reply?.text || '';
      const audioKey = result.reply?.audioKey || result.reply?.audio?.key || null;
      const audioUrl = audioKey ? `/dsh-surfcore/pet-api/audio/${audioKey}.wav` : null;

      return {
        ok: true,
        text: replyText,
        audioUrl: audioUrl,
        visualFact: visualFact || '',
        reply: result.reply,
        userMessage: result.userMessage,
        latencyMs: result.latencyMs,
        voice: result.voice,
      };
    }
    return result;
  }
}

