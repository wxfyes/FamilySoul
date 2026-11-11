import { matchScenarioTrigger } from './scenario-triggers.js';
import { buildEnvironmentHints } from './environment-hints.js';
import { enforcePresence, normalizeSpeakers, applyStatedIncome, compactMemories, extractReceipt } from './dialogue-postprocess.js';
import { executeNarrativeTags } from './narrative-engine.js';
import { resolveVoiceCasting } from '../world/voice-casting.js';
import fs from 'node:fs';
import { personFacts } from '../world/person-facts.js';
import { getPlaceDisplayName } from '../world/naming.js';
import { moveActor, isHumanBound, healInnerFamilyAtNight } from '../world/position.js';
import { applyChatActions } from '../world/chat-actions.js';
import path from 'node:path';

import { buildStateSummary } from '../world/summarize.js';
import { loadState, saveState } from '../world/state.js';
import { parseWorldTags, applyWorldTags, recordReceipt, markReceiptHit } from '../world/dispatch.js';
import { prepareRitual, enforceRitualAnswer } from '../world/ritual.js';
import { evaluateBedIntent, resolveBedPartner, buildBedChamberPrompt } from '../world/bedchamber.js';
import { ensurePresence } from '../world/scene.js';
import { applySummon } from '../world/summon.js';
import { auditReply } from '../world/audit.js';
import { buildMemberCard } from '../world/member-card.js';
import { placeFacts } from '../world/state.js';
import { arcStepPrompt } from '../world/arcs.js';
import { normalizeMemberReply } from '../world/member-reply.js';
import { resolveTurnTarget } from '../world/turn-target.js';
import { describeBonds } from '../world/bonds.js';
import { rumorsKnownBy } from '../world/rumors.js';
import { recordHumanLine, memberKeyOfActor } from '../world/co-presence.js';
import { buildProxyPrompt, wrapProxyLine } from '../world/proxy-actor.js';
import { parseIntent, VERBS } from '../world/intent.js';
import { checkGate } from '../world/gate.js';
import { applyAction } from '../world/apply.js';
import { addMemory, recallMemories } from '../world/memory.js';
import { stripForVoice, mergeSameSpeaker } from './text-utils.js';
import { cleanReply } from './reply-sanitizer.js';
import { composeViewerPersona, composeWorldRules } from './prompt-composer.js';
import {
  parseSummonTarget, pickSummonActor,
  parseDismissIntent, isMassDismiss, homeRoomForName,
  parsePayTag, isActionHandledPay,
} from './intent-pipeline.js';
import { composeSystemPrompt } from './system-prompt.js';



/**
 * 对话主流程（从 pet-service.js 整体迁出，行为逐字不变）
 *
 * 只通过 svc（PetService 实例）调用既有方法/字段；不反向 import 主文件。
 */


/**
 * 回复收尾：TTS、发言记录、assistantMsg、后处理与最终返回（从 chat-flow 抽出）
 * 只通过 svc 调用既有方法，不反向 import。
 */
