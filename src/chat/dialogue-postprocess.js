/**
 * 对话后处理与发音人管道：
 * 包含在场人员约束校验、角色花名归一化、口述收入确定性落账、长久记忆压缩与记账员回执提取。
 * 从 pet-service.js 剥离，职责纯化。
 */

import { cleanSpeakerLabel, cleanRoleLabel, cnNum } from './text-utils.js';
import { loadState, saveState } from '../world/state.js';
import { parseWorldTags, applyWorldTags } from '../world/dispatch.js';
import { appendLedger } from '../world/ledger.js';

/**
 * 校验回复中涉及的发音人是否在场，剔除不在场的人说的台词
 */
export function enforcePresence(text, allowedNames, knownNames = []) {
  const cleanAllowed = (allowedNames || []).flatMap((n) => {
    const c = cleanSpeakerLabel(n);
    return [c, c.length > 2 ? c.slice(-2) : c];
  }).filter(Boolean);

  const segs = String(text || '').split(/(?=【[^】\n]{1,12}】)/);
  const kept = [];
  const dropped = [];
  for (const seg of segs) {
    if (!seg) continue;
    const m = seg.match(/^【([^】\n]{1,12})】/);
    if (!m) {
      kept.push(seg);
      continue;
    }
    const rawSpeaker = m[1].trim();
    if (/^天道/.test(rawSpeaker)) {
      kept.push(seg);
      continue;
    }
    const pureSpeaker = cleanSpeakerLabel(rawSpeaker);
    const pureShort = pureSpeaker.length > 2 ? pureSpeaker.slice(-2) : pureSpeaker;

    // 只有「账本里真有的人」才算说话人；动作描写不参与在场删除
    const isKnown = (knownNames || []).some((n) => {
      const cn = cleanSpeakerLabel(n);
      return cn && (pureSpeaker.includes(cn) || cn.includes(pureSpeaker));
    });
    if (!isKnown) {
      kept.push(seg);
      continue;
    }

    const isAllowed = cleanAllowed.some(
      (a) => a && (pureSpeaker.includes(a) || a.includes(pureSpeaker) || pureShort === a),
    );
    if (isAllowed) {
      kept.push(seg);
    } else {
      dropped.push(rawSpeaker);
    }
  }
  const out = kept.join('').trim();
  return { text: out, dropped };
}

/**
 * 统一说话人花名：模型写成「【沈婉儿】」「【婉儿】」都归一到「【正妻·婉儿】」
 */
export function normalizeSpeakers(text, dataDir) {
  try {
    const world = (dataDir && typeof dataDir === 'object' && dataDir.actors) ? dataDir : loadState(dataDir);
    const map = new Map();

    for (const a of Object.values(world.actors || {})) {
      if (!a?.name || a.id === 'husband' || a.name === '王甯') continue;
      const short = a.name.length > 2 ? a.name.slice(-2) : a.name;
      const roleTitle = cleanRoleLabel(a.role || a.title || a.label);
      const label = roleTitle ? `${roleTitle}·${short}` : a.name;
      map.set(a.name, label);
      if (short !== a.name) map.set(short, label);
    }
    // 尊称与身份反向归一映射：解决大模型只写【正妻】、【二房】等导致丢失名字的问题
    if (world.actors?.waner) {
      map.set('沈婉儿', '正妻·婉儿');
      map.set('婉儿', '正妻·婉儿');
      map.set('正妻', '正妻·婉儿');
      map.set('大娘子', '正妻·婉儿');
      map.set('少夫人', '正妻·婉儿');
      map.set('正室', '正妻·婉儿');
    }
    if (world.actors?.yunnia) {
      map.set('林芸娘', '二房·芸娘');
      map.set('芸娘', '二房·芸娘');
      map.set('二房', '二房·芸娘');
      map.set('二娘子', '二房·芸娘');
      map.set('如夫人', '二房·芸娘');
      map.set('侧妾', '二房·芸娘');
    }
    if (world.actors?.xiaocui) {
      map.set('小翠', '丫鬟·小翠');
      map.set('丫鬟', '丫鬟·小翠');
      map.set('通房丫鬟', '丫鬟·小翠');
      map.set('大丫鬟', '丫鬟·小翠');
    }
    if (world.actors?.liuwenxia) {
      map.set('刘文霞', '老板娘·紫嫣');
      map.set('文霞', '老板娘·紫嫣');
      map.set('紫嫣', '老板娘·紫嫣');
    }
    if (world.actors?.zhanjing) {
      map.set('战静', '发妻·静儿');
      map.set('静儿', '发妻·静儿');
    }
    let res = String(text || '').replace(/【([^】\n]{1,10})】/g, (whole, name) => {
      const hit = map.get(String(name).trim());
      return hit ? `【${hit}】` : whole;
    });
    // 治理【姓名·姓名】重复的缺陷（如【陈二·陈二】 -> 【伙计·陈二】）
    res = res.replace(/【([^·】\n]{1,6})[·・]\1】/g, (m0, dupName) => {
      const a = Object.values(world.actors || {}).find((x) => x && (x.name === dupName || x.name?.endsWith(dupName)));
      if (a) {
        const r = cleanRoleLabel(a.role || a.title) || '伙计';
        return `【${r}·${dupName}】`;
      }
      return `【${dupName}】`;
    });
    // 治理残缺括号头衔（如【跑商路）·勋柱】 -> 【掌柜·勋柱】）
    res = res.replace(/【[^】\n]*?[)）]\s*[·・]?\s*([^】\n]{1,6})】/g, (m0, actName) => {
      const a = Object.values(world.actors || {}).find((x) => x && (x.name === actName || x.name?.endsWith(actName)));
      const r = cleanRoleLabel(a?.role || a?.title) || '掌柜';
      return `【${r}·${actName}】`;
    });
    // 容错：如果模型输出 "张三：“台词”" 而漏了方括号，自动补齐 "【张三】：“台词”"
    for (const [name, label] of map.entries()) {
      if (name.length >= 2) {
        const rawRegex = new RegExp(`(^|\\n)(${name})\\s*[:：]\\s*([“"'])`, 'g');
        res = res.replace(rawRegex, `$1【${label}】：$3`);
      }
    }

    // 治理男性角色被大模型误套正妻人设自称“妾身/奴婢”的荒唐问题
    const segs = res.split(/(?=【[^】\n]{1,12}】)/);
    const correctedSegs = segs.map((seg) => {
      const spkMatch = seg.match(/^【([^】\n]{1,12})】/);
      if (!spkMatch) return seg;
      const spk = spkMatch[1].trim();
      // 判断说话人是否为男性
      const actor = Object.values(world.actors || {}).find(
        (a) => a && (a.name === spk || spk.includes(a.name) || (a.name && spk.endsWith(a.name)))
      );
      const isMale = (actor && actor.gender === 'male') ||
        /叔|爷|伯|公|男|生|掌柜|账房|大厨|伙计|护院|家丁|大人|总商|捕快|师爷|小二|小厮|兄|爹|汉/.test(spk);
      const isFemale = (actor && actor.gender === 'female') ||
        /妻|妾|娘|妹|姐|丫鬟|女|姑|妇|婆/.test(spk);

      if (isMale && !isFemale) {
        // 男性严禁自称妾身、奴婢、小女
        let cSeg = seg;
        // 如果是长者、乡绅、士人、客商
        if (/乡绅|老|叔|爷|伯|公|大人|总商|汪德润|袁/.test(spk)) {
          cSeg = cSeg.replace(/妾身/g, '老夫').replace(/奴婢/g, '在下').replace(/小女/g, '在下');
        } else if (/掌柜|账房|大厨|伙计|护院|小二|小厮|小的/.test(spk)) {
          cSeg = cSeg.replace(/妾身/g, '小的').replace(/奴婢/g, '小的').replace(/小女/g, '小的');
        } else {
          cSeg = cSeg.replace(/妾身/g, '在下').replace(/奴婢/g, '在下').replace(/小女/g, '在下');
        }
        return cSeg;
      }
      return seg;
    });
    res = correctedSegs.join('');

    return res;
  } catch {
    return text;
  }
}

/**
 * 确定性记账：相公话里明确说了「日入 N 两」，就直接把产业营收改过去。
 */
