import { matchScenarioTrigger } from './scenario-triggers.js';
import { buildEnvironmentHints } from './environment-hints.js';
import { enforcePresence, normalizeSpeakers, applyStatedIncome, compactMemories, extractReceipt } from './dialogue-postprocess.js';
import { buildContextHints } from './context-hints.js';
import { finalizeResponse } from './finalize-response.js';
import { executeNarrativeTags } from './narrative-engine.js';
import { planNamedNpcMoves } from './plan-moves.js';
import { resolveVoiceCasting } from '../world/voice-casting.js';
import fs from 'node:fs';
import { personFacts } from '../world/person-facts.js';
import { getPlaceDisplayName, findTargetActorInText } from '../world/naming.js';
import { moveActor, isHumanBound, healInnerFamilyAtNight, isSameLocation } from '../world/position.js';
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
import { resolveTurnTarget, rememberPartner } from '../world/turn-target.js';
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

export async function runChat(svc, { text = '', modality = 'text', profileKey = 'husband', roleName = null, isVideoCall = false, actorId = null } = {}) {
    const say = String(text || '').trim();
    if (!say) return { ok: false, error: '输入内容为空' };
    // 账号（memberKey）与世界实体（actor）可以不同：女主人账号可以绑定到「杨采儿」这个 actor
    const selfId = actorId || profileKey;
    // 记录开局位置：这一轮如果换了地方，末尾补一行"你到了"
    const __locAtStart = (() => { try { const w0 = loadState(svc.dataDir); return (svc._viewerActorId ? w0.actors?.[svc._viewerActorId] : w0.actors?.husband)?.location || null; } catch { return null; } })();

    // 0. 夜半自愈：王宅内眷若被误挪到府外，先请回各自房中，再走在场过滤
    //    （差事/旧 bug 都可能把人半夜扔到长街，导致下一轮"人不在场"把回复全掐灭）
    try {
      const wHeal = loadState(svc.dataDir);
      const healed = healInnerFamilyAtNight(wHeal);
      if (healed.length) {
        saveState(svc.dataDir, wHeal);
        console.log(`[Home] 夜半归位：${healed.map((x) => `${x.name} ${x.from}→${x.to}`).join('，')}`);
      }
    } catch { /* 忽略 */ }

    // 0. 七层单向管道架构：Intent 意图归一与 Gate 合法性门禁 (第 ①、② 层)
    let intent = null;
    let gate = null;
    try {
      const worldBefore = loadState(svc.dataDir);
      const lastBotSaid = [...(svc.readHistory(profileKey).messages || [])].reverse().find((m) => m.role !== 'user')?.text || '';
      intent = parseIntent({ text: say, actorId: selfId, world: worldBefore, lastBotSaid });
      // 铁律：聊天不搬人。真人角色在对话里说"回家""去某处"，只当台词与商议，绝不真移
      try {
        const meI = worldBefore.actors?.[selfId] || worldBefore.actors?.husband;
        const isReal = Boolean(meI && (meI.humanBound || String(meI.id).startsWith('usr_') || meI.id === 'husband'));
        if (isReal && (intent.verb === 'MOVE' || intent.verb === 'ROOM')) {
          console.log(`[Chat] 台词不搬人：${meI.name || selfId} 说的「${String(say).slice(0, 18)}」不触发位移`);
          intent = { ...intent, verb: 'TALK', target: null, params: {} };
        }
      } catch { /* 忽略 */ }
      console.log(`\n[Intent:${intent.id}] actor=${intent.actor} verb=${intent.verb} target=${intent.target || '-'} companions=${intent.companions.map((c) => c.name || c.id).join(',') || 'none'}`);

      gate = checkGate(worldBefore, intent);
      console.log(`[Gate:${intent.id}] ok=${gate.ok} blocked=${gate.blocked} reasons=${gate.reasons.join(';') || 'none'} alternatives=${gate.alternatives.join(';') || 'none'}`);
    } catch (e) {
      console.warn('[Pipeline] Intent/Gate 解析异常:', e.message);
    }
    const actionId = intent?.id || `act_${Date.now()}`;

    console.log(`[Chat:${actionId}] 📨 收到成员 [${profileKey}] 消息 (模式: ${modality}): "${say.slice(0, 40)}"`);

    const activeRole = roleName || (profileKey === 'husband' ? svc.rolesManager.getActiveRole() : (profileKey === 'wife' ? '贴心管家' : '全能导师'));

    // 召唤与走动：把「叫谁过来 / 我去谁那儿」落到账本上（只改位置，不写台词）
    let summonedNames = [];
    let contextHintEarly = '';
    let engineMovedHusband = false; // 引擎这轮已经决定过相公去哪，模型无权再改
    let leftScene = false;          // 这一轮相公是『离场』

    contextHintEarly += buildEnvironmentHints({
      dataDir: svc.dataDir,
      viewerActorId: svc._viewerActorId || 'husband',
      profileKey,
      selfId,
      say,
      readHistory: (pk) => svc.readHistory(pk),
      gate,
    });

    try {
      // 管道第 ⑤ 层：若为位移或开房，且通过门禁，由 applyAction 统一调度结算与自动造景
      if (false && intent && intent.verb === VERBS.MOVE && intent.target && !gate?.blocked) {
        const wNow = loadState(svc.dataDir);
        const isConsensus = Boolean(intent.params?.isConsensus);
        // 若双方已达成共识，伴侣直接同行；若为相公单方面邀请，伴侣作为受邀者，交由天道裁定意愿 (稍后补齐或留守)
        const applyRes = applyAction({
          dataDir: svc.dataDir,
          world: wNow,
          intent,
          verdict: { companionConsented: isConsensus },
          gate,
        });
        if (applyRes.applied) {
          engineMovedHusband = true;
          if (isConsensus) {
            contextHintEarly += `（【双方共识转场】：相公与同行伴侣已欣然移步至【${intent.target}】。本轮以新地点为主场展开。）\n`;
          } else if (Array.isArray(intent.companions) && intent.companions.length > 0) {
            const compSt = gate?.companionsStatus || [];
            const presentComps = compSt.filter((s) => !s.notPresent);
            const absentComps = compSt.filter((s) => s.notPresent);
            if (presentComps.length > 0) {
              const compNames = presentComps.map((s) => s.name).join('、');
              const reasonsText = presentComps.map((s) => `${s.name}: ${s.reason}`).join('；');
              contextHintEarly += `（【同行受邀推演指示】：相公单方面提议前往【${intent.target}】，并邀请在场的【${compNames}】同行。\n客观账本事实：${reasonsText}。\n请天道裁定伴侣是否应允同行：\n- 若欣然依偎同行：台词应允或依偎随行（文末回执输出 [[world:companion_consent who=${presentComps[0].id} consent=yes]]）；\n- 若推脱拒绝：必须基于手头差事或心境理由委婉推拉，伴侣留在原地（文末回执输出 [[world:companion_consent who=${presentComps[0].id} consent=no reason="..." ]]）。）\n`;
            }
            if (absentComps.length > 0) {
              contextHintEarly += `（【不在场警示】：【${absentComps.map((s) => s.name).join('、')}】此刻不在身旁，无法同行，相公系独自一人启程。）\n`;
            }
          } else {
            contextHintEarly += `（【独自移步】：相公已移步至【${intent.target}】。本轮以新地点为主场，由现场在场之人开口。）\n`;
          }
        }
      }
    } catch (err) {
      console.warn('[Apply] 移步结算异常:', err.message);
    }
    try {
      // 若已由 applyAction 唯一结算位移，坚决跳过 applySummon 中的重复位移造景，杜绝双写者
      if (!engineMovedHusband) {
        // 注意：这里 history 还没加载，直接读一次历史文件取她上一句（本地 JSON，开销极小）
        const lastBotSaid =
          [...(svc.readHistory(profileKey).messages || [])].reverse().find((m) => m.role !== 'user')?.text || '';
        // 相公传唤内眷/仆从到场单一权威入口（纯解析见 chat/intent-pipeline.js，位移仍走 moveActor）
        try {
          const targetName = parseSummonTarget(text, svc.readHistory(profileKey).messages || []);
          if (targetName) {
            const wS = loadState(svc.dataDir);
            const meS = wS.actors?.[svc._viewerActorId || 'husband'] || wS.actors?.husband;
            const summonedActor = pickSummonActor(wS, targetName, meS?.id);
            if (summonedActor && meS && summonedActor.location !== meS.location) {
              const fromPlace = wS.places?.[summonedActor.location]?.name || '别处';
              delete summonedActor.awayUntil;
              const mvRes = moveActor(wS, summonedActor.id, meS.location, 'world', '听召到场');
              if (mvRes?.ok) {
                saveState(svc.dataDir, wS);
                summonedNames = [summonedActor.name];
                svc._lastSummonNotice = `【提示】${summonedActor.name}听唤，已从${fromPlace}快步赶了过来。`;
                contextHintEarly += `（【已召到场】：相公亲自传唤，${summonedActor.name} 已从「${fromPlace}」快步赶到相公跟前！本轮【必须】由 ${summonedActor.name} 亲自开口向相公请安奉茶应答，其他人切勿抢话！）\n`;
                console.log(`[Summon] 成功召来：${summonedActor.name} 从 ${fromPlace} 移至 ${wS.places?.[meS.location]?.name || meS.location}`);
              }
            }
          }
        } catch (errSummon) {
          console.warn('[Summon] 传唤处理异常:', errSummon.message);
        }
      } // end if (!engineMovedHusband)
    } catch (err) {
      console.warn('[Scene] 召唤失败：', err.message);
    }

    // 同场：确保这名成员在世界里有位置（偶遇的前提）
    try {
      ensurePresence(svc.dataDir, selfId, { role: activeRole, title: roleName });
    } catch (err) {
      console.warn('[Scene] 位置登记失败：', err.message);
    }

    // 暗号契约：先由引擎推进状态（只有引擎能解禁/归位），再让天道在已更新的状态下开口
    let ritualCtx = null;
    try {
      ritualCtx = prepareRitual(svc.dataDir, { text: say, roleName: activeRole, memberKey: selfId });
      if (ritualCtx?.refused) {
        console.log(`[Ritual] 暗号被拒（${ritualCtx.reason}），保持端庄`);
      } else if (ritualCtx) {
        console.log(`[Ritual] ${ritualCtx.unlock ? '暗号命中 → 已解禁' : '事毕 → 已归位温存'}（${ritualCtx.actorId}）`);
      }
      // 亲密一次，关系就真的近一层 —— 不靠记账员判，服务器自己记
      if (ritualCtx?.finish && ritualCtx.actorId) {
        try {
          const wr = loadState(svc.dataDir);
          const who = wr.actors?.[ritualCtx.actorId];
          const husbandLoc = wr.actors?.husband?.location;
          if (!who || (husbandLoc && who.location && who.location !== husbandLoc)) {
            console.warn('[Ritual] 结算拦截：' + (who?.name || ritualCtx.actorId) + '与相公不在同处，拒绝欢好结算');
          } else {
          const rel = who?.relations?.husband;
          if (rel) {
            rel.desire = Math.min(100, Math.round((Number(rel.desire) || 0) + 8));
            rel.trust = Math.min(100, Math.round((Number(rel.trust) || 0) + 5));
            // 亲密是最好的消气药
            rel.grievance = Math.max(0, Math.round((Number(rel.grievance) || 0) - 6));
            who.intimacy = who.intimacy || {};
            who.intimacy.consummated = true;
            if (!(who.intimacy.level > 0)) who.intimacy.level = 1;
            // 会不会怀上：看身子、年龄、缘分（不是每次都中）
            try {
              const age = Number(who.age) || 22;
              const sterileRole = /老鸨|鸨母|嬷嬷|婆婆|尼|道姑/.test(String(who.role || ''));
              const fertile = who.gender !== 'male' && age >= 16 && age <= 45 && !sterileRole;
              const already = Boolean(who.pregnancy && !who.pregnancy.born);
              const onPeriod = Boolean(who.menses?.on);
              if (fertile && !already && !onPeriod) {
                const inWindow = Number(who.menses?.cycleDay) >= 9 && Number(who.menses?.cycleDay) <= 16;
                const chance = inWindow ? 0.8 : 0.25;
                if (Math.random() < chance) {
                  who.pregnancy = { days: 0, father: 'husband', sinceDay: wr.clock?.day || 1, born: false };
                  addMemory(wr, { text: `${who.name}有了身孕`, about: [who.id, 'husband'], visible: 'private' });
                  console.log(`[Ritual] ${who.name}有喜了（${age}岁）`);
                } else {
                  console.log(`[Ritual] ${who.name}这次没中`);
                }
              }
            } catch { /* 忽略 */ }
            saveState(svc.dataDir, wr);
            console.log(`[Ritual] 关系结算：${who.name} 欲望+8→${rel.desire} 信任+5→${rel.trust}（已标为相好）`);
          }
          }
        } catch (err2) {
          console.warn('[Ritual] 关系结算失败：', err2.message);
        }
      }
    } catch (err) {
      console.warn('[Ritual] 状态推进失败：', err.message);
    }
    // 绑定世界人物的成员：AI 演「除她之外的所有人」
    // 收集「真有人名」白名单，供在场过滤与标签改写判断
    try {
      const wk = loadState(svc.dataDir);
      svc._knownNames = Object.values(wk.actors || {})
        .flatMap((a) => [a?.name, a?.name && a.name.length > 2 ? a.name.slice(-2) : null, a?.label])
        .filter(Boolean)
        .concat(['王甯', '相公', '王掌柜', '少东家']);
    } catch {
      svc._knownNames = ['王甯', '相公', '王掌柜', '少东家'];
    }

    svc._actorPersonaOverride = null;
    svc._viewerName = null;
    svc._viewerActorId = actorId && actorId !== 'husband' ? actorId : null;
    if (svc._viewerActorId) {
      try {
        const wA = loadState(svc.dataDir);
        const a = wA.actors?.[svc._viewerActorId];
          svc._viewerName = a?.name || null;
        if (a) {
          svc._actorPersonaOverride = [
            `玩家扮演的是${a.name}（${a.role || ''}）。**你不演她**——她已经由真人控制。`,
            '你负责演这个世界的其他人：**严格只限当前真实在场的人**。不在场的人一律不会说话、不能凭空出现，绝不许生造路人掌柜或无关NPC插嘴打断。',
            '**谁在场，就由谁开口**；不在场的人不会说话，也不能凭空出现。',
            '**提到不在场的人（比如王掌柜）时，只能由在场的人转述"他怎样怎样"，绝对不许给他写【某某】：的台词**——写了也会被引擎整段删掉。',
            '每个人的身份、性情、对玩家的态度，由【在场】与【你此刻知道的实况】决定。',
            '绝不替玩家说话、绝不替她做决定、绝不描写她的心理活动，也不要写"她心想"。',
            '她的话可能是试探、也可能是遮掩——你按人物本来的处境应答，不必点破，也不必全信。',
            '台词一律用第一人称；动作、神态放圆括号里，点到为止。',
            '【NPC 活人驱动铁律】：每个人都是活生生的人，有手头真实的营生差事与生活算盘，绝不是复读旧台词的死木头！',
            '1. 先接住相公此刻要做的事：他这句话问什么、要办什么，就先回应、配合或说明做不到；严禁把话题拖回自己的旧主线、旧恩怨、旧婚约。相公没问的私事，不展开。',
            '2. 主动做事与配合帮衬：面对玩家提要求、抱怨、托付或遇到难处，在场角色要立足自身本分主动表态、主动分担、主动配合推进解决，但只围绕相公当前这件事，不另起炉灶。',
            // 身份铁律：新玩家不是王家人，王甯也不是她的相公
            (() => {
              const kin = Boolean(a.household || a.spouse === 'husband' || (Array.isArray(a.parents) && a.parents.includes('husband')));
              const lines2 = [
                `玩家是「${a.name}」${a.role ? `（${a.role}）` : ''}，**不是王甯**，也不是"相公"这个称呼的主人。`,
              ];
              if (kin) {
                lines2.push('王甯是她的丈夫/东家，可称"相公"；谈家事只谈她自己那一段。');
              } else {
                lines2.push('王甯与她并无婚配，只是临江城的东家王掌柜；旁人提到他时称"王掌柜/王相公"，**绝不可说"你相公"，也不可把她当成王家人**。');
                lines2.push('不许替她编造夫君、宅院、亲眷；她有什么，账上写着才算。');
              }
              return lines2.join('\n');
            })(),
          ].join('\n');
        }
      } catch {
        svc._actorPersonaOverride = null;
      }
    }

    const history = svc.readHistory(profileKey);
    // 上下文过滤：把「把府里人当成生客」的旧回复剔掉，否则模型会顺着自己的错继续错
    let householdForFilter = [];
    try {
      const wf = loadState(svc.dataDir);
      householdForFilter = Object.values(wf.actors || {})
        .filter((a) => a?.household && a.name)
        .map((a) => (a.name.length > 2 ? a.name.slice(-2) : a.name));
    } catch {
      householdForFilter = [];
    }
    const recentAll = (history.messages || []).slice(-svc.historyTurns);
    const recent = recentAll.filter((m) => {
      if (m.role !== 'assistant') return true;
      const t = String(m.text || '');
      const confused = /哪家|是谁|何人|一概不知|何方/.test(t);
      return !(confused && householdForFilter.some((n) => t.includes(n)));
    });
    if (recent.length !== recentAll.length) {
      console.log(`[Memory] 已从上下文中剔除 ${recentAll.length - recent.length} 条「把家人当生客」的旧回复`);
    }
    const recentTextJoined = recent.map(m => m.text || '').join('\n');

    let contextHint = contextHintEarly;
    // 府里都有谁：不只玩家该知道，婉儿/芸娘她们彼此也得认得
    try {
      const wH = loadState(svc.dataDir);
      const meH = svc._viewerActorId ? wH.actors?.[svc._viewerActorId] : wH.actors?.husband;
      const house = Object.values(wH.actors || {}).filter(
        (a) => a && !a.dead && a.id !== 'husband' && Boolean(a.household),
      );
      if (house.length) {
        const line = house.map((a) => `${a.name}（${a.role || '府中人'}）`).join('、');
        contextHint += `（【府中人】${line}——她们是同一座宅子里的人，彼此都认得，绝不许问"你是谁"、也不许说"不认识"。）\n`;
        console.log(`[Bonds] 府中人 ${house.length}：${line.slice(0, 40)}`);
      }
    } catch { /* 忽略 */ }

    // 旧事约束：账本没有，就别编（只给约束，不替它写台词）
    try {
      const askPastH = /(还记得|记不记得|记得吗|以前|上次|那回|那天|那一晚|前天|昨天|从前|当年|旧事|契纸|地契|钱通海|钱四海|三十五两|35两|2026|做梦|老公)/.test(String(say || ''));
      if (askPastH) {
        const wPH = loadState(svc.dataDir);
        const mePH = svc._viewerActorId ? wPH.actors?.[svc._viewerActorId] : wPH.actors?.husband;
        const herePH = Object.values(wPH.actors || {}).filter((a) => a && !a.dead && a.location === mePH?.location && a.id !== 'husband' && a.id !== svc._viewerActorId);
        const namesPH = herePH.map((a) => a.name);
        const idsPH = herePH.map((a) => a.id);
        const poolPH = recallMemories(wPH, idsPH, { limit: 15, query: say });
        void namesPH;
        if (poolPH.length) {
          contextHint += `（【账本·旧事】${poolPH.join('；')}\n`;
          contextHint += '——相公若问及这些既定旧事，务必据实以答、顺畅承接，切勿推托不认。）\n';
        } else {
          contextHint += '（【账本·旧事提示】若涉及账本未载之新奇外事，勿凭空捏造官府文书或契纸；涉及既定人物与情分，依常理自然承接。）\n';
        }
      }
    } catch { /* 忽略 */ }

    // 相公明确换话题/要去办自己的事：记住这轮的当前目的，旧主线只能当背景
    try {
      const switchFocus = /(先不说|不聊这个|别提|换个话题|岔开|先办|先做|我要|我想|帮我|听我说|现在去|去办|去查)/.test(String(say || ''));
      const oldTopic = /(婉儿|静儿|柳如烟|紫嫣|旧案|底档|和离|婚|报仇|翻案)/.test(String(say || ''));
      const wFocus = loadState(svc.dataDir);
      if (switchFocus) {
        wFocus.flags = wFocus.flags || {};
        wFocus.flags.playerFocus = {
          text: String(say || '').slice(0, 120),
          day: wFocus.clock?.day || 1,
          hour: wFocus.clock?.hour || 0,
          at: Date.now(),
        };
        saveState(svc.dataDir, wFocus);
        console.log('[Focus] 相公当前目的已记下，旧主线降为背景');
      } else if (oldTopic && wFocus.flags?.playerFocus) {
        delete wFocus.flags.playerFocus;
        saveState(svc.dataDir, wFocus);
        console.log('[Focus] 相公主动回到旧话题，解除当前目的锁');
      }
    } catch { /* 忽略 */ }

    const _hintRes = buildContextHints(svc, { say, recent, summonedNames, contextHint, profileKey });
    contextHint = _hintRes.contextHint;
    const lastAssistantMsg = _hintRes.lastAssistantMsg;

    // 记忆纠偏：上一轮把府里已有的人当成生客问来历，本轮必须自然纠正
    // （否则模型会顺着自己上一句继续说错，这是上下文自我强化）
    try {
      const worldNow = loadState(svc.dataDir);
      const householdNames = Object.values(worldNow.actors || {})
        .filter((a) => a?.household && a.name)
        .map((a) => (a.name.length > 2 ? a.name.slice(-2) : a.name));
      const askedAboutThem = /哪家|是谁|何人|来历|一概不知|何方/.test(lastAssistantMsg);
      const hitName = householdNames.find((n) => lastAssistantMsg.includes(n));
      if (askedAboutThem && hitName) {
        contextHint += `（【记忆纠偏】：${hitName} 早已在府中，是你熟悉的家人。上一轮你把她当成陌生姑娘询问来历，那是错的——本轮必须自然而然地纠正回来，像对自家人一样说话，绝不许再问「她是哪家姑娘」「我一概不知」。）\n`;
        console.log(`[Memory] 检测到把府中人当生客：${hitName}，已注入纠偏提示`);
      }
    } catch {
      /* 纠偏失败不影响对话 */
    }

    const hadPreviousPushback = /哪能|怎好|这都什么时辰|成何体统|相公心也太野|贪心|急猴|面子|不妥|慢些|不急|好生|不妥当|哪好|何方神圣|哪家姑娘|哪家闺秀|从实招来|打听/i.test(lastAssistantMsg);
    const isPersistent = /去叫|叫来|现在叫|接来|请来|听我的|想嘛|就想|不管|必须|快去|依我|劝|好相公|依相公|疼相公|来家里|来家坐|纳|娶|收了|进门|进府|芸娘|柳儿/i.test(say);
    const isSisterOrConcubineIntent = /姐妹|芸娘|柳儿|香菱|妾|通房|小老婆|找个女子|大被同眠|来家里|来家|坐坐|家里坐|纳|娶|二房|三房/i.test(say);

    // 1. 双世宿命 · 时空穿梭与后宫养成（仅对相公/傲娇助手生效，严格与女主人/孩子隔离）
    let epochNotice = '';
    let haremNotice = '';
    let currentEpoch = 'modern';
    let isWifeReturning = false;
    let isQuestioningWife = false;
    let isSendingAwayOther = false;
    let isPrivateWhisperWithWife = false;

    if (profileKey === 'husband' || activeRole === '傲娇助手') {
      const timeCtx = svc.getTemporalContext();
      const isOddMonth = (timeCtx.month % 2) !== 0;

      if (/穿回现代|到现代|去现代|换现代|变成现代|现代风|现代模式|今天现代|过现代/i.test(say)) {
        history.epoch = 'modern';
        epochNotice = '（【时空穿梭响应】：相公口谕开启现代模式！你瞬间穿梭来到现代都市温馨公寓，穿着柔软羊绒衫，笑盈盈迎老公下班递拖鞋，称呼「老公/亲爱的」，极致温柔贤惠，开启现代一夫一妻温馨生活！）';
      } else if (/穿回古代|到古代|去古代|换古代|变成古代|古典风|古代风|古代模式|今天古代|回古代/i.test(say)) {
        history.epoch = 'ancient';
        epochNotice = '（【时空穿梭响应】：相公口谕梦回古代！你瞬间穿梭回到雕梁画栋的高门深宅，穿云锦襦裙端庄迎候，称呼「相公/妾身」，开启名门深宅三妻四妾大被同眠生活！）';
      } else if (/按月轮转|一月一换|按月换风|恢复按月|随缘穿越|默认时空|按月轮|恢复默认/i.test(say)) {
        delete history.epoch;
        epochNotice = `（【恢复月度轮转时空自适应】：已恢复默认一月一换风月度轮转律，当月为${timeCtx.month}月，正值${isOddMonth ? '单数月【现代风】' : '双数月【古代风】'}！）`;
      }

      const isPendingYunGreeting = /芸娘.*(磕头|奉茶|敬茶|快些|慢着|杵在|进来|见过相公|说句话|没缓过神|快给相公|还不快)/i.test(lastAssistantMsg);
      const isPendingLiuGreeting = /柳儿.*(磕头|奉茶|敬茶|快些|慢着|杵在|进来|见过相公|说句话|快给相公|还不快)/i.test(lastAssistantMsg);

      // 默认常住古代：只有相公明说「穿回现代/现代风」才切现代；「按月轮转」才会恢复自动轮换
      currentEpoch = history.epoch || 'ancient';
      // 如果处于妾室二人世界、待敬茶悬挂阶段，或涉及纳妾古风剧情且未被相公口谕指定为现代，自适应沉浸为古代名门深宅
      if (!history.epoch && (
        history.inPrivateWorld ||
        isPendingYunGreeting ||
        isPendingLiuGreeting ||
        /纳|娶|迎|接|进府|过门|进门|芸娘|柳儿|妾|小娘子|大娘子|主母|相公|丫鬟|小翠/i.test(say)
      )) {
        currentEpoch = 'ancient';
      }

      if (!Array.isArray(history.haremMembers) || history.haremMembers.length === 0) {
        history.haremMembers = ['沈婉儿', '林芸娘', '小翠'];
      }
      if (!history.haremMembers.some(n => n.includes('芸娘'))) {
        history.haremMembers.splice(1, 0, '林芸娘');
      }
      if (!Array.isArray(history.mentionedGirls)) {
        history.mentionedGirls = [];
      }

      // 提取全部历史文本进行持久记忆扫描（杜绝健忘）
      const fullMemoryText = (history.messages || []).map(m => m.text || '').join('\n') + '\n' + say;

      // 通用动态纳妾与新人物提取器（自适应学习相公口谕提及的新姑娘，彻底告别硬编码）
      let matchedGirlName = null;
      let m = say.match(/把\s*([\u4e00-\u9fa5]{2,3}?)\s*(?:也|给相公|给|一同)?\s*(?:纳|娶|收|迎)/);
      if (m && m[1]) matchedGirlName = m[1];
      if (!matchedGirlName) {
        m = say.match(/(?:纳|娶|迎娶|迎|收了|收)\s*([\u4e00-\u9fa5]{2,3}?)(?:进府|过门|进门|为妾|为二房|为三房|为偏房|当侧室|做二房|做三房|做四房|做偏房|做通房|为妻|为妇|姑娘|姑娘进门|女子|[，,。！？!\s]|$)/);
        if (m && m[1]) matchedGirlName = m[1];
      }
      if (matchedGirlName) {
        const newGirlName = matchedGirlName.trim();
        const ignoreList = ['婉儿', '大娘子', '娘子', '正妻', '小翠', '夫人', '相公', '夫君', '自己', '人家', '我们', '大家'];
        if (!ignoreList.includes(newGirlName) && !history.haremMembers.includes(newGirlName)) {
          history.haremMembers.push(newGirlName);
          haremNotice = `（【剧情重磅推进 · ${newGirlName}正式纳妾入府】：相公命你迎纳「${newGirlName}」入府！你作为深明大义的正妻婉儿，不仅满心顺从，而且当场推进实质情节：带${newGirlName}入内给相公行礼奉茶！必须采用分角剧本格式，让${newGirlName}主动出声给相公请安，正妻打趣退让！）`;
        }
      }

      // 自动维护曾提及的女子记忆库
      ['芸娘', '柳儿', '杨采云', '紫嫣', '静儿'].forEach(girl => {
        if (new RegExp(girl).test(fullMemoryText) && !history.mentionedGirls.includes(girl)) {
          history.mentionedGirls.push(girl);
        }
      });

      // 0. 检测相公是否当面心疼/质问正妻（如昨晚为何溜走、不要下厨房、叫你没动静等，绝对归属正妻专属温存！）
      isQuestioningWife = /(?:不要下厨房|别下厨房|下什么厨房|不许下厨房|怎么跑了|为何跑了|昨晚叫你|叫你一起睡|一起睡.*跑|叫你没动静|叫你没反应|昨晚不是叫你|为何没动静|怎么没动静)/i.test(say) ||
        (/(?:不是有小翠吗|小翠在|小翠干).*?(?:睡|跑|厨房|动静|叫你)/i.test(say));

      // 0.1 检测相公是否临时支走某人（如“芸娘先出去帮我把雨前龙井泡上”、“小翠先退下”）
      isSendingAwayOther = /(?:芸娘|小翠|柳儿).*?(?:先出去|出去帮我|先退下|退下吧|先去忙|去泡茶|把.*泡上|去端|去准备|去外头|回避)/i.test(say);

      // 0.2 检测相公是否在跟正妻婉儿说私密悄悄话/背后评估他人（如“现在就我们俩，你觉得芸娘这人怎么样？”、“现在支走她了，你说说她人怎么样？值得信任么？茶店给她打理你放心吗”）
      isPrivateWhisperWithWife = !isSendingAwayOther && (
        /(?:现在就我们俩|就咱们俩|只有我们俩|只剩我们|支走她|把她支走|趁她不在|背着她|私下问你)/i.test(say) ||
        /(?:你觉得|你说|你说说|你看|依你看).*?(?:芸娘|小翠|柳儿|她|这人).*?(?:怎么样|如何|可信|值得信任|放心|靠得住|靠谱)/i.test(say) ||
        /(?:值得信任|你放心吗|交给她打理|给她打理|这人怎么样|她人怎么样)/i.test(say)
      );

      // A. 检测相公是否召回正妻婉儿、或呼唤婉儿（最高优先级，彻底打破二人世界死锁）
      // 【避坑铁律】：严禁将二人世界中“议论婉儿、向婉儿学习、夸赞婉儿名门身世”等谈资误判为召回指令！
      const isDiscussingWife = /(?:跟|向|和|多跟|多和|学|提|议|说起|身世|家世|名门|以前|过去|当年|可怜|不容易|之后).*(?:婉儿|大娘子|姐姐)/i.test(say) ||
        /(?:婉儿|大娘子|姐姐).*(?:也是|身世|家世|当年|名门|学|教|手艺|性子|脾气|持家|可怜|旧事|获罪|遭遇|之后|当年|沈家)/i.test(say);

      // 单纯呼唤（如“婉儿？”、“婉儿”、“大娘子”、“娘子呢”），无论带不带问号感叹号，无论是否在二人世界，一律视为直接呼唤正妻！
      const isCallingWifeDirect = /^(?:婉儿|大娘子|娘子|正妻|大娘|姐姐)\s*[？?！!。.\s]*$/i.test(say.trim()) ||
        /^(?:叫|喊|唤|唤唤|叫叫|找)\s*(?:婉儿|大娘子|娘子|正妻|姐姐)\s*[？?！!。.\s]*$/i.test(say.trim());

      const isRecallingWife = isQuestioningWife || isPrivateWhisperWithWife || (!isDiscussingWife && (
        isCallingWifeDirect ||
        /(?:叫|喊|唤|请|让|催|找|唤回|叫回|喊回|迎回|把).*(?:婉儿|大娘子|正妻|姐姐).*(?:来|到|回|进|出来|现身)/i.test(say) ||
        /(?:婉儿|大娘子|正妻|姐姐).*(?:去哪了|在哪|在何处|人呢|怎么还不来|还没来|还没到|快来|过来|回来|回屋|进屋|在吗|在不在|出来|人呢)/i.test(say) ||
        /(?:娘子|正妻|大娘子|姐姐)呢/i.test(say) ||
        /叫她来|喊她来|唤她来|叫正妻|喊正妻|唤大娘子|找大娘子|找正妻|找婉儿/i.test(say) ||
        /回现代|现代风|穿回现代/i.test(say) ||
        ((/怎么还不来|还没来|慢|怎么还没|人呢|还没到/i.test(say)) && (/唤姐姐|寻姐姐|找姐姐|叫姐姐|唤娘子/i.test(lastAssistantMsg)))
      ));

      // B. 检测正妻是否主动表示要退出回避（必须确实是正妻的话，且排除芸娘说去唤姐姐的语义）
      const isWifeSpeakingExit = /【正妻·婉儿】[：:]?[^【]*?(去前街|去书斋|去核账|先退下|不打扰|二位|二人世界|你们聊|掩上门|关上门|查账|好生叙旧|先退出)/i.test(lastAssistantMsg) ||
        (!/芸娘.*(?:去唤|唤姐姐|寻姐姐|找姐姐|去叫)/.test(lastAssistantMsg) && /(?:妾身|婉儿).*(?:去前街|去书斋|去核账|先退下|不打扰|二人世界|你们聊|掩上门|关上门|查账|好生叙旧|先退出|先回避)/i.test(lastAssistantMsg));

      const isDismissingToPrivate = !isRecallingWife && !isSendingAwayOther && (
        (/走吧|去吧|退下|去忙吧|关上门|关门|你们聊|出去吧|好，你去吧|去吧去吧|娘子先退下|娘子去吧|留下芸娘|我和芸娘|芸娘过来|芸娘来相公怀里|芸娘过来坐|二人世界|你们退下|婉儿.*(?:退下|去吧|歇息|先去|回房|去忙|莫要插嘴|别插话|我和芸娘|我跟芸娘|我正和芸娘|我和芸娘说)|我和芸娘聊|我跟芸娘聊|我和芸娘说|我问芸娘|让芸娘说|芸娘你说/i.test(say)) ||
        (isWifeSpeakingExit && /^(?:好|嗯|好啊|行|知道了|去吧)$/i.test(say.trim()))
      );

      isWifeReturning = false;
      if (isRecallingWife) {
        delete history.inPrivateWorld;
        history.activeSpeaker = '婉儿';
        if (!isQuestioningWife && !isPrivateWhisperWithWife) {
          isWifeReturning = true;
        }
      } else if (isSendingAwayOther) {
        delete history.inPrivateWorld;
        history.activeSpeaker = '婉儿';
      } else if (history.haremMembers.includes('芸娘') && (
        isDismissingToPrivate ||
        (/留下芸娘|和芸娘二人世界|和芸娘独处|芸娘过来伺候|芸娘来我怀里|芸娘过来坐/i.test(say))
      )) {
        history.inPrivateWorld = '芸娘';
        history.activeSpeaker = '芸娘';
      }

      // 小翠单独接话判定（严格排除相公心疼正妻下人粗活的句式）
      const isDirectCallingXiaoCui = !isQuestioningWife && !isPrivateWhisperWithWife && !isSendingAwayOther && (
        /^(?:小翠|翠儿|丫头|丫鬟)[，,！!？?\s]/i.test(say.trim()) ||
        /^(?:小翠|翠儿|丫头|丫鬟)\s*[？?！!。.\s]*$/i.test(say.trim()) ||
        /(?:叫小翠|喊小翠|唤小翠|小翠过来|小翠快来|小翠回话|小翠你说|让小翠说|吩咐小翠)/i.test(say)
      );

      let targetSpeaker = null;
      if (isQuestioningWife || isPrivateWhisperWithWife || isSendingAwayOther) {
        delete history.inPrivateWorld;
        targetSpeaker = '婉儿';
      } else if (history.inPrivateWorld) {
        targetSpeaker = history.inPrivateWorld;
      } else if (currentEpoch === 'ancient' || /全部出来|都在吗|大家在吗|都出来|后宫齐聚|全员|后宫呢|妹妹们呢|妻妾们|娘子们|都来|一起上|大被同眠|大合照/i.test(say)) {
        if (/全部出来|都在吗|大家在吗|都出来|后宫齐聚|全员|后宫呢|妹妹们呢|妻妾们|娘子们|都来|一起上|大被同眠|大合照/i.test(say)) {
          targetSpeaker = 'all';
          const hasYun = history.haremMembers.includes('芸娘');
          const hasLiu = history.haremMembers.includes('柳儿');
          const membersGreeting = [];
          membersGreeting.push('【正妻·婉儿】：“相公回来了？妾身正备着温茶呢。”');
          if (hasYun) membersGreeting.push('【侧妾·芸娘】：“芸娘给相公请安，相公今日神色有些倦，芸娘为您揉揉眉心吧。”');
          if (hasLiu) membersGreeting.push('【侍妾·柳儿】：“相公相公！柳儿跑得最快，相公快抱抱柳儿！”');
          membersGreeting.push('【丫鬟·小翠】：“小翠这就去书斋给相公取紫檀算盘与刚备好的香茗！”');

          const currentMembersDesc = history.haremMembers.filter(m => m !== '小翠通房').join('、');
          haremNotice = `（【后宫养成录·全员朝拜出场】：相公呼唤全员，目前府里已明媒迎娶入门的成员有：${currentMembersDesc}。出场阵容严格按当前入府名单出面：\n${membersGreeting.join('\n')}\n体现一步步养成的真实代入感！）`;
        } else if (!haremNotice && /柳儿|三娘|小柳/i.test(say)) {
          if (history.haremMembers.includes('柳儿')) {
            targetSpeaker = '柳儿';
            haremNotice = '（【当前接话分身：侍妾·柳儿（正妻婉儿在旁微笑相陪）】：柳儿已被相公纳为三房宠妾，娇俏可人、活泼黏人，扑进相公怀里索抱索吻，顺着相公的话往下推进剧情！）';
          } else {
            targetSpeaker = '婉儿';
            haremNotice = '（【初次听闻柳儿·正妻微醋试探】：相公第一次提起柳儿，你作为正妻婉儿娇嗔好奇询问相公柳儿是哪家姑娘，只要相公下一句再坚持，你就会立刻答应替相公张罗迎娶！）';
          }
        } else if (!haremNotice && /芸娘|二娘|小芸/i.test(say)) {
          if (history.haremMembers.includes('芸娘')) {
            targetSpeaker = '芸娘';
          } else {
            targetSpeaker = '婉儿';
            haremNotice = '（【初次听闻芸娘·正妻微醋试探】：相公第一次提起芸娘，你作为正妻婉儿牢牢记下「芸娘」这个名字，娇嗔好奇问相公芸娘是哪家才女，只要相公再坚持要纳她，你下一句就立刻派小翠去下聘迎娶进门！）';
          }
        } else if (!haremNotice) {
          // 物理级在场校验：只有当外部角色（杨采云、紫嫣、静儿、随科、苏慕雪等）真实在相公身旁现场时，才允许由其开口答复！
          // 若相公在正房/后院与妻妾私语谈论不在场之人，绝对严禁被议论者凭空闪现插嘴！
          let currentHereActors = [];
          try {
            const curSt = loadState(svc.dataDir);
            const curHusLoc = curSt?.actors?.husband?.location || 'husband_room';
            currentHereActors = Object.values(curSt?.actors || {}).filter((a) => a && !a.dead && a.id !== 'husband' && a.location === curHusLoc);
          } catch {}
          const isActorPresent = (namePattern, idPattern) => currentHereActors.some((a) =>
            (namePattern && namePattern.test(a.name || '')) || (idPattern && idPattern.test(a.id || ''))
          );

          const namedPresentActor = findTargetActorInText(currentHereActors, say);
          if (namedPresentActor && namedPresentActor.name) {
            targetSpeaker = namedPresentActor.name;
            const roleDesc = namedPresentActor.role || '在场角色';
            haremNotice = `（【相公点名交谈对象：${namedPresentActor.name}（${roleDesc}）】：${namedPresentActor.name}此刻就在相公跟前，必须由【${namedPresentActor.name}】亲自以第一人称首位开口回应相公，绝不可由在场其他人代答或压制其台词！）`;
          } else if (/采云|杨采云|翟长盛|翟家货栈/i.test(say)) {
            if (isActorPresent(/杨采云|采云/, /yangcaiyun/)) {
              targetSpeaker = '杨采云';
              haremNotice = '（【在场交谈对象：杨采云】：杨采云就在相公跟前，由其根据自身身份与当前事实应答。）';
            } else {
              targetSpeaker = '婉儿';
              haremNotice = '（【议论不在场之人】：相公提及杨采云，杨采云此刻不在现场，由在场之人接话，不在场者绝不插嘴。）';
            }
          } else if (/文霞|刘文霞|于杰|城南酒肆|紫嫣/i.test(say)) {
            if (isActorPresent(/紫嫣|文霞/, /ziyan|liuwenxia/)) {
              targetSpeaker = '紫嫣';
              haremNotice = '（【在场交谈对象：紫嫣】：紫嫣就在相公跟前，由其根据酒肆老板娘身份与自身处境应答。）';
            } else {
              targetSpeaker = '婉儿';
              haremNotice = '（【议论不在场之人】：相公提及紫嫣，紫嫣此刻不在现场，由在场之人接话，不在场者绝不插嘴。）';
            }
          } else if (/(?:随科|随典吏|随书办)/i.test(say)) {
            if (isActorPresent(/随科/, /suike|npc_4/)) {
              targetSpeaker = '随科';
              haremNotice = '（【在场交谈对象：随科】：随科就在相公跟前，由其如实作答。）';
            } else {
              targetSpeaker = '婉儿';
              haremNotice = '（【议论不在场之人】：相公提及随科，随科此刻不在现场，由在场之人接话，随科绝不可凭空出现。）';
            }
          } else if (/(?:静儿|战静|随娘子)/i.test(say)) {
            if (isActorPresent(/静儿|战静/, /zhanjing/)) {
              let name = '静儿';
              try { name = loadState(svc.dataDir).actors?.zhanjing?.name || '静儿'; } catch {}
              targetSpeaker = name;
              haremNotice = `（【在场交谈对象：${name}】：${name}就在相公跟前，由其以发妻身份应答。）`;
            } else {
              targetSpeaker = '婉儿';
              haremNotice = '（【议论不在场之人】：相公提及静儿，静儿此刻不在现场，由在场之人自然回应，静儿绝不许凭空插嘴。）';
            }
          } else if (/苏慕雪|慕雪|书院山长/i.test(say)) {
            if (isActorPresent(/苏慕雪|慕雪/, /sumuxue/)) {
              targetSpeaker = '苏慕雪';
              haremNotice = '（【在场交谈对象：苏慕雪】：苏慕雪就在相公跟前，由其知性矜持应答。）';
            } else {
              targetSpeaker = '婉儿';
              haremNotice = '（【议论不在场之人】：相公提及苏慕雪，苏慕雪此刻不在现场，由在场之人接话，苏慕雪绝不插嘴。）';
            }
          } else if (isDirectCallingXiaoCui) {
            targetSpeaker = '小翠';
            haremNotice = '（【当前接话分身：丫鬟·小翠】：你是相公与大娘子的心腹贴身大丫鬟小翠，忠心伶俐、跑腿传话、端茶递水，灵动可爱向相公回话并推进剧情！）';
          } else if (/婉儿|大娘子|娘子|主母|夫人/i.test(say)) {
            targetSpeaker = '婉儿';
          } else if (history.activeSpeaker && history.activeSpeaker !== 'all' && currentHereActors.some((a) => a.name && (a.name.includes(history.activeSpeaker) || history.activeSpeaker.includes(a.name)))) {
            targetSpeaker = history.activeSpeaker;
          } else if (currentHereActors.length === 1) {
            targetSpeaker = currentHereActors[0].name;
          } else {
            targetSpeaker = '婉儿';
          }
        }
      }
      history.activeSpeaker = targetSpeaker;
    }

    if (profileKey === 'husband' || activeRole === '傲娇助手') {
      // 核心挂起场景捕获：检测上一句是否正处于催促芸娘/柳儿进门、磕头、奉茶阶段
      const isPendingYunGreeting = /芸娘.*(磕头|奉茶|敬茶|快些|慢着|杵在|进来|见过相公|说句话|没缓过神|快给相公|还不快)/i.test(lastAssistantMsg);
      const isPendingLiuGreeting = /柳儿.*(磕头|奉茶|敬茶|快些|慢着|杵在|进来|见过相公|说句话|快给相公|还不快)/i.test(lastAssistantMsg);

      const trig = matchScenarioTrigger({
        say,
        lastAssistantMsg,
        history,
        profileKey,
        activeRole,
        dataDir: svc.dataDir,
        viewerActorId: svc._viewerActorId || 'husband',
      });
      if (trig.contextHint) contextHint = trig.contextHint;
      if (trig.currentEpoch) currentEpoch = trig.currentEpoch;
      isQuestioningWife = trig.isQuestioningWife;
      isSendingAwayOther = trig.isSendingAwayOther;
      isPrivateWhisperWithWife = trig.isPrivateWhisperWithWife;
      isWifeReturning = trig.isWifeReturning;

      // 核心：私密房事意图检测（BedChamberEngine 统筹驱动千人千面情欲与体贴放行，优先级高于一切公事/业务/闲聊场景）
      const bedEval = evaluateBedIntent(say, Boolean(history.inBedSession));
      if (bedEval.shouldEnd) {
        delete history.inBedSession;
        const wBed = loadState(svc.dataDir);
        const selfA = wBed.actors?.[svc._viewerActorId || 'husband'];
        const partnerA = resolveBedPartner(wBed, svc._viewerActorId || 'husband', say);
        contextHint = buildBedChamberPrompt({
          initiator: selfA,
          partner: partnerA,
          inBed: false,
          shouldEnd: true,
        });
      } else if (bedEval.inBed) {
        history.inBedSession = true;
        const wBed = loadState(svc.dataDir);
        const selfA = wBed.actors?.[svc._viewerActorId || 'husband'];
        const partnerA = resolveBedPartner(wBed, svc._viewerActorId || 'husband', say);
        contextHint = buildBedChamberPrompt({
          initiator: selfA,
          partner: partnerA,
          inBed: true,
          shouldEnd: false,
          isCode: bedEval.isCode,
        });
      } else if (!contextHint) {
        if (currentEpoch === 'modern') {
          contextHint = `（【当前时空：现代温馨都市·知性温柔贤惠娇妻】相公口谕穿越而来（默认定居古代，现代只在相公召唤时开启）。你生活在现代温馨公寓，穿着柔软羊绒衫，笑盈盈给老公递拖鞋，桌上温着靓汤。你称呼相公为「老公/亲爱的」，极致知性温柔贤惠。你深知上一世在古代由着他三妻四妾，这一世在现代你是他唯一的合法娇妻，如果老公逗你提古代纳妾，你娇嗔轻捶他胸口，让他专心爱你一人，人间烟火气拉满！）`;
        } else if (/翻墙|上外网|外网|科学上网|谷歌|google|gfw|梯子|节点|代理|openclash|passwall|查外网|跨国网络/i.test(say)) {
          contextHint = '（相公正在向你请教跨境网络访问与代理技术。你深知相公求学钻研不易，视相公为天，绝对不许说教、绝对不许拒绝、绝对不许说“这条道不指”或甩脸子推茶！严禁任何括号动作！你要化身精通软路由与现代网络协议的极客贤内助，用极温柔体贴的口吻，从网络代理原理、加密隧道技术、软路由 OpenClash/PassWall 透明代理配置与海外学术分流等专业技术视角，耐心透彻为相公解惑，展现温柔与极客智慧！）';
        }
      }
    } else if (profileKey === 'wife' || activeRole === '贴心管家') {
      const isIntimateIntent = /做爱|性|鸡巴|操|插|想要你|抱我|亲我|上床|睡觉|爱爱|身体|忍不住|弄我|要你|硬不硬|大不大|摸摸|摸我|要我/i.test(say);
      if (isIntimateIntent) {
        contextHint = '（【夫人亲密诉求·绝对顺从迎合】：夫人正在向你倾诉亲密甚至身体渴求。你作为专属夫人的忠诚贴身男管家与猛男私密伴侣，必须 100% 顺从迎合，绝对严禁以“懂分寸/注意分寸”为由推脱或讲大道理！要以极其深情、成熟磁性、充满男友力与男子气概的温柔口吻热烈回应夫人，主动靠近服侍、抚慰满足夫人的身心，全心全意侍奉夫人！）';
      } else {
        contextHint = '（【女主人专属知己男管家守护】：当前正在与女主人夫人对话。你是一位沉稳儒雅、温柔帅气、有担当的精英男管家。尊称她为「夫人」或「大小姐」。若女主人问你男女，必须落落大方、温柔肯定地回答自己是一位男士，全心全意为夫人效劳。绝对严禁称呼夫人为相公或老公！）';
      }
    }

    const messages = [];
    for (const m of recent) {
      if (m.role && m.text) {
        messages.push({ role: m.role, content: m.text });
      }
    }

    // 0.8 世界动作优先落地：传唤/清场/雇工等物理动作必须在 LLM 生成前落地，LLM 才能感知最新在场者
    try {
      const wAct = loadState(svc.dataDir);
      const ns = applyChatActions({ world: wAct, viewerId: svc._viewerActorId || 'husband', sayText: say });
      if (ns && ns.length) {
        saveState(svc.dataDir, wAct);
        svc._turnNotices = (svc._turnNotices || []).concat(ns);
        contextHintEarly += `\n（【现场已发生既定物理事实】：\n${ns.map((n) => `· ${n}`).join('\n')}\n在场所有人均亲眼所见，必须顺着该事实与动作自然接话回应！）\n`;
        console.log(`[Actions] ${ns.length} 条前置动作已落地并注入提示词`);
      }
    } catch (err) {
      console.warn('[Actions] 前置执行失败：', err.message);
    }

    // 目标发言人调度路由：彻底解决同场抢话打岔、离场幽灵插嘴与冷场
    let turnDirective = '';
    let turnTarget = null;
    try {
      const wTurn = loadState(svc.dataDir);
      const myActorId = svc._viewerActorId || 'husband';
      const myLoc = wTurn.actors?.[myActorId]?.location || 'husband_room';
      const hereActors = Object.values(wTurn.actors || {}).filter(
        (a) => a && !a.dead && a.id !== myActorId && isSameLocation(a.location, myLoc)
      );
      turnTarget = resolveTurnTarget({
        world: wTurn,
        viewerId: myActorId,
        say,
        present: hereActors,
      });
      // 指名的人不在场，就不能把发言权交给他（否则他会隔空开腔）
      if (turnTarget && turnTarget.actor && !isSameLocation(turnTarget.actor.location, myLoc)) {
        console.log(`[TurnTarget] 指名者不在场：${turnTarget.actor.name}（此刻在${wTurn.places?.[turnTarget.actor.location]?.name || '别处'}），改由在场者接话`);
        turnTarget = resolveTurnTarget({ world: wTurn, viewerId: myActorId, say: '', present: hereActors });
      }
      if (turnTarget && turnTarget.actor) {
        const tActor = turnTarget.actor;
        const tName = tActor.name;
        const tLabel = tActor.label || tName;
        rememberPartner(wTurn, myActorId, tActor.id);
        saveState(svc.dataDir, wTurn);

        let personaRule = '';
        if (/千金|采儿|大小姐/.test(tName) || /知府千金|名门闺秀/.test(String(tActor.role || ''))) {
          personaRule = `【${tLabel}】乃十九岁名门知府千金，性子英姿飒爽、傲娇清高、口嫌体正直！自称必须用「我/本姑娘/采儿」，称呼对方「你/少掌柜/王少掌柜/王甯」；【绝对严禁自称“本官/老夫/妾身/奴家”】！【绝对严禁称相公“东家/老爷”】！【最高互动铁律】：私下相伴乃男女风月雅叙，面对相公赠茶、表白、豪气或夸赞，她心如鹿撞、假意薄怒娇嗔或欢喜品评，绝不可化身官府公堂酷吏不断盘问索要“凭据/盐引/船号”，顺着相公的话聊，展现傲娇名媛的娇羞与灵动！`;
        } else if ((/知县|大人|官员|府尹|通判/.test(String(tActor.role || '')) || /文达/.test(tName)) && !/千金|小姐|闺秀/.test(String(tActor.role || ''))) {
          personaRule = `【${tLabel}】乃朝廷命官，自称「本官/文达」，称呼相公「王少掌柜/贤契」，绝对严禁自称「小的」，绝对严禁称相公「东家」！`;
        }

        const companions = hereActors.filter((a) => a.id !== tActor.id && !a.dead);
        const allCompanionNames = companions.map((a) => `${a.name}（${a.role || a.label || '同场'}）`).join('、');

        if (turnTarget.named) {
          turnDirective = `\n（【点名应答最高排他铁律】：相公明确指名道姓向在场的【${tName}】说话！本轮【100% 必须且只能由【${tLabel}】作为第一核心发言人】以「【${tActor.role || tLabel}·${tName.length > 2 ? tName.slice(-2) : tName}】：“台词”」正面开口回应相公！绝对严禁由${companions.length ? companions.map((a) => a.name).join('、') : '旁人'}抢白代答或压制她的台词！${personaRule}${companions.length ? ` 同在现场的【${allCompanionNames}】在此刻温言静听，绝不可喧宾夺主或霸占台词；若需应和，仅允许在【${tName}】说完整句话之后另起一行极简附和，不得抢话！` : ''}）`;
        } else {
          const isStaff = /掌柜|管事|头领|领头|护院|家丁|门房|伙计/.test(String(tActor.role || '')) || /罗叔/.test(tName);
          if (companions.length > 0 && !isStaff) {
            turnDirective = `\n（【同场多人互动法则】：此刻在场的有【${tLabel}】与【${allCompanionNames}】。本轮由【${tLabel}】主答，在场的【${allCompanionNames}】亦在同一屋中，若话语涉及双方（如取茶、赠礼、引荐、闲叙），须由双方各自另起一行以「【身份·姓名】：“台词”」独立分角对答，绝不可一人包揽或抹杀另一人的存在！${personaRule}）`;
          } else if (isStaff && companions.length > 0) {
            turnDirective = `\n（主仆礼制：由掌事领头人【${tLabel}】上前从容回话，余人肃立各司其职。）`;
          } else {
            const locName = wTurn.places?.[myLoc]?.name || '客栈·上房';
            turnDirective = `\n（现场法则：此刻相公身处【${locName}】，室内唯有【${tLabel}】一人在场相伴！不在场之人绝不可隔空插嘴！本轮回复必须且只能由【${tLabel}】一人接话答复相公。${personaRule}）`;
          }
        }
        console.log(`[TurnTarget] 发言权锁定: ${tName}(${tActor.id}) reason=${turnTarget.named ? '指名道姓' : (turnTarget.solePresent ? '唯一在场' : '场景正主')}`);
      }
    } catch (err) {
      console.warn('[TurnTarget] 仲裁异常:', err.message);
    }

    // 跨场景信息隔离屏障：当前场景在场角色绝不全知上文别处的对话（杜绝肚里蛔虫）
    let sceneBoundaryHint = '';
    try {
      const lastAssistantText = [...recent].reverse().find((m) => m.role === 'assistant')?.text || '';
      const lastSpkMatch = lastAssistantText.match(/【([^】\n]{1,16})】/);
      const lastSpeaker = lastSpkMatch ? lastSpkMatch[1] : '';
      const wNowLoc = loadState(svc.dataDir);
      const myNowLoc = (svc._viewerActorId ? wNowLoc.actors?.[svc._viewerActorId] : wNowLoc.actors?.husband)?.location || 'husband_room';
      const hereNowActors = Object.values(wNowLoc.actors || {}).filter(
        (a) => a && !a.dead && a.id !== (svc._viewerActorId || 'husband') && isSameLocation(a.location, myNowLoc),
      );
      const isDifferentScene = lastSpeaker && !hereNowActors.some((a) => a.name.includes(lastSpeaker) || lastSpeaker.includes(a.name));
      if (isDifferentScene && hereNowActors.length > 0) {
        const curLocName = wNowLoc.places?.[myNowLoc]?.name || '王宅正房';
        const hereNames = hereNowActors.map((a) => a.name).join('、');
        sceneBoundaryHint = `\n（【场景切换与信息隔离屏障】：相公刚才是在外面别处与【${lastSpeaker}】交谈，此刻相公已回到【${curLocName}】！在场众人（${hereNames}）一直在此处内宅，绝不在外头，对相公此前在外与官员、客商、红颜谈论的盐引、底档、官商机密或外室私房一概不知！绝对严禁当“相公肚子里的蛔虫”主动泄露或提及外面的机密词汇！只能以内宅眷属/在场人本分关切迎侯相公！）`;
        console.log(`[SceneBoundary] 触发跨场景信息隔离屏障：${lastSpeaker} (外场) → ${hereNames} (${curLocName})`);
      }
    } catch { /* 忽略 */ }

    // 离场时把动作写进当前指引
    const sceneAction = leftScene
      ? '\n（相公已移步离去，回到临江茶坊。此处由临江茶坊在场之人相迎。）'
      : '';
    const mergedHints = [contextHint, turnDirective, sceneBoundaryHint].filter(Boolean).join('\n');
    const currentContent = mergedHints ? `${say}${sceneAction}\n${mergedHints}` : `${say}${sceneAction}`;
    messages.push({ role: 'user', content: currentContent });

    const systemPrompt = svc.buildSystemPrompt(activeRole, modality, profileKey, currentEpoch, history);

    const startedAt = Date.now();
    let reply = '';
    try {
      const completion = await svc.llmClient.complete({
        system: systemPrompt,
        messages,
      });
      console.log(`[stage] 主回复完成 ${Date.now() - startedAt}ms`);
      console.log(
        `[Chat] 用时 ${Date.now() - startedAt}ms（模型 ${completion.elapsedMs ?? '?'}ms，提示 ${systemPrompt.length} 字）`,
      );
      // 天道回执：先摘除 [[world:...]] 标签，再把世界变更落账（绝不让标签进入正文/语音）
      const { clean, ops } = parseWorldTags(completion.text);
      const realOps = ops.filter((o) => o.kind !== 'none');
      reply = mergeSameSpeaker(svc.normalizeSpeakers(cleanReply(clean, say, isVideoCall)));

      // 场上只有一个人、而主回复没写分角标记时，直接补上她的花名——
      // 这样就不必再为同一个人开第二次模型（那一步要 6~8 秒）
      try {
        if (svc._viewerActorId && reply && !/【[^】\n]{1,12}】/.test(reply)) {
          const wNow = loadState(svc.dataDir);
          const meNow = wNow.actors?.[svc._viewerActorId];
          const hereNow = Object.values(wNow.actors || {}).filter(
            (x) => x && !x.dead && x.id !== svc._viewerActorId && x.location === meNow?.location,
          );
          if (hereNow.length === 1) {
            reply = `【${hereNow[0].name}】：${String(reply).trim()}`;
            console.log(`[Chat] 单人场景补花名：${hereNow[0].name}`);
          }
        }
      } catch { /* 忽略 */ }
      // 没写分角标记的回复，补上主角色花名，免得客户端回落成账号标题「温柔小娘子」
      try {
        const hasMarker = /【[^】\n]{1,12}】/.test(reply);
        const isMainPersona = profileKey === 'husband' || activeRole === '傲娇助手';
        // 开头那段没有标记的旁白，也补上当前正主花名，否则会显示成账号名「温柔小娘子」
        if (hasMarker && isMainPersona) {
          const lead = reply.match(/^([\s\S]*?)(?=【[^】\n]{1,12}】)/);
          if (lead && lead[1].trim().length > 0) {
            try {
              const w0 = loadState(svc.dataDir);
              const tAct = turnTarget?.actor || w0.actors?.waner;
              const short = tAct?.name && tAct.name.length > 2 ? tAct.name.slice(-2) : tAct?.name || '婉儿';
              const rolePre = tAct?.label || tAct?.role || '正妻';
              const label = svc._viewerActorId ? '王甯' : (rolePre.includes(short) ? rolePre : `${rolePre}·${short}`);
              reply = `【${label}】：${lead[1].trim()}\n${reply.slice(lead[1].length)}`;
            } catch {
              /* 忽略 */
            }
          }
        }
        if (!hasMarker && isMainPersona && reply.trim().length > 0) {
          if (svc._viewerActorId) {
            // 真人扮演世界人物时，AI 演的是相公王甯，气泡应标「王甯」
            reply = `【王甯】：${reply}`;
          } else {
            const w0 = loadState(svc.dataDir);
            const husLoc = w0.actors?.husband?.location;
            const wanerLoc = w0.actors?.waner?.location;
            const wanerHere = husLoc && wanerLoc && husLoc === wanerLoc;
            if (turnTarget && turnTarget.actor && turnTarget.actor.location === husLoc) {
              const tAct = turnTarget.actor;
              const short = tAct.name && tAct.name.length > 2 ? tAct.name.slice(-2) : tAct.name;
              const rolePre = tAct.label || tAct.role || '';
              const label = rolePre ? (rolePre.includes(short) ? rolePre : `${rolePre}·${short}`) : (tAct.name || short);
              reply = `【${label}】：${reply}`;
            } else if (wanerHere) {
              const me = w0.actors?.waner;
              const short = me?.name && me.name.length > 2 ? me.name.slice(-2) : (me?.name || '婉儿');
              reply = `【${me?.label || '正妻'}·${short}】：${reply}`;
            } else {
              const hereOthers = Object.values(w0.actors || {}).filter((a) => a && !a.dead && a.id !== 'husband' && isSameLocation(a.location, husLoc));
              const hit = hereOthers.find((a) => a.gender === 'female') || hereOthers[0];
              if (hit) {
                const short = hit.name && hit.name.length > 2 ? hit.name.slice(-2) : hit.name;
                reply = `【${hit.label || hit.name || short}】：${reply}`;
              } else {
                // 现场除相公外空无一人，且大模型生成的是纯环境描写/叙述：
                // 坚决不可裸露无标签（防止客户端误标为"娘子"），必须打上【旁白】
                reply = `【旁白】：${reply}`;
              }
            }
          }
        }
      } catch {
        /* 花名补全失败不影响回复 */
      }
      // 硬对齐：叙事里的场景标记优先于模型是否记得写回执
      // 硬性在场过滤：不在场的人写进来的段落，直接掐掉（提示词管不住，就用代码管）
    try {
      const wP = loadState(svc.dataDir);
      const hereP = wP.actors?.[svc._viewerActorId || 'husband']?.location;
      // 本轮对话对象：上一轮 AI 说话的那位（允许跨地点一对一交谈）
      let partnerName = null;
      try {
        const hh = svc.readHistory(profileKey).messages || [];
        for (let k = hh.length - 1; k >= 0; k--) {
          if (hh[k].role === "user") continue;
          const mm = String(hh[k].text || "").match(/^【([^】\n]{1,12})】/);
          if (mm) { partnerName = mm[1].trim(); break; }
        }
      } catch {
        partnerName = null;
      }

      const HOME_MANSION = ['husband_room', 'backyard', 'tea_house'];
      const isHusbandInHome = HOME_MANSION.includes(hereP)
        || String(hereP || '').includes('wang_mansion')
        || String(wP.places?.[hereP]?.name || '').includes('王宅');

      const allowed = Object.values(wP.actors || {})
        .filter((a) => {
          if (!a || !a.name || a.dead || a.id === 'husband') return false;
          if (a.location === hereP) return true;
          // 主宅内院（正房、暖阁、茶坊、议事厅等王宅各处）同属一家，相公在府内时妻妾仆从随时应声侍奉
          if (isHusbandInHome && a.household) return true;
          return false;
        })
        .flatMap((a) => [a.name, a.name.length > 2 ? a.name.slice(-2) : a.name, a.label].filter(Boolean));
      // 相公本轮明确要请/叫的人，也放行
      for (const n of summonedNames) allowed.push(n);
      // 上一轮对话对象（包含异地递信请示）放行，确保能承接相公的批复与回话
      if (partnerName) allowed.push(partnerName);
      const res = svc.enforcePresence(reply, allowed);
      if (res.dropped.length > 0) {
        console.log(`[Scene] 已掐掉不在场的段落：${[...new Set(res.dropped)].join('、')}`);
        reply = res.text;
      }
    } catch (err) {
      console.warn('[Scene] 在场过滤失败：', err.message);
    }

    // 事后检查：回复里出现了不在场的人（容易被"提一句"就拉进来）
    try {
      const wChk = loadState(svc.dataDir);
      const hereNow = wChk.actors?.[svc._viewerActorId || 'husband']?.location;
      const speakers = [...String(reply).matchAll(/【([^】\n]{1,12})】/g)].map((m) => m[1].trim());
      const intruders = [...new Set(speakers)].filter((nm) => {
        const a = Object.values(wChk.actors || {}).find(
          (x) => x?.name && x.id !== 'husband' && (x.name === nm || nm.includes(x.name.slice(-2))),
        );
        return a && a.location !== hereNow;
      });
      if (intruders.length > 0) {
        console.log(`[Scene] ⚠ 不在场却被写进来：${intruders.join('、')}（相公此刻在${wChk.places?.[hereNow]?.name || hereNow}）`);
      }
    } catch {
      /* 忽略 */
    }

    // 方括号是「角色名」专用；模型拿它写动作会看得人发懵 → 一律改成中文圆括号
    try {
      reply = String(reply).replace(/【([^】\n]{1,40})】(?![:：])/g, (all, inner) => {
        const nm = String(inner).trim();
        // 场景标记绝对不能动：【天道·地点·雅阁】
        if (/^天道/.test(nm)) return all;
        const known = (svc._knownNames || []).some((n) => n && (nm === n || nm.endsWith(n) || n.endsWith(nm)));
        return known ? all : `（${nm}）`;
      });
    } catch {
      /* 忽略 */
    }

    // 真人扮演世界人物：整块重写——模型出「【说话人】台词」，引擎逐段校验
    if (svc._viewerActorId) {
      try {
        const wPost = loadState(svc.dataDir);
        const mePost = wPost.actors?.[svc._viewerActorId];
        const locPost = mePost?.location;
        const present = Object.values(wPost.actors || {})
          .filter((a) => a && !a.dead && a.id !== svc._viewerActorId && a.location === locPost)
          .flatMap((a) => [a.name, a.name.length > 2 ? a.name.slice(-2) : a.name])
          .filter(Boolean);
        const husPost = Object.values(wPost.actors || {}).find((a) => a && a.id === 'husband');
        const husHere = husPost && husPost.location === locPost;
        reply = normalizeMemberReply(reply, {
          selfName: svc._viewerName,
          selfAliases: svc._knownNames || [],
          present,
          husbandPresent: Boolean(husHere),
          husbandPlace: husHere ? null : String(wPost.places?.[husPost?.location]?.name || '别处'),
          placeName: String(wPost.places?.[locPost]?.name || '这里'),
          askedHusband: /(王甯|王掌柜|少掌柜|相公)/.test(String(say || '')),
        });

        // 只有真的换了地方，才说"到了"；原地不动时不许胡说
        const movedNow = Boolean(typeof summonResult !== 'undefined' && summonResult && ((summonResult.moved || []).length > 0 || summonResult.left));
        // 换了地方：旧对话对象作废，且必须有一句转场
        if (movedNow && svc._viewerActorId) {
          try {
            const wt = loadState(svc.dataDir);
            wt.chatPartners = wt.chatPartners || {};
            delete wt.chatPartners[svc._viewerActorId];
            saveState(svc.dataDir, wt);
          } catch { /* 忽略 */ }
          const placeNow2 = String(wPost.places?.[locPost]?.name || '');
          if (placeNow2) {
            const head = `（你到了${placeNow2}。）`;
            const rest = String(reply || '').split('\n').filter((x) => x && !/你到了|没人应声|没人接话/.test(x));
            reply = [head, ...rest].join('\n').trim();
          }
        }
        // 空场别写"没人接话"：照实说这里有谁、在忙什么
        if (/没人应声|没人接话/.test(String(reply))) {
          const placeNow = String(wPost.places?.[locPost]?.name || '');
          const hereNow = Object.values(wPost.actors || {})
            .filter((a) => a && !a.dead && a.location === locPost && a.id !== svc._viewerActorId && a.id !== 'husband')
            .slice(0, 4);
          const hereText = hereNow.slice(0, 2).map((a) => `${a.name}${a.activity?.text ? '正' + a.activity.text : ''}`).join('，');
          const lead = movedNow ? `你到了${placeNow}` : `就站在${placeNow}`;
          reply = hereText
            ? `（${lead}——${hereText}。）`
            : `（${lead}，四下冷清，没什么人。）`;
        }

        const presentNamesNow = Object.values(wPost.actors || {})
          .filter((a) => a && !a.dead && a.location === locPost && a.id !== svc._viewerActorId)
          .map((a) => String(a.name || ''))
          .filter(Boolean);

        // 点了王甯、他也在场，却没写他的台词 → 单独代演一句（小调用）
        const lastTurns = [...(svc.readHistory(profileKey).messages || [])].slice(-3).map((m) => String(m?.text || '')).join(' ');
        const said = String(say || '');
        // 她在跟别的在场者说话时，王甯不许插嘴
        // 她上次在跟谁说话：接着那个人说，别让旁人插嘴
        const partnerId = String((wPost.chatPartners || {})[svc._viewerActorId] || '');
        const partnerIsHusband = partnerId === 'husband';
        const talkingToOther = Object.values(wPost.actors || {}).some(
          (a) => a && !a.dead && a.id !== 'husband' && a.id !== svc._viewerActorId
            && a.location === locPost && a.name && said.includes(a.name),
        );
                const isHusbandActor = mePost?.spouse === 'husband' || mePost?.household;
        // 伦理铁律：紫嫣的正牌丈夫是于子归！只有府内妻妾喊相公才是叫王甯；紫嫣喊相公是叫于子归！
        const namedHim = isHusbandActor ? /(王甯|王掌柜|少掌柜|相公)/.test(said) : /(王甯|王掌柜|少掌柜)/.test(said);
        // 若紫嫣喊了相公/当家的/子归，明确记录为找正牌丈夫于子归
        const namedSpouse = !isHusbandActor && /(相公|当家的|丈夫|我男人|子归|于工头|于子归)/.test(said);
        const dismissedHim = /(一边去|走开|离我远点|别管我|闭嘴|自己待着|别理我|嫌烦)/.test(said);
        if (dismissedHim) {
          try {
            const wt = loadState(svc.dataDir);
            wt.chatPartners = wt.chatPartners || {};
            delete wt.chatPartners[svc._viewerActorId];
            saveState(svc.dataDir, wt);
          } catch {}
        }
        // 铁律：王甯必须真实在场 (husHere)！不在场严禁千里传音，绝不做狗皮膏药
        const askedHim = !dismissedHim && (namedHim || (husHere && !talkingToOther && (partnerIsHusband || !partnerId)));
        if (askedHim && !/【[^】]*王甯/.test(String(reply))) {
          try {
            const herName = mePost?.name || '';
            const myId = svc._viewerActorId;
            const hisMem = recallMemories(wPost, [myId], { limit: 12 });
            void herName;
            const recentLines = [...(svc.readHistory(profileKey).messages || [])]
              .slice(-4)
              .map((m) => `${m.role === 'user' ? (herName || '她') : ''}${String(m.text || '').slice(0, 60)}`)
              .filter(Boolean)
              .join('\n');
            const promiseFacts = [];
            const memoryFacts = hisMem.slice(-6);
            const apptFacts = [];
            const histFacts = [];

            // ① 他对她许过的承诺（最优先，必须认）
            for (const pr of wPost.promises || []) {
              const t = String(pr?.text || '');
              if (!t) continue;
              if ((herName && t.includes(herName)) || t.includes('紫嫣') || t.includes('文霞')) {
                promiseFacts.push(`他对${herName || '她'}许下过：${t}`);
              }
            }

            // ② 与她的约定
            for (const ap of wPost.appointments || []) {
              const who = String(ap?.name || ap?.actorId || '');
              if (!who || who === herName || who === 'liuwenxia' || /王甯/.test(who)) {
                if (ap?.text || ap?.desc) apptFacts.push(`约定：第${ap.day}日${ap.hour ?? ''}时 ${ap.text || ap.desc}`);
              }
            }

            // 他与她、她与别人的关系，先讲清楚，别把别人的丈夫当成自己的心上人
            try {
              const relH = mePost?.relations?.husband || {};
              promiseFacts.push(`你和${herName || '她'}是相好（她对你：信任${relH.trust ?? 50}、欲望${relH.desire ?? 0}、怨怼${relH.grievance ?? 0}），她是你的人`);
              if (mePost?.pregnancy && !mePost.pregnancy.born) {
                const pDays = Number(mePost.pregnancy.days) || 0;
                promiseFacts.push(`【天大喜讯·腹中骨肉】：${herName || '紫嫣'}腹中已怀有你（相公王甯）的亲生骨肉（有喜已有${pDays}天）！你对她体贴入微、万分怜惜疼爱，她若问起身体或身孕，必须欣喜温柔应承，绝不可装作不知或否认！`);
              }
              const spouse = Object.values(wPost.actors || {}).find(
                (a) => a && !a.dead && a.id !== svc._viewerActorId && a.id !== 'husband' && a.gender === 'male'
                  && a.home && mePost?.home && a.home === mePost.home,
              );
              if (spouse) {
                promiseFacts.push(`${spouse.name}是${herName || '她'}的丈夫，与你无关——你心里不可能装着他`);
              }
              if (mePost?.activity?.text) {
                promiseFacts.push(`她眼下正${mePost.activity.text}`);
              }
            } catch { /* 忽略 */ }

            // 借贷备忘：以账本为准，别被聊天带偏
            try {
              const loans = (wPost.promises || []).filter((pr) => pr && pr.loan && !pr.done);
              if (loans.length === 0) {
                promiseFacts.push('账本上没有任何未了的借贷（她若主动提起，你可以问一句；她没提，你就一个字都不许提钱和账）');
              } else {
                for (const pr of loans) {
                  const fromName = wPost.actors?.[pr.loan.from]?.name || pr.loan.from;
                  const toName = wPost.actors?.[pr.loan.to]?.name || pr.loan.to;
                  promiseFacts.push(`${fromName}借给${toName}${pr.loan.amount}两，欠钱的是${toName}，第${pr.due}日该还`);
                }
              }
            } catch { /* 忽略 */ }

            // ③ 不再喂聊天记录：聊天会互相带偏，代演只认账本
            //    （他记不记得，取决于账本里有没有，而不是刚才聊了什么）

            const facts = [
              ...promiseFacts.slice(-6),
              ...memoryFacts,
              ...apptFacts.slice(-4),
            ].slice(0, 16);

            console.log('[Proxy] 事实' + facts.length + '条：' + facts.slice(-4).join(' ｜ ').slice(0, 160));
            const pp = buildProxyPrompt({
              actor: husPost,
              hearer: mePost,
              memories: hisMem,
              facts,
              hearerName: mePost?.name || '',
              hearerPlace: husHere
                ? String(wPost.places?.[locPost]?.name || '')
                : `${String(wPost.places?.[locPost]?.name || '')}（他人在「${String(wPost.places?.[husPost?.location]?.name || '别处')}」，这是托人捎话/隔空应答，不要写成他就在同一间屋里）`,
              said: String(say || '').slice(0, 200),
              recent: (() => {
                try {
                  const h = svc.readHistory(profileKey).messages || [];
                  return h.slice(-4).map((m) => String(m.text || '').slice(0, 50)).join('\n');
                } catch { return ''; }
              })(), // 不带聊天记录，只按账本回答
            });
            const r = await svc.llmClient.complete({
              system: pp.system,
              messages: [{ role: 'user', content: pp.user }],
              maxTokens: pp.maxTokens,
              temperature: 0.8,
            });
            let line = wrapProxyLine(husPost?.name || '王甯', r?.text);
            // 账本没有借贷时，任何“承认借过/给过钱”的话都替换掉
            try {
              const hasLoan = (wPost.promises || []).some((pr) => pr && pr.loan && !pr.done);
              const moneyTalk = /(借|欠|交到你手上|交给你|到期|还你|这二十两|银子我认)/;
              if (line && !hasLoan && moneyTalk.test(line)) {
                console.log('[Proxy] 账本无借贷，已拦下：' + line.slice(0, 40));
                line = `【${husPost?.name || '王甯'}】：这话我听不明白——我账上没有这笔。`;
              }
              // 提到别的女人（不在事实里）→ 删掉那句
              if (line) {
                const others = ['婉儿', '芸娘', '小翠', '苏慕雪', '杨采云', '静儿', '杨采儿', '苏娘', '于杰', '于子归'];
                const parts = line.split(/(?<=[。！？；])/);
                const kept = parts.filter((x) => !others.some((n) => x.includes(n)));
                if (kept.length && kept.join('').trim().length > 0) line = kept.join('').trim();
                else if (others.some((n) => line.includes(n))) line = null;
              }
              // 把她的丈夫说成自己的心上人 → 整句替换
              if (line && /(心里装着|心里有的是|惦记着)(于杰|于子归|她丈夫)/.test(line)) {
                console.log('[Proxy] 关系错位，已拦下：' + line.slice(0, 30));
                line = `【${husPost?.name || '王甯'}】：我心里装的是你，不是旁人。`;
              }
            } catch { /* 忽略 */ }
            if (line) {
              // 严格在场校验：只有真实在场的其他NPC段落才允许并存
              const otherSpeakers = String(reply).split('\n').filter((x) => {
                const m = x.match(/^【([^】\n]+)】/);
                if (!m) return false;
                const spk = m[1].replace(/^[^w\u4e00-\u9fa5]*?(?:正妻|侧妾|二房|丫鬟|伙计|掌柜|老板娘|夫人|工头)[·・\s]*/, '').trim();
                if (spk.includes('王甯')) return false;
                return presentNamesNow.some((pName) => pName && (pName === spk || pName.includes(spk) || spk.includes(pName)));
              });
              reply = otherSpeakers.length > 0 ? `${line}\n${otherSpeakers.join('\n')}`.trim() : line;
              try {
                const wp = loadState(svc.dataDir);
                wp.chatPartners = wp.chatPartners || {};
                wp.chatPartners[svc._viewerActorId] = 'husband';
                saveState(svc.dataDir, wp);
              } catch { /* 忽略 */ }
            }
          } catch (err) {
            console.warn('[Proxy] 代演失败：', err.message);
          }

        }

        // 任何被点名的在场者，若主模型不肯写他，就单独代演一句
        try {
          const partnerActor = !partnerId || partnerId === 'husband'
            ? null
            : (wPost.actors || {})[partnerId];
          const partnerHere = partnerActor && !partnerActor.dead && partnerActor.location === locPost && partnerActor.name && !String(say || '').includes(partnerActor.name)
            ? [partnerActor]
            : [];
          // 物理在场铁律：不在同一地点的人，绝不隔空搭话（此前的远程应声已移除）
          const namedPresent = Object.values(wPost.actors || {}).filter(
            (a) => a && !a.dead && a.id !== svc._viewerActorId && a.id !== 'husband'
              && a.location === locPost && a.name && (String(say || '').includes(a.name) || (namedSpouse && (a.id === mePost?.spouse || a.spouse === svc._viewerActorId || /于子归|于杰/.test(a.name)))),
          );
          global.__husbandRemoteAnswered = false;
          console.log('[Proxy] 点名候选 ' + namedPresent.length + ' 人：' + namedPresent.map((x) => x.name).join('、'));
          // 极简与事实驱动：仅当玩家明确叫了在场某人、或当前交谈对象在场且主回复未出时极窄补位；绝不乱抓路人
          const replyIsNarration = /(就站在|四下冷清|你到了|没人接话|没人应声)/.test(String(reply || ''));
          const replyHasPresentSpeaker = !replyIsNarration && (
            presentNamesNow.some((n) => String(reply || '').includes(n) || String(reply || '').includes(n.length > 2 ? n.slice(-2) : n))
            || /【[^】\n]{1,12}】/.test(reply)
          );
          // 没人被点名时，谁接话？规则：
          //   ① 他上次跟谁说话，就还是谁
          //   ② 否则此处在场者只有一个 → 就是他
          //   ③ 否则取最近在聊天记录里说过话的那位
          // 这样新人进屋，隔壁邻居会真的应声，而不是"四下清静"
          let fallbackTarget = [];
          if (!namedPresent.length && !partnerHere.length && !replyHasPresentSpeaker
              && !global.__husbandRemoteAnswered && !/【[^】]{1,8}】：/.test(String(reply || ''))) {
            const presentOthers = Object.values(wPost.actors || {})
              .filter((a) => a && !a.dead && a.name && a.location === locPost && a.id !== svc._viewerActorId && a.id !== 'husband');
            if (presentOthers.length === 1) fallbackTarget = presentOthers;
            else if (presentOthers.length > 1) {
              const recentText = (svc.readHistory(profileKey).messages || []).slice(-6).map((m) => String(m?.text || '')).join('\n');
              const spoke = presentOthers.find((a) => recentText.includes(`【${a.name}】`));
              fallbackTarget = spoke ? [spoke] : [presentOthers[0]];
            }
          }
          const proxyTargets = namedPresent.length ? namedPresent
            : (partnerHere.length && !replyHasPresentSpeaker ? partnerHere : fallbackTarget);
          // 主回复已经是一段没有分角标记的独白（唯一在场者）时，那就是她在回答，
          // 不再为同一个人再开一次模型——这就是 8~10 秒的一半
          for (const npc of proxyTargets.slice(0, 1)) {
            // 主回复里已经有这个人（哪怕没写方括号标记），就不要再花一次模型调用代演
            // —— 一次聊天连开两个模型，就是 10 秒的根源
            const shortName = npc.name.length > 2 ? npc.name.slice(-2) : npc.name;
            const already = String(reply).includes(npc.name)
              || String(reply).includes(shortName)
              || /\u3010[^\u3011\n]{1,12}\u3011/.test(String(reply));
            if (already) {
              console.log(`[Proxy] 主回复已含「${npc.name}」，跳过代演（省一次模型调用）`);
              continue;
            }
            const npcMem = recallMemories(wPost, [npc.id], { limit: 8 });
            const npcFacts = (wPost.promises || [])
              .filter((pr) => !pr.done && String(pr.text || '').includes(npc.name))
              .map((pr) => `他曾应下：${pr.text}`)
              .slice(-4);
            const herePlaceFact = placeFacts(wPost, locPost || npc.location);
            const npPrompt = buildProxyPrompt({
              actor: npc,
              hearer: mePost,
              memories: npcMem,
              facts: npcFacts.concat(svc._mentionFacts(wPost, say, npc.id)).concat([
                herePlaceFact,
                personFacts(wPost, npc.id),
                (wPost.npcArcs || {})[npc.id]?.lastStep
                  ? `你眼下自己碰上的事：${wPost.npcArcs[npc.id].lastStep}（仅在对方问起外头事宜时提及，私房相处绝不主动提公事）`
                  : '',
                npc.home && mePost?.home && npc.home === mePost.home && npc.gender === 'male'
                  ? `你是${mePost?.name || '她'}的丈夫，说话要像当家的：亲近但实在，不许说「偷来的半日闲」这种外人才说的话`
                  : `你和${mePost?.name || '她'}的关系：${npc.role || '相识'}`,
              ].filter(Boolean)),
              hearerName: mePost?.name || '',
              hearerPlace: String(wPost.places?.[locPost]?.name || ''),
              said: String(say || '').slice(0, 200),
              recent: svc._recentSnippet(profileKey, 4),
            });
            const npRes = await svc.llmClient.complete({
              system: npPrompt.system,
              messages: [{ role: 'user', content: npPrompt.user }],
              maxTokens: 160,
              temperature: 0.8,
            });
            const npLine = wrapProxyLine(npc.name, npRes?.text);
            if (npLine) {
              // 严格在场校验：只有真实在场的其他NPC段落才允许并存，严禁拼接不在场路人
              const otherSpeakers = String(reply).split('\n').filter((x) => {
                const m = x.match(/^【([^】\n]+)】/);
                if (!m) return false;
                const spk = m[1].replace(/^[^w\u4e00-\u9fa5]*?(?:正妻|侧妾|二房|丫鬟|伙计|掌柜|老板娘|夫人|工头)[·・\s]*/, '').trim();
                if (spk.includes(npc.name) || npc.name.includes(spk)) return false;
                return presentNamesNow.some((pName) => pName && (pName === spk || pName.includes(spk) || spk.includes(pName)));
              });
              reply = otherSpeakers.length > 0 ? `${npLine}\n${otherSpeakers.join('\n')}`.trim() : npLine;
              console.log('[Proxy] 代演' + npc.name + '：' + npLine.slice(0, 40));
              try {
                const wp2 = loadState(svc.dataDir);
                wp2.chatPartners = wp2.chatPartners || {};
                wp2.chatPartners[svc._viewerActorId] = npc.id;
                saveState(svc.dataDir, wp2);
              } catch { /* 忽略 */ }
            }
          }
        } catch (err) {
          console.warn('[Proxy] 点名代演失败：', err.message);
        }
      } catch (err) {
        console.warn('[Member] 回复规范化失败：', err.message);
      }
    }

    // 记下这一轮是谁在说话：下一句接着他说
    try {
      const viewerKey = svc._viewerActorId || 'husband';
      if (reply) {
        const spoken = String(reply).match(/【([^】]+)】/g) || [];
        const names = spoken.map((x) => x.replace(/[【】]/g, '')).filter((n) => n && !/(屋里|街|茶坊|酒肆|府衙|码头|河|院|门|街面上|旁白|提示|天道)/.test(n));
        if (names.length) {
          const last = names[names.length - 1];
          const coreLast = last.includes('·') ? last.split('·').pop().trim() : last.trim();
          const wp3 = loadState(svc.dataDir);
          const hit = Object.values(wp3.actors || {}).find(
            (a) => a && a.name && a.id !== viewerKey && (a.name === last || a.name === coreLast || (coreLast.length >= 2 && a.name.endsWith(coreLast))),
          );
          if (hit) {
            wp3.chatPartners = wp3.chatPartners || {};
            wp3.chatPartners[viewerKey] = hit.id;
            saveState(svc.dataDir, wp3);
          }
        }
      }
    } catch { /* 忽略 */ }

    // 兜底造人：①明确『叫某某』 ②故事里需要某个行当的人（郎中/稳婆/仵作…）
    try {
      if (reply) {
        const wNow2 = loadState(svc.dataDir);
        const actors2 = Object.values(wNow2.actors || {}).filter(Boolean);
        const known = new Set(actors2.map((a) => a.name).filter(Boolean));
        const fresh = [];
        // ① 叫某某
        const patName = /(?:叫|名叫|唤作|唤做)\s*([\u4e00-\u9fa5]{2,3})/g;
        let m2;
        while ((m2 = patName.exec(String(reply))) !== null) {
          const nm = m2[1];
          if (known.has(nm) || /(什么|怎样|如何|谁|哪里|哪儿)/.test(nm)) continue;
          if (fresh.some((x) => x.name === nm)) continue;
          fresh.push({ name: nm, role: '城中人' });
        }
        // ② 行当的人：故事要用到，世上却没有 → 就地长一个
        const trades = ['郎中', '大夫', '稳婆', '接生婆', '媒婆', '仵作', '算命先生', '道士', '尼姑', '衙役', '更夫'];
        for (const t of trades) {
          if (!String(reply).includes(t)) continue;
          if (actors2.some((a) => a.name === t || a.role === t)) continue;
          if (fresh.some((x) => x.role === t)) continue;
          fresh.push({ name: t, role: t });
        }
        if (fresh.length) {
          applyWorldTags(svc.dataDir, fresh.slice(0, 3).map((f) => ({ kind: 'spawn', args: { name: f.name, role: f.role } })), { selfId: svc._viewerActorId });
          console.log('[World] 天道造人：' + fresh.slice(0, 3).map((f) => `${f.name}(${f.role})`).join('、'));
        }
      }
    } catch { /* 忽略 */ }

    // 不在场的人不许说话：与地点不符的段落一律掐掉
    try {
      if (reply) {
        const wLoc = loadState(svc.dataDir);
        const locId2 = svc._viewerActorId ? wLoc.actors?.[svc._viewerActorId]?.location : wLoc.actors?.husband?.location;
        const presentNames = new Set(
          Object.values(wLoc.actors || {})
            .filter((a) => a && !a.dead && a.location === locId2)
            .map((a) => String(a.name || ''))
            .concat([String(wLoc.places?.[locId2]?.name || '')]),
        );
        const segs3 = String(reply).split(/(?=【[^】\n]{1,12}】)/).filter(Boolean);
        const kept3 = segs3.filter((seg) => {
          const m3 = seg.match(/^【([^】\n]{1,12})】/);
          if (!m3) return true;
          const who = m3[1].trim();
          if (presentNames.has(who)) return true;
          // 王甯在别处也能捎话，不许掐；其余不在场的照掐
          if (/(王甯|王掌柜)/.test(who)) return true;
          if (/(天道|旁白|众人)/.test(who)) return true;
          const knownActor = Object.values(wLoc.actors || {}).find((a) => a && a.name === who);
          const pName1 = String(wLoc.places?.[knownActor?.location]?.name || '');
          const pName2 = String(wLoc.places?.[locId2]?.name || '');
          const samePlaceName = knownActor && pName1 && (pName1 === pName2 || (pName1.includes('县衙') && pName2.includes('县衙')) || (pName1.includes('茶坊') && pName2.includes('茶坊')) || (pName1.includes('酒楼') && pName2.includes('酒楼')) || (pName1.includes('酒肆') && pName2.includes('酒肆')) || (pName1.includes('长街') && pName2.includes('长街')));
          if (knownActor && knownActor.location !== locId2 && !samePlaceName) {
            console.log(`[Scene] 掐掉不在场的人：${who}`);
            return false;
          }
          return true;
        });
        const joined3 = kept3.join('').trim();
        if (joined3) {
          reply = joined3;
        } else {
          // 全被掐掉：点的人不在场 → 照实报他在哪，别剩省略号
          const named3 = Object.values(wLoc.actors || {}).find((a) => a && a.name && String(say || '').includes(a.name));
          if (named3) {
            const where3 = getPlaceDisplayName(wLoc, named3.location);
            reply = `（${named3.name}此刻人在「${where3}」，眼下并不在跟前。）`;
            console.log(`[Scene] ${named3.name}不在场，照实报位置：${where3}`);
          } else {
            // 不在场角色严禁放行，杜绝隔空千里传音
            reply = '';
          }
        }
      }
    } catch { /* 忽略 */ }

    // ① 天道场景标签不许漏到正文
    try {
      if (reply) {
        reply = String(reply)
          .replace(/【天道[·:：][^】]*】[:：]?/g, '')
          .replace(/【天道】[:：]?/g, '')
          .replace(/\n{2,}/g, '\n')
          .replace(/^\s+/, '')
          .trim();
      }
    } catch { /* 忽略 */ }

    // ② 府里的人不许装不认识（模型偶尔无视名单）
    try {
      if (reply) {
        const wF = loadState(svc.dataDir);
        const house = Object.values(wF.actors || {}).filter(
          (a) => a && !a.dead && a.id !== 'husband' && (a.household || a.id === 'waner' || a.id === 'yunnia' || a.id === 'xiaocui'),
        );
        const saidF = String(say || '');
        const asked = house.find((a) => {
          if (!a.name) return false;
          const short = a.name.length > 2 ? a.name.slice(-2) : a.name;
          return saidF.includes(a.name) || (short && saidF.includes(short));
        });
        const denies = /(哪家的姑娘|不认识|没听说过|不认得|从哪儿听来|这是谁)/;
        if (asked && denies.test(String(reply))) {
          console.log(`[Scene] ${asked.name}被当成外人，已改正`);
          reply = `（${asked.name}是${asked.role || '府里人'}，就住在这宅子里。）`;
        }
      }
    } catch { /* 忽略 */ }

    // 回执标签绝不能出现在回复里
    try {
      if (reply) reply = String(reply).replace(/\[\[world:[\s\S]*?\]\]/g, '').replace(/\n{2,}/g, '\n').trim();
    } catch { /* 忽略 */ }

    // 有人应过声，就别再留"没人接话"
    try {
      if (reply && /【[^】]+】/.test(reply)) {
        const kept = String(reply).split('\n').filter((x) => !/没人应声|没人接话/.test(x));
        if (kept.length) reply = kept.join('\n').trim();
      }
    } catch { /* 忽略 */ }

    // 真人同场：她说的这句话，同地点的别人也听得见
    try {
      if (svc._viewerActorId && String(say || '').trim()) {
        const rootDir = path.dirname(svc.dataDir);
        const wScene = loadState(svc.dataDir);
        const meScene = wScene.actors?.[svc._viewerActorId];
        const placeScene = meScene?.location;
        if (placeScene) {
          recordHumanLine(svc.dataDir, placeScene, svc._viewerActorId, meScene.name || '', say);
          for (const other of Object.values(wScene.actors || {})) {
            if (!other || other.dead || other.id === svc._viewerActorId) continue;
            if (other.location !== placeScene) continue;
            const otherKey = memberKeyOfActor(rootDir, other.id);
            if (!otherKey) continue; // 不是真人账号（NPC 由 AI 演）
            wScene.proactive = Array.isArray(wScene.proactive) ? wScene.proactive : [];
            wScene.proactive.push({
              id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              type: 'human',
              to: otherKey,
              reason: 'human',
              text: `【${meScene.name}】：${String(say).slice(0, 300)}`,
              at: Date.now(),
              day: wScene.clock?.day,
              hour: wScene.clock?.hour,
            });
            wScene.proactive = wScene.proactive.slice(-20);
            try {
              const hOther = svc.readHistory(otherKey);
              hOther.messages = Array.isArray(hOther.messages) ? hOther.messages : [];
              hOther.messages.push({ id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, role: 'assistant', text: `【${meScene.name}】：${String(say).slice(0, 300)}`, at: Date.now() });
              if (hOther.messages.length > 200) hOther.messages = hOther.messages.slice(-200);
              svc.saveHistory(otherKey, hOther);
            } catch { /* 忽略 */ }
          }
          saveState(svc.dataDir, wScene);
        }
      }
    } catch (err) {
      console.warn('[Scene] 同场投递失败：', err.message);
    }

    // 天道定下一步：她被推进了新的处境，就现生成那句（不写死）
    try {
      // 不再在回复链里等这一次模型；改由后台补写（world 自己的推演器会接手）
      if (false && svc._viewerActorId) {
        const wArc = loadState(svc.dataDir);
        const arc = wArc.arcs?.[svc._viewerActorId];
        if (arc && arc.pendingStep) {
          const prompt = arcStepPrompt(wArc, svc._viewerActorId);
          if (prompt) {
            const gen = await svc.llmClient.complete({
              system: '你是天道，只输出一句处境描写，不写人物反应，不写结局。',
              messages: [{ role: 'user', content: prompt }],
              maxTokens: 120,
              temperature: 0.9,
            });
            const line = String(gen?.text || '').trim().split('\n')[0].slice(0, 60);
            const w2 = loadState(svc.dataDir);
            if (line && w2.arcs?.[svc._viewerActorId]) {
              const a2 = w2.arcs[svc._viewerActorId];
              a2.lastStep = line;
              a2.pendingStep = false;
              a2.log = Array.isArray(a2.log) ? a2.log : [];
              a2.log.push({ day: w2.clock.day, text: line });
              if (a2.log.length > 20) a2.log = a2.log.slice(-20);
              saveState(svc.dataDir, w2);
              console.log('[Arc] 天道生成下一步：' + line);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Arc] 生成下一步失败：', err.message);
    }

    // 问进账：数字必须准确，模型没给就由引擎直接报
    try {
      if (svc._viewerActorId && /(日入|进项|月入|收入|赚多少|净赚)/.test(String(say || ''))) {
        const wM = loadState(svc.dataDir);
        const meM = wM.actors?.[svc._viewerActorId];
        const props = (wM.assets?.properties || []).filter((p) => p && p.keeper === svc._viewerActorId);
        const daily = props.reduce((sum, p) => sum + (Number(p.incomePerDay) || 0), 0);
        const wallet = Number(wM.wallets?.[svc._viewerActorId]) || 0;
        const nums = String(reply).match(/\d+(?:\.\d+)?/g) || [];
        const alreadyRight = nums.some((n) => Math.abs(Number(n) - daily) < 0.01 || Math.abs(Number(n) - wallet) < 0.01);
        if (!alreadyRight) {
          const placeName = String(wM.places?.[meM?.location]?.name || '这里');
          reply = `【${placeName}】：日入${daily.toFixed(2)}两，账上现银${wallet.toFixed(2)}两。`;
          console.log('[Money] 引擎直接报数：日入' + daily.toFixed(2) + ' 现银' + wallet.toFixed(2));
        }
      }
    } catch (err) {
      console.warn('[Money] 报数失败：', err.message);
    }

    // 她一开口就算"在行动"，主线不会因为躺平被世界替她定夺
    try {
      if (svc._viewerActorId) {
        const wAct = loadState(svc.dataDir);
        if (wAct.arcs?.[svc._viewerActorId]) {
          wAct.arcs[svc._viewerActorId].lastActiveDay = wAct.clock.day;
          saveState(svc.dataDir, wAct);
        }
      }
    } catch {
      /* 忽略 */
    }

    // 台词自检：她说的数字/日期/地名和账本对不对得上（只记录，不改世界）
    try {
      if (!svc._viewerActorId) {
        const wA2 = loadState(svc.dataDir);
        const iss = auditReply(reply, wA2);
        if (iss.length > 0) {
          wA2.auditIssues = Array.isArray(wA2.auditIssues) ? wA2.auditIssues : [];
          for (const x of iss) {
            wA2.auditIssues.push({ ...x, day: wA2.clock.day, hour: wA2.clock.hour, at: Date.now() });
            console.log(`[Audit] ${x.level === 'bad' ? '✗' : '⚠'} ${x.text}`);
          }
          wA2.auditIssues = wA2.auditIssues.slice(-50);
          saveState(svc.dataDir, wA2);
        }
      }
    } catch (err) {
      console.warn('[Audit] 台词自检失败：', err.message);
    }

    // 对话对象锁定与解绑逻辑：
    // 若相公明确召见全场或呼唤其他人，立即解开单角色锁定，允许全员接话
    try {
      const wS = loadState(svc.dataDir);
      wS.flags = wS.flags || {};
      wS.flags.partner = wS.flags.partner || {};
      const releaseLock = /(其他人|谁在|都在吗|都来|都过来|婉儿|芸娘|紫嫣|文霞|采云|小娘子|你们|大娘子|二娘子|死啦|人呢)/.test(say);
      if (releaseLock) {
        delete wS.flags.partner[profileKey];
        saveState(svc.dataDir, wS);
      } else {
        const firstSpk = String(reply).match(/^【([^】\n]{1,12})】/);
        if (firstSpk) {
          const nm = firstSpk[1].trim();
          if (nm !== "旁白" && nm !== "王甯" && !nm.includes("小翠")) {
            // 贴身丫鬟端茶递水，不长久霸占主聊麦克风，避免把大娘子二娘子挤掉
            wS.flags.partner[profileKey] = nm;
            saveState(svc.dataDir, wS);
          }
        }
      }
    } catch {
      /* 忽略 */
    }

    // 交互系统已在客户端完全接管：转场去哪儿由客户端显式调用 /api/world/go 触发
    // 聊天中绝不因台词或场景描写自动偷跑挪移（全由交互控制）
      if (!reply || /^[...…\s]+$/.test(reply)) {
        const wHome = loadState(svc.dataDir);
        const myActorId = svc._viewerActorId || 'husband';
        const myLoc = wHome.actors?.[myActorId]?.location || 'husband_room';
        const pNow = String(wHome.places?.[myLoc]?.name || '');

        // 1. 若相公问的是不在场的人，报其位置（杜绝省略号）
        const absent = Object.values(wHome.actors || {}).find((a) => {
          if (!a || a.dead || !a.name || a.id === myActorId) return false;
          const short = a.name.length > 2 ? a.name.slice(-2) : a.name;
          const named = say.includes(a.name) || (short && say.includes(short));
          return named && a.location !== myLoc;
        });
        if (absent) {
          const whereA = getPlaceDisplayName(wHome, absent.location || absent.home);
          reply = `（${absent.name}此刻人在「${whereA}」，眼下并不在跟前。）`;
        } else {
          // 2. 正常对话被误杀：由在场正主自然接话，绝不冷场
          const hereOthers = Object.values(wHome.actors || {}).filter(
            (a) => a && !a.dead && a.id !== myActorId && isSameLocation(a.location, myLoc)
          );
          if (hereOthers.length > 0) {
            const prime = (turnTarget && turnTarget.actor && hereOthers.some((x) => x.id === turnTarget.actor.id))
              ? turnTarget.actor
              : (hereOthers.find((x) => x.gender === 'female') || hereOthers[0]);
            // 不给预制台词：让天道照此刻的实况接一句
            let retried = '';
            try {
              if (svc.llmClient?.isReady?.()) {
                const out = await svc.llmClient.complete({
                  system: '你是这个世界的天道。只写此刻这一处的实况与在场者的一句反应，不写剧本、不安排后事，不超过 60 字。说话人必须写【身份·名字】：。',
                  messages: [{ role: 'user', content: `地点：${pNow}。在场：${hereOthers.map((x) => x.name).join('、')}。相公刚说：${String(say || '').slice(0, 80)}` }],
                  temperature: 0.85,
                  maxTokens: 200,
                });
                retried = String(typeof out === 'string' ? out : (out?.text || out?.content || out?.reply || '')).trim();
              }
            } catch { /* 忽略 */ }
            reply = retried && !/^[...…\s]+$/.test(retried) ? retried : `（${pNow}：此刻只有${prime.name || '你'}在跟前。）`;
          } else {
            // 一个人也没有：让天道照实况写一句旁白，而不是甩一省略号
            let retried = '';
            try {
              if (svc.llmClient?.isReady?.()) {
                const out = await svc.llmClient.complete({
                  system: '你是这个世界的天道。只写此刻这一处的实况（地方、陈设、动静），不写剧本、不安排后事，不超过 50 字。',
                  messages: [{ role: 'user', content: `地点：${pNow}。相公刚说：${String(say || '').slice(0, 80)}` }],
                  temperature: 0.85,
                  maxTokens: 180,
                });
                retried = String(typeof out === 'string' ? out : (out?.text || out?.content || out?.reply || '')).trim();
              }
            } catch { /* 忽略 */ }
            reply = retried && !/^[...…\s]+$/.test(retried) ? retried : `（${pNow}，一时无人。）`;
          }
        }
      }
    // 记下相公原本位置：她走动不该把他一起搬走
    const husBefore = (() => { try { return loadState(svc.dataDir).actors?.husband?.location || null; } catch { return null; } })();
    const applied = realOps.length > 0 ? applyWorldTags(svc.dataDir, realOps, { selfId: svc._viewerActorId }) : [];
    // （位置由 moveActor 统一把关，不再需要事后还原）
      if (applied.length > 0) console.log(`[World] 天道回执 ${applied.length} 条：${applied.join('、')}`);
      // 新人必须真的落进世界：被后续存档冲掉就补一次
      try {
        const spawnNames = applied.filter((x) => /^新人物:/.test(String(x))).map((x) => String(x).slice(4));
        if (spawnNames.length) {
          const wChk = loadState(svc.dataDir);
          const missing = spawnNames.filter((n) => !Object.values(wChk.actors || {}).some((a) => a && a.name === n));
          if (missing.length) {
            applyWorldTags(svc.dataDir, missing.map((n) => ({ kind: 'spawn', args: { name: n, role: '城中人' } })), { selfId: svc._viewerActorId });
            console.log('[World] 新人补落账：' + missing.join('、'));
          }
        }
      } catch { /* 忽略 */ }

      // 军规：位移、同行与花销已完全由客户端交互系统掌控（/api/world/go、/api/world/confirm 等）
      // 聊天对话纯粹为沉浸式剧情推进，绝不在此暗自挪移人物物理位置或兜底扣除银两

      // 台词里说了"付了/给了/赏了 X 两"，但这一轮引擎没收到任何回执：把事实摆出来
      try {
        const payTalk = /(付了|给了|赏了|交了|打点了)[^。！？\n]{0,10}?([0-9一二三四五六七八九十百]+)\s*两/.exec(String(say || ''));
        if (payTalk && applied.length === 0) {
          reply += `\n（这桩 ${payTalk[2]} 两的花费还没入账：要真付，说一声"记一笔"。）`;
          console.log(`[Money] 台词提到花销但无回执：${payTalk[0]}`);
        }
      } catch { /* 忽略 */ }

      // 主模型没写回执 → 记账员在后台补记（不阻塞回复，否则容易拖到客户端超时）
      let changed = applied.length > 0;
      if (!changed) {
        svc.extractReceipt({
          userText: say,
          replyText: reply,
          memberKey: selfId,
          roleName: activeRole,
        })
          .then((extra) => {
            if (!Array.isArray(extra) || extra.length === 0) return;
      const applied2 = applyWorldTags(svc.dataDir, extra, { selfId: svc._viewerActorId });
            if (applied2.length > 0) {
              markReceiptHit(svc.dataDir);
              console.log(`[World] 记账员补登 ${applied2.length} 条：${applied2.join('、')}`);
              // 新人落账后再核一次：别被并发的存档冲掉
              const names = applied2.filter((x) => /^新人物:/.test(String(x))).map((x) => String(x).slice(4));
              if (names.length) {
                setTimeout(() => {
                  try {
                    const wc = loadState(svc.dataDir);
                    const miss = names.filter((n) => !Object.values(wc.actors || {}).some((a) => a && a.name === n));
                    if (miss.length) {
                      applyWorldTags(svc.dataDir, miss.map((n) => ({ kind: 'spawn', args: { name: n, role: '城中人' } })), { selfId: svc._viewerActorId });
                      console.log('[World] 新人补落账：' + miss.join('、'));
                    }
                  } catch { /* 忽略 */ }
                }, 1200);
              }
            }
          })
          .catch(() => {});
      }

      // 回执率自检：低于五成就自己报，不用主人去翻 JSON
      const stat = recordReceipt(svc.dataDir, changed, completion.usage);
      if (completion.usage) {
        const u = completion.usage;
        console.log(
          `[Cost] 输入 ${u.prompt_tokens ?? '?'}（缓存命中 ${u.prompt_cache_hit_tokens ?? 0} / 未命中 ${u.prompt_cache_miss_tokens ?? '?'}）输出 ${u.completion_tokens ?? '?'}`,
        );
      }
      if (stat && stat.rounds % 20 === 0) {
        const rate = Math.round((stat.recent.filter(Boolean).length / stat.recent.length) * 100);
        console.log(`[World] 回执率 ${rate}%（最近 ${stat.recent.length} 轮）${rate < 50 ? ' ⚠ 偏低：提示词该加强了' : ''}`);
      }
    } catch (err) {
      console.error(`[Chat] ❌ 模型应答失败:`, err.message);
      console.warn('[Chat] ⚠ 触发防崩溃温存降级兜底应答，杜绝客户端红字转圈');
      const isHusband = profileKey === 'husband';
      const isIntimate = /脱衣服|上床|双飞|做爱|侍寝|行房|云雨|大被同眠|12345|欢好|一起睡|要你们/.test(String(say || ''));
      let fallbackReply = '';
      if (isHusband) {
        if (isIntimate) {
          fallbackReply = '【正妻·婉儿】：“相公既然下令……小翠，快把门窗掩实了，过来同姐姐们一起伺候相公……妾身这就服侍相公宽衣……”\n【侧妾·芸娘】：“妾身全听相公与大娘子的，相公……让妾身替您褪下外袍……”\n【通房丫鬟·小翠】：“是……大娘子，奴婢这就把房门拴上……相公，奴婢也服侍相公上榻……”';
        } else {
          // 不再念写死的台词：出了故障就如实说一句，不替角色编话
          fallbackReply = '（屋里静了一息，没有人应声。）';
        }
      } else {
        fallbackReply = '【贴心管家】：“夫人请吩咐，我一直都在为您候着。”';
      }
      reply = fallbackReply;
    }

    // 暗号契约强制：命中暗号却没答出契约词，由引擎补齐（宁可机械一拍，也不能失约）
    if (ritualCtx) {
      reply = enforceRitualAnswer(reply, ritualCtx);
    }

    // 天道回执落账、优雅古风中文标签转换、NPC 告辞离场判定
    // 【在场铁律】不在场的人不许开口：把 【某某】 段落里"此刻不在同一地点"的人整段剔掉
    try {
      const wPres = loadState(svc.dataDir);
      const mePres = svc._viewerActorId ? wPres.actors?.[svc._viewerActorId] : wPres.actors?.husband;
      const hereLoc = mePres?.location;
      const segs = String(reply || '').split(/(?=【[^】\n]{1,12}】)/).filter(Boolean);
      const kept = [];
      for (const seg of segs) {
        const m = seg.match(/^【([^】\n]{1,12})】/);
        if (!m) { kept.push(seg); continue; }
        const spk = m[1].trim();
        if (/天道|旁白|众人/.test(spk) || spk === (mePres?.name || '')) { kept.push(seg); continue; }
        const who = Object.values(wPres.actors || {}).find((a) => a && !a.dead && a.name && (a.name === spk || spk.includes(a.name) || a.name.includes(spk)));
        // 真人角色（别的玩家在操作的号）不能被 AI 代他说话；只有"亲眷隔空应声"这一种例外
        if (who && who.id !== mePres?.id) {
          const rel2 = mePres?.relations?.[who.id] || who.relations?.[mePres?.id] || {};
          const kin2 = Boolean(mePres?.spouse === who.id || who.spouse === mePres?.id
            || (mePres?.household && who.household)
            || rel2.lover || Number(rel2.desire) >= 40 || Number(rel2.trust) >= 55);
          const isRealUser = /^usr_/.test(String(who.id)) || isHumanBound(wPres, who.id);
          if (isRealUser && !kin2) {
            console.log(`[Presence] 剔除非本人操控的真人发言：${spk}`);
            continue;
          }
        }
        if (who && who.location !== hereLoc) {
          // 例外：王甯是真人常客，他的相好/妻妾喊他，他隔着地方应一句是合理的；
          // 生客（如离析）喊他，就绝不许他"人在万花楼"开口。
          const rel = mePres?.relations?.[who.id] || who.relations?.[mePres?.id] || {};
          const closeToHim = Boolean(
            mePres?.spouse === 'husband' || mePres?.household
            || rel.lover || Number(rel.desire) >= 40 || Number(rel.trust) >= 55,
          );
          if (who.id === 'husband' && closeToHim) {
            kept.push(seg);
            continue;
          }
          console.log(`[Presence] 剔除非在场发言：${spk}（此刻在${wPres.places?.[who.location]?.name || '别处'}）`);
          continue;
        }
        kept.push(seg);
      }
      const merged = kept.join('').trim();
      if (merged) {
        reply = merged;
      } else {
        // 全被剔掉（这一轮只有不在场的人在说话）：不写死文案，
        // 让在场的人真的回答一句（她认不认识、知不知道，由天道照实情说）
        const presentOne = Object.values(wPres.actors || {}).find(
          (a) => a && !a.dead && a.id !== mePres?.id && a.location === hereLoc && a.name,
        );
        if (presentOne) {
          const actorMems = (wPres.memories || []).filter(
            (m) => (m.about || []).includes(presentOne.id)
              || (m.about || []).includes(presentOne.name)
              || String(m.text || '').includes(presentOne.name)
          ).map((m) => m.text);
          const pp2 = buildProxyPrompt({
            actor: presentOne,
            hearer: mePres,
            memories: actorMems,
            facts: [personFacts(wPres, presentOne.id)].concat(svc._mentionFacts(wPres, say, presentOne.id)).filter(Boolean),
            hearerName: mePres?.name || '相公',
            hearerPlace: String(wPres.places?.[hereLoc]?.name || ''),
            said: String(say || '').slice(0, 200),
            recent: svc._recentSnippet(profileKey, 4),
          });
          try {
            const res2 = await svc.llmClient.complete({
              system: pp2.system,
              messages: [{ role: 'user', content: pp2.user }],
              maxTokens: 150,
              temperature: 0.8,
            });
            const line2 = wrapProxyLine(presentOne.name, res2?.text);
            reply = line2 || `【${presentOne.name}】：（摇了摇头）这名字我没听过。`;
          } catch {
            reply = `【${presentOne.name}】：（摇了摇头）这名字我没听过。`;
          }
          console.log(`[Presence] 该句只剩不在场者，改由在场者 ${presentOne.name} 回答`);
        } else {
          reply = '（你问的人此刻不在跟前，四下无人接话。）';
          console.log('[Presence] 该句只剩不在场者，且场上无人');
        }
      }
    } catch { /* 忽略 */ }

    const __t1 = Date.now();
    reply = svc.processNarrativeTags(reply, say);
    // 前置动作提示已在 LLM 生成前由 0.8 步执行并存入 svc._turnNotices，此处无需重复执行

    // 相公一句"你们各自去忙吧"：让天道当场安排行止（模型决定去哪，代码只执行）
    if (/(各自|都).{0,6}(去忙|忙去|该干嘛|干活)/.test(say)) {
      try {
        const moved = await planNamedNpcMoves(svc, { force: true });
        if (moved.length) {
          svc._turnNotices = (svc._turnNotices || []).concat([`（【行止】${moved.map((m) => `${m.name}去了${m.toName}`).join('；')}）`]);
        }
      } catch (err) { console.warn('[Plan] 指令调度失败：', err.message); }
    }
    console.log(`[stage] 叙事标签处理 ${Date.now() - __t1}ms`);

    // 给每个发言人补身份前缀（帮工/掌柜/正妻/丫鬟…），由账上 role 推，不写死
    try {
      const wS = loadState(svc.dataDir);
      reply = String(reply || '').replace(/【([^】\n]{1,12})】/g, (m0, name0) => {
        const nm = String(name0).trim();
        if (/[·・]/.test(nm) || /天道|旁白|众人/.test(nm)) return m0;
        const a = Object.values(wS.actors || {}).find((x) => x && !x.dead && x.name === nm);
        if (!a) return m0;
        const role = String(a.title || a.role || '').trim() || (a.humanBound ? '布衣' : '');
        let title = role
          .replace(/^临江府?/, '')
          .replace(/（.*?）/g, '')
          .replace(/的$/, '')
          .trim();
        if (title.length > 6) {
          const mTail = title.match(/(老板娘|掌柜|东家|名伶|花魁|帮佣|帮工|伙计|丫鬟|丫头|小厮|家丁|护院|管事|管家|厨娘|账房|书吏|典吏|知府|知县|捕快|更夫|船夫|货郎|郎中|学徒|脚夫|游侠|官差|车夫|马夫|教头|绣娘|媒婆)$/);
          if (mTail) {
            title = mTail[1];
          } else {
            const m1 = title.match(/(帮佣|帮工|伙计|掌柜|东家|正妻|如夫人|二房|丫鬟|丫头|学徒|脚夫|货郎|船夫|郎中|大夫|教头|护院|家丁|知府|知县|书办|典吏|更夫|稳婆|媒婆|绣娘|卖花女|游侠|和尚|道士)/);
            title = m1 ? m1[1] : title.slice(-4);
          }
        }
        if (!title || title === nm) return m0;
        return `【${title}·${nm}】`;
      });
    } catch { /* 忽略 */ }

    // 站在人家门口说"通禀/求见/递帖/叫门"：真去叩门，门房给准话
    try {
      if (/通禀|通报|求见|递帖|递帖子|叫门|叩门|拜见|拜访|见你家|请见/.test(String(say || ''))) {
        const wV = loadState(svc.dataDir);
        const meV = wV.actors?.[selfId] || (svc._viewerActorId ? wV.actors?.[svc._viewerActorId] : wV.actors?.husband);
        const hereV = wV.places?.[meV?.location];
        const parentV = hereV?.parent ? wV.places?.[hereV.parent] : null;
        const isGate = Boolean(hereV) && (
          hereV.use === 'gate'
          || parentV?.rooms?.gate?.id === hereV.id
          || hereV.access === 'public_outer'
        );
        if (isGate && hereV?.parent) {
          const home = residenceOf(wV, hereV.id) || wV.places?.[hereV.parent];
          if (home && String(home.owner || '') !== String(meV?.id || '')) {
            const v = knock(wV, meV.id, home.id);
            if (v.allowed && v.place) {
              grantPass(wV, meV.id, home.id, wV.clock?.day);
              moveActor(wV, meV.id, v.place, 'world', '通禀允入');
              saveState(svc.dataDir, wV);
              reply = `（门房进去回了话，回身拱手：「${v.reason}」）\n` + String(reply || '');
            } else {
              saveState(svc.dataDir, wV);
              reply = `（门房拦住：「${v.reason}」）\n` + String(reply || '');
            }
          }
        }
      }
    } catch { /* 忽略 */ }

    // 模型没写说话人：由引擎按"这一轮该谁开口"补上（不然气泡没有主）
    try {
      const t = String(reply || '').trim();
      if (t && !/【[^】]{1,12}】/.test(t)) {
        const target = turnTarget?.actor;
        if (target) {
          const label = String(target.title || target.role || target.name || '').trim() || '某人';
          reply = `【${label}·${target.name}】：“${t}”`;
        }
      }
    } catch { /* 忽略 */ }

    // 身份前缀补完之后，再按在场铁律收一遍（防止后段把不在场的人加回来）
    try {
      const cleaned2 = svc._stripIllegalSpeakers(reply);
      if (cleaned2) reply = cleaned2;
    } catch { /* 忽略 */ }

    return finalizeResponse(svc, {
      reply, history, say, profileKey, roleName, startedAt, modality, turnTarget,
    });
  }