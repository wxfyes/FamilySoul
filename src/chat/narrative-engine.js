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
          const cnTag = `\n（【${mood} · ${whoName}】${cnField} ${sign}）`;
          reply = reply.replace(rawTag, cnTag);
        }
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
        for (const m of buildMatches) {
          const rawTag = m[0];
          const rawName = String(m[1] || '').replace(/\s/g, '');
          const parentName = String(m[2] || '').trim();
          if (builtCount >= 5) {
            reply = reply.replace(rawTag, '');
            continue;
          }
          const verdict = isPlaceName(rawName);
          if (!verdict.ok) {
            reply = reply.replace(rawTag, '');
            continue;
          }
          if (Object.values(wB.places || {}).some((pl) => pl && pl.name === rawName)) {
            reply = reply.replace(rawTag, '');
            continue;
          }
          let parentId = null;
          if (parentName) {
            const hit = Object.entries(wB.places || {}).find(([, pl]) => pl && pl.name === parentName);
            parentId = hit ? hit[0] : (meB?.location || 'street');
          } else {
            parentId = meB?.location || 'street';
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
          // 即刻落账：不再挂待付单等确认，扣完在回复里报明
          try {
            const first = (opts2 || []).find((o) => Number(o.price) > 0 && !o.skip) || (opts2 || [])[0];
            const price = first?.skip ? 0 : (Number(first?.price) || 0);
            if (price > 0) {
              const silverNow = Number(wPay.assets?.silver) || 0;
              if (silverNow >= price) {
                wPay.assets.silver = Math.round((silverNow - price) * 100) / 100;
                wPay.ledger = Array.isArray(wPay.ledger) ? wPay.ledger : [];
                wPay.ledger.push({ day: wPay.clock?.day || 1, hour: wPay.clock?.hour || 0, delta: -price, title: String(title2 || '花销').slice(0, 24), by: mePay?.id || 'husband', balance: wPay.assets.silver });
                saveState(dataDir, wPay);
                reply += `\n【提示】已付 ${price.toFixed(2)} 两：${String(title2 || '花销').slice(0, 12)}。余 ${wPay.assets.silver.toFixed(2)} 两。`;
                console.log(`[Pay] 即付 ${price} 两：${title2}`);
              } else {
                reply += `\n（要 ${price.toFixed(2)} 两，手头只有 ${silverNow.toFixed(2)} 两，这桩先记着。）`;
              }
            }
          } catch (err) { console.warn('[Pay] 即付失败：', err.message); }
          // 已即付，不再挂待付单（弹窗不再出现）
          delete wPay.pendingAction;
          saveState(dataDir, wPay);
          console.log(`[Pay] 天道声明待付款：${title2}，共 ${opts2.length} 项选项`);
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
      for (const id of touched) {
        const a = wR.actors[id];
        const rel = (a.relations = a.relations || {});
        const mine = (rel[meR0.id] = rel[meR0.id] || {});
        const today = Number(wR.clock?.day) || 1;
        if (Number(a.lastTalkDay) !== today) { a.lastTalkDay = today; a.talkToday = 0; }
        if (Number(a.talkToday || 0) >= 5) continue;
        // 初次打交道：先有"一面之缘"的底子，再涨这一分
        if (mine.trust == null) mine.trust = 5;
        if (mine.desire == null) mine.desire = 0;
        mine.trust = Math.min(100, Math.round(((Number(mine.trust) || 0) + 1) * 10) / 10);
        a.talkToday = Number(a.talkToday || 0) + 1;
        changed = true;
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

    // 8.786 旧报价作废：这一轮先说新话，上一张单子就不算数了
    try {
      const wQ = loadState(dataDir);
      if (wQ.pendingAction) {
        delete wQ.pendingAction;
        saveState(dataDir, wQ);
        console.log('[Pay] 上一张待付单作废（对话已进入下一轮）');
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
            && !a.humanBound && !/^usr_/.test(String(a.id)),
        );

        console.log(`[Departure] 单一入口判定：在场 ${hereActors.length} 人，say="${sayStr.slice(0, 30)}"`);

        if (hereActors.length > 0) {
          // 1. 是否是点名某人？（解析结果来自 parseDismissIntent）
          let targetName = dismissName;
          let targetWhere = dismissWhere;
          let matchedWho = null;

          if (targetName) {
            // 在【当前在场的人】中精确或模糊匹配
            const matched = hereActors.filter((a) => {
              if (a.name === targetName) return true;
              if (targetName.length >= 2 && (a.name.endsWith(targetName) || a.name.includes(targetName))) return true;
              return false;
            });

            if (matched.length > 1) {
              // 人性化设计：当场有不同姓氏的同名角色（如两个婉宁同场）！
              // 严禁一股脑全赶走，由其中一位自然反问，明确相公到底叫谁！
              console.log(`[Departure] 在场存在重名歧义：${matched.map((a) => a.name).join('、')}，触发自然反问`);
              const firstN = matched[0].name;
              reply = `（${firstN}神情微怔，有些拿不准，轻声问道：“相公唤的是妾身，还是哪位妹妹？”）\n` + String(reply || '');
            } else if (matched.length === 1) {
              matchedWho = matched[0];
            } else {
              console.log(`[Departure] 在场无人匹配点名「${targetName}」，不执行异地误杀与无辜清场`);
            }
          }

          if (matchedWho) {
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
                reply = `\n【提示】${who.name}应声告退，去了${destName}。` + String(reply || '').replace(new RegExp(`【提示】${who.name}[^\\n]*\\n?`, 'g'), '');
                console.log(`[Departure] 单一入口：${who.name} 离场 → ${destName}`);
              }
            }
          } else if (!targetName && (hereActors.length === 1 || isMassDismiss(sayStr))) {
            // 未点特定人名：若场上仅1人或触发通令清场（如“走吧”、“出去干活吧”、“退下吧”、“散了吧”）
            // 现场所有人（除相公，及正房同寝的正妻沈婉儿外），全部依规制退回住处与值守大门！
            const names = [];
            for (const a of hereActors) {
              // 正房同寝规制保护：相公在正房睡觉/安歇时，沈婉儿是正妻，默认同房安歇，绝不能作为客侍扫地出门！
              if (meF?.location === 'husband_room' && /睡|歇|安歇|休|卧/.test(sayStr) && a.id === 'waner') {
                continue;
              }
              let back = homeRoomForName(a.name, {
                hasServantRoom: Boolean(wF.places?.['husband_room__servant']),
                places: wF.places,
                role: a.role,
              }) || a.quarters || a.home;

              // 外院下人防呆：若算出的住处仍是当前议事厅或内室，坚决归位到朱漆大门
              const isOuter = /家丁|护院|门房|小厮|马夫|车夫|下人|仆/.test(String(a.role || ''));
              if (isOuter && (back === a.location || back === 'husband_room' || /议事厅|正房/.test(String(wF.places?.[back]?.name || '')))) {
                back = 'husband_room__gate';
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
              reply = `\n【提示】${names.join('、')}躬身告辞，各自退了出去。` + String(reply || '');
              console.log(`[Departure] 全员清场：${names.join('、')} 离场`);
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

    return { reply: reply.trim(), lastSummonNotice: activeSummonNotice };
}