export function applyStatedIncome(userText, dataDir) {
  try {
    const say = String(userText || "");
    const m = say.match(/(?:日入|每天|每日|一天|日进)[^0-9一二三四五六七八九十百千]{0,16}([0-9]+(?:\.[0-9]+)?|[一二三四五六七八九十百千]+)\s*两/);
    if (!m) return [];
    const value = /^[0-9]/.test(String(m[1])) ? Number(m[1]) : cnNum(m[1]);
    const world = loadState(dataDir);
    const props = Array.isArray(world.assets?.properties) ? world.assets.properties : [];
    if (props.length === 0) return [];
    const opened = /开张|营业|开业/.test(say);
    const bizWord = /(日入|日进|营收|流水|进项|开张|营业|开业|每天|每日|一天)/.test(say);
    if (!bizWord) return [];
    const named = props.find((p) => { const nm = String(p.name || ""); for (let n = nm.length; n >= 2; n--) { for (let i = 0; i + n <= nm.length; i++) { if (say.includes(nm.slice(i, i + n))) return true; } } return false; });
    const openedWord = /开张|营业|开业/.test(say);
    const newShop = /(开|新开|盘下|置办)[^，。]{0,6}(店|铺|庄|楼|行|坊|号)/.test(say);
    if (!named && !openedWord && !newShop) return [];
    const expense = /(花|用掉|喝|吃|买|付给|欠|还了|赏|赌|输)/.test(say);
    if (expense && !openedWord) return [];
    if (!named && newShop) {
      const nm = ((say.match(/(?:开|新开|盘下|置办)[^，。]{0,6}?([\u4e00-\u9fa5]{2,8}(?:店|铺|庄|楼|行|坊|号))/) || [])[1] || "").replace(/^(?:一间|一家|一个|一座|一|间|家|个|座|条|处)/, "");
      if (nm && !props.some((x) => x.name === nm)) {
        world.flags.propSeq = (Number(world.flags.propSeq) || 0) + 1;
        world.assets.properties = props;
        let placeId = null;
        const pm = say.match(/在\s*([\u4e00-\u9fa5]{2,8}?)(?:开|盘|置|租|买|，|。|$)/);
        if (pm) {
          const want = pm[1].trim().replace(/(新|的|那边|附近|里|处|一带)$/u, "");
          placeId = Object.keys(world.places || {}).find((id) => {
            const n = String(world.places[id]?.name || "");
            return n && (n.includes(want) || want.includes(n));
          }) || null;
          if (!placeId && want.length >= 2) {
            world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;
            placeId = `place_${world.flags.placeSeq}`;
            world.places[placeId] = { name: want, exits: ["street"], dynamic: true };
          }
        }
        let staff = 0;
        const sm = say.match(/([0-9]+|[一二三四五六七八九十]+)\s*个?\s*(?:伙计|人手|伙计|帮工|小二)/);
        if (sm) staff = /^[0-9]/.test(sm[1]) ? Number(sm[1]) : cnNum(sm[1]);
        let keeper = null;
        for (const a of Object.values(world.actors || {})) {
          if (a?.name && say.includes(a.name)) { keeper = a.id; break; }
        }
        world.flags.propSeq = (Number(world.flags.propSeq) || 0) + 1;
        world.assets.properties = props;
        props.push({ id: `prop_${world.flags.propSeq}`, name: nm, kind: "shops", incomePerDay: value, status: "已开张", place: placeId, keeper, staff, openedDay: world.clock.day });
        saveState(dataDir, world);
        console.log(`[Ledger] 新开产业：${nm} 日入 ${value} 两`);
        return [`新产业:${nm}`];
      }
    }
    const target = named || props.find((p) => !(Number(p.incomePerDay) > 0)) || props[0];
    if (!target) return [];
    const before = Number(target.incomePerDay) || 0;
    target.incomePerDay = value;
    if (opened) target.status = "已开张";
    for (const pr of world.promises || []) {
      if (!pr.done && opened && /开张|开业/.test(String(pr.text || ""))) {
        pr.done = true;
        pr.doneDay = world.clock.day;
      }
    }
    saveState(dataDir, world);
    console.log(`[Ledger] 按相公口述落账：${target.name} 日入 ${value} 两${opened ? "（已开张）" : ""}（原 ${before}）`);
    return [`${target.name} 日入${value}两`];
  } catch (err) {
    console.warn("[Ledger] 口述落账失败：", err.message);
    return [];
  }
}

/**
 * 掌柜/账房递定金收条，相公批复时真实入账进流水
 */
