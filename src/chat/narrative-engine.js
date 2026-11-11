/**
 * 叙事标签执行引擎：转场、传唤、离场、好感、私密、因果律落账。
 * 从 pet-service.js 剥离提纯，保持单向数据流与单一职责。
 */

import fs from 'node:fs';
import { loadState, saveState } from '../world/state.js';
import { matchActor, isPlaceName, getPlaceDisplayName } from '../world/naming.js';
import { moveActor, isHumanBound } from '../world/position.js';
import { applySummon, applyNpcDeparture } from '../world/summon.js';
import { resolvePlaceTarget } from '../world/places-target.js';
import { sanePrice, priceHint } from '../world/pricing.js';
import { hireStaff } from '../world/employment.js';
import { proposeMarriage, acceptAlliance, declineAlliance } from '../world/marriage.js';
import { quellBandits } from '../world/bandits.js';
import { addMemory } from '../world/memory.js';
import { ensureProjectProperty } from '../world/projects.js';
import {
  parseSummonTarget, pickSummonActor,
  parseDismissIntent, isMassDismiss, homeRoomForName,
  parsePayTag, isActionHandledPay,
} from './intent-pipeline.js';

/**
 * 天道行止标签统一执行：[[go:谁|哪处]]
 * 返回替换后的文本与真的移动了谁；不跨城瞬移，不搬相公/真人绑定角色。
 */
export function applyGoTags(dataDir, text) {
  let out = String(text || '');
  const moved = [];
  const goMatches = [...out.matchAll(/\[\[go:\s*([^|\]]+?)\s*\|\s*([^\]]+?)\s*\]\]/g)];
  if (goMatches.length === 0) return { text: out, moved };
  const wGo = loadState(dataDir);
  for (const m of goMatches) {
    const rawTag = m[0];
    const whoRaw = String(m[1]).trim();
    const placeRaw = String(m[2]).trim();
    const actor = Object.values(wGo.actors || {}).find((a) => a && !a.dead
      && (a.id === whoRaw || a.name === whoRaw || (a.name && a.name.includes(whoRaw))));
    if (!actor) continue;
    if (actor.id === 'husband' || isHumanBound(actor)) { out = out.replace(rawTag, ''); continue; }
    const q = placeRaw.replace(/\s/g, '');
    let to = wGo.places?.[q] ? q : null;
    if (!to) to = Object.keys(wGo.places || {}).find((id) => wGo.places[id]?.name === q);
    if (!to) {
      const roots = [wGo.places?.[actor.home], wGo.places?.husband_room].filter(Boolean);
      for (const root of roots) {
        for (const [k, r] of Object.entries(root.rooms || {})) {
          if (!r?.id || !wGo.places[r.id]) continue;
          if (k === q || r.name === q || String(r.name || '').includes(q) || String(wGo.places[r.id].name || '').includes(q)) { to = r.id; break; }
        }
        if (to) break;
      }
    }
    if (!to) to = Object.keys(wGo.places || {}).find((id) => String(wGo.places[id]?.name || '').includes(q));
    if (!to) continue;
    const cityOf = (id) => String(wGo.places?.[id]?.name || '').split('·')[0];
    if (cityOf(actor.location) !== cityOf(to) && !String(wGo.places?.[to]?.name || '').includes('王宅')) continue;
    const r = moveActor(wGo, actor.id, to, 'world', '天道安排行止');
    if (r?.ok || actor.location === to) {
      const toName = wGo.places[to]?.name || q;
      actor.activity = { text: `去了${toName}`, at: wGo.clock?.hour || 0, day: wGo.clock?.day || 1 };
      out = out.replace(rawTag, `（【${actor.name}去了${toName}】）`);
      moved.push({ id: actor.id, name: actor.name, to, toName });
    }
  }
  saveState(dataDir, wGo);
  return { text: out, moved };
}

function formatDepartureNotice(names, destName = '', actorMap = {}) {
  const notices = names.map((n) => {
    const a = actorMap[n] || {};
    const r = String(a.role || '');
    if (/知府|千金|大小姐/.test(r) || /采儿/.test(n)) {
      return `（杨大小姐含笑示意，提灯乘车回府去了。）`;
    }
    if (/知县|县令|大人|官员/.test(r) || /文达/.test(n)) {
      return `（知县周大人拱手道别，下楼登轿回衙去了。）`;
    }
    if (/掌柜|老板娘/.test(r)) {
      return `（${n}盈盈一礼，回自家铺子打理去了。）`;
    }
    if (/家丁|护院|门房|小厮/.test(r)) {
      return `（${n}躬身应诺，自去前院当差看护。）`;
    }
    if (destName) {
      return `（${n}应声告退，去了${destName}。）`;
    }
    return `（${n}告辞离去。）`;
  });
  return notices.join('\n');
}

