/**
 * 状态摘要 —— 把世界状态压成一段给叙述层看的「天机」文字
 * 纯规则生成，不调用大模型；目标 ≤ 800 token。
 */
import { loadState, worldDate, readRecentEvents, seasonCN, shichenOf, round2, ensureCities, standingOf, forceOf } from './state.js';
import { arcViewFor } from './arcs.js';
import { describeScene } from './scene.js';
import { recentActivities } from './actors.js';

function money(assets) {
  const parts = [];
  parts.push(`现银 ${round2(assets.silver)} 两`);
  if (Number(assets.copper)) parts.push(`铜钱 ${assets.copper} 吊`);
  const income = (assets.properties || []).reduce((s, p) => s + (Number(p.incomePerDay) || 0), 0);
  if (income > 0) parts.push(`日入 ${round2(income)} 两`);
  return parts.join(' · ');
}

function propsDetail(props) {
  const bits = [];
  for (const p of props) {
    const extra = [];
    if (p.staff) extra.push(`${p.staff}个人手`);
    const s = `${p.name}（日入${p.incomePerDay}两${extra.length ? '，' + extra.join('，') : ''}）`;
    bits.push(s);
  }
  return bits.join('；');
}

function propsLine(assets) {
  const props = (assets.properties || []).filter((p) => p.status !== '正常营业');
  if (props.length === 0) return '';
  return props.map((p) => `${p.name}（${p.status}）`).join('、');
}

// 只列「主子级」在场者。仆役（阿吉/小翠）一律不列：
// 一旦把仆人写进【在场】，模型遇到"回家/看茶"这类场景就会让仆人抢答，把主母的戏抢走。
// 只把「仆人」排除在【在场】之外（他们抢话），其余在场的人一律给出态度，好人坏人都有阻力
const SERVANT_IDS = new Set(['xiaocui', 'aji']);

/**
 * 把关系数值翻译成「她此刻的态度」。
 * 只给阻力（好不好接近、会不会答应），**不给结局**——成不成由天道演。
 */
function attitudeOf(actor) {
  const d = Number(actor?.relations?.husband?.desire ?? 0);
  const t = Number(actor?.relations?.husband?.trust ?? 0);
  const g = Number(actor?.relations?.husband?.grievance ?? 0);

  // 府里的下人：听差遣的自家人，不谈交情也不谈男女
  if (actor?.servant) {
    if (g >= 60) return '心里有气，但不敢违拗';
    if (t >= 60) return actor.gender === 'male' ? '忠心办事的伙计，最得力' : '贴心的丫头，最得力';
    return actor.gender === 'male' ? '府里的伙计，听你差遣' : '府里的丫头，听你差遣';
  }

  // 府里的男仆/伙计：听差遣的下人，不谈交情也不谈敌意
  if (actor?.gender === 'male' && actor?.household) {
    if (g >= 60) return '心里有气，但不敢违拗';
    if (t >= 60) return '忠心办事的伙计，最得力';
    return '府里的伙计，听你差遣';
  }

  // 外头的男人：谈的是交情与敌意，不是欲望
  if (actor?.gender === 'male') {
    if (g >= 60) return '对你有敌意，见面就要生事';
    if (g >= 30) return '心里有疙瘩，面上还得应酬';
    if (t >= 60) return '跟你称兄道弟，未必真心';
    return '点头之交，各怀算盘';
  }

  // 已进门的妻妾侍女：是自己人，绝不会真拒绝，最多闹闹小脾气
  if (actor?.household) {
    if (g >= 60) return '心里有气，会闹一场、要哄，但仍是你的妻妾';
    if (d >= 60) return '心里有你，主动迎合';
    if (d >= 30) return '愿意服侍，但会撒撒娇、拿你两句';
    return '虽有些倦，仍会应下';
  }

  // 外人 / 有夫之妇：这里才是真阻力
  if (g >= 60) return '心里有怨，轻易不松口';
  // 已经成过事的相好：嘴上还要端着，身子早应了——不会再"到此为止"
  if (actor?.intimacy?.consummated) {
    if (d >= 50) return '已是你的相好，嘴上推拒两句，身子早应了';
    return '已是你的相好，只是脸皮薄，要你先把话递过去';
  }
  if (d >= 70 && t >= 55) return '心里已有你，半推半就';
  if (d >= 45) return '有点意动，但要给足由头与体面';
  if (t >= 45) return '当你是可信的人，但到此为止';
  if (d <= 20 && t <= 30) return '只是相识，提防着——第一次必拒，硬来会翻脸';
  return '有意无意地打量着，不肯先开口';
}