export function applyStatedDeposit(userText, lastMsgText, { dataDir } = {}) {
  try {
    const say = String(userText || '').trim();
    const prev = String(lastMsgText || '').trim();
    if (!/(?:好|好的|成|妥|行|准|准了|收下|好嘞|知道了|办妥|结清|准奏|阅|允|行吧)/.test(say)) return [];

    const applied = [];
    const world = loadState(dataDir);

    // 提取业务标题
    let title = '产业大单定金';
    if (/汪总商|汪老夫人|天字阁|寿宴/.test(prev)) title = '运河大酒楼·汪总商寿宴定金';
    else if (/知府|衙门|官宴/.test(prev)) title = '运河大酒楼·官席定金';
    else if (/茶|货栈/.test(prev)) title = '茶坊货栈大宗定金';

    // 1. 定金落账：只在"还欠/尾款"之前找定金金额，别把尾款又当定金收一遍
    const head = prev.split(/(?:还欠|尾款|余款|尚欠)/)[0];
    const m = head.match(/([0-9]+(?:\.[0-9]+)?|[一二三四五六七八九十百千]+)\s*两(?:纹银)?\s*(?:的)?\s*(?:定金|订金|货款)/)
      || head.match(/(?:定金|订金|货款)[^0-9一二三四五六七八九十百千]{0,16}([0-9]+(?:\.[0-9]+)?|[一二三四五六七八九十百千]+)\s*两/);
    if (m) {
      const amount = /^[0-9]/.test(String(m[1])) ? Number(m[1]) : cnNum(m[1]);
      if (amount > 0) {
        const ledger = Array.isArray(world.ledger) ? world.ledger : [];
        const already = ledger.slice(-12).some((e) => e && Math.abs(e.delta - amount) < 0.01 && e.day === world.clock?.day && /(?:定金|定银|寿宴|大单)/.test(e.title || ''));
        if (!already) {
          world.assets = world.assets || {};
          world.assets.silver = Math.round(((Number(world.assets.silver) || 0) + amount) * 100) / 100;
          appendLedger(world, { delta: amount, title, by: 'husband' });
          applied.push(`${title}+${amount}两`);
          console.log(`[Ledger] 定金真实落账入库：${title} +${amount}两（现银结余 ${world.assets.silver}两）`);
        }
      }
    }

    // 2. 尾款债权字据立项（不受定金是否已入限制）
    const mBal = prev.match(/(?:还欠|尾款|余款)[^0-9一二三四五六七八九十百千]{0,16}([0-9]+(?:\.[0-9]+)?|[一二三四五六七八九十百千]+)\s*两/);
    if (mBal) {
      const balAmt = /^[0-9]/.test(String(mBal[1])) ? Number(mBal[1]) : cnNum(mBal[1]);
      if (balAmt > 0) {
        world.promises = Array.isArray(world.promises) ? world.promises : [];
        const hasBal = world.promises.some((p) => p && !p.done && p.orderBalance === balAmt);
        if (!hasBal) {
          world.promises.push({
            id: `bal_${Date.now()}`,
            text: `${title}余款`,
            orderBalance: balAmt,
            from: 'wang_zongshang',
            due: (Number(world.clock?.day) || 20) + 1,
            at: Number(world.clock?.day) || 20,
            done: false,
          });
          applied.push(`${title}余款字据${balAmt}两`);
          console.log(`[Ledger] 商单尾款字据立项：${title}余款 ${balAmt} 两，约定办妥结清`);
        }
      }
    }

    if (applied.length > 0) saveState(dataDir, world);
    return applied;
  } catch (err) {
    console.warn('[Ledger] 定金与商单尾款落账失败：', err.message);
    return [];
  }
}

/**
 * 记忆压缩归档
 */
