import { matchScenarioTrigger } from './scenario-triggers.js';
import { buildEnvironmentHints } from './environment-hints.js';
import { enforcePresence, normalizeSpeakers, applyStatedIncome, compactMemories, extractReceipt } from './dialogue-postprocess.js';
import { finalizeResponse } from './finalize-response.js';
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
 * 对话上下文提示组装（诊脉/位置/产业/锁定对象/抹除/点名…，从 chat-flow 抽出）
 * 只读世界、只拼提示字符串，不写库。
 */
export function buildContextHints(svc, { say, recent, summonedNames, contextHint, profileKey }) {
    // 诊脉与身孕：把账本上的身子实情摆出来（发起人自己的身孕绝不可遗漏！）
    try {
      const wQ = loadState(svc.dataDir);
      const meQ = svc._viewerActorId ? wQ.actors?.[svc._viewerActorId] : wQ.actors?.husband;
      // 1. 如果发起人本人有孕（如紫嫣怀了相公的孩子），这是至高事实，无论是否专门提问都要让对话者知晓
      if (meQ && meQ.pregnancy && !meQ.pregnancy.born) {
        const pDays = Number(meQ.pregnancy.days) || 0;
        contextHint += `（【天大喜讯·腹中骨肉】${meQ.name}（玩家本人）腹中已确确凿凿怀有相公王甯的亲生骨肉，有喜已有 ${pDays} 天！这是铁打的既定事实，在场相公王甯与众人均完全知晓，必须万分怜惜温柔，绝不许说没有/不知道！）\n`;
      }
      if (/(诊脉|把脉|怀孕|有喜|喜脉|身子|身孕|怀上)/.test(String(say || ''))) {
        const hereQ = Object.values(wQ.actors || {}).filter(
          (a) => a && !a.dead && a.id !== 'husband'
            && (a.location === meQ?.location || a.household || a.id === svc._viewerActorId),
        );
        const preg = hereQ.filter((a) => a.pregnancy && !a.pregnancy.born);
        const askedWho = hereQ.find((a) => {
          if (!a.name) return false;
          const short = a.name.length > 2 ? a.name.slice(-2) : a.name;
          return String(say || '').includes(a.name) || String(say || '').includes(short);
        });
        if (askedWho && askedWho.pregnancy && !askedWho.pregnancy.born) {
          contextHint += `（【诊脉】${askedWho.name}确有身孕，已 ${askedWho.pregnancy.days || 0} 天。这是账本事实，不许说没有。）\n`;
        } else if (askedWho) {
          contextHint += `（【诊脉】${askedWho.name}没有身孕。这是账本事实，不许说有了。）\n`;
        } else if (preg.length) {
          contextHint += `（【诊脉】府里/身边有孕的：${preg.map((a) => `${a.name}（${a.pregnancy.days || 0} 天）`).join('、')}。这是账本事实。）\n`;
        } else {
          contextHint += '（【诊脉】府里眼下没有谁有身孕。这是账本事实，不许编一个有孕的。）\n';
        }
      }
    } catch { /* 忽略 */ }

    // 问"某人在哪"：直接给准确位置
    try {
      const mWhere = String(say || '').match(/([\u4e00-\u9fa5]{2,4})\s*(?:在哪儿|在哪|在何处|何处)/);
      if (mWhere) {
        const wW2 = loadState(svc.dataDir);
        const who = String(mWhere[1]);
        const hit = Object.values(wW2.actors || {}).find((a) => a && !a.dead && a.name && (a.name === who || a.name.includes(who) || who.includes(a.name)));
        if (hit) {
          const meLoc = wW2.actors?.[svc._viewerActorId || 'husband']?.location;
          if (hit.location && hit.location === meLoc) {
            contextHint += `（【位置】${hit.name}此刻就在你跟前这间屋里！就在眼前，必须直接迎面开口应声，绝不许说他在别处！）\n`;
          } else {
            const placeName2 = String(wW2.places?.[hit.location]?.name || '别处');
            contextHint += `（【位置】${hit.name}此刻在「${placeName2}」——问他在哪就照这个答，别说不知道。）\n`;
          }
        }
      }
    } catch {
      /* 忽略 */
    }

    // 她此刻所在：东家、掌柜、在场名单——压到最后，防止模型凭空造人
    try {
      if (svc._viewerActorId) {
        const wHere = loadState(svc.dataDir);
        const meA = wHere.actors?.[svc._viewerActorId];
        const locId = meA?.location;
        const locName = String(wHere.places?.[locId]?.name || '');
        const place = wHere.places?.[locId];
        const prop = (wHere.assets?.properties || []).find((p) => {
          const pn = String(p?.name || '');
          if (!pn || !locName) return false;
          return locName.includes(pn) || pn.includes(locName) || locName.includes(pn.slice(-3));
        });
        const ownerName = prop?.owner === 'husband' ? '王甯' : (wHere.actors?.[prop?.owner]?.name || '');
        const keeperName = wHere.actors?.[prop?.keeper]?.name || '';
        const hereNames = Object.values(wHere.actors || {})
          .filter((a) => a && !a.dead && a.id !== svc._viewerActorId && a.location === locId)
          .map((a) => `${a.name}（${a.role || '在场'}）`);
        const bits = [`你现在在「${locName || '未明'}」`];
        if (place?.owner === 'public') bits.push('这是公家地方，没有东家');
        else if (ownerName) bits.push(`这地方东家是「${ownerName}」`);
        if (keeperName) bits.push(`掌柜是「${keeperName}」`);
        bits.push(hereNames.length ? `此刻在跟前的只有：${hereNames.join('、')}` : '此刻跟前没有别人');
        const activePartnerId = String((wHere.chatPartners || {})[svc._viewerActorId] || '');
        const activePartner = (wHere.actors || {})[activePartnerId];
        if (activePartner && !activePartner.dead && activePartner.location === locId) {
          bits.push(`当前对话对象是「${activePartner.name}」——玩家正在与他当面对话，除非玩家明确叫了别人，否则必须由他继续接话，在场其他人切勿突兀插话打断沉浸感`);
        } else if (hereNames.length === 1) {
          bits.push('眼前只有这一人，自然由他开口应承');
        }
        const acts = Object.values(wHere.actors || {})
          .filter((a) => a && !a.dead && a.location === locId && a.id !== svc._viewerActorId && a.activity?.text)
          .map((a) => `${a.name}正在${a.activity.text}`)
          .slice(0, 4);
        if (acts.length) bits.push(`他们手头的事：${acts.join('；')}（他们说自己的话时，要跟他们正在做的事对得上）`);
        const hereIds = Object.values(wHere.actors || {})
          .filter((a) => a && !a.dead && a.location === locId && a.id !== svc._viewerActorId)
          .map((a) => a.id);
        const bondLines = describeBonds(wHere, hereIds);
        // 旧事：写进账本的永久记忆（亲密、承诺、翻脸）——别让它们随时间消失
        try {
          const olds = recallMemories(wHere, hereIds, { limit: 12 });
          if (olds.length) {
            bits.push(`你记得的旧事：${olds.join('；')}（提起来要照这些说，别说不记得）`);
            console.log(`[Memory] 旧事 ${olds.length} 条进上下文：${olds[0].slice(0, 24)}`);
          }
        } catch { /* 忽略 */ }
        const rumorLines = rumorsKnownBy(wHere, hereIds);
        if (rumorLines.length) {
          bits.push(`街上在传：${rumorLines.join('；')}（他们可能主动提起，也可能拿这个说事）`);
        }
        if (bondLines.length) {
          bits.push(`他们彼此：${bondLines.join('；')}（他们之间有自己的情分和恩怨，不只围着你转）`);
          console.log(`[Bonds] 在场关系 ${bondLines.length} 条：${bondLines.slice(0, 3).join('；')}`);
        }
        const own = Object.values(wHere.actors || {})
          .filter((a) => a && !a.dead && a.location === locId && a.id !== svc._viewerActorId)
          .map((a) => ({ name: a.name, step: (wHere.npcArcs || {})[a.id]?.lastStep }))
          .filter((x) => x.step)
          .slice(0, 4);
        if (own.length) {
          bits.push(`他们各自正碰上：${own.map((x) => `${x.name}——${x.step}`).join('；')}（他们说话时会带着这桩心事，别装作没事）`);
        }
        if (hereNames.length) bits.push('玩家点了谁的名字，就必须由那个人开口应声，不许沉默、不许换别人答');
        try {
          const rootDir2 = path.dirname(svc.dataDir);
          const humansHere = Object.values(wHere.actors || {})
            .filter((a) => a && !a.dead && a.id !== svc._viewerActorId && a.location === locId)
            .filter((a) => Boolean(memberKeyOfActor(rootDir2, a.id)))
            .map((a) => a.name);
          if (humansHere.length) {
            bits.push(`同一处的真人还有：${humansHere.join('、')}——他们的话由他们自己说，你不许替他们开口`);
          }
        } catch { /* 忽略 */ }
        const hus = Object.values(wHere.actors || {}).find((a) => a && a.id === 'husband');
        if (hus && hus.location !== locId) {
          const hp = String(wHere.places?.[hus.location]?.name || '别处');
          bits.push(`王甯此刻在「${hp}」，有人找他就照实说他在那儿`);
        }
        contextHint += `（【此间铁律】${bits.join('；')}。名单之外的人一律不在此处，**绝不许虚构管账先生、新来的伙计、小翠姐之类的人物或职位**；有人问掌柜/东家，就按这里写的答。**王甯就是王掌柜、这店东家、你的相好，不许说"不认识王甯""没这个人"**；他若不在跟前，只说他此刻不在这儿。）\n`;
        // 问钱就报账本上的数，省得它自己编
        if (/(进多少|日入|收入|赚多少|多少钱|几两)/.test(String(say || ''))) {
          const myProps = (wHere.assets?.properties || []).filter((p) => p && p.keeper === svc._viewerActorId);
          const daily = myProps.reduce((sum, p) => sum + (Number(p.incomePerDay) || 0), 0);
          const wallet = Number(wHere.wallets?.[svc._viewerActorId]) || 0;
          const detail = myProps.map((p) => `${p.name}${Number(p.incomePerDay) || 0}两`).join('、') || '名下没有产业';
          contextHint += `（【钱的准数】现银${wallet.toFixed(2)}两，日入${daily.toFixed(2)}两；${detail}。问钱就照这个答，不许自己编数。）\n`;
        }

      }
    } catch {
      /* 忽略 */
    }

    // 锁定本轮对话对象：上一轮 AI 是谁，就继续由它接话（除非相公明确点了别人）
    try {
      const wL = loadState(svc.dataDir);
      const locked = wL.flags?.partner?.[profileKey];
      if (locked && summonedNames.length === 0) {
        const mentionedOther = Object.values(wL.actors || {})
          .filter((a) => a?.name && a.name !== locked)
          .some((a) => say.includes(a.name) || (a.name.length > 2 && say.includes(a.name.slice(-2))));
        if (!mentionedOther) {
          contextHint += `（【继续对话】：本轮仍由「${locked}」接话，其他人一律不许插话、不许出场。）\n`;
        }
      }
    } catch {
      /* 忽略 */
    }

    // 被抹除过的人：凡问"以前的事"，只要账本里查不到，就必须否认（硬拦，不给模型编的机会）
    try {
      const wW = loadState(svc.dataDir);
      const whoName = wW.flags?.partner?.[profileKey];
      const who = Object.values(wW.actors || {}).find((x) => x?.name === whoName);
      const wiped = who?.wipedAt && (Number(wW.clock?.day) || 1) - Number(who.wipedAt) <= 30;
      const askPast = /(还记得|记不记得|记得吗|上次|那天|那一回|从前|当年|旧事)/.test(say);
      if (wiped && askPast) {
        const pool = [
          ...(wW.memories || []).map((m) => String(m.text || "")),
          ...(wW.quotes || []).map((q) => String(q.text || "")),
        ].join("|");
        const hasRecord = pool.includes(who.name);
        if (!hasRecord) {
          contextHint += `（【查无此事】：天机里没有任何「你和${who.name}的往事」记录。相公说的这件事是假的——她只能回"不记得/没这回事/相公认错了人"，**绝不许顺着编任何细节（银簪、雅阁、二百两都不许提）**。）\n`;
        }
      }
    } catch {
      /* 忽略 */
    }

    // 相公亲口说了「日入 N 两」，直接落账（这是事实，不该由模型猜）
    if (!svc._viewerActorId) {
      try {
        const ledger = svc.applyStatedIncome(say);
        if (ledger.length > 0) console.log(`[Ledger] 已落账：${ledger.join("、")}`);
      } catch {
        /* 忽略 */
      }
    }

    if (summonedNames.length > 0) {
      contextHint += `（【已到场】：${summonedNames.join('、')} 现在就在相公面前。本轮必须由她亲自开口应声（按分角格式写她的台词），你不许替她回答，也不许说她不在。若相公直接对她说"过来"，她必须应声上前。）\n`;
    }

    // 相公点名找谁，就由谁开口——绝不许别人抢答
    try {
      const wNamed = loadState(svc.dataDir);
      const named = Object.values(wNamed.actors || {})
        .filter((a) => a?.name && a.id !== 'husband' && a.kind !== 'human')
        .map((a) => ({ id: a.id, name: a.name, short: a.name.length > 2 ? a.name.slice(-2) : a.name }))
        .filter((x) => say.includes(x.name) || say.includes(x.short));
      if (named.length === 1) {
        contextHint += `（【点名】：相公这轮是去找「${named[0].name}」。**本轮只许她一个人开口**，其余角色一律不得出场、不得插话、不得替她接待。她若不在原地，要写出"她正从里头出来"这种自然过渡，不许让旁人代答。）\n`;
      }
    } catch {
      /* 忽略 */
    }
    const lastAssistantMsg = recent.filter(m => m.role === 'assistant').slice(-1)[0]?.text || '';
  return { contextHint, lastAssistantMsg };
}