function relationLine(actor) {
  const r = actor?.relations?.husband;
  if (!r) return actor?.name || '';
  const bits = [`信任${Math.round(r.trust ?? 0)}`, `欲望${Math.round(r.desire ?? 0)}`];
  if (Number(r.grievance) > 0) bits.push(`怨怼${Math.round(r.grievance)}`);
  return `${actor.name}（${bits.join(' ')}｜${attitudeOf(actor)}）`;
}

function describeEvent(e) {
  if (!e) return '';
  const day = `第${e.day}日`;
  if (e.action === 'gossip') return `${day}·市井风闻：${e.payload?.text || ''}`;
  if (e.action === 'event_fired') return `${day}·${e.payload?.desc || '城中起了变故'}`;
  if (e.action === 'settle') return '';
  if (e.payload?.text) return `${day}·${e.payload.text}`;
  return '';
}

/**
 * 生成给相公端（丈夫）看的状态摘要。
 * 女主人端与孩子端不出这段，避免王家账本串味（见 docs/world-engine.md 第 13 节）。
 */
export function buildStateSummary(dataDir, { roleName = '', memberKey = 'husband', viewer = null } = {}) {
  try {
    const world = loadState(dataDir);
    const lines = [];

    // ── 真人扮演某个世界里的人物：只给她自己该知道的视角 ──
    if (viewer && viewer !== 'husband' && world.actors?.[viewer]) {
      const meV = world.actors[viewer];
      const dayV = world.clock?.day ?? 1;
      const hourV = world.clock?.hour ?? 0;
      const wdV = worldDate(world);
      const placeV = world.places?.[meV.location]?.name || meV.location || '';
      lines.push(
        `【天机】${world.era || '乾宁三年'}·${seasonCN(world.clock?.season || 'spring')} ${wdV ? `${wdV.month}月${wdV.day}日` : `第${dayV}日`}${wdV?.lunar ? `（农历${wdV.lunar.text}）` : ''} ${shichenOf(hourV)}`,
      );
      lines.push(`【你是谁】${meV.name}，${meV.role || ''}。${(meV.goals || []).length ? `你心里惦记的事：${meV.goals.join('、')}。` : ''}`);
      lines.push(`【所在】${placeV}`);
      // 同处的人（不透露别人对你的好感数值，只给人名与身份）
      const othersV = Object.values(world.actors || {}).filter(
        (a) => a && a.id !== viewer && a.id !== 'husband' && a.kind !== 'human' && a.location === meV.location,
      );
      const husbandHere = world.actors?.husband?.location === meV.location;
      const spouseV = Object.values(world.actors || {}).find(
        (x) => x && x.id !== viewer && x.id !== 'husband' && x.gender === 'male' && x.home && meV.home && x.home === meV.home,
      );
      const presentNames = [
        ...(husbandHere ? ['王甯（临江茶坊少掌柜，与她相好）'] : []),
        ...othersV.map((a) => {
          const isSpouse = spouseV && a.id === spouseV.id;
          return `${a.name}（${a.role || ''}${isSpouse ? '·她的丈夫' : ''}）`;
        }),
      ];
      lines.push(`【在场】${presentNames.length ? presentNames.join('、') : '只你一人'}`);
      // 你自己的心事（以你的感受表述，不给数字）
      const relV = meV.relations?.husband;
      if (relV) {
        const feel = [];
        if (Number(relV.grievance) >= 40) feel.push('心里有气还没消');
        else if (Number(relV.grievance) >= 15) feel.push('心里有点疙瘩');
        if (Number(relV.desire) >= 60) feel.push('对他有情意');
        else if (Number(relV.desire) >= 35) feel.push('对他有些意动');
        if (Number(relV.trust) >= 60) feel.push('信得过他');
        else if (Number(relV.trust) < 35) feel.push('对他还留着心');
        lines.push(`【你此刻的心事】${feel.length ? feel.join('；') : '说不上来'}`);
      }
      if (meV.pregnancy) lines.push(`【身孕】你已有身孕约${Math.floor((Number(meV.pregnancy.days) || 0) / 30)}个月`);
      // 只有你自己的孩子
      const myKids = Object.values(world.actors || {}).filter(
        (k) => k?.bornDay && String(k.role || '').includes(meV.name),
      );
      if (myKids.length) lines.push(`【你的孩子】${myKids.map((k) => `${k.name}（${Math.max(0, dayV - Number(k.bornDay))}天）`).join('、')}`);
      // 只有你自己的约定
      const myAppts = (world.appointments || []).filter(
        (a) => a && (a.actorId === viewer || a.name === meV.name),
      );
      if (myAppts.length) {
        lines.push(`【你应下的事】${myAppts.map((a) => `第${a.day}日${a.hour}时 在${world.places?.[a.place]?.name || '老地方'}${a.text ? `（${a.text}）` : ''}`).join('；')}`);
      }
      // 只有与她有关的旧事
      const myMem = (world.memories || []).filter((m) => m && String(m.text || '').includes(meV.name));
      if (myMem.length) lines.push(`【你记得的事】${myMem.slice(-6).map((m) => String(m.text).slice(0, 34)).join('；')}`);
      // 她自己的兵（如果有）
      try {
        const myF = world.forces?.[viewer];
        if (myF) {
          const total = (Number(myF.guards) || 0) + (Number(myF.militia) || 0) + (Number(myF.army) || 0);
          if (total > 0) {
            lines.push(`【你的人马】护院${myF.guards || 0} 乡勇${myF.militia || 0} 兵马${myF.army || 0} · 训练${myF.quality || 0} 士气${myF.morale || 0} 粮草${myF.supplies || 0}日`);
          }
        }
        const mineCities = Object.entries(world.cities || {}).filter(([, c]) => c.owner === `actor_${viewer}`);
        if (mineCities.length) lines.push(`【你的城】${mineCities.map(([n]) => n).join('、')}`);
      } catch {
        /* 忽略 */
      }

      // 她自己的主线（难关），只有她自己看得见
      try {
        const arc = arcViewFor(world, viewer);
        if (arc) {
          const doneArc = world.arcs?.[viewer];
          if (doneArc?.done) {
            lines.push(`【你的难关】${arc.title}——已了结：${doneArc.outcome || ''}`);
          } else {
            let limit = '';
            if (doneArc?.atEdge) {
              const left = 3 - ((Number(world.clock?.day) || 1) - Math.max(Number(doneArc.atEdgeDay) || 0, Number(doneArc.lastActiveDay) || 0));
              limit = left > 0 ? `（再不动手，${left}天后就由不得你了）` : '（已在最后关头）';
            }
            lines.push(`【你的难关】${arc.title}——${arc.hook}。眼下：${arc.step}${limit}`);
          }
        }
      } catch {
        /* 忽略 */
      }
      lines.push('【提醒】你只知道你亲眼见过、亲耳听过的事。别人的银钱、产业、与他人私下的往来，你一概不知，也不许"忽然懂了"。');
      return lines.join('\n');
    }

    const day = world.clock?.day ?? 1;
    const hour = world.clock?.hour ?? 0;
    const season = world.clock?.season || 'spring';
    const weather = world.clock?.weather || '';
    const wd = worldDate(world);
    const lunarText = wd?.lunar?.text ? `农历${wd.lunar.text}` : '';
    const solarText = wd ? `${wd.month}月${wd.day}日` : `第${day}日`;
    lines.push(
      `【天机】${world.era || '乾宁三年'}·${seasonCN(season)} ${solarText}${lunarText ? `（${lunarText}）` : ''} ${shichenOf(hour)}${weather ? ` ${weather}` : ''}`,
    );

    const me = world.actors?.[memberKey] || world.actors?.husband;
    const here = me?.location || 'tea_house';
    const placeName = world.places?.[here]?.name || '临江茶坊';
    lines.push(`【所在】${placeName}`);

    // 同场与偶遇：有别的真人在同一处，这场话就是公开的，私密不得外露
    try {
      lines.push(`【场合】${describeScene(world, here, memberKey).line}`);
    } catch {
      /* 场景信息失败不影响摘要 */
    }

    // 府中到底有谁：以世界账本为准（旧的花名册数组早就不准了）
    try {
      const household = Object.values(world.actors || {}).filter(
        (a) => a && a.kind !== 'human' && a.household,
      );
      if (household.length > 0) {
        lines.push(
          `【府中】你的家人，天天见面的自己人：${household
            .map((a) => {
              const where = world.places?.[a.location]?.name || a.location || '';
              return `${a.name}（${a.role}${where ? `，住${where}` : ''}）`;
            })
            .join('、')}`,
        );
      }
    } catch {
      /* 忽略 */
    }

    const presentActors = Object.values(world.actors || {})
      .filter((a) => a && a.id !== 'husband' && a.kind !== 'human' && a.location === here && !SERVANT_IDS.has(a.id));
    const present = presentActors.map(relationLine).filter(Boolean);
    if (present.length > 0) {
      lines.push(`【在场】${present.join('、')}`);
      // 在场的人各有自己的店/家：她在这儿说的"下楼招呼客人"，不是指自己的铺子
      const away = presentActors
        .filter((a) => a.home && a.home !== here && world.places?.[a.home])
        .map((a) => `${a.name}的铺子/家在${world.places[a.home].name}`);
      if (away.length > 0) {
        lines.push(`【各自的去处】${away.join('；')} —— 她此刻在${placeName}，要说"回自己铺子"才算离开。`);
      }
    }

    // 子嗣：谁生了谁，多大了
    try {
      const kids = Object.values(world.actors || {}).filter((a) => a?.bornDay && a.role && /所生/.test(a.role));
      if (kids.length > 0) {
        lines.push(
          `【子嗣】${kids
            .map((k) => `${k.name}（${k.role}，${Math.max(0, world.clock.day - Number(k.bornDay))}天）`)
            .join('、')}`,
        );
      }
    } catch {
      /* 忽略 */
    }

    // 身孕：怀上了就一直跟着她，不会聊完就没
    try {
      const pregs = Object.values(world.actors || {}).filter((a) => a?.pregnancy && !a.pregnancy.born);
      if (pregs.length > 0) {
        lines.push(
          `【身孕】${pregs
            .map((a) => {
              const d = Number(a.pregnancy.days) || 0;
              const m = Math.floor(d / 30);
              return `${a.name}（怀上约${m}个月${d >= 120 ? '，已显怀' : ''}）`;
            })
            .join('、')}`,
        );
      }
    } catch {
      /* 忽略 */
    }

    // 天下：谁占着哪些城、你自己的兵力
    try {
      ensureCities(world);
      const mine = Object.entries(world.cities || {}).filter(([, c]) => c.owner === 'wangjia');
      const powers = Object.values(world.powers || {})
        .filter((p) => p && p.kind !== '商帮')
        .slice(0, 4)
        .map((p) => `${p.name}(${p.kind},兵${p.troops})`);
      if (powers.length) lines.push(`【天下】${powers.join('、')}`);
      // 朝中：谁坐着什么位子，哪个位子空着
      try {
        const offs = Object.entries(world.court?.offices || {}).map(([k, o]) => {
          const holder = o.holder ? world.actors?.[o.holder]?.name : null;
          return `${o.title}${holder ? ':' + holder : '（空缺）'}`;
        });
        if (offs.length) lines.push(`【朝中】${offs.join('、')}`);
        const mnd = world.court?.mandate || {};
        if (mnd.quality) {
          lines.push(`【天意】${mnd.quality === 'benevolent_deceived' ? '当今天子并非昏君，只是被权臣蒙蔽' : '当今天子'}：${mnd.note || ''}${mnd.wrath ? '（天道已降罚，天下大乱）' : ''}`);
        }
        const dec = (world.court?.decisions || []).filter((d) => d.kind === 'regicide');
        if (dec.length) {
          lines.push('【待决】相公已动过弑君之念。天道示警：杀的是被蒙蔽的仁君，真凶在朝中。你要把这话说给他听，等他亲口定夺——他不改口才可动手。');
        }
        if (world.flags?.chosenName && mnd.wrath) {
          lines.push(`【天命】${world.flags.chosenName} 已应运而起，各地义军并立`);
        }
      } catch {
        /* 忽略 */
      }
      // 地方：物产、物价、税率、民心
      const own = Object.entries(world.cities || {}).filter(([, c]) => c.owner === 'wangjia').slice(0, 3);
      if (own.length) {
        lines.push(
          `【你的地方】${own
            .map(([n, c]) => `${n}（${(c.goods || []).join('/') || '无特别物产'}，物价${c.price}，税${c.tax}%，民心${c.unrest}）`)
            .join('；')}`,
        );
      }
      lines.push(`【名声】士绅口碑${world.reputation ?? 50} · 官府通缉${world.wanted ?? 0}`);
      try {
        const here = world.actors?.[viewer || 'husband']?.location;
        const hereCity = world.places?.[here]?.name || '';
        const near = (world.terrain || []).filter((t) => (t.cities || []).some((cn) => hereCity.includes(String(cn).replace('府', '')) || String(cn).includes(hereCity)));
        const list = near.length ? near : (world.terrain || []).slice(0, 3);
        if (list.length) {
          lines.push(`【山河】${list.map((t) => `${t.name}（${t.note}）`).join('；')}`);
        }
      } catch {
        /* 忽略 */
      }
      try {
        const key = viewer || 'husband';
        const allies = (world.allies?.[key] || []).map((id) => world.actors?.[id]?.name).filter(Boolean);
        if (allies.length) lines.push(`【盟友】${allies.join('、')}（可合兵）`);
      } catch {
        /* 忽略 */
      }
      try {
        const st = standingOf(world);
        lines.push(`【身份】${st.level}（${st.note}）${st.next ? `，距「${st.next.name}」还差 ${Math.max(0, st.next.at - st.score)} 分` : ''}`);
      } catch {
        /* 忽略 */
      }
      if (mine.length) {
        lines.push(`【你的城】${mine.map(([n]) => n).join('、')}`);
      }
      const mil = world.military || {};
      if ((Number(mil.guards) || 0) + (Number(mil.militia) || 0) + (Number(mil.army) || 0) > 0) {
        lines.push(`【兵马】护院${mil.guards || 0} 乡勇${mil.militia || 0} 兵马${mil.army || 0} · 训练${mil.quality || 0} 士气${mil.morale || 0} 粮草${mil.supplies || 0}日`);
      }
    } catch {
      /* 忽略 */
    }

    const moneyText = money(world.assets || {});
    const propsText = propsLine(world.assets || {});
    lines.push(`【家底】${moneyText}${propsText ? ` · ${propsText}` : ''}`);

    const milestones = Array.isArray(world.milestones) ? world.milestones.slice(-2) : [];
    if (milestones.length > 0) {
      lines.push(`【既定事实】${milestones.map((m) => String(m).slice(0, 80)).join(' / ')}`);
    }

    // NPC 自己的日子：只给事实（谁在忙什么），怎么演由天道裁定
    try {
      const acts = recentActivities(world, 2);
      if (acts.length > 0) {
        lines.push(`【近况】${acts.map((a) => `${a.name}在忙：${String(a.goal).slice(0, 24)}`).join('；')}`);
      }
    } catch {
      /* 忽略 */
    }

    // 账本消毒：府里已有的人，绝不可能再被"迎娶/纳聘"——这类记录是历史误记，一律不显示
    const houseKeys = new Set(
      Object.values(world.actors || {})
        .filter((a) => a?.household && a.name)
        .flatMap((a) => [a.name, a.name.length > 2 ? a.name.slice(-2) : a.name]),
    );
    const isBogusMarriage = (t) => {
      const s = String(t || '');
      if (!/(迎娶|迎纳|纳妾|聘礼|八抬|入府|进门|开脸|娶)/.test(s)) return false;
      for (const n of houseKeys) if (s.includes(n)) return true;
      return false;
    };
    // 只取「已经发生」的：时钟回拨后，旧账里会有晚于当前时刻的记录，不能当成已经发生的事
    const nowH = (Number(world.clock?.day) || 1) * 24 + (Number(world.clock?.hour) || 0);
    const recent = readRecentEvents(dataDir, 16)
      .filter((e) => (Number(e?.day) || 0) * 24 + (Number(e?.hour) || 0) <= nowH)
      .map(describeEvent)
      .filter(Boolean)
      .filter((line) => !isBogusMarriage(line))
      .slice(-3);
    if (recent.length > 0) lines.push(`【她记得】${recent.join('；')}`);

    // 暗号与亲密状态（契约的当前档位，不是台词）
    const ritualId =
      roleName === '傲娇助手'
        ? 'waner'
        : Object.entries(world.actors || {}).find(([, a]) => a?.role === roleName)?.[0];
    const intimacy = ritualId ? world.actors?.[ritualId]?.intimacy : null;
    if (intimacy?.ritual) {
      lines.push(
        intimacy.ritual === 'unlocked'
          ? `【私密】已解禁 · 语气档位 ${intimacy.tone ?? 3}/3（事毕须立刻归位温存）`
          : '【私密】未解禁（端庄矜持；对出暗号方才解禁）',
      );
    }


    const promises = (world.promises || []).filter((p) => p && !p.done && !isBogusMarriage(p.text));
    if (promises.length > 0) {
      const items = promises
        .slice(0, 3)
        .map((p) => `第${p.due}日「${String(p.text || '').slice(0, 30)}」${day > Number(p.due) ? '（已逾期）' : '（未到期）'}`);
      lines.push(`【待兑现】${items.join('；')}`);
    }

    // 约定：约好某日某时见面，到点她会自己上门
    try {
      const nowHour = day * 24 + hour;
      // 同一人同一时刻只保留最新那条（后写的覆盖先写的），避免自相矛盾的约定堆在一起
      const raw2 = (world.appointments || []).filter((a) => a && Number(a.day) * 24 + Number(a.hour) >= nowHour);
      const latest = new Map();
      for (const a of raw2) {
        const key = `${a.day}-${a.hour}-${a.name}`;
        latest.set(key, a); // 后出现的覆盖前面的
      }
      const aps = [...latest.values()]
        .sort((a, b) => Number(a.day) * 24 + Number(a.hour) - (Number(b.day) * 24 + Number(b.hour)))
        .slice(0, 3);
      if (aps.length > 0) {
        lines.push(
          `【约定】${aps
            .map((a) => `第${a.day}日${a.hour}时 ${a.name}${a.text ? `（${a.text}）` : ''}`)
            .join('；')} —— **在场的那一位必须主动提起这件事**（"明日晌午雅阁，妾身记着呢"）。`,
        );
      }
    } catch {
      /* 忽略 */
    }

    // 势力与线索：复仇/翻案线的进度账本
    try {
      const fs2 = Object.values(world.factions || {});
      if (fs2.length > 0) {
        lines.push(`【势力】${fs2.map((f) => `${f.name} ${Number(f.relation) >= 0 ? '+' : ''}${Math.round(Number(f.relation) || 0)}`).join(' · ')}`);
      }
      const cls = (world.clues || []).slice(-4);
      if (cls.length > 0) {
        lines.push(`【线索】${cls.map((c) => String(c.text || '').slice(0, 30)).join('；')}`);
      }
    } catch {
      /* 忽略 */
    }

    // 「她与相公的约」：把当前这个角色自己的约定单独拎出来，否则她根本不会主动提
    try {
      const meId =
        roleName === '傲娇助手'
          ? 'waner'
          : Object.entries(world.actors || {}).find(([, a]) => a?.role === roleName)?.[0];
      const meActor = meId ? world.actors?.[meId] : null;
      const mine = (world.appointments || []).filter(
        (a) => a && meActor && (a.actorId === meId || a.name === meActor.name),
      );
      if (mine.length > 0) {
        lines.push(
          `【她与相公的约】${mine
            .map((a) => `第${a.day}日${a.hour}时 在${world.places?.[a.place]?.name || a.place || '老地方'}${a.text ? `（${a.text}）` : ''}`)
            .join('；')} —— 这是她自己应下的，见面时要主动提起。`,
        );
      }
    } catch {
      /* 忽略 */
    }

    // 长期记忆：不受 14 条对话窗口限制，一直跟着她
    try {
      const mems = Array.isArray(world.memories) ? world.memories.slice(-12) : [];
      if (mems.length > 0) {
        lines.push(`【旧事】${mems.map((m) => String(m.text || '').slice(0, 40)).join('；')}`);
      }
    } catch {
      /* 忽略 */
    }

    const pending = (world.pending || []).slice(0, 3);
    if (pending.length > 0) {
      const items = pending.map((p) => `第${p.due}日 ${String(p.desc || '').slice(0, 40)}`);
      lines.push(`【暗涌】${items.join('；')}`);
    }

    return lines.join('\n');
  } catch (err) {
    console.warn('[World] 状态摘要生成失败：', err.message);
    return '';
  }
}