export async function compactMemories(batch, { llmClient, dataDir } = {}) {
  try {
    if (!llmClient || !llmClient.isReady()) return 0;
    if (!Array.isArray(batch) || batch.length < 6) return 0;
    const transcript = batch
      .map((m) => `${m.role === 'user' ? '相公' : '她'}：${String(m.text || '').slice(0, 200)}`)
      .join('\n');
    const res = await llmClient.complete({
      system: [
        '你是记忆整理员。从下面这段旧对话里提炼 2~5 条**值得长久记住的事实**。',
        '要记的是：谁做了什么、答应过什么、关系发生了什么变化、有什么只有他们知道的事。',
        '每条一句话，不超过 30 字，用第三人称写。',
        '只输出回执行，不要解释：[[world:remember text="一句话"]]',
      ].join('\n'),
      messages: [{ role: 'user', content: transcript }],
      maxTokens: 320,
      temperature: 0.3,
    });
    const { ops } = parseWorldTags(res.text);
    const remembers = ops.filter((o) => o.kind === 'remember');
    if (remembers.length === 0) return 0;
    const applied = applyWorldTags(dataDir, remembers);
    if (applied.length > 0) console.log(`[Memory] 自动压缩归档 ${applied.length} 条：${applied.join('、')}`);
    return applied.length;
  } catch (err) {
    console.warn('[Memory] 压缩失败：', err.message);
    return 0;
  }
}

/**
 * 专职记账员
 */