export function executeNarrativeTags({
  replyText,
  sayText = '',
  dataDir,
  viewerActorId = 'husband',
  lastSummonNotice = null,
} = {}) {
  let reply = String(replyText || '');
  let activeSummonNotice = lastSummonNotice;
    // 0. 好感/心境变动：[[world:relation ...]] 或 [[relation:谁|哪样|+-数]] ➔ 落账转古风中文展示
    try {
      const relMatches = [...reply.matchAll(/\[\[(?:world\s*:\s*)?relation(?:\s*who=([^\s\]]+)\s*field=([^\s\]]+)\s*delta=([+-]?\d+)|:\s*([^|\]]+?)\s*\|\s*([^|\]]+?)\s*\|\s*([+-]?\d+))[^\]]*\]\]/gi)];
      if (relMatches.length > 0) {
        const wRel = loadState(dataDir);
        let relChanged = false;
        for (const m of relMatches) {
          const rawTag = m[0];
          const whoRaw = m[1] || m[4];
          const fieldRaw = m[2] || m[5];
          const deltaRaw = Number(m[3] || m[6]) || 0;
          const who = matchActor(wRel.actors, whoRaw);
          const whoName = who?.name || whoRaw;
          let cnField = '好感';
          const sign = deltaRaw > 0 ? `+${deltaRaw}` : `${deltaRaw}`;
          if (fieldRaw === 'trust') cnField = '信任';
          else if (fieldRaw === 'desire') cnField = '情愫';
          else if (fieldRaw === 'grievance') cnField = '怨怼';
          else if (fieldRaw === 'fear') cnField = '敬畏';
          else cnField = String(fieldRaw);

          let mood = '好感渐增';
          if (deltaRaw < 0) {
            mood = fieldRaw === 'grievance' ? '释怀释怨' : '心生防备';
          } else {
            if (fieldRaw === 'desire') mood = '情愫暗生';
            else if (fieldRaw === 'grievance') mood = '心生芥蒂';
          }
          // 标签不是只改一句展示——关系账本要真的动
          if (who && deltaRaw) {
            const relKey = viewerActorId || 'husband';
            who.relations = who.relations || {};
            const mine = (who.relations[relKey] = who.relations[relKey] || { trust: 30, desire: 0, fear: 0, grievance: 0 });
            const fieldKey = ['trust', 'desire', 'grievance', 'fear'].includes(fieldRaw) ? fieldRaw : 'trust';
            mine[fieldKey] = Math.max(0, Math.min(100, Math.round(((Number(mine[fieldKey]) || 0) + deltaRaw) * 10) / 10));
            relChanged = true;
            console.log(`[RelationTag] ${who.name} ${fieldKey} ${sign} → ${mine[fieldKey]}`);
          }
          const cnTag = `\n（【${mood} · ${whoName}】${cnField} ${sign}）`;
          reply = reply.replace(rawTag, cnTag);
        }
        if (relChanged) saveState(dataDir, wRel);
      }
    } catch (err) {
      console.warn('[RelationTag] 转换失败：', err.message);
    }

    // 1. 习性变动：[[trait:谁|哪一样|+-数]] ➔ 落账并转为优雅古风中文展示
    try {
      const traitMatches = [...reply.matchAll(/\[\[trait:\s*([^|\]]+?)\s*\|\s*([^|\]]+?)\s*\|\s*([+-]?\d+)\s*\]\]/g)];
      if (traitMatches.length > 0) {
        const wTr = loadState(dataDir);
        for (const m of traitMatches) {
          const rawTag = m[0];
          const whoName = String(m[1]).trim();
          const key = String(m[2]).trim().slice(0, 30);
          const delta = Math.max(-20, Math.min(20, Number(m[3]) || 0));
          const who = matchActor(wTr.actors, whoName);
          if (who && delta) {
            who.traits = who.traits || {};
            who.traits[key] = Math.max(0, Math.min(100, Number(who.traits[key] || 50) + delta));
            wTr.notes = Array.isArray(wTr.notes) ? wTr.notes : [];
            const sign = delta > 0 ? `+${delta}` : `${delta}`;
            wTr.notes.push({ day: wTr.clock?.day, hour: wTr.clock?.hour, text: `${who.name}习性变化：${key} (${sign})` });
            console.log(`[Trait] ${who.name} ${key} ${sign} → ${who.traits[key]}`);
          }
          const sign = delta > 0 ? `+${delta}` : `${delta}`;
          const targetName = whoName || who?.name;
          const cnTag = `\n（【心性长进 · ${targetName}】${key} ${sign}）`;
          reply = reply.replace(rawTag, cnTag);
        }
        wTr.notes = (wTr.notes || []).slice(-40);
        saveState(dataDir, wTr);
      }
    } catch (err) {
      console.warn('[Trait] 处理失败：', err.message);
    }

    // 2. 差事记账：[[task:谁|办什么|几天]] ➔ 落账并转为中文
    try {
      const taskMatches = [...reply.matchAll(/\[\[task:\s*([^|\]]+?)\s*\|\s*([^|\]]+?)(?:\s*\|\s*([^\]]+?))?\s*\]\]/g)];
      if (taskMatches.length > 0) {
        const wT = loadState(dataDir);
        wT.tasks = Array.isArray(wT.tasks) ? wT.tasks : [];
        for (const m of taskMatches) {
          const rawTag = m[0];
          const whoName = String(m[1] || '').trim();
          const what = String(m[2] || '').trim().slice(0, 60);
          const days = Number(m[3]) || 3;
          const who = matchActor(wT.actors, whoName);
          if (who && what) {
            wT.tasks.push({
              id: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
              actorId: who.id,
              name: who.name,
              what,
              status: 'doing',
              startDay: wT.clock?.day || 1,
              dueDay: (wT.clock?.day || 1) + days,
              log: [],
            });
            console.log(`[Task] ${who.name} 领受差事：${what}`);

            // 领受差事只记账、只更新 activity；绝不在这里当场 moveActor。
            // 实测 bug：夜半把内眷从东厢挪到长街，下一轮"人不在场"会把她的回复全掐灭。
            // 真正动身交给日常作息/日程，或次日白天由交互转场自然驱动。
            who.activity = {
              text: `办差：${what.slice(0, 24)}`,
              at: wT.clock?.hour || 0,
              day: wT.clock?.day || 1,
            };
          }
          const targetName = who?.name || whoName;
          const cnTag = `\n（【领受差事 · ${targetName}】${what} · 限${days}日）`;
          reply = reply.replace(rawTag, cnTag);
        }
        saveState(dataDir, wT);
      }
    } catch (err) {
      console.warn('[Task] 处理失败：', err.message);
    }

    // 3. 差事进展：[[tasklog:片段|进展一句话]]
    try {
      const logMatches = [...reply.matchAll(/\[\[tasklog:\s*(.+?)\s*\|\s*([^\]]+?)\s*\]\]/g)];
      if (logMatches.length > 0) {
        const wL = loadState(dataDir);
        for (const m of logMatches) {
          const rawTag = m[0];
          const frag = String(m[1]).trim();
          const note = String(m[2]).trim().slice(0, 60);
          const t = (wL.tasks || []).find((x) => x && x.status === 'doing' && (String(x.what).includes(frag) || String(x.name) === frag));
          if (t) {
            t.log = Array.isArray(t.log) ? t.log : [];
            t.log.push({ day: wL.clock?.day || 1, hour: wL.clock?.hour || 0, text: note });
            wL.notes = Array.isArray(wL.notes) ? wL.notes : [];
            wL.notes.push({ day: wL.clock?.day, hour: wL.clock?.hour, text: `${t.name}办差：${note}` });
          }
          const cnTag = `\n（【差事进展】${note}）`;
          reply = reply.replace(rawTag, cnTag);
        }
        wL.notes = (wL.notes || []).slice(-40);
        saveState(dataDir, wL);
      }
    } catch (err) {
      console.warn('[TaskLog] 处理失败：', err.message);
    }

    // 4. 差事办完：[[taskdone:片段|结果]]
    try {
      const doneMatches = [...reply.matchAll(/\[\[taskdone:\s*(.+?)\s*\|\s*([^\]]+?)\s*\]\]/g)];
      if (doneMatches.length > 0) {
        const wD = loadState(dataDir);
        for (const m of doneMatches) {
          const rawTag = m[0];
          const frag = String(m[1]).trim();
          const result = String(m[2]).trim().slice(0, 60);
          const t = (wD.tasks || []).find((x) => x && x.status === 'doing' && (String(x.what).includes(frag) || String(x.name) === frag));
          if (t) {
            t.status = 'done';
            t.result = result;
            t.doneDay = wD.clock?.day || 1;
            wD.notes = Array.isArray(wD.notes) ? wD.notes : [];
            wD.notes.push({ day: wD.clock?.day, hour: wD.clock?.hour, text: `${t.name}办完了：${result}` });
            // 办完差事回铺/回家，不能把人扔在外头
            try {
              const actor = wD.actors?.[t.actorId];
              const back = actor?.home || actor?.quarters;
              if (actor && !actor.dead && back && wD.places?.[back] && actor.location !== back) {
                const mv = moveActor(wD, actor.id, back, 'world', '差事办完回铺');
                if (mv?.ok) reply += `\n【提示】${actor.name}办完差事，回${wD.places[back].name}去了。`;
              }
            } catch { /* 忽略 */ }
          }
          // 差事办完，顺带勾掉包含同一片段的旧诺（模型常忘了写 [[deal]]）
          if (frag.length >= 2) {
            for (const pr of wD.promises || []) {
              if (!pr || pr.done || pr.loan) continue;
              if (!String(pr.text || '').includes(frag)) continue;
              pr.done = true;
              pr.doneDay = wD.clock?.day || 1;
              pr.doneByTask = true;
            }
          }
          const cnTag = `\n（【差事了结】${result}）`;
          reply = reply.replace(rawTag, cnTag);
        }
        wD.notes = (wD.notes || []).slice(-40);
        saveState(dataDir, wD);
      }
    } catch (err) {
      console.warn('[TaskDone] 处理失败：', err.message);
    }

    // 5. 约定/承诺了结：[[deal:片段|成|不成]]
    try {
      const dealMatches = [...reply.matchAll(/\[\[deal:\s*(.+?)\s*\|\s*(成|不成)\s*\]\]/g)];
      if (dealMatches.length > 0) {
        const wDeal = loadState(dataDir);
        wDeal.notes = Array.isArray(wDeal.notes) ? wDeal.notes : [];
        for (const m of dealMatches) {
          const rawTag = m[0];
          const frag = String(m[1]).trim();
          const ok = m[2] === '成';
          const apIdx = (wDeal.appointments || []).findIndex((x) => x && (String(x.text || '').includes(frag) || String(x.name || '') === frag));
          if (apIdx >= 0) {
            const ap = wDeal.appointments[apIdx];
            wDeal.appointments.splice(apIdx, 1);
            wDeal.notes.push({ day: wDeal.clock?.day, hour: wDeal.clock?.hour, text: `与${ap.name || '人'}的约${ok ? '已了' : '没成'}` });
          }
          for (const pr of (wDeal.promises || [])) {
            if (!pr || pr.done) continue;
            if (!String(pr.text || '').includes(frag)) continue;
            if (ok) { pr.done = true; pr.settledBy = 'dm'; }
            else { pr.settled = 'failed'; pr.settledBy = 'dm'; }
            wDeal.notes.push({ day: wDeal.clock?.day, hour: wDeal.clock?.hour, text: `旧诺「${String(pr.text || '').slice(0, 14)}」${ok ? '办成了' : '没办成'}` });
            break;
          }
          const cnTag = `\n（【因果了结】${frag} · ${ok ? '办成' : '未成'}）`;
          reply = reply.replace(rawTag, cnTag);
        }
        wDeal.notes = wDeal.notes.slice(-40);
        saveState(dataDir, wDeal);
      }
    } catch (err) {
      console.warn('[Deal] 处理失败：', err.message);
    }

    // 5.5 天道安排行止：[[go:谁|哪处]] —— 内眷/仆从由大模型按心事、差事自行走动，不由钟点硬搬
    try {
      reply = applyGoTags(dataDir, reply).text;
    } catch (err) {
      console.warn('[Go] 行止处理失败：', err.message);
    }

    // 6. 新辟地名：[[build:地名|父地点]]
    try {
      const buildMatches = [...reply.matchAll(/\[\[build:\s*(.+?)(?:\s*\|\s*([^\]]+?))?\s*\]\]/g)];
      if (buildMatches.length > 0) {
        const wB = loadState(dataDir);
        const meB = viewerActorId ? wB.actors?.[viewerActorId] : wB.actors?.husband;
        const builtToday = Number(wB.flags?.buildDay || 0);
        let builtCount = builtToday === (wB.clock?.day || 1) ? (Number(wB.flags?.buildCount) || 0) : 0;
        const dynamicCount = Object.keys(wB.dynamicPlaces || {}).length;
        for (const m of buildMatches) {
          const rawTag = m[0];
          const rawName = String(m[1] || '').replace(/\s/g, '');
          const parentName = String(m[2] || '').trim();
          // 每天最多三处；全城动态地点三百处封顶，先复用再新造
          if (builtCount >= 3 || dynamicCount + builtCount >= 300) {
            reply = reply.replace(rawTag, '\n（【舆图已满】这处先不新辟，沿用现有地点。）');
            continue;
          }
          const verdict = isPlaceName(rawName);
          if (!verdict.ok) {
            reply = reply.replace(rawTag, '');
            continue;
          }
          const existingPlace = Object.entries(wB.places || {}).find(([, pl]) => pl
            && (pl.name === rawName || String(pl.name || '').endsWith(`·${rawName}`)));
          if (existingPlace) {
            reply = reply.replace(rawTag, `\n（【旧处】${existingPlace[1].name}）`);
            continue;
          }
          let parentId = null;
          if (parentName) {
            const hit = Object.entries(wB.places || {}).find(([, pl]) => pl && pl.name === parentName);
            parentId = hit ? hit[0] : (meB?.location || 'street');
          } else {
            parentId = meB?.location || 'street';
          }
          // 父地点里已有同类房间（后门/雅间/账房/暗室/地窖/耳房）就复用，绝不再造一个同名的
          const roomKey = ({ 后门: 'backdoor', 雅间: 'room', 账房: 'office', 暗室: 'secret', 地窖: 'cellar', 耳房: 'ear' })[rawName];
          const reusedRoom = roomKey ? wB.places?.[parentId]?.rooms?.[roomKey] : null;
          if (reusedRoom?.id && wB.places?.[reusedRoom.id]) {
            reply = reply.replace(rawTag, `\n（【旧处】${wB.places[reusedRoom.id].name || rawName}）`);
            continue;
          }
          wB.flags = wB.flags || {};
          wB.flags.placeSeq = (Number(wB.flags.placeSeq) || 0) + 1;
          const id = `place_${wB.flags.placeSeq}`;
          const pl = {
            id, name: rawName, exits: [parentId], dynamic: true,
            builtBy: 'dm', createdDay: wB.clock?.day || 1,
            desc: `天道在世设的一处：${rawName}`,
          };
          wB.places[id] = pl;
          wB.dynamicPlaces = wB.dynamicPlaces || {};
          wB.dynamicPlaces[id] = pl;
          wB.notes = Array.isArray(wB.notes) ? wB.notes : [];
          wB.notes.push({ day: wB.clock?.day, hour: wB.clock?.hour, text: `世上新添一处「${rawName}」` });
          builtCount += 1;
          wB.flags.buildDay = wB.clock?.day || 1;
          wB.flags.buildCount = builtCount;
          console.log(`[Build] 天道立了新地方：${rawName}`);
          const cnTag = `\n（【新辟舆图】${rawName}）`;
          reply = reply.replace(rawTag, cnTag);
        }
        wB.notes = (wB.notes || []).slice(-40);
        saveState(dataDir, wB);
      }
    } catch (err) {
      console.warn('[Build] 处理失败：', err.message);
    }

    // 7. 约定指派地点：[[place:约定片段|地点名]]
    try {
      const placeMatches = [...reply.matchAll(/\[\[place:\s*(.+?)\s*\|\s*([^\]]+?)\s*\]\]/g)];
      if (placeMatches.length > 0) {
        const wPlace = loadState(dataDir);
        for (const m of placeMatches) {
          const rawTag = m[0];
          const frag = String(m[1]).trim();
          const placeName = String(m[2]).trim();
          const hit = Object.entries(wPlace.places || {}).find(([, pl]) => pl && String(pl.name) === placeName);
          if (hit) {
            const apt = (wPlace.appointments || []).find((x) => x && (String(x.text || '').includes(frag) || String(x.name || '') === frag));
            if (apt) {
              apt.place = hit[0];
              wPlace.notes = Array.isArray(wPlace.notes) ? wPlace.notes : [];
              wPlace.notes.push({ day: wPlace.clock?.day, hour: wPlace.clock?.hour, text: `与${apt.name || '人'}的约定在「${placeName}」` });
            }
          }
          const cnTag = `\n（【约定地点】${placeName}）`;
          reply = reply.replace(rawTag, cnTag);
        }
        wPlace.notes = (wPlace.notes || []).slice(-40);
        saveState(dataDir, wPlace);
      }
    } catch (err) {
      console.warn('[Place] 处理失败：', err.message);
    }

    // 7.2 暗号约定：[[signal:谁|暗号|地点]] —— 说了暗号，引擎真的知道该叫谁来
    try {
      const signalMatches = [...reply.matchAll(/\[\[signal:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*([^\]]+?)\s*\]\]/g)];
      if (signalMatches.length > 0) {
        const wS = loadState(dataDir);
        for (const m of signalMatches) {
          const rawTag = m[0];
          const who = String(m[1]).trim();
          const code = String(m[2]).trim();
          const placeName = String(m[3]).trim();
          const hitActor = Object.values(wS.actors || {}).find((a) => a && (a.name === who || a.id === who));
          const hitPlace = Object.entries(wS.places || {}).find(([id, p]) => p && (p.name === placeName
            || String(p.name || '').endsWith(`·${placeName}`)
            || String(p.name || '').includes(placeName) || id === placeName));
          if (!hitActor || !hitPlace || !code) {
            reply = reply.replace(rawTag, '');
            continue;
          }
          wS.flags = wS.flags || {};
          wS.signals = Array.isArray(wS.signals) ? wS.signals : [];
          const dup = wS.signals.find((s) => s && s.active !== false
            && s.actorId === hitActor.id && s.signal === code && s.placeId === hitPlace[0]);
          if (!dup) {
            wS.flags.signalSeq = (Number(wS.flags.signalSeq) || 0) + 1;
            wS.signals.push({
              id: `sig_${wS.flags.signalSeq}`,
              actorId: hitActor.id,
              actorName: hitActor.name,
              signal: code,
              placeId: hitPlace[0],
              placeName: hitPlace[1].name,
              day: wS.clock?.day || 1,
              active: true,
            });
            wS.notes = Array.isArray(wS.notes) ? wS.notes : [];
            wS.notes.push({ day: wS.clock?.day, hour: wS.clock?.hour, text: `与${hitActor.name}约暗号「${code}」于${hitPlace[1].name}` });
          }
          reply = reply.replace(rawTag, `\n（【暗号约定】${hitActor.name}：${code}，在${hitPlace[1].name}）`);
        }
        wS.signals = (wS.signals || []).slice(-40);
        wS.notes = (wS.notes || []).slice(-40);
        saveState(dataDir, wS);
      }
    } catch (err) {
      console.warn('[Signal] 处理失败：', err.message);
    }

    // 军规：严禁在此粗暴正则偷听文字挂待付款，付款必须由 App 客户端交互或模型显式 [[pay:...]] 触发

    // 7.9 募兵/买军械：说了也要确认——挂待办单，等 App 点确认才真的花钱招人
    try {
      const milTag = reply.match(/\[\[(?:recruit|military):([^\]]+)\]\]/);
      if (milTag) {
        const body3 = String(milTag[1] || '').split('|').map((x) => x.trim());
        const kindMap = { 家丁: 'guard', 护院: 'retainer', 营兵: 'army', 兵: 'guard' };
        let recruitKind = 'guard';
        let countRaw = body3[0];
        if (kindMap[body3[0]]) { recruitKind = kindMap[body3[0]]; countRaw = body3[1]; }
        const count = Math.max(1, Math.min(500, Math.round(Number(countRaw) || 0) || 10));
        const wMil = loadState(dataDir);
        const meMil = viewerActorId ? wMil.actors?.[viewerActorId] : wMil.actors?.husband;
        const fMil = wMil.factions?.wangjia;
        const town = (Array.isArray(fMil?.cities) && fMil.cities[0]) || '临江府';
        const costRecruit = count * 12;
        const grainRecruit = Math.round(count * 0.5 * 10) / 10;
        wMil.pendingAction = {
          kind: 'military',
          id: `pend_mil_${Date.now()}`,
          title: '招募',
          action: 'call',
          recruitKind,
          qty: count,
          city: town,
          options: [{ key: `募兵${count}`, label: `募兵 ${count} 人（耗粮 ${grainRecruit} 石）`, price: costRecruit }],
          by: meMil?.id || 'husband',
          askedDay: wMil.clock?.day || 1,
          askedHour: wMil.clock?.hour || 0,
        };
        saveState(dataDir, wMil);
        console.log(`[Mil] 天道报募兵：${count} 人，${costRecruit} 两，待确认`);
        reply = reply.replace(/\[\[(?:recruit|military):[^\]]+\]\]/g, '').trim();
      }
    } catch { /* 忽略 */ }

    // 7.95 买军械：[[gear:兵器|20]]
    try {
      const gearTag = reply.match(/\[\[gear:([^\]]+)\]\]/);
      if (gearTag) {
        const parts = String(gearTag[1] || '').split('|').map((x) => x.trim());
        const kindMap = { 兵器: 'weapon', 甲: 'armor', 铠甲: 'armor', 马: 'horse', 战马: 'horse', 攻城器械: 'siege', 器械: 'siege' };
        const kind = kindMap[parts[0]] || 'weapon';
        const qty = Math.max(1, Math.min(500, Math.round(Number(parts[1]) || 0) || 10));
        const priceMap = { weapon: 3, armor: 5, horse: 20, siege: 300 };
        const nameMap = { weapon: '兵器', armor: '铠甲', horse: '战马', siege: '攻城器械' };
        const wG = loadState(dataDir);
        const meG = viewerActorId ? wG.actors?.[viewerActorId] : wG.actors?.husband;
        wG.pendingAction = {
          kind: 'military',
          id: `pend_gear_${Date.now()}`,
          title: '军械',
          action: 'gear',
          gearKind: kind,
          qty,
          options: [{ key: `${nameMap[kind]}${qty}`, label: `买${nameMap[kind]} ${qty} 件`, price: qty * priceMap[kind] }],
          by: meG?.id || 'husband',
          askedDay: wG.clock?.day || 1,
          askedHour: wG.clock?.hour || 0,
        };
        saveState(dataDir, wG);
        console.log(`[Mil] 天道报军械：${nameMap[kind]} ${qty}，待确认`);
        reply = reply.replace(/\[\[gear:[^\]]+\]\]/g, '').trim();
      }
    } catch { /* 忽略 */ }

    // 7.7 带兵出征：[[quell:匪名|人数]] —— 说了就真打，结果写回正文
    try {
      const quellTag = reply.match(/\[\[quell:([^\]]+)\]\]/);
      if (quellTag) {
        const parts = String(quellTag[1] || '').split('|').map((x) => x.trim());
        const want = parts[0] || '';
        const troops = Math.max(1, Math.round(Number(parts[1]) || 20));
        const wQ = loadState(dataDir);
        const list = Object.values(wQ.bandits || {});
        const hit = list.find((b) => b && (b.name === want || b.name.includes(want) || String(b.leader || '') === want))
          || list[0];
        if (hit) {
          const fQ = wQ.factions?.wangjia;
          const fromCity = Object.keys(fQ?.stationed || {})[0] || hit.homeCity;
          const r = quellBandits(wQ, hit.id, troops, fromCity);
          saveState(dataDir, wQ);
          if (r && r.ok) {
            reply = String(reply || '').replace(/\[\[quell:[^\]]+\]\]/g, '').trim();
            reply += `\n（${r.win ? '大获全胜' : '受挫'}：${r.text}）`;
            console.log(`[Quell] ${hit.name} → ${r.win ? '剿平' : '失败'}`);
          } else {
            reply = String(reply || '').replace(/\[\[quell:[^\]]+\]\]/g, '').trim();
            reply += `\n（${r?.error || '未能出征'}）`;
          }
        }
      }
    } catch (e) {
      console.warn('[Quell] 出征失败：', e.message);
    }

    // 8. 待付款声明：[[pay:标题|选项=价|选项=价]] 挂待付款，正文剥离
    let createdPendingId = null;
    try {
      const payTag = reply.match(/\[\[pay:([^\]]+)\]\]/);
      if (payTag) {
        // 纯解析见 chat/intent-pipeline.js
        const { title: title2, options: opts2 } = parsePayTag(payTag[1]);
        if (opts2.length > 0) {
          // 引擎动作已经管的名目（开房/买米/走货/赌/打点）：付款标签作废，免重复扣钱
          const handledByAction = isActionHandledPay(title2, sayText);
          if (handledByAction) {
            for (const o of opts2) { o.price = 0; o.skip = true; }
            console.log(`[Pay] 「${title2}」由动作入口结算，报价标签作废`);
          }
          // 报价夹回人间：房钱、饭钱这类，天道随口报多大都要收回来
          const clampKey = (label) => {
            const s2 = String(label || '');
            if (/房|宿|住/.test(s2)) return 'inn_room';
            // 日用杂货先认，别被"菜/油"这种大类吞掉
            if (/盐/.test(s2)) return 'salt';
            if (/酱油|酱/.test(s2)) return 'sauce';
            if (/醋/.test(s2)) return 'vinegar';
            if (/油/.test(s2)) return 'oil';
            if (/布|绸|缎/.test(s2)) return 'cloth';
            if (/针线|针|线/.test(s2)) return 'needlework';
            if (/炭/.test(s2)) return 'charcoal';
            if (/柴|薪/.test(s2)) return 'firewood';
            if (/肉/.test(s2)) return 'meat';
            if (/蛋/.test(s2)) return 'egg';
            if (/糖/.test(s2)) return 'sugar';
            if (/药/.test(s2)) return 'medicine';
            if (/青菜|蔬菜|白菜|萝卜|瓜/.test(s2)) return 'vegetable';
            if (/饭|菜|食/.test(s2)) return 'meal';
            if (/酒/.test(s2)) return 'wine';
            if (/马/.test(s2)) return 'horse';
            if (/刀|箭|兵器/.test(s2)) return 'weapon';
            if (/甲/.test(s2)) return 'armor';
            if (/宅|院/.test(s2)) return 'mansion';
            if (/铺|店|楼/.test(s2)) return 'shop';
            return null;
          };
          // 通用大类归一键：同类实业在同一天内只认最高总预算，一律只补差额，绝对严禁重复扣整笔
          const canonicalGroupKey = (t) => {
            const s = String(t || '').replace(/\s/g, '');
            if (/船|舟|舶|漕运/.test(s)) return 'group_ship_fleet';
            if (/兵工|军械|铁匠|兵器|火器/.test(s)) return 'group_armory';
            if (/窑|瓷|陶|砖瓦/.test(s)) return 'group_kiln';
            if (/镖局|车马|脚行|驿/.test(s)) return 'group_logistics';
            if (/马场|矿|田庄|茶山/.test(s)) return 'group_resource';
            if (/钱庄|票号|当铺/.test(s)) return 'group_finance';
            const isProjectAction = /开张|盘铺|置办|开业|装修|盘店|新店|开间|设立|筹建|新开/.test(s);
            const isIndustryFeature = /厂|所|局|坊|庄|场|行|号|肆|铺|店|楼|阁|坞|院|馆|栈|仓/.test(s);
            if (!isProjectAction && !isIndustryFeature) return null;
            const clean = s.replace(/^(?:置办|购置|盘下|打制|开办|采买|兴建|设立|筹建|新开|开一[家座个条间]|建一[家座个条间]|立一[家座个条间])/, '')
                           .replace(/(?:开张|盘铺|开业|装修|盘店|新店|开间|买船|造船|打船|设厂|开厂)$/, '')
                           .trim();
            return clean.length >= 2 ? clean : s.slice(0, 10);
          };
          const projectKey = canonicalGroupKey(title2);
          const payDay = String(loadState(dataDir)?.clock?.day || 1);

          for (const o of opts2) {
            if (o.skip) continue;
            const labelAll = `${o.label} ${title2}`;
            // 房租/半年付/年付这类是"分期"，不能拿整间铺子的市价下限去夹它
            const isTerm = /租|付|月|季|半年|年|押/.test(labelAll) || opts2.length > 1;
            if (isTerm) {
              o.price = Math.max(0.01, Math.min(5000, Number(o.price) || 0));
            } else {
              const k = clampKey(labelAll);
              if (k) o.price = sanePrice(k, o.price);
            }
          }
          const wPay = loadState(dataDir);
          const mePay = viewerActorId ? wPay.actors?.[viewerActorId] : wPay.actors?.husband;
          const first = (opts2 || []).find((o) => Number(o.price) > 0 && !o.skip) || (opts2 || [])[0];
          const quoted = first?.skip ? 0 : (Number(first?.price) || 0);

          // 判定相公是否属于打探/询价/商议调整阶段（提需求、改方案、询价均严禁擅自直接扣银子！）
          const sayClean = String(sayText || '').trim();
          const isInquiringOrNegotiating = /(多少钱|什么价|什么价格|贵不贵|能值多少|市价|几何|算算|合算吗|开价|怎么卖|多少银子|估摸|约多少|要多少|探探|问问|也搞一条|也要一条|也要|换成|改改|太小了|太大了|不够|再添|再加|商量|合计|看看)/.test(sayClean);
          const isExplicitPurchase = /(买了|买下|定下|准了|成交|就照这个办|支银子|给钱|掏钱|拿下|办了吧|办起来|就按这个定|拍板了|就这么定了|定了|买吧|要了|取银子|付了|给银子|就买|定这条|出银子|立下|开办|置办|做吧)/.test(sayClean);

          // 核心风控：大额开销（>5两）且相公在商议调整或未明确拍板时，绝不擅自扣钱！挂入待定夺单
          if (quoted > 5 && (isInquiringOrNegotiating || !isExplicitPurchase)) {
            createdPendingId = `pend_pay_${Date.now()}`;
            wPay.pendingAction = {
              kind: 'pay',
              id: createdPendingId,
              title: title2,
              options: opts2,
              by: mePay?.id || 'husband',
              askedDay: wPay.clock?.day || 1,
              askedHour: wPay.clock?.hour || 0,
            };
            saveState(dataDir, wPay);
            reply += `\n（【商议报价】${title2}市价约需银 ${quoted.toFixed(2)} 两，公账银两未动，待相公定夺拍板。）`;
            console.log(`[Pay] 相公商议中尚未拍板，挂入待定夺单：${title2}（${quoted} 两）`);
          } else {
            // 即刻落账：相公明确拍板购买，或市井小额零花（<=5两）
            try {
              // 真人角色已有这个名字：不能拿钱把人家买成 NPC，直接不扣
              const humanName = Object.values(wPay.actors || {}).find((a) => a && a.name
                && isHumanBound(wPay, a.id) && String(title2 || '').includes(String(a.name)));
              const blockedHuman = Boolean(humanName && /头牌|安家|雇|请|工钱|月钱|聘/.test(String(title2 || '')));
              if (blockedHuman) {
                reply += `\n（「${humanName.name}」是真人角色，不能雇作 NPC；这笔安家银未扣，请另取艺名。）`;
                console.log(`[Pay] 真人重名拦截：${humanName.name}`);
              } else if (quoted > 0) {
                // 同一大类同一天：按"最高总预算覆盖制"只补差额，坚决杜绝重复叠加扣款
                let price = quoted;
                if (projectKey) {
                  wPay.flags = wPay.flags || {};
                  wPay.flags.projectPay = wPay.flags.projectPay || {};
                  const pk = `${payDay}:${projectKey}`;

                  // 从当天 ledger 中穿透统计该大类已扣金额（防止内存丢失导致的重复扣）
                  const matchLedgerRe = projectKey === 'group_ship_fleet' ? /船|舟|舶|漕运/
                    : (projectKey === 'group_armory' ? /兵工|军械|铁匠|兵器/
                    : (projectKey === 'group_kiln' ? /窑|瓷|陶|砖瓦/
                    : new RegExp(projectKey)));
                  const ledgerAlreadyPaid = (wPay.ledger || [])
                    .filter((e) => e && Number(e.day) === Number(payDay) && Number(e.delta) < 0
                      && matchLedgerRe.test(String(e.title || '')))
                    .reduce((s, e) => s + Math.abs(Number(e.delta) || 0), 0);

                  const recordedPaid = Number(wPay.flags.projectPay[pk]?.paid) || 0;
                  const currentTotalPaid = Math.max(recordedPaid, ledgerAlreadyPaid);

                  if (currentTotalPaid >= quoted) {
                    // 今日已付金额已经覆盖当前报价：完全免扣！
                    price = 0;
                  } else {
                    // 仅补差额！
                    price = Math.max(0, Math.round((quoted - currentTotalPaid) * 100) / 100);
                  }

                  wPay.flags.projectPay[pk] = {
                    paid: Math.max(currentTotalPaid, quoted),
                    title: String(title2).slice(0, 30),
                    day: payDay,
                  };

                  const keys = Object.keys(wPay.flags.projectPay);
                  if (keys.length > 60) {
                    for (const k of keys.slice(0, keys.length - 60)) delete wPay.flags.projectPay[k];
                  }
                  // 付了开张/置办钱，产业总览里必须真有一间（按最高总预算落地）
                  try { ensureProjectProperty(wPay, projectKey.startsWith('group_') ? title2 : projectKey, Math.max(currentTotalPaid, quoted), { day: wPay.clock?.day, title: title2 }); } catch { /* 忽略 */ }
                }

                const silverNow = Number(wPay.assets?.silver) || 0;
                if (price <= 0) {
                  saveState(dataDir, wPay);
                  reply += `\n（【账簿核销】${String(title2 || '这桩开销').slice(0, 16)}预算已包含在今日已付银两中，不再重复扣款。）`;
                  console.log(`[Pay] ${title2} 差额为0，跳过重复扣款（当前最高预算 ${quoted}）`);
                } else if (silverNow >= price) {
                  wPay.assets.silver = Math.round((silverNow - price) * 100) / 100;
                  wPay.ledger = Array.isArray(wPay.ledger) ? wPay.ledger : [];
                  wPay.ledger.push({
                    day: wPay.clock?.day || 1, hour: wPay.clock?.hour || 0,
                    delta: -price,
                    title: String(title2 || '花销').slice(0, 24),
                    by: mePay?.id || 'husband',
                    balance: wPay.assets.silver,
                  });
                  saveState(dataDir, wPay);
                  const note = price < quoted ? `（补足差额至 ${quoted.toFixed(2)} 两）` : '';
                  reply += `\n【提示】已付 ${price.toFixed(2)} 两${note}：${String(title2 || '花销').slice(0, 16)}。余 ${wPay.assets.silver.toFixed(2)} 两。`;
                  console.log(`[Pay] 即付 ${price} 两${note}：${title2}`);
                } else {
                  reply += `\n（要 ${price.toFixed(2)} 两，手头只有 ${silverNow.toFixed(2)} 两，这桩先记着。）`;
                }
              }
            } catch (err) { console.warn('[Pay] 即付失败：', err.message); }
            // 已即付，不再挂待付单（弹窗不再出现）
            delete wPay.pendingAction;
            saveState(dataDir, wPay);
            console.log(`[Pay] 天道落账：${title2}，共 ${opts2.length} 项选项`);
          }
        }
        reply = reply.replace(/\[\[pay:[^\]]+\]\]/g, '').trim();
      }
    } catch (err) {
      console.warn('[Pay] 处理失败：', err.message);
    }

    // 8.7 相公说"请进/叫她进来"：门口的人这才算被叫进来（当日请帖）
    try {
      if (/请进|进来吧|叫她进来|叫他进来|让她进来|让他进来|领进来|带进来/.test(String(sayText || ''))) {
        const wI = loadState(dataDir);
        const meI = wI.actors?.[viewerActorId || 'husband'] || wI.actors?.husband;
        const myPlace = wI.places?.[meI?.location];
        const home = myPlace ? (homeOf(wI, myPlace) || wI.places?.husband_room) : wI.places?.husband_room;
        if (home) {
          const gateId = home.rooms?.gate?.id;
          const guests = Object.values(wI.actors || {}).filter(
            (a) => a && !a.dead && a.id !== meI?.id && a.location === gateId,
          );
          if (guests.length) {
            const names = [];
            for (const g of guests.slice(0, 3)) {
              giveInvite(wI, g.id, home.id);
              if (meI?.location) moveActor(wI, g.id, meI.location, 'world', '主人请进');
              names.push(g.name);
            }
            saveState(dataDir, wI);
            reply = String(reply || '') + `\n（门房让开，${names.join('、')} 被请了进来。）`;
            console.log(`[Gate] 相公请进：${names.join('、')}`);
          }
        }
      }
    } catch (err) { console.warn('[Gate] 请进失败：', err.message); }

    // 8.8 相公说"清人/都出去/外人出去"：后宅当场清场（不靠谁去传话）
    try {
      if (/清人|清场|都出去|外人出去|打发出去|赶出去|闲杂人等都|不许闲人/.test(String(sayText || ''))) {
        const wE = loadState(dataDir);
        const n = evictOutsiders(wE);
        if (n > 0) {
          saveState(dataDir, wE);
          reply = String(reply || '') + `\n（府里把 ${n} 个闲杂人请了出去，后宅清静了。）`;
          console.log(`[Gate] 相公下令清人，清出 ${n} 人`);
        }
      }
    } catch (err) { console.warn('[Gate] 清人失败：', err.message); }

    // 8.78 相处涨交情：这轮与谁说了话、送了礼，就对谁涨信任（每城通用）
    try {
      const wR = loadState(dataDir);
      const meR0 = wR.actors?.[viewerActorId || 'husband'] || wR.actors?.husband;
      const speakers = [...String(reply || '').matchAll(/【([^】]{1,12})】/g)].map((m) => m[1]);
      const touched = new Set();
      for (const spk of speakers) {
        const nm = spk.includes('·') ? spk.split('·').pop().trim() : spk;
        if (!nm || nm === '旁白' || nm === meR0?.name) continue;
        const a = Object.values(wR.actors || {}).find((x) => x && !x.dead && x.name === nm && x.location === meR0?.location);
        if (!a) continue;
        touched.add(a.id);
      }
      // 点名的礼：给/赏/送 某人 X两
      const gifts = [];
      const mg = /(?:给|赏|送)[^。]{0,6}?([\u4e00-\u9fa5]{2,4})[^。]{0,4}?([一二三四五六七八九十两\d]+)\s*两/.exec(String(sayText || ''));
      const cnNum = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
      if (mg) {
        const who = Object.values(wR.actors || {}).find((x) => x && !x.dead && x.name === mg[1]);
        const rawN = mg[2].replace(/两/g, '');
        const amt = /^\d+$/.test(rawN) ? Number(rawN) : (cnNum[rawN] || 1);
        if (who && amt > 0) gifts.push({ who, amt });
      }
      let changed = false;
      const intimate = /(?:亲吻|吻|拥抱|抱住|搂|依偎|侍寝|宽衣|解衣|同床|云雨|行房|肌肤之亲|亲我|亲你|亲她|亲一下|亲一口)/.test(`${sayText || ''} ${reply || ''}`);
      for (const id of touched) {
        const a = wR.actors[id];
        const rel = (a.relations = a.relations || {});
        const mine = (rel[meR0.id] = rel[meR0.id] || {});
        const today = Number(wR.clock?.day) || 1;
        if (Number(a.lastTalkDay) !== today) { a.lastTalkDay = today; a.talkToday = 0; }
        // 初次打交道：先有"一面之缘"的底子，再涨这一分
        if (mine.trust == null) mine.trust = 5;
        if (mine.desire == null) mine.desire = 0;
        if (Number(a.talkToday || 0) < 5) {
          mine.trust = Math.min(100, Math.round(((Number(mine.trust) || 0) + 1) * 10) / 10);
          a.talkToday = Number(a.talkToday || 0) + 1;
          changed = true;
        }
        // 亲密进展：情愫不能只写在台词里，每天至少动一次
        if (intimate && Number(a.intimacyDay) !== today) {
          mine.desire = Math.min(100, Math.round(((Number(mine.desire) || 0) + 3) * 10) / 10);
          mine.trust = Math.min(100, Math.round(((Number(mine.trust) || 0) + 1) * 10) / 10);
          a.intimacyDay = today;
          changed = true;
          reply += `\n（${a.name}与你的情愫更深了一层。）`;
        }
      }
      for (const g of gifts) {
        const purse = meR0.id === 'husband' ? Number(wR.assets.silver) || 0 : Number(meR0.money) || 0;
        const amt = Math.min(g.amt, purse);
        if (amt <= 0) continue;
        if (meR0.id === 'husband') wR.assets.silver = Math.round((purse - amt) * 100) / 100;
        else meR0.money = Math.round((purse - amt) * 100) / 100;
        const rel = (g.who.relations = g.who.relations || {});
        const mine = (rel[meR0.id] = rel[meR0.id] || {});
        mine.trust = Math.min(100, Math.round(((Number(mine.trust) || 0) + Math.min(12, amt * 3)) * 10) / 10);
        changed = true;
        reply += `\n（${g.who.name}收下了 ${amt.toFixed(2)} 两。）`;
      }
      if (changed) {
        saveState(dataDir, wR);
        if (touched.size) console.log(`[Relation] 这轮与 ${[...touched].map((id) => wR.actors[id]?.name).join('、')} 相处，交情略增`);
      }
    } catch (err) { console.warn('[Relation] 涨交情失败：', err.message); }

    // 8.785 开业：名下筹备中的铺子，相公一句话就开张
    try {
      if (/开业|开张|开门做生意|挂匾/.test(String(sayText || ''))) {
        const wO = loadState(dataDir);
        const meO = wO.actors?.[viewerActorId || 'husband'] || wO.actors?.husband;
        const mine = (wO.assets?.properties || []).filter((p) => p && (String(p.owner || '') === String(meO?.id) || String(p.keeper || '') === String(meO?.id)));
        const closed = mine.filter((p) => !['已开张', '正常营业'].includes(String(p.status || '')));
        for (const p of closed) { p.status = '已开张'; p.openedDay = wO.clock?.day || 1; }
        try { refreshPropertyIncomes(wO); } catch { /* 忽略 */ }
        saveState(dataDir, wO);
        if (closed.length) {
          reply += `\n（${closed.map((p) => p.name).join('、')} 今日开张了。）`;
          console.log(`[Shop] 相公令下开张：${closed.map((p) => p.name).join('、')}`);
        }
      }
    } catch { /* 忽略 */ }

    // 8.786 旧报价作废：仅在相公明确回绝（不要了/太贵了/算了/不买了）或单子已过时才清理，绝不误删本轮新挂的待定夺单
    try {
      const wQ = loadState(dataDir);
      if (wQ.pendingAction) {
        const isThisTurn = createdPendingId && String(wQ.pendingAction.id) === String(createdPendingId);
        const isExplicitReject = /(不要了|太贵了|算了|不买了|作罢|买不起|免了|不办了)/.test(String(sayText || ''));
        if (isExplicitReject) {
          delete wQ.pendingAction;
          saveState(dataDir, wQ);
          reply += '\n（相公已明令作罢，此项花销账目撤回。）';
          console.log('[Pay] 相公明确回绝，待付单撤销');
        } else if (!isThisTurn) {
          // 非本轮新挂的旧单，跨时辰或转移话题时作废
          const pendDay = Number(wQ.pendingAction.askedDay) || 0;
          const curDay = Number(wQ.clock?.day) || 1;
          if (curDay > pendDay) {
            delete wQ.pendingAction;
            saveState(dataDir, wQ);
            console.log('[Pay] 隔日待付单已过期作废');
          }
        }
      }
    } catch { /* 忽略 */ }

    // 8.787 大户提亲：答应或回绝
    try {
      const wA = loadState(dataDir);
      const offer = wA.flags?.allianceOffer;
      if (offer && offer.status === 'pending') {
        if (/应了这门亲|答应(这门)?亲事|允了这门亲|就娶她/.test(String(sayText || ''))) {
          const r = acceptAlliance(wA, viewerActorId || 'husband');
          saveState(dataDir, wA);
          reply += `\n【提示】${String(r.line || '').replace(/^（/, '').replace(/）$/, '')}`;
        } else if (/回绝|婉拒|不允|这门亲算了/.test(String(sayText || ''))) {
          const r = declineAlliance(wA);
          saveState(dataDir, wA);
          reply += `\n【提示】${String(r.line || '').replace(/^（/, '').replace(/）$/, '')}`;
        }
      }
    } catch { /* 忽略 */ }

    // 8.79 说亲：话里点名"娶/提亲/说亲/纳"某人，真去说媒
    try {
      const mMarry = /(?:娶|提亲|说亲|迎娶|纳)\s*([\u4e00-\u9fa5]{2,4})/.exec(String(sayText || ''));
      if (mMarry) {
        const wM = loadState(dataDir);
        const meM = wM.actors?.[viewerActorId || 'husband'] || wM.actors?.husband;
        const who = Object.values(wM.actors || {}).find((a) => a && a.name === mMarry[1]);
        if (who) {
          const r = proposeMarriage(wM, meM.id, who.id, 2);
          if (r.ok) {
            try { wM.assets.silver = Math.round(((Number(wM.assets.silver) || 0) - 2) * 100) / 100; } catch { /* 忽略 */ }
            saveState(dataDir, wM);
          }
          reply += `\n【提示】${String(r.line || '').replace(/^（/, '').replace(/）$/, '')}`;
          console.log(`[Marriage] 说亲：${meM.name} → ${who.name}：${r.ok ? '成' : '未成'}`);
        }
      }
    } catch (err) { console.warn('[Marriage] 说亲失败：', err.message); }

    // 8.80 营生三件事：摆摊 / 找差事 / 租铺（哪个城都能做，不分临江内外）
    try {
      const sayT = String(sayText || '');
      const wB = loadState(dataDir);
      const meB = wB.actors?.[viewerActorId || 'husband'] || wB.actors?.husband;
      const labelOf3 = (nm) => { const seg = String(nm || '').split('·')[0]; return /府$|州$|县$/.test(seg) ? seg : '临江府'; };
      const myCity3 = labelOf3(wB.places?.[meB?.location]?.name);
      const base3 = wB.flags?.cityBase?.[myCity3];
      const money3 = (id) => (id === 'husband' ? Number(wB.assets?.silver) || 0 : Number(wB.actors?.[id]?.money) || 0);
      const pay3 = (id, amt) => {
        if (id === 'husband') { wB.assets.silver = Math.round(((Number(wB.assets.silver) || 0) - amt) * 100) / 100; }
        else { const a = wB.actors[id]; if (a) a.money = Math.round(((Number(a.money) || 0) - amt) * 100) / 100; }
      };

      // 摆摊
      const mStall = /摆(个)?摊|支个摊|摆摊卖(.{1,6})/.exec(sayT);
      if (mStall && !/街|集|市/.test(String(wB.places?.[meB?.location]?.name || ''))) {
        reply += `\n（摆摊得去街上或集市，院子里摆不开。）`;
      }
      if (mStall && /街|集|市/.test(String(wB.places?.[meB?.location]?.name || ''))) {
        const mGoods = /卖(.{1,6})/.exec(sayT);
        const goods = String((mGoods && mGoods[1]) || mStall[2] || '杂货').slice(0, 6);
        const fee = 0.05;
        if (money3(meB.id) < fee) {
          reply += `\n（摆摊要先交 ${fee.toFixed(2)} 两摊位钱，手头不够。）`;
        } else {
          pay3(meB.id, fee);
          meB.stall = { good: goods, word: goods, price: 0.04, sinceDay: wB.clock?.day || 1 };
          meB.role = '摊贩'; meB.title = '摊贩';
          saveState(dataDir, wB);
          reply += `\n（你在${wB.places?.[meB.location]?.name || '街边'}支起摊子卖${goods}，交了 ${fee.toFixed(2)} 两摊位钱。）`;
          console.log(`[Job] ${meB.name} 在${myCity3}摆摊卖${goods}`);
        }
      }

      // 找差事（本城差事表）
      if (base3 && !Array.isArray(base3.jobs)) {
        base3.jobs = [
          { title: '米行帮工', pay: 0.05, place: base3.streetId },
          { title: '客栈跑堂', pay: 0.05, place: base3.innId },
          { title: '更夫', pay: 0.04, place: base3.streetId },
          { title: '码头卸货', pay: 0.06, place: base3.streetId },
        ];
      }
      if (/找.{0,3}(活|差事|营生|事做|口饭吃)|应差|寻个差事/.test(sayT) && base3?.jobs?.length) {
        if (meB.job) {
          reply += `\n（你眼下已在${meB.job.city}做${meB.job.title}，一日 ${Number(meB.job.pay).toFixed(2)} 两。）`;
        } else {
          const job = base3.jobs[Math.floor(Math.random() * base3.jobs.length)];
          meB.job = { city: myCity3, title: job.title, pay: job.pay, place: job.place, sinceDay: wB.clock?.day || 1 };
          meB.role = job.title; meB.title = job.title;
          saveState(dataDir, wB);
          reply += `\n（你应了${myCity3}的${job.title}，一日 ${job.pay.toFixed(2)} 两，当值在${wB.places?.[job.place]?.name || '街面上'}。）`;
          console.log(`[Job] ${meB.name} 应差：${job.title} @${myCity3}`);
        }
      }

      // 租铺（本城集市里一间）
      if (/租(个|一间|下)?铺|盘个铺子|开个铺子/.test(sayT) && base3?.marketId) {
        const rent = Math.round((20 + (Number(wB.cities?.[myCity3]?.wealth) || 30) * 0.4) * 100) / 100;
        if (money3(meB.id) < rent) {
          reply += `\n（本城租一间铺面要 ${rent.toFixed(2)} 两，手头不够。）`;
        } else {
          pay3(meB.id, rent);
          const nm = `${myCity3}·${meB.name}的铺子`;
          wB.assets = wB.assets || {};
          wB.assets.properties = Array.isArray(wB.assets.properties) ? wB.assets.properties : [];
          wB.assets.properties.push({
            id: `prop_${Date.now()}`, name: nm, kind: 'shops',
            incomePerDay: 0.3, owner: meB.id, keeper: meB.id, staff: 0,
            city: myCity3, place: base3.marketId, status: '已开张', openedDay: wB.clock?.day || 1,
            capital: Math.max(100, rent * 8),
          });
          saveState(dataDir, wB);
          reply += `\n（你在${wB.places?.[base3.marketId]?.name || '集市'}租下一间铺子，花了 ${rent.toFixed(2)} 两。）`;
          console.log(`[Job] ${meB.name} 在${myCity3}租铺：${rent} 两`);
        }
      }
    } catch (err) { console.warn('[Job] 营生处理失败：', err.message); }


    // 8.85 相公说"进你屋里/去你房间"：对方答应了就真的换场（她带你进她的私房）
    try {
      if (/(去|进|到)\s*你(的)?\s*(屋|房间|房里|闺房|卧室|内室)|带我(去|进|上)|进你屋/.test(String(sayText || ''))) {
        const wR = loadState(dataDir);
        const meR = wR.actors?.[viewerActorId || 'husband'] || wR.actors?.husband;
        const hereR = wR.places?.[meR?.location];
        // 这一场里跟着的、不是本家的人（比如紫嫣）
        const guest = Object.values(wR.actors || {}).find((a) => a && !a.dead && a.id !== meR?.id
          && a.location === meR?.location && !a.household && !String(a.id).startsWith('usr_'));
        if (guest) {
          // 她的私房：优先她自己住处；否则这处场子的"上房/雅间/后宅"那类房
          let target = null;
          const home = guest.home && wR.places?.[guest.home];
          if (home && (home.residence || home.rooms)) {
            const key = home.rooms && (home.rooms.wing ? 'wing' : (home.rooms.main ? 'main' : (home.rooms.back ? 'back' : null)));
            target = key ? home.rooms[key]?.id : home.id;
          }
          if (!target && hereR?.parent) {
            const par = wR.places?.[hereR.parent];
            const key2 = par?.rooms && ['back', 'room', 'main', 'f3', 'f2'].find((k) => par.rooms[k]);
            target = key2 ? par.rooms[key2].id : null;
          }
          if (target && wR.places?.[target]) {
            moveActor(wR, guest.id, target, 'world', '带相公入内室');
            if (meR?.id) moveActor(wR, meR.id, target, 'world', '随她入内室');
            try { guest.invitedTo = { home: hereR?.parent || target, day: wR.clock?.day || 1 }; } catch { /* 忽略 */ }
            saveState(dataDir, wR);
            reply = `（${guest.name}引着相公往里走，帘子一挑，进了内室。）\n` + String(reply || '');
            console.log(`[Scene] ${guest.name} 带相公进了 ${wR.places?.[target]?.name || target}`);
          }
        }
      }
    } catch (err) { console.warn('[Scene] 入内室失败：', err.message); }

    // 8.9 相公吩咐离场 / 回房 / 送客（单一入口：严格限定在场人物，杜绝异地同名误判与多头打架）
    try {
      const sayStr = String(sayText || '').trim();
      // 纯解析见 chat/intent-pipeline.js（只判断"要不要打发人"和"打发谁"）
      const { isDismiss: isDismissOrGo, targetName: dismissName, targetWhere: dismissWhere } = parseDismissIntent(sayStr);

      if (isDismissOrGo) {
        const wF = loadState(dataDir);
        const meF = wF.actors?.[viewerActorId || 'husband'] || wF.actors?.husband;
        // 核心铁律：候选人必须 100% 严格限定在【当前在场的人】！严禁搜寻全天下不在场的人！
        const hereActors = Object.values(wF.actors || {}).filter(
          (a) => a && !a.dead && a.id !== meF?.id && a.location === meF?.location
            && !/^usr_/.test(String(a.id)),
        );

        console.log(`[Departure] 单一入口判定：在场 ${hereActors.length} 人，say="${sayStr.slice(0, 30)}"`);

        let preDismissed = false;
        if (hereActors.length > 0) {
          // 先按"正文里真实出现的在场人名"抓：婉儿芸娘都回家吧 → 两个名字都要走
          const namedHere = hereActors.filter((a) => a.name && (
            String(sayStr).includes(a.name)
            || (a.name.length > 2 && String(sayStr).includes(a.name.slice(-2)))
          ));
          if (namedHere.length >= 2) {
            const names = [];
            for (const who of namedHere) {
              let dest = homeRoomForName(who.name, {
                includeWife: true,
                hasServantRoom: Boolean(wF.places?.['husband_room__servant']),
                places: wF.places,
                role: who.role,
              }) || who.quarters || who.home;
              if (/家丁|护院|门房|小厮|马夫|车夫|脚夫/.test(String(who.role || ''))) dest = 'husband_room__gate';
              if (dest && wF.places?.[dest] && dest !== who.location) {
                const mv = moveActor(wF, who.id, dest, 'world', '听命离场');
                if (mv?.ok) names.push(who.name);
              }
            }
            if (names.length) {
              saveState(dataDir, wF);
              const actorMap = Object.fromEntries(hereActors.map((a) => [a.name, a]));
              reply = (String(reply || '').trim() + '\n\n' + formatDepartureNotice(names, '', actorMap)).trim();
              console.log(`[Departure] 正文多人点名离场：${names.join('、')}`);
            }
            preDismissed = true;
          } else if (namedHere.length === 1 && !dismissName) {
            dismissName = namedHere[0].name;
            dismissWhere = '回房';
          }

          // 1. 是否是点名某人？（解析结果来自 parseDismissIntent）
          let targetName = dismissName;
          let targetWhere = dismissWhere;
          let matchedWho = null;
          let multiDismissed = false;

          if (!preDismissed && targetName) {
            // 连写两个名字："芸娘婉宁退出去" → 拆成在场的人，逐个请走
            const contained = targetName.length >= 4
              ? hereActors.filter((a) => a.name && targetName.includes(a.name))
              : [];
            if (contained.length > 1) {
              const names = [];
              for (const who of contained) {
                let dest = homeRoomForName(who.name, {
                  includeWife: true,
                  hasServantRoom: Boolean(wF.places?.['husband_room__servant']),
                  places: wF.places,
                  role: who.role,
                }) || who.quarters || who.home;
                if (/家丁|护院|门房|小厮|马夫|车夫|脚夫/.test(String(who.role || ''))) dest = 'husband_room__gate';
                if (dest && wF.places?.[dest] && dest !== who.location) {
                  const mv = moveActor(wF, who.id, dest, 'world', '听命离场');
                  if (mv?.ok) {
                    who.awayUntil = { day: wF.clock?.day || 1, hour: ((Number(wF.clock?.hour) || 0) + 4) % 24 };
                    names.push(who.name);
                  }
                }
              }
              if (names.length) {
                saveState(dataDir, wF);
                const actorMap = Object.fromEntries(hereActors.map((a) => [a.name, a]));
                reply = (String(reply || '').trim() + '\n\n' + formatDepartureNotice(names, '', actorMap)).trim();
                console.log(`[Departure] 连写点名离场：${names.join('、')}`);
              }
              multiDismissed = true;
              targetName = null;
            }

            // 在【当前在场的人】中精确或模糊匹配
            const matched = multiDismissed ? [] : hereActors.filter((a) => {
              if (a.name === targetName) return true;
              if (targetName.length >= 2 && (a.name.endsWith(targetName) || a.name.includes(targetName))) return true;
              return false;
            });

            if (!multiDismissed && matched.length > 1) {
              // 人性化设计：当场有不同姓氏的同名角色（如两个婉宁同场）！
              // 严禁一股脑全赶走，由其中一位自然反问，明确相公到底叫谁！
              console.log(`[Departure] 在场存在重名歧义：${matched.map((a) => a.name).join('、')}，触发自然反问`);
              const firstN = matched[0].name;
              reply = `（${firstN}神情微怔，有些拿不准，轻声问道：“相公唤的是妾身，还是哪位妹妹？”）\n` + String(reply || '');
            } else if (!multiDismissed && matched.length === 1) {
              matchedWho = matched[0];
            } else if (!multiDismissed) {
              console.log(`[Departure] 在场无人匹配点名「${targetName}」，不执行异地误杀与无辜清场`);
            }
          }

          if (!preDismissed && !multiDismissed && matchedWho) {
            // 精准锁定唯一在场角色
            const who = matchedWho;
            let dest = null;

            if (/铺子/.test(targetWhere || '')) {
              const prop = (wF.assets?.properties || []).find((x) => x && (String(x.keeper || '') === String(who.id) || String(x.owner || '') === String(who.id)) && x.place);
              dest = prop?.place || null;
            } else if (/东厢/.test(targetWhere || '')) {
              dest = 'wang_mansion_east';
            } else if (/西厢/.test(targetWhere || '')) {
              dest = 'wang_mansion_west';
            } else if (/房间|回房|屋|歇着|等我|候着|退下|出去|睡/.test(targetWhere || '')) {
              // 王宅内眷与下人规制（纯映射见 homeRoomForName）
              dest = homeRoomForName(who.name, {
                includeWife: true,
                hasServantRoom: Boolean(wF.places?.['husband_room__servant']),
                places: wF.places,
                role: who.role,
              }) || who.quarters || who.home || null;
            }

            if (!dest) {
              dest = resolvePlaceTarget(wF, targetWhere, { nearId: meF?.location, actor: who });
            }
            if (!dest) dest = who.quarters || who.home || null;
            if (!dest || !wF.places?.[dest]) {
              try { dest = ensureDwelling(wF, who.id, who.name, 'street'); } catch { dest = null; }
            }

            if (dest && wF.places?.[dest] && dest !== who.location) {
              const mv = moveActor(wF, who.id, dest, 'world', '听命离场');
              if (mv?.ok) {
                who.awayUntil = { day: wF.clock?.day || 1, hour: ((Number(wF.clock?.hour) || 0) + 4) % 24 };
                saveState(dataDir, wF);
                const destName = wF.places[dest].name;
                reply = (String(reply || '').trim() + '\n\n' + formatDepartureNotice([who.name], destName, { [who.name]: who })).trim();
                console.log(`[Departure] 单一入口：${who.name} 离场 → ${destName}`);
              }
            }
          } else if (!preDismissed && !multiDismissed && !targetName) {
            // 未点特定人名：必须明确触发通令清场（如“走吧”、“出去干活吧”、“退下吧”、“散了吧”）或面向单人的送客词
            const isPersonalFarewell = /^(?:好的|那|您|好|行)?\s*(?:你|你们|都|先|那您|您)?\s*(?:走(?:吧|啦)?|回去(?:吧)?|回吧|退下(?:吧)?|下去(?:吧)?|散了(?:吧)?|去吧|出门吧|慢走|走好|再见|回见|送客|睡吧|安歇吧)[。！!~…\s]*$/.test(sayStr)
              || /送客|慢走|走好|不送了|不远送|留步|再见|回见|改日再聚|改日再叙|告辞|你回吧|你走吧|退下吧|都散了吧|各自回房|都走吧|走吧|走啦/.test(sayStr);
            if (isMassDismiss(sayStr) || (hereActors.length === 1 && isPersonalFarewell)) {
            // 说“家眷留下”时，妻妾丫鬟全部留下；没这句话则仍按原规矩清场。
            const names = [];
            const keepFamily = /家眷|女眷|家小|夫人留下|妻妾留下/.test(sayStr);
            for (const a of hereActors) {
              const isFamily = a.household || a.spouse === 'husband'
                || /正妻|大娘子|如夫人|二房|侧室|妾|通房/.test(String(a.role || ''));
              if (keepFamily && isFamily) continue;
              // 正房同寝规制保护：相公在正房睡觉/安歇时，沈婉儿是正妻，默认同房安歇，绝不能作为客侍扫地出门！
              if (meF?.location === 'husband_room' && /睡|歇|安歇|休|卧/.test(sayStr) && a.id === 'waner') {
                continue;
              }
              let back = homeRoomForName(a.name, {
                hasServantRoom: Boolean(wF.places?.['husband_room__servant']),
                places: wF.places,
                role: a.role,
              }) || a.quarters || a.home;

              // 官员/外客送客兜底：知县/官员归位于县衙，客商归于货栈
              if (/知县|县令|县丞|典吏|书吏|衙门|大人/.test(String(a.role || '')) && (!back || back === a.location)) {
                back = wF.places?.yamen ? 'yamen' : 'street';
              } else if (/客商|货栈/.test(String(a.role || '')) && (!back || back === a.location)) {
                back = wF.places?.goods_shop ? 'goods_shop' : 'street';
              }

              if (!back || !wF.places?.[back]) {
                try { back = ensureDwelling(wF, a.id, a.name, 'street'); } catch { back = null; }
              }
              if (back && wF.places?.[back] && back !== a.location) {
                const mv = moveActor(wF, a.id, back, 'world', '全员送客离场');
                if (mv?.ok) {
                  a.awayUntil = { day: wF.clock?.day || 1, hour: ((Number(wF.clock?.hour) || 0) + 4) % 24 };
                  names.push(a.name);
                }
              }
            }
            if (names.length) {
              saveState(dataDir, wF);
              const actorMap = Object.fromEntries(hereActors.map((a) => [a.name, a]));
              reply = (String(reply || '').trim() + '\n\n' + formatDepartureNotice(names, '', actorMap)).trim();
              console.log(`[Departure] 全员清场：${names.join('、')} 离场`);
            }
            }
          }
        }
      }
    } catch (err) { console.warn('[Departure] 离场处理失败：', err.message); }

    // 8.96 模型自己写的"起身告辞/退了出去"旁白：删掉，离场事实只由引擎那一行说
    try {
      // 括号里凡是"谁走了/退了出去"的叙述，一律删；离场事实只由引擎追加
      reply = String(reply || '').replace(/[（(][^（）()]{0,80}(起身告辞|退了出去|退了出去。|告退出去|都退下了|退出去了)[^（）()]{0,40}[）)]/g, '').replace(/\n{3,}/g, '\n\n').trim();
    } catch { /* 忽略 */ }

    // 9. NPC 告辞离场：先照 [[depart:谁|去哪]] 把真位移走完，再清标签
    try {
      applyNpcDeparture(dataDir, reply, sayText);
    } catch (err) {
      console.warn('[Departure] 离场处理失败：', err.message);
    }

    // 10. 最终兜底：剔除任何未识别的系统标签，绝不向客户端吐裸露 [[...]]
    reply = reply.replace(/\[\[[a-zA-Z0-9_]+:[^\]]*\]\]/g, '').replace(/\[\[[^\]]*\]\]/g, '');

    // 11. 孤立与未闭合中文括号治理（彻底杜绝末尾单挂 "（" 或残缺括号）
    reply = reply.replace(/[（(]\s*$/g, '').trim();
    reply = reply.replace(/[（(]\s*[）)]/g, '').trim();
    const openCount = (reply.match(/[（(]/g) || []).length;
    const closeCount = (reply.match(/[）)]/g) || []).length;
    if (openCount > closeCount) {
      const lastOpenIdx = Math.max(reply.lastIndexOf('（'), reply.lastIndexOf('('));
      if (lastOpenIdx >= 0) {
        const inside = reply.slice(lastOpenIdx + 1).trim();
        if (!inside || !/[\u4e00-\u9fa5]/.test(inside)) {
          reply = reply.slice(0, lastOpenIdx).trim();
        } else {
          reply = reply + '）';
        }
      }
    }

    if (activeSummonNotice) {
      reply = `${activeSummonNotice}\n` + reply;
      activeSummonNotice = null;
    }

    // 11.9 说话人校正：男角色不许自称妾身；客人不许代报产业内部账
    try {
      reply = enforceSpeakerTone(reply, dataDir, viewerActorId, sayText);
    } catch { /* 忽略 */ }

    // 12. 重大事件兜底记忆：模型忘了写 [[world:remember]] 时，引擎替它记一笔
    try {
      const majorEvent = /(?:送|押)(?:进|去|到)?了?(?:衙门|县衙|大牢|官府)|判(?:了)?(?:有罪|无罪|斩|流|杖)|断罪|收监|结案/;
      const hadRemember = /\[\[world:remember/i.test(String(replyText || ''));
      if (!hadRemember && majorEvent.test(reply)) {
        const wM = loadState(dataDir);
        if (wM) {
          const about = ['husband'];
          for (const a of Object.values(wM.actors || {})) {
            if (a && a.id !== 'husband' && a.name && reply.includes(a.name)) about.push(a.id);
          }
          const text = `事件：${String(reply).replace(/【[^】]*】/g, '').replace(/\s+/g, ' ').trim().slice(0, 100)}`;
          if (addMemory(wM, { text, about: about.slice(0, 8), visible: 'private', day: wM.clock?.day })) {
            saveState(dataDir, wM);
            console.log('[Memory] 重大事件兜底落账：' + text.slice(0, 40));
          }
        }
      }
    } catch { /* 忽略 */ }

    return { reply: reply.trim(), lastSummonNotice: activeSummonNotice };
}

/** 最后一道人话校正：男角色不得自称妾身；客人不得代报内部账 */
function enforceSpeakerTone(reply, dataDir, viewerActorId, sayText = '') {
  const world = loadState(dataDir);
  const guestRole = /乡绅|客商|公子|富商|茶客|酒客|顾客|客人|买主|贵客/;
  const internal = /(入柜|入账|账房|账目|核账|菜单|陈设|工钱|月钱|流水|日入|成本|雇工|定金|寿宴|八冷八热|金桂酿)/;
  const streetAsk = /(街上|街面|奇闻|异事|传闻|听说|热闹|新鲜事|外面)/.test(String(sayText || ''));
  const streetRumor = (world?.rumors || []).find((r) => r && r.text && !internal.test(String(r.text)));

  const cleanText = (raw, actor, hasClosingQuote = false) => {
    let text = String(raw || '');
    const hadQuote = hasClosingQuote || /[”"]\s*$/.test(text);
    if (actor?.gender === 'male') {
      text = text.replace(/妾身|奴家|奴婢|小女子/g, '在下');
    }
    if (streetAsk && internal.test(text)) {
      // 相公问的是街面，掌柜/客人都不许把产业内部账当街谈
      text = text.split(/(?<=[。！？])/).filter((s) => !internal.test(s)).join('').trim();
      if (!text) text = streetRumor ? `街上都在传：${streetRumor.text}` : '街上倒没听着什么新鲜的。';
      if (hadQuote) text += '”';
    } else if (guestRole.test(String(actor?.role || '')) && internal.test(text)) {
      text = text.split(/(?<=[。！？])/).filter((s) => !internal.test(s)).join('').trim();
      text = text
        ? `${text} 这些账房里的细事小人说不清，得问掌柜。`
        : '这些账房里的细事小人说不清，得问掌柜。';
      if (hadQuote) text += '”';
    }
    return text;
  };

  let current = null;
  return String(reply || '').split('\n').map((line) => {
    const m = line.match(/^【([^】]{1,20})】\s*[：:]?\s*([\s\S]*)$/);
    if (!m) {
      // 同一角色换行继续说的话，也要校正；不能只改第一行
      return current ? cleanText(line, current) : line;
    }
    const spk = m[1];
    const name = spk.includes('·') ? spk.split('·').pop().trim() : spk;
    if (!name || /提示|旁白|系统/.test(name)) { current = null; return line; }
    const actor = Object.values(world?.actors || {}).find((a) => a && !a.dead && a.name === name);
    if (!actor) { current = null; return line; }
    current = actor;
    const prefix = line.slice(0, line.indexOf(m[2]));
    return prefix + cleanText(m[2], actor, true);
  }).join('\n');
}