export async function finalizeResponse(svc, ctx) {
  let { reply, history, say, profileKey, memberKey, roleName, startedAt, modality, turnTarget } = ctx;
    const now = Date.now();
    let audioKey = null;

    if (modality === 'voice') {
      const voiceText = stripForVoice(reply);
      if (voiceText) {
        try {
          const matchSpeaker = String(reply || '').match(/^[^\w一-龥]*?【([^】\n]{1,16})】/);
          const detectedSpeaker = matchSpeaker ? matchSpeaker[1].trim() : (turnTarget?.actor?.name || null);
          let currentWorld = null;
          try { currentWorld = loadState(svc.dataDir); } catch {}
          const casting = resolveVoiceCasting({
            speakerName: detectedSpeaker,
            actor: turnTarget?.actor || null,
            world: currentWorld,
            profileKey,
          });
          console.log(`[TTS] 🎭 角色配音派发 [${detectedSpeaker || '默认'}] -> ${casting.label} (voice=${casting.voice}, pitch=${casting.pitch}, rate=${casting.rate})`);
          const ttsResult = await svc.ttsService.synthesizeToFile({
            text: voiceText,
            voice: casting.voice,
            pitch: casting.pitch,
            rate: casting.rate,
          });
          if (ttsResult.ok) {
            audioKey = ttsResult.key;
          }
        } catch (err) {
          console.error('[TTS] ❌ 合成失败：', err.message);
        }
      }
    } else {
      console.log(`[Chat] 💬 当前为纯文本模式 (手机端右上角语音开关未开启，若需语音请在手机右上角点开喇叭)`);
    }

    console.log(`[stage] 到准备返回 ${Date.now() - startedAt}ms`);
    const userMsg = { id: `u-${now}`, role: 'user', text: say, at: now };

    // 真人扮演世界人物时，把她说的原话记进世界（原文照录，不经 AI 解读）
    if (svc._viewerActorId) {
      try {
        const wq = loadState(svc.dataDir);
        const who = wq.actors?.[svc._viewerActorId];
        if (who) {
          wq.quotes = Array.isArray(wq.quotes) ? wq.quotes : [];
          wq.quotes.push({
            actor: who.id,
            name: who.name,
            text: String(say).slice(0, 300),
            day: wq.clock?.day ?? 1,
            hour: wq.clock?.hour ?? 0,
            at: Date.now(),
          });
          if (wq.quotes.length > 300) wq.quotes = wq.quotes.slice(-300);
          saveState(svc.dataDir, wq);
        }
      } catch (err) {
        console.warn('[Quotes] 记录失败：', err.message);
      }
    }
    // 成文前最后一道：把不该开口的人再剔一次（后段追加的旁人也会被挡住）
    try {
      const cleaned = svc._stripIllegalSpeakers(reply);
      if (cleaned) reply = cleaned;
    } catch { /* 忽略 */ }
    const assistantMsg = { id: `a-${now}`, role: 'assistant', text: reply, at: now };
    if (audioKey) {
      assistantMsg.audioKey = audioKey;
      assistantMsg.audio = {
        key: audioKey,
        url: `/dsh-surfcore/pet-api/audio/${audioKey}.wav`,
      };
      console.log(`[Chat] 🎙️ 语音就绪: /dsh-surfcore/pet-api/audio/${audioKey}.wav`);
    }

    history.messages.push(userMsg, assistantMsg);
    if (history.messages.length > 100) history.messages = history.messages.slice(-100);
    history.lastUserAt = now;
    history.lastAssistantAt = now;

    // 每攒够 20 条，就把最老的一段压缩成长期记忆（不阻塞回复）
    try {
      const upTo = Number(history.compactedUpTo) || 0;
      if (history.messages.length - upTo >= 40) {
        const batch = history.messages.slice(upTo, upTo + 40);
        history.compactedUpTo = upTo + 40;
        svc.compactMemories(batch).catch(() => {});
      }
    } catch {
      /* 压缩失败不影响对话 */
    }

    // 问"我在哪"：引擎直接答，别让模型猜
    try {
      if (/(我(在|到了)?哪|这是哪|到哪儿了|在什么地方)/.test(String(say || ''))) {
        const wHere2 = loadState(svc.dataDir);
        const locSelf = svc._viewerActorId ? wHere2.actors?.[svc._viewerActorId]?.location : wHere2.actors?.husband?.location;
        const pName = String(wHere2.places?.[locSelf]?.name || '');
        if (pName) {
          // 用旁白、不用【地点】当发言人（否则会被在场铁律当成"地点在说话"剔掉）
          const wRoom = loadState(svc.dataDir);
          const hereRoom = wRoom.places?.[locSelf];
          const furn = (hereRoom?.rooms && Object.keys(hereRoom.rooms).length) ? '' : '';
          const meW = svc._viewerActorId ? wRoom.actors?.[svc._viewerActorId] : wRoom.actors?.husband;
          const silver = Number(meW?.money ?? wRoom.assets?.silver ?? 0);
          assistantMsg.text = `（你在「${pName}」。${silver > 0 ? `身上还有 ${silver.toFixed(2)} 两碎银。` : ''}${furn}）`;
          assistantMsg.audioKey = null;
          console.log('[Where] 直接答位置：' + pName);
        }
      }
    } catch { /* 忽略 */ }

    // 全场收口：严禁因台词提及第三者而抹杀在场交谈者的对话；仅当点名某在场人时掐掉旁人插嘴
    try {
      const wEnd = loadState(svc.dataDir);
      const sayText = String(say || '');
      const curLoc = svc._viewerActorId ? wEnd.actors?.[svc._viewerActorId]?.location : wEnd.actors?.husband?.location;
      // 只认全名或非通称尾名：别把“掌柜的呢”当成在喊某个姓张的掌柜
      const GENERIC = ['掌柜', '东家', '夫人', '娘子', '小姐', '公子', '老爷', '婆婆', '婶子', '公公', '伙计', '老板', '客官', '大娘子'];
      const namedActors = Object.values(wEnd.actors || {}).filter((a) => {
        if (!a || a.dead || !a.name || a.id === svc._viewerActorId) return false;
        if (sayText.includes(a.name)) return true;
        const short = a.name.length > 2 ? a.name.slice(-2) : '';
        if (!short || GENERIC.includes(short)) return false;
        return sayText.includes(short);
      });
      const namedPresent = namedActors.filter((a) => a.location === curLoc);
      const namedAbsent = namedActors.filter((a) => a.location !== curLoc);

      // 若明确点名了在场某人（如喊苏娘/子归/婉儿），只留该在场者，掐掉无关旁人插嘴
      if (namedPresent.length === 1 && reply && /【[^】]+】/.test(String(reply))) {
        const keepActor = namedPresent[0];
        const placeName = String(wEnd.places?.[keepActor.location]?.name || '');
        const segs = String(reply).split(/(?=【[^】\n]{1,12}】)/).filter(Boolean);
        const kept = segs.filter((seg) => {
          const m = seg.match(/^【([^】\n]{1,12})】/);
          if (!m) return true;
          const who = m[1].trim();
          if (who === keepActor.name || (placeName && who === placeName)) return true;
          if (/(天道|旁白|众人)/.test(who)) return true;
          const actor = Object.values(wEnd.actors || {}).find((a) => a && a.name === who);
          if (actor && actor.id !== keepActor.id) {
            console.log(`[Scene] 只留${keepActor.name}，掐掉${who}`);
            return false;
          }
          return true;
        });
        const joined = kept.join('').trim();
        if (joined) reply = joined;
      } else if (!namedPresent.length && namedAbsent.length === 1 && (!reply || !/【[^】]+】/.test(String(reply)) || /(没人接话|没人应声)/.test(String(reply)))) {
        // 专程找不在场的人且现场无人应答：照实报位置
        const abs = namedAbsent[0];
        const where = getPlaceDisplayName(wEnd, abs.location);
        reply = `（${abs.name}此刻人在「${where}」，眼下并不在跟前。）`;
        console.log(`[Scene] ${abs.name}不在场，照实报位置：${where}`);
      }
    } catch { /* 忽略 */ }

    // 记住这一轮是谁在说话（相公号也要有对象记忆）
    try {
      const wP = loadState(svc.dataDir);
      const speakers = [...String(reply || '').matchAll(/【([^】\n]{1,12})】/g)].map((m) => m[1].trim());
      const last = speakers.filter((n) => !/天道|旁白|众人/.test(n)).pop();
      if (last) {
        const hit = Object.values(wP.actors || {}).find((a) => a && a.name === last);
        wP.chatPartners = wP.chatPartners || {};
        const key = svc._viewerActorId || 'husband';
        if (hit && wP.chatPartners[key] !== hit.id) {
          wP.chatPartners[key] = hit.id;
          saveState(svc.dataDir, wP);
        }
      }
    } catch { /* 忽略 */ }

    // 相公号：点了在场的人，模型没写出来 → 单独代演一句（和她的号同等待遇）
    try {
      const isHusAcc = !svc._viewerActorId || svc._viewerActorId === 'husband';
      const replyEmpty = !String(reply || '').trim() || /^[...…]+$/.test(String(reply || '').trim());
      if (isHusAcc && replyEmpty) {
        const wN = loadState(svc.dataDir);
        const husN = wN.actors?.husband;
        const saidN = String(say || '');
        const target = Object.values(wN.actors || {}).find(
          (a) => a && !a.dead && a.id !== 'husband' && a.name && a.location === husN?.location && saidN.includes(a.name),
        );
        if (target) {
          const pN = buildProxyPrompt({
            actor: target,
            hearer: husN,
            memories: recallMemories(wN, [target.id], { limit: 4 }),
            facts: (wN.npcArcs?.[target.id]?.lastStep ? [`你眼下的事：${wN.npcArcs[target.id].lastStep}`] : []),
            hearerName: husN?.name || '相公',
            hearerPlace: String(wN.places?.[husN?.location]?.name || ''),
            said: saidN.slice(0, 120),
            recent: '',
          });
          const resN = await svc.llmClient.complete({
            system: pN.system, messages: [{ role: 'user', content: pN.user }], maxTokens: 150, temperature: 0.85,
          });
          const lineN = wrapProxyLine(target.name, resN?.text);
          if (lineN) {
            reply = lineN;
            const wSave = loadState(svc.dataDir);
            wSave.chatPartners = wSave.chatPartners || {};
            wSave.chatPartners.husband = target.id;
            saveState(svc.dataDir, wSave);
            console.log('[Proxy] 补代演' + target.name + '：' + lineN.slice(0, 30));
          }
        }
      }
    } catch { /* 忽略 */ }

    console.log(`[stage] 收口段完成 ${Date.now() - startedAt}ms`);
    svc.saveHistory(profileKey, history);
    console.log(`[stage] 历史已存 ${Date.now() - startedAt}ms`);

    // 点了一个不在场的人 → 直接报他在哪，别让在场的人对着他说话
    try {
      const wAbs = loadState(svc.dataDir);
      const saidA = String(say || '');
      const meA2 = svc._viewerActorId ? wAbs.actors?.[svc._viewerActorId] : wAbs.actors?.husband;
      const absent = Object.values(wAbs.actors || {}).find((a) => {
        if (!a || a.dead || !a.name || a.id === svc._viewerActorId) return false;
        const short = a.name.length > 2 ? a.name.slice(-2) : a.name;
        const named = saidA.includes(a.name) || (short && saidA.includes(short));
        return named && a.location !== meA2?.location;
      });
      const absentIsHousehold = absent && (absent.household || ['waner', 'yunnia', 'xiaocui'].includes(absent.id));
      if (absent && !absentIsHousehold && !String(reply || '').includes(String(wAbs.places?.[absent.location]?.name || ''))) {
        const whereA = getPlaceDisplayName(wAbs, absent.location);
        // 先只把事实塞进提示，让天道用自己的话说；只有它一个字没写时才兜底
        contextHint += `（【事实】${absent.name}此刻在「${whereA}」，不在这儿。若对方问起，就照实说，别装作他/她在场。）\n`;
        if (!String(reply || '').trim() || /^\.{2,}$/.test(String(reply || '').trim())) {
          reply = `（${absent.name}此刻人在「${whereA}」，眼下并不在跟前。）`;
        }
        contextHint += `（【铁律】${absent.name}此刻在「${whereA}」，**绝不可写【${absent.name}】的台词**；只能由在场的人回答，或写成旁白。）\n`;
        console.log(`[Scene] 点名不在场：${absent.name}@${whereA}（已禁止替他开口）`);
      }
    } catch { /* 忽略 */ }

    // 问到府里的人：剔除纯旁白干扰，保持回复纯净
    try {
      reply = String(reply || '').split('\n').filter((x) => !/就站在|四下冷清|你到了/.test(x)).join('\n').trim();
    } catch { /* 忽略 */ }

    // 最后兜底：若只剩场景旁白，而在场有人 → 让他开口说一句
    try {
      const replyTrimmed = String(reply || '').trim();
      const isNarration = !replyTrimmed || /^[…\s.]{1,12}$/.test(replyTrimmed) || /^(【[^】]+】：)?\s*[^【]*(就站在|四下冷清|你到了|没人接话|没人应声)/.test(replyTrimmed);
      if (isNarration) {
        const wL = loadState(svc.dataDir);
        const meL = svc._viewerActorId ? wL.actors?.[svc._viewerActorId] : wL.actors?.husband;
        const hereL = Object.values(wL.actors || {})
          .filter((a) => a && !a.dead && a.id !== 'husband' && a.id !== svc._viewerActorId && a.location === meL?.location)
          .sort((x, y) => (Number(y.relations?.husband?.trust) || 0) - (Number(x.relations?.husband?.trust) || 0));
        const pickL = hereL[0];
        if (pickL) {
          const pL = buildProxyPrompt({
            actor: pickL,
            hearer: meL,
            memories: recallMemories(wL, [pickL.id], { limit: 3 }),
            facts: wL.npcArcs?.[pickL.id]?.lastStep ? [`你眼下的事：${wL.npcArcs[pickL.id].lastStep}`] : [],
            hearerName: meL?.name || '相公',
            hearerPlace: String(wL.places?.[meL?.location]?.name || ''),
            said: String(say || '').slice(0, 120),
            recent: '',
          });
          const rL = await svc.llmClient.complete({
            system: pL.system, messages: [{ role: 'user', content: pL.user }], maxTokens: 150, temperature: 0.85,
          });
          const lineL = wrapProxyLine(pickL.name, rL?.text);
          if (lineL) {
            reply = lineL;
            console.log('[Proxy] 旁白兜底 → ' + pickL.name + '：' + lineL.slice(0, 24));
          }
        }
      }
    } catch { /* 忽略 */ }

    // 账本没有的往事：让天道自己重写一版（不替它写台词）
    try {
      const askP2 = /(还记得|记不记得|记得吗|以前|上次|那回|从前|当年|旧事)/.test(String(say || ''));
      const looksFabricated = /(记得|从前|那时|当年|上次|那回|你总|你总是|你那时)/.test(String(reply || ''));
      if (askP2 && looksFabricated) {
        const wR = loadState(svc.dataDir);
        const meR = svc._viewerActorId ? wR.actors?.[svc._viewerActorId] : wR.actors?.husband;
        const hereR = Object.values(wR.actors || {}).filter((a) => a && !a.dead && a.location === meR?.location && a.id !== 'husband' && a.id !== svc._viewerActorId);
        const namesR = hereR.map((a) => a.name);
        const idsR = hereR.map((a) => a.id);
        const poolR = recallMemories(wR, idsR, { limit: 12 });
        console.log(`[Memory] 旧事检查 ask=${askP2} fab=${looksFabricated} pool=${poolR.length} speakers=${namesR.join('、')}`);
        if (poolR.length === 0) {
          const speaker = (String(reply || '').match(/^【([^】\n]{1,12})】/) || [])[1] || (hereR[0]?.name || '她');
          const rr = await svc.llmClient.complete({
            system: `你就是${speaker}。账本里没有对方说的那件旧事。`, messages: [{
              role: 'user',
              content: `对方问：“${String(say).slice(0, 60)}”。账本里没有这件事。请用一句到两句、${speaker}自己的口吻回答：记不得、或含混带过，绝不许编任何具体往事、细节、物件、场景。只输出台词，以【${speaker}】：开头。`,
            }], maxTokens: 120, temperature: 0.8,
          });
          const rewritten = String(rr?.text || '').trim();
          if (rewritten) {
            reply = /^【[^】]+】/.test(rewritten) ? rewritten : (wrapProxyLine(speaker, rewritten) || rewritten);
            console.log('[Memory] 已让天道重写（账本无此事）');
          }
        }
      }
    } catch (e) { console.warn('[Memory] 重写失败：', e.message); }

    // 没点名、也没说"你们俩" → 只留一个说话的人（不许两个人抢话）
    try {
      const wS = loadState(svc.dataDir);
      const saidS = String(say || '');
      const pluralS = /(你们两个|你们俩|你俩|你们两|两位|都来|都过来|一起)/.test(saidS);
      const anyNamed = Object.values(wS.actors || {}).some((a) => {
        if (!a || !a.name) return false;
        const short = a.name.length > 2 ? a.name.slice(-2) : a.name;
        return saidS.includes(a.name) || (short && saidS.includes(short));
      });
      const segs = String(reply || '').split(/(?=【[^】\n]{1,12}】)/).filter(Boolean);
      // 【提示】不是人说话，不能算进"几个人抢话"，更不能被只留第一个说话人时丢掉
      const speech = segs.filter((x) => /^【[^】]+】/.test(x)
        && !/^【提示】/.test(x)
        && !/(就站在|四下冷清|你到了)/.test(x));
      const isBed = Boolean(history?.inBedSession);
      const isHouseholdScene = speech.length > 0 && speech.every((seg) => /(婉儿|芸娘|小翠|二娘子|大娘子)/.test(seg));

      if (!isBed && !isHouseholdScene && !pluralS && !anyNamed) {
        if (speech.length > 1) {
          const partnerId = String((wS.chatPartners || {})[svc._viewerActorId || 'husband'] || '');
          const partnerName = wS.actors?.[partnerId]?.name || '';
          const keep = speech.find((x) => partnerName && x.includes(partnerName)) || speech[0];
          reply = keep.trim();
          console.log('[Scene] 没点名：只留' + (partnerName || '第一个人') + '说话');
        }
      }
    } catch { /* 忽略 */ }

    // 点了好几个人：每人都得应一声，不许只有一个回
    try {
      const wM = loadState(svc.dataDir);
      const meM = svc._viewerActorId ? wM.actors?.[svc._viewerActorId] : wM.actors?.husband;
      const saidM = String(say || '');
      const namedByText = Object.values(wM.actors || {}).filter((a) => {
        if (!a || a.dead || !a.name || a.id === svc._viewerActorId) return false;
        if (a.location !== meM?.location) return false;
        const short = a.name.length > 2 ? a.name.slice(-2) : a.name;
        return saidM.includes(a.name) || (short && saidM.includes(short));
      });
      // 说"你们两个/你们俩/都"这种，就把在场的几位都算上
      const plural = /(你们两个|你们俩|你俩|你们两|两位|都|大家|一起)/.test(saidM);
      const presentAll = Object.values(wM.actors || {})
        .filter((a) => a && !a.dead && a.name && a.id !== svc._viewerActorId && a.id !== 'husband' && a.location === meM?.location)
        .sort((x, y) => (Number(y.relations?.husband?.trust) || 0) - (Number(x.relations?.husband?.trust) || 0));
      const named = (namedByText.length ? namedByText : (plural ? presentAll.slice(0, 2) : [])).slice(0, 3);
      if (named.length >= 2) {
        for (const who of named) {
          const shortN = String(who.name).length > 2 ? String(who.name).slice(-2) : String(who.name);
          const already = new RegExp(`【[^】]*(?:${String(who.name)}|${shortN})`).test(String(reply || ''));
          if (already) continue;
          const pM = buildProxyPrompt({
            actor: who,
            hearer: meM,
            memories: recallMemories(wM, [who.id], { limit: 3 }),
            facts: wM.npcArcs?.[who.id]?.lastStep ? [`你眼下的事：${wM.npcArcs[who.id].lastStep}`] : [],
            hearerName: meM?.name || '相公',
            hearerPlace: String(wM.places?.[meM?.location]?.name || ''),
            said: saidM.slice(0, 120),
            recent: '',
          });
          const rM = await svc.llmClient.complete({
            system: pM.system, messages: [{ role: 'user', content: pM.user }], maxTokens: 150, temperature: 0.85,
          });
          const lineM = wrapProxyLine(who.name, rM?.text);
          if (lineM) {
            reply = `${String(reply || '').trim()}\n${lineM}`.trim();
            console.log('[Proxy] 补' + who.name + '一句：' + lineM.slice(0, 24));
          }
        }
      }
    } catch { /* 忽略 */ }

    // 找人与同行由客户端交互面板调用 /api/world/summon 驱动，聊天中不因"同去/跟我去"等词偷听挪移

    // 有人说正经台词了，旁白就别再占一行（它会每轮重复同一句）
    try {
      const lines = String(reply || '').split('\n');
      const hasSpeech = lines.some((l) => /^【[^】]+】/.test(l) && !/^【(天道|旁白|)[^】]*】：\s*[^【]*(就站在|四下冷清|你到了|没人接话|没人应声)/.test(l));
      if (hasSpeech) {
        const kept = lines.filter((l) => !/(就站在|四下冷清|你到了|没人接话|没人应声)/.test(l));
        const joined = kept.join('\n').trim();
        if (joined) reply = joined;
      }
    } catch { /* 忽略 */ }

    // 出口：把本轮动作的【提示】并进最终正文（这里之后没人再改 reply）
    try {
      const tips = Array.isArray(svc._turnNotices) ? svc._turnNotices.splice(0, svc._turnNotices.length) : [];
      if (tips.length) {
        reply = String(reply || '').trim() + '\n' + tips.map((t) => `【提示】${t}`).join('\n');
        if (assistantMsg) assistantMsg.notices = tips.slice();
        console.log(`[Actions] 出口拼入 ${tips.length} 条提示`);
      }
    } catch { /* 忽略 */ }

    // 最后一道：所有后处理改的是 reply，这里同步回 assistantMsg
    try {
      if (assistantMsg && typeof reply === 'string' && reply !== assistantMsg.text) {
        assistantMsg.text = reply;
      }
    } catch { /* 忽略 */ }

    return {
      ok: true,
      reply: assistantMsg,
      userMessage: userMsg,
      latencyMs: Date.now() - startedAt,
      voice: audioKey ? { ok: true, key: audioKey } : null,
    };
}