export async function extractReceipt({
  userText = '',
  replyText = '',
  memberKey = 'husband',
  roleName = null,
  llmClient,
  dataDir,
  viewerActorId = null,
} = {}) {
  try {
    if (!llmClient || !llmClient.isReady()) return [];
    if (!replyText || replyText.trim().length < 6) return [];
    let roster = '';
    let props = '';
    let w0 = null;
    try { w0 = loadState(dataDir); } catch {} 
    try {
      const w0p = w0 || loadState(dataDir);
      props = (w0p.assets?.properties || [])
        .map((p) => `${p.name}(id=${p.id}, 日入${p.incomePerDay}, ${p.status || ''})`)
        .join(' / ') || '（无）';
    } catch {
      props = '（无）';
    }
    try {
      const w0 = loadState(dataDir);
      roster = Object.values(w0.actors || {})
        .filter((a) => a?.name && a.kind !== 'human')
        .map((a) => `${a.name}(${a.id})`)
        .slice(0, 12)
        .join('、');
    } catch {
      roster = '';
    }
    const curSpeaker = (viewerActorId && w0?.actors?.[viewerActorId]?.name) || (memberKey === 'husband' ? '相公王甯' : '女眷');
    const system = [
      '你是世界账本记账员。判断这一轮有没有改变世界，只输出回执行，不要解释、不要写台词。',
      `在场人物：${roster}`,
      `产业清单：${props}`,
      viewerActorId ? `【重要角色识别】：当前说话者是「${curSpeaker}」（id=${viewerActorId}）。当她说自己怀有身孕时，必须记 [[world:pregnant who=${viewerActorId}]]，绝不许记给在场的其他女眷！` : '',
      '格式：[[world:relation who=waner field=trust delta=+3]] [[world:asset delta=-12.5 reason="x"]] [[world:promise due=世界日+天数 text="x"]] [[world:move who=husband to=地点]] [[world:remember text="一句话"]]',
      '剧情线：[[world:clue text="沈家旧案的一页卷宗"]] [[world:faction id=yamen delta=+5]]',
      '新人物：[[world:spawn name="苏娘" role="绣坊寡妇" goals="养大幼子;寻个依靠" secret="亡夫留了债"]]',
      '有孕：[[world:pregnant who=liuwenxia]]（她自己说/大夫诊出/相公确认才算；谁说自己有孕就记谁，绝不可张冠李戴）',
      '产业：[[world:income id=canal_restaurant set=18 status="已开张"]] —— **凡是"开张/日入多少/生意变好变差"，一律用这个改产业营收，绝不许拿 [[world:asset]] 加一笔银子代替。**',
      '新开店：[[world:property name="城南布庄" set=10 status="已开张"]] —— 相公说要开一间以前没有的铺子时用它。',
      '招兵：[[world:troops field=guards delta=10]]（护院 guards / 乡勇 militia / 兵马 army）',
      '基建：[[world:infra name=granary delta=1]]（roads 路 / granary 粮仓 / dock 码头 / workshop 匠作坊 / school 学堂 / clinic 药堂）',
      '攻城：[[world:siege city="临江府"]] —— 只有相公明确下令攻城时才记；兵不够/没粮时不许记成功。',
      '花销与付款：对话仅为戏内商议，严禁在此输出 spend 直接扣除相公银两（付款全由相公在 App 客户端交互手动确认）。',
      '大单定金与商海进账：掌柜/账房向相公呈递定金收条、客商定金、商海大单银两，相公批复同意（如"好的/可以/收下/成/准了"）时，必须记 [[world:asset delta=+金额 reason="某某定金/货款"]]，让银两真实入公账与流水！',
      '借钱：[[world:loan to=liuwenxia amount=20 due=第40日]] —— 相公答应借钱给别人时用这个，钱会真的转过去；不记就等于空口许诺。',
      '还钱：[[world:repay who=liuwenxia amount=20]] —— 借的人还钱时用它，钱回到出借人手里。',
      '免债：[[world:forgive who=liuwenxia]] —— 相公说"那钱不用还了/算我送她"时用它：钱不收回，凭证作废。',
      '雇人：[[world:hire property="运河码头三层大酒楼" count=3]] —— 说"雇几个伙计/添人手"时用；每人每日工钱 0.12 两。',
      '关系：[[world:bond a=aji b=wangpo type=母子 score=40]] —— 剧情里出现认亲、拜把子、结仇时用；score 正为亲近、负为仇怨。',
      '起名规范（天道必须遵守）：新人物一律「姓+名/称呼」，2–3 字，姓取常见百家姓（陈、王、李、周、柳、秦…），例如「陈郎中」「柳三娘」「周文达」；严禁用句子、动词、疑问词起名（"拾啥""什么""收拾"这类一律不许）。',
      '造人规矩：只有剧情里真的出现了一个人（进门、街上遇见、被人提起且需要登场），才许 spawn；给身份、给去处、给一句眼下在做什么；不许为了凑场面空造。',
      '造物规矩：铺子/宅子/器物也按人间名字起（"回春堂药铺""聚宝赌坊"），不许拿半句话当招牌。',
      '挑唆：[[world:bond a="张三" b="李四" type=嫌隙 score=-15]] —— 相公搬弄是非、说谁坏话、告状时，把被他挑唆的两个人之间的关系往下压；每挑一次 -10 ~ -20。',
      '外交：[[world:diplomacy to=beidi action=pay]] —— 对邻国纳贡/通商/拒使/和亲时用；action 取 pay|trade|refuse|marry。',
      '结盟：[[world:ally a=husband b=liuwenxia]] —— 两人合兵，攻城时盟友各出一半兵力。',
      '**杀天子不准直接写 [[world:kill who=emperor]] 就算完**——先写它，会得到"天道示警"；相公若仍执意，才用 [[world:regicide]]。',
      '没变化只输出 [[world:none]]。人物跨建筑换地方记 move（相公也记，who=husband；绝对严禁把门口、门外、院中、屋里等微动作记为 move！）；值得记一辈子的事记 remember。',
      '**本轮回复里只要出现账本没有的人名（哪怕是别人嘴里提到的），就要输出 spawn 回执**，格式：',
      '  [[world:spawn name="柳三娘" role="挑担卖花的" place="street"]]',
      '  role 从他做的事推断，place 用对话里说的地点（street/tea_house/dock/wine_shop 等）。不输出就等于这个人不存在。',
      '**相公赔罪、哄人、说软话，且对方语气缓和** → 必须记 [[world:relation who=她的id field=grievance delta=-6]]；若对方反而更硬，就记 delta=+3。',
      '**女子得相公撑腰、维护出头、体贴关怀、承诺相助** → 信任与心动欲望并进：记 [[world:relation who=她的id field=trust delta=+3]] [[world:relation who=她的id field=desire delta=+2]]（情意笃深，心有所属）；绝不可只涨信任不涨欲望！',
      '**动情/暧昧/答应私会/被撩到心软** → 必须记 [[world:relation who=她的id field=desire delta=+4]]（明显亲密可 +8）；被冷落或受惊则记 delta=-3。',
    ].join('\n');

    const speakerLabel = viewerActorId ? `${curSpeaker}说` : '相公说';
    const replyLabel = viewerActorId ? '对方回' : '她回';
    const res = await llmClient.complete({
      system,
      messages: [{ role: 'user', content: `${speakerLabel}：${userText}\n${replyLabel}：${replyText}` }],
      maxTokens: 150,
      temperature: 0.2,
    });
    const { ops } = parseWorldTags(res.text);
    return ops.filter((o) => o.kind !== 'none');
  } catch (err) {
    console.warn('[World] 记账员失败：', err.message);
    return [];
  }
}
