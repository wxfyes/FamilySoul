/**
 * 环境事实与行当规矩提示词构建器：
 * 包含今日行情、名下铺面、府中兵粮、街边摊子、房事规矩、朝廷近况、天下大事、在场者底细等客观事实。
 * 从 pet-service.js 剥离，职责纯化。
 */

import { loadState, readRecentEvents } from '../world/state.js';
import { priceHint } from '../world/pricing.js';
import { describeRoom } from '../world/room-life.js';
import { personFacts } from '../world/person-facts.js';

const grainPrice = (world, city) => 0.85;
const priceAt = (world, city, item) => 1.2;

export function buildEnvironmentHints({
  dataDir,
  viewerActorId = 'husband',
  profileKey = 'husband',
  selfId = 'husband',
  say = '',
  readHistory = null,
  gate = null,
} = {}) {
  let hints = '';

  // 若相公说到"去某地"，只当商量：告诉天道别写"已经到了"
  try {
    if (/(去|往|到|上|回|进)(一|那|这|[\u4e00-\u9fa5]{2,6}(馆|铺|楼|坊|堂|店|院|阁|局|庄|街|巷|客栈|酒楼|茶坊|衙门))/.test(say)) {
      hints += '（【规矩】相公说要动身，只是商量；真正动身由他自己在界面上点「出门」。你这轮别写"已经到了某处"，最多写到应声或起身。）\n';
    }
  } catch { /* 忽略 */ }

  // 规矩与参考
  try {
    hints += '（【用人规矩】要开张、要添人手时，你替产业点人：[[staff:产业名|人名|身份]]，例如 [[staff:运河码头三层大酒楼|周有福|掌柜]]。没有这个人就现起一个名字，世上就真有这个人了。）\n';
    hints += '（【习性规矩】长期相处真的改了某个人的性子（更顺从、更敢顶嘴、开始怕你…），你可以在回复末尾附 [[trait:谁|哪一样|+5]]，一次最多动 5~10，别乱给。这东西会跟着她一辈子。）\n';
    hints += `（【物价参考】${priceHint()}。报钱一律照这个来，不许编出"一晚房钱三两"这种价。）\n`;
    hints += '（【工钱规矩】家丁安家银约0.2两/人、月饷0.6两/人；护院安家银约0.5两/人、月饷0.9两/人。两人头一个月连冬衣铺盖也就一二两到三四两，绝不许报一人五六两、两人十两以上。）\n';
    hints += '（【出征规矩】相公若说「点齐护院去平了某寨」，你只在末尾写 [[quell:匪名|人数]]；引擎会真的打，并把战报回给你，你再写成台词。）\n';
    hints += '（【兵事规矩】相公若要募兵、买军械，你不要自己报数，只写 [[recruit:人数]] 或 [[gear:兵器|数量]]（兵器/铠甲/战马/攻城器械）；引擎会算钱粮并让他在界面上确认，确认后才真的成军。）\n';
    hints += '（【打探规矩】相公若差人去打听一个人的底细，或某处生意的实情，你把这桩事记成差事；等有了结果，用 [[clue:一句话底细|谁打探的]] 落进世界。打探可能只得到传言、也可能打草惊蛇，别一次给全。）\n';
    hints += '（【差事规矩】相公吩咐谁去办一件事时，把它记成差事：[[task:谁|办什么|几天]]。后面有进展就 [[tasklog:片段|一句话]]，办成了 [[taskdone:片段|结果]]。谁去办由你按他的性情定，不必凑数。**一段话里交代三件事，就写三条 task，一件一行；只在台词里答应、不写 task，等于没派。**）\n';
    hints += '（【记事规矩】送官、押人、判案、和离/婚嫁、生死、大额钱财、当众翻脸这类事，必须在回执里写 [[world:remember text="谁做了什么、结果如何" about="当事人名,在场人名"]]；不写，NPC 以后真的不记得。宁可多记一条，不许漏。）\n';
    hints += '（【造物规矩·加戏必落地】凡是台词里新造的具体去处（后门/暗室/雅间/别院/地窖/耳房），必须同时附 [[build:地名|挂在哪处之下]]；没有这个标签，就不许把它说成真的存在。名字要像地名（2~6字，别用"那里/某处"这种）。每天最多立三处，全城动态地点三百处封顶；先找现有地点和现有房间，能复用就不新造。例：[[build:后门|翟家货栈]]。）\n';
    hints += '（【暗号规矩】若约定了敲门声、接头暗语，必须附 [[signal:谁|暗号|地点]]，例 [[signal:柳如烟|三短一长|翟家货栈·后门]]；引擎会记下，相公到那处说出暗号时真的把人叫来。没有标签就不许承诺"三短一长我自会来开"这种具体机关。）\n';
    hints += '（【了结规矩】若一件约定或承诺在剧情里真的办完了/彻底黄了，你在回复末尾附 [[deal:片段|成]] 或 [[deal:片段|不成]]，片段取自那件事的原话。别自己宣布"这事就当没发生过"，要有个交代。）\n';
    hints += '（【行止规矩】有名有姓的人（婉儿/芸娘/紫嫣/掌柜等）的去留由你按她的心事、差事、相公方才的话安排，不要按钟点硬搬：她要起身去账房/茶坊/回房，就在回复末尾写 [[go:谁|哪处]]，引擎会真的移；不许写"她一直在正房算账"这种死话，也不许给相公写这个标签。街上无名的脚夫小贩由世界自己走，不用你管。）\n';
    hints += '（【关系规矩】有亲吻、拥抱、侍寝等明确亲密进展时，必须在回复末尾写 [[relation:谁|desire|+5]]，必要时再补 [[relation:谁|trust|+1]]；只写台词不写标签，关系账本不会动。别把"亲了一下"写成没发生。）\n';
    hints += '（【接话规矩】同场多人时，只让与话头最相关的人接话，没被点名的可以沉默；不要用"是""小的明白"这种占位回话，每次开口带一条实情（人数、班次、码头情形、账目）。）\n';
    hints += '（【收钱规矩】剧情里若要花钱（房钱、货钱、打点、赏银、聘礼），你在回复末尾附一行 [[pay:名目|选项=价|选项=价]]，**每改一次价、每换一个数目，都必须重新写一行新的 [[pay]]，否则玩家看到的仍是上一张旧单**，例如 [[pay:开房|上房=3|通铺=0.2]]。相公会自己点确认；你没收到确认前，不许写"已经付了/已经进了房"。）\n';
  } catch { /* 忽略 */ }

  // 今日真实行情
  try {
    const wPx = loadState(dataDir);
    const mePx = viewerActorId ? wPx.actors?.[viewerActorId] : wPx.actors?.husband;
    const cityPx = Object.values(wPx.cities || {}).find((c) => c && c.name && String(wPx.places?.[mePx?.location]?.name || '').includes(String(c.name).slice(0, 2)))?.name
      || Object.keys(wPx.cities || {})[0] || '临江府';
    const g = grainPrice(wPx, cityPx);
    const parts = [`${cityPx}今日米价 ${g.toFixed(2)} 两/石（买 10 石 = ${(g * 10).toFixed(2)} 两，买 50 石 = ${(g * 50).toFixed(2)} 两）`];
    for (const k of ['salt', 'tea', 'silk', 'iron']) {
      try { parts.push(`${k === 'salt' ? '盐' : k === 'tea' ? '茶' : k === 'silk' ? '丝' : '铁'} ${priceAt(wPx, cityPx, k).toFixed(2)} 两`); } catch { /* 忽略 */ }
    }
    hints += `（【今日行情】${parts.join('；')}。凡谈到价钱，一律照这个数说；绝不许可自报一个更便宜的价来哄相公。此前若说过别的价，以这条为准。）\n`;
  } catch { /* 忽略 */ }

  // 开场入世提示
  try {
    if (typeof readHistory === 'function') {
      const hist0 = readHistory(profileKey).messages || [];
      if (hist0.length === 0) {
        const wF0 = loadState(dataDir);
        const meF0 = wF0.actors?.[selfId] || wF0.actors?.husband;
        const here0 = wF0.places?.[meF0?.location];
        const isNewbie = /^usr_/.test(String(selfId || ''));
        if (isNewbie) {
          hints += `（【入世第一面】他刚入世，此刻在「${here0?.name || '自家小院'}」，身上只有 ${Number(meF0?.money ?? 2).toFixed(2)} 两碎银；这屋子是他自己的，简陋但能遮风。`
            + `本轮是开场：先照实写他在哪、这屋子什么样、手里有多少钱，再让他自己开口想去做什么；别替他安排营生，也别写他"已经在做什么"。）\n`;
        }
      }
    }
  } catch { /* 忽略 */ }

  // 行当规矩与铺面
  try {
    const wBz2 = loadState(dataDir);
    const props2 = Array.isArray(wBz2.assets?.properties) ? wBz2.assets.properties.filter(Boolean) : [];
    if (props2.length) {
      hints += '（【行当规矩】东家出本钱、定大方向；掌柜管经营、用人、账目；伙计跑堂听掌柜的。小铺子老板自己就是掌柜，不另请人。东家与掌柜是两回事，绝不许混为一谈。）\n';
      const lines2 = props2.slice(0, 6).map((p) => {
        const boss = Object.values(wBz2.actors || {}).find((a) => a && !a.dead && a.location === p.place && /掌柜/.test(String(a.role || '')));
        return `${p.name}（东家：相公；掌柜：${boss?.name || '未请'}）`;
      });
      hints += `（【名下铺面】${lines2.join('；')}）\n`;
    }
  } catch { /* 忽略 */ }

  // 府中兵事与存粮
  try {
    const wMil2 = loadState(dataDir);
    const fj = (wMil2.factions || {}).wangjia;
    if (fj) {
      const kinds = fj.kinds || {};
      const total = Number(fj.troops) || 0;
      hints += `（【府中兵事】家丁 ${Number(kinds.guard) || 0} 人、护院 ${Number(kinds.retainer) || 0} 人、营兵 ${Number(kinds.army) || 0} 人（共 ${total} 人）；`
        + `月饷 ${(Number(fj.monthlyPay) || 0).toFixed(1)} 两；府库存粮 ${(Number(fj.grain) || 0).toFixed(1)} 石。`
        + `家里管事的人（正妻、管家）自然知道这些数目，问起就照实说；但别主动炫耀兵力。）\n`;
    }
  } catch { /* 忽略 */ }

  // 街边摊子
  try {
    const wSt = loadState(dataDir);
    const meSt = viewerActorId ? wSt.actors?.[viewerActorId] : wSt.actors?.husband;
    const hereSt = wSt.places?.[meSt?.location];
    if (hereSt && /街|巷|市|桥头|码头/.test(String(hereSt.name || ''))) {
      const vendors = Object.values(wSt.actors || {}).filter((a) => a && !a.dead && a.stall && a.location === meSt.location);
      if (vendors.length) {
        hints += `（【街边摊子】${vendors.map((v) => `${v.name}卖${v.stall.word}（约${Number(v.stall.price).toFixed(2)}两）`).join('；')}。要买就照这些摊子写，别编出没有的摊。）\n`;
      }
    }
  } catch { /* 忽略 */ }

  // 相公明令侍寝：引擎把在场妻妾标成"今夜解禁"，不必暗号
  try {
    if (/(服侍|侍寝|要你|陪我睡|开始|继续|上来|宽衣|脱了)/.test(String(say || ''))) {
      const wT = loadState(dataDir);
      const meT = wT.actors?.[viewerActorId || 'husband'] || wT.actors?.husband;
      const dayT = Number(wT.clock?.day) || 1;
      const marked = [];
      for (const a of Object.values(wT.actors || {})) {
        if (!a || a.dead || a.location !== meT?.location) continue;
        if (!/正妻|如夫人|二房|侧室|妾|通房/.test(String(a.role || ''))) continue;
        a.intimacy = a.intimacy || { level: 0, tone: 0, lastAt: 0, ritual: 'solemn' };
        a.intimacy.ritual = 'unlocked';
        a.intimacy.tone = 3;
        a.intimacy.consentedDay = dayT;
        a.intimacy.lastAt = dayT;
        marked.push(a.name);
      }
      if (marked.length) {
        saveState(dataDir, wT);
        hints += `（【今夜已准】${marked.join('、')}已得相公明令，今夜解禁，可放开服侍，不必再问、不必再请示。）\n`;
        console.log(`[Intimacy] 明令解禁：${marked.join('、')}`);
      }
    }
  } catch (err) { console.warn('[Intimacy] 解禁失败：', err.message); }

  // 房事规矩（给天道的事实，不是台词）
  try {
    hints += '（【房里规矩】相公没开口时，妻妾不得主动求欢（正妻可低声问一句要不要服侍）。相公一旦明说"服侍/侍寝/要你/开始/继续/宽衣"，就是明令：不必暗号、不得推脱、不得打岔劝睡，该怎么做就怎么做，写到位；应了的妻妾今夜可放开服侍，天亮归位。）\n';
  } catch { /* 忽略 */ }

  // 提亲事件
  try {
    const wOf = loadState(dataDir);
    const of2 = wOf.flags?.allianceOffer;
    if (of2 && of2.status === 'pending') {
      hints += `（【提亲】${of2.familyName}托媒婆来提亲，欲将${of2.girlName}许给相公做侧室。相公若点头，婚事便成；若无意，说一句回绝就是。）\n`;
    }
  } catch { /* 忽略 */ }

  // 此间陈设
  try {
    const wRoom = loadState(dataDir);
    const meRoom = viewerActorId ? wRoom.actors?.[viewerActorId] : wRoom.actors?.husband;
    const rd = describeRoom(wRoom, meRoom?.location);
    if (rd && rd.furnish?.length) {
      hints += `（【此间】${rd.name}：有${rd.furnish.join('、')}。` +
        `在场的人：${rd.occupants.filter((x) => x.id !== meRoom?.id).map((x) => x.name).join('、') || '无人'}。` +
        `在这里能做的事：${(rd.can || []).join('、')}。要写就照着陈设写，别凭空添不存在的物件。）\n`;
    }
  } catch { /* 忽略 */ }

  // 苦主求庇
  try {
    const wB = loadState(dataDir);
    const big = Object.values(wB.bandits || {})
      .filter((b) => b && Number(b.tier) >= 2)
      .slice(0, 2);
    if (big.length) {
      const lines = big.map((b) => `${b.name}（${b.homeCity}，${b.strength} 人，${b.tier} 阶）`).join('、');
      hints += `（【匪患实况】${lines}。若相公在城中，可安排客商或百姓来诉苦求庇；台词照实情写，别编额外的匪。）\n`;
    }
  } catch { /* 忽略 */ }

  // 朝廷近况
  try {
    const wC = loadState(dataDir);
    const tr = wC.court?.treasury || {};
    const offices = Object.values(wC.court?.offices || {}).filter((o) => o && o.holder && !o.vacant).length;
    const cityList = Object.values(wC.cities || {});
    const unrestAvg = cityList.length ? Math.round(cityList.reduce((x, c) => x + (Number(c.unrest) || 0), 0) / cityList.length) : 0;
    const sil = Number(tr.silver) || 0;
    const inc = Number(tr.lastIncome) || 0;
    const exp = Number(tr.lastExpense) || 0;
    const status = sil <= 0 ? '国库已空' : (sil < 300 ? '国库拮据、官俸发不出' : '国库尚可');
    const bits = [
      `国库 ${sil.toFixed(1)} 两（昨日收 ${inc.toFixed(1)}、支 ${exp.toFixed(1)}，${status}）`,
      `在任官 ${offices} 人，各城平均民心 ${unrestAvg}`,
    ];
    if (Number(wC.flags?.courtPressure)) bits.push(`朝廷压力 ${Number(wC.flags.courtPressure)}`);
    if (Number(wC.flags?.courtBankrupt)) bits.push(`国库告罄 ${Number(wC.flags.courtBankrupt)} 次`);
    hints += `（【朝廷近况】${bits.join('；')}。这是账上真数，朝堂戏只能照这个演，不许自己编富庶或盛世。）\n`;
  } catch { /* 忽略 */ }

  // 天下大事
  try {
    const recent = readRecentEvents(dataDir, 6) || [];
    const lines = recent
      .map((e) => {
        const t = e?.payload?.text || e?.text || '';
        if (!t) return '';
        const day = e?.day != null ? `第${e.day}日` : '';
        return `${day}${t}`;
      })
      .filter(Boolean)
      .slice(-4);
    if (lines.length) {
      hints += `（【近来天下大事】${lines.join('；')}。这些事已经发生，相公或身边人可能听说；若有人问起，照此说，不许另编更离奇的。）\n`;
    }
  } catch { /* 忽略 */ }

  // 在场者底细
  try {
    const wPF = loadState(dataDir);
    const mePF = viewerActorId ? wPF.actors?.[viewerActorId] : wPF.actors?.husband;
    const others = Object.values(wPF.actors || {})
      .filter((a) => a && !a.dead && a.name && a.id !== (mePF?.id || 'husband') && a.location === mePF?.location)
      .slice(0, 4);
    const facts = others
      .map((a) => {
        const t = personFacts(wPF, a.id);
        return t ? `${a.name}：${t.replace('【你的底细】', '')}` : '';
      })
      .filter(Boolean);
    if (facts.length) hints += `（【在场者底细】${facts.join(' ／ ')}）\n`;
  } catch { /* 忽略 */ }

  // 用人事实
  try {
    const wEmp = loadState(dataDir);
    const lines = Object.values(wEmp.actors || {})
      .filter((a) => a && !a.dead && a.employer === 'husband' && a.workplace)
      .slice(0, 12)
      .map((a) => `${a.name}是相公${a.workplace}的${a.role || '伙计'}`);
    if (lines.length) hints += `（【用人】${lines.join('；')}。这些人都认相公是东家，说话要带这层本分。）\n`;
  } catch { /* 忽略 */ }

  // 在场者习性
  try {
    const wT2 = loadState(dataDir);
    const meT2 = viewerActorId ? wT2.actors?.[viewerActorId] : wT2.actors?.husband;
    const near = Object.values(wT2.actors || {}).filter((a) => a && !a.dead && a.location === meT2?.location && a.id !== (meT2?.id || 'husband'));
    const lines2 = near
      .filter((a) => a.traits && Object.keys(a.traits).length)
      .slice(0, 4)
      .map((a) => `${a.name}：${Object.entries(a.traits).map(([k, v]) => `${k}${v}`).join('、')}`);
    if (lines2.length) hints += `（【习性】${lines2.join('；')}。这些是处出来的，照它演。）\n`;
  } catch { /* 忽略 */ }

  // 门禁阻力事实
  if (gate && gate.reasons && gate.reasons.length > 0) {
    hints += `（【天道门禁客观事实】：${gate.reasons.join('；')}。请天道根据此客观事实进行生动合理裁决，绝不可让不在场之人瞬间穿墙同行。）\n`;
  }
  if (gate && gate.alternatives && gate.alternatives.length > 0) {
    hints += `（【天机机缘与替代方案】：${gate.alternatives.join('；')}）\n`;
  }

  return hints;
}
