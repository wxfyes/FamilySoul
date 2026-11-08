/**
 * 剧本场景触发器：
 * 包含夫妻私密、支走旁人、运河大酒楼510两既定大事记、沈家大案身世、查账、早安晨起等剧情提示词。
 * 从 pet-service.js 剥离，职责纯化。
 */

import { loadState } from '../world/state.js';
import { evaluateBedIntent } from '../world/bedchamber.js';

export function matchScenarioTrigger({
  say = '',
  lastAssistantMsg = '',
  history = {},
  profileKey = 'husband',
  activeRole = '傲娇助手',
  dataDir,
  viewerActorId = 'husband',
} = {}) {
  let contextHint = '';
  let currentEpoch = history.epoch || 'ancient';
  let epochNotice = '';
  let haremNotice = '';

  const isQuestioningWife = /昨晚.*(为何|怎么|去哪|溜|跑|丢下).*我|叫你.*(没动静|不应)|下厨房.*(作甚|干什么|别去)/i.test(say);
  const isSendingAwayOther = /(?:先)?(?:去|到|帮我)?(?:外头|隔壁|厨房|院子|铺子)?(?:泡|沏|备|弄)(?:壶|盏|碗|杯)?(?:茶|水|点心)|(?:先)?(?:退下|出去|回避|忙你的)/i.test(say) &&
    /芸娘|小翠|二房|丫鬟/i.test(say);
  const isPrivateWhisperWithWife = /就我们俩|支走|单独|悄悄|私下|背后|放心吗|信得过|为人|管事|打理|怎么样|交由她/i.test(say) &&
    /芸娘|二房|林氏|外人/i.test(say);
  const isWifeReturning = /大娘子|婉儿|正妻|夫人|姐姐/i.test(say) &&
    /回来|叫你|出来|在何处|在哪|人呢/i.test(say);

  const isPendingYunGreeting = /芸娘.*(磕头|奉茶|敬茶|快些|慢着|杵在|进来|见过相公|说句话|没缓过神|快给相公|还不快)/i.test(lastAssistantMsg);

  // 精确判定动身指令
  const isImmediateActionDeparture = !isPrivateWhisperWithWife && !isSendingAwayOther && !isQuestioningWife &&
    !/你觉得|你说说|你放心吗|值得信任|怎么样|如何|怎么看|好不好|行不行|能不能/i.test(say) && (
      /^(?:行|好|成|嗯|妥|走|那|好嘞|走吧)[，,、\s]*(?:我去速战速决|咱们速战速决|速战速决|那我去了|我去了|那我走了|我走了|咱们走|我们走|走吧|出发|动身|这就去|现在就去|我去会会|咱们去|我们去|去看看|去瞧瞧)/i.test(say.trim()) ||
      /(?:我现在去|我这就去|咱们这就去|我们现在去|我去速战速决|那我去了|那我走了|走，咱们去|走，我们去|走，去|随我去|陪我去|立刻动身|马上出发|现在出发|这就动身|这就启程|去会会他们|去会会他)/i.test(say) ||
      /^(?:去分号|去码头|去前堂|去县衙|去杨府|去茶园|去酒楼|出门|出府|出发|动身|走吧|咱们走)[！!。.\s]*$/i.test(say.trim())
    );

  // 运河码头临街三层大酒楼（已全款买下，契纸办妥）
  const isRestaurantMilestoneIntent = !isImmediateActionDeparture &&
    /酒楼|运河码头|临街铺子|码头那边|码头的铺子|大酒楼|510两|五百一十两|盘下.*酒楼|磨价/i.test(say);

  if (isQuestioningWife) {
    currentEpoch = 'ancient';
    contextHint = `（【正妻沈婉儿亲口娇羞谢罪与真情流露】：\n相公此刻正当面心疼质问婉儿为何昨夜溜走、为何下厨房（相公说：“${say}”）！\n【最高发声铁律·严禁丫鬟小翠与芸娘抢戏包办】：\n正妻沈婉儿必须第一个亲自站出来开口！低头含羞、眼眶泛红向夫君解释昨夜的害羞与体贴，当面温存认错并答应今后凡事听相公的！\n让当事人沈婉儿亲自回应相公的质问，给足深情与夫妻体己温存！）`;
  } else if (isSendingAwayOther) {
    currentEpoch = 'ancient';
    contextHint = `（【支走旁人·留出夫妻私密交谈空间】：\n相公此刻下令支走房内旁人去外头办事泡茶（相公口谕：“${say}”）！\n【物理空间与在场铁律】：\n1. 被点名支走的角色（如【侧妾·芸娘】或【丫鬟·小翠】）只能简短乖巧应一声“是，相公，妾身/奴婢这就去外头备茶”，随即掀帘退下离开房间！\n2. 随后【正妻·婉儿】留在相公身边，轻声示意旁人已走远，温言询问相公特意支开旁人可是有什么体己话要与妾身商议。\n3. 严禁切换场景，严禁无关外人出场！）`;
  } else if (isPrivateWhisperWithWife) {
    currentEpoch = 'ancient';
    contextHint = `（【夫妻私密交谈 · 背后评议与家政托付（最高物理空间隔离铁律）】：\n相公此刻正单独与正妻沈婉儿说私房悄悄话、背后询问打探对旁人的真实看法与托付产业的放心程度（相公说：“${say}”）！\n【天道最高物理法则 · 严禁穿帮违背】：\n1. **被议论者与无关第三人绝对禁止出场插话**：相公明确说了“就我们俩”或“把她支走了”，被相公提及或议论的任何人此刻根本不在房内，【绝对严禁输出任何被议论者的台词】！严禁凭空冒出来接话！\n2. **正妻绝对禁止回避**：相公正在问婉儿的体己话，婉儿【绝对严禁说“妾身先回避了/你们聊”】！\n3. **严禁擅自转场或冒出外人**：哪怕相公话里提到“酒楼/茶店/铺子”，这也是夫妻俩在房内商议家事，严禁擅自转场，严禁冒出任何外人！\n4. **100% 仅由【正妻·婉儿】一人回话**：你必须且只能以【正妻·婉儿】一人之口，紧扣相公所问（为人是否可靠、交给她打理是否放心、如何循序渐进带她管事），推心置腹、有理有据地向相公分析并给出当家主母的沉稳建议！）`;
  } else if (isWifeReturning) {
    currentEpoch = 'ancient';
    contextHint = `（【剧情重磅推进·大娘子沈婉儿应声归来】：\n相公此刻明确呼唤大娘子沈婉儿（相公口谕：“${say}”）！\n大娘子沈婉儿闻声立刻自书斋或正轩掀帘而入、笑盈盈归场！【绝对严禁】芸娘再找借口推脱说姐姐在厨房！\n正妻婉儿正式现身归场，端庄温存，主动倾听相公心意与大计，顺着相公的话往下走！）`;
  } else if (isPendingYunGreeting || /芸娘怎么不说话|芸娘说话|叫芸娘说话|让芸娘说话|芸娘快磕头|芸娘快敬茶/i.test(say)) {
    contextHint = `（【剧情关键推进点·芸娘必须立刻亲自出声接话】：\n相公此刻正看着芸娘催促她开口（“${say}”）！\n【绝对严禁】正妻婉儿继续一人包办代言！必须让【侧妾·芸娘】立刻亲自上前开口向相公回话请安！）`;
  } else if (/沈家|沈家身世|身世.*沈家|沈家到底|沈家遭|害我沈家|沈家获罪|沈家冤案|沈侍郎|亏空库银|名门大家闺秀.*沈家|替你做主.*沈家|委屈全说出来|当年沈家/i.test(say)) {
    currentEpoch = 'ancient';
    contextHint = `（【天道重磅大案·沈家身世主线彻底揭晓】：\n相公此刻正当面询问沈家当年冤案真相（相公口谕：“${say}”）！\n【人设谱系绝对不可错位铁律】：\n1. 姓沈的名门千金只有【正妻·沈婉儿】一人！沈家满门被抄、沈侍郎含冤下狱的血海深仇，100% 必须且只能由【正妻·沈婉儿】亲口垂泪诉说！\n2. 【侧妾·林芸娘】姓林，是紫阳山茶农林老汉之女，与京城沈家毫无血缘关系！【绝对严禁芸娘自称“害我沈家”或冒认沈家女儿】！）`;
  } else if (/杨采云|采云|翟长盛|刘文霞|文霞|于杰|战静|随科|随典史|苏慕雪|静儿|紫嫣/i.test(say)) {
    currentEpoch = 'ancient';
    contextHint = `（【宿命乾坤 · 人妻名媛与有夫之妇攻略博弈法则】：\n相公此刻正与有夫之妇/城中名媛交涉（相公说：“${say}”）！\n【核心攻略铁律 · 杜绝开局白给，保留真实攻略乐趣】：\n1. **名节与防线（攻略前）**：她们皆是有夫之妇或望族名媛，恪守妇德礼节，深知男女之防！言谈以客套、生疏、公事公办为主，称呼相公为「王掌柜」或「王少东」，绝不会平白无故投怀送抱、依偎撒娇或死心塌地！\n2. **攻略过程**：相公必须展现眼界、智谋、担当，或替她们化解原夫带来的困境与羞辱，她们内心的坚冰才会随着好感度提升一层层融化；\n3. **分层台词**：初见生疏自持；略有好感时欲迎还拒、微露羞怯与委屈；唯有当好感度极高且经历关键事件彻底沦陷后，才会私相授受、成为相公生死相随的红粉知己！）`;
  } else if (isRestaurantMilestoneIntent) {
    currentEpoch = 'ancient';
    contextHint = `（【天道最高历史事实铁律 · 运河大酒楼已全资买下（绝对严禁失忆）】：\n相公此刻正与大娘子沈婉儿商议运河码头大酒楼的关键大计（相公说：“${say}”）！\n【最高既定历史事实锁定 · 绝对严禁失忆翻旧账】：\n1. **已全资买下归属王家**：运河码头临街三层大酒楼，相公此前已斥巨资五百一十两白银（510两）全款拿下，房契、地契、官府红押全数办妥立案，契书全在正房大娘子沈婉儿妆匣妥善锁存！\n2. **绝对严禁失忆妄言**：【绝对严禁】沈婉儿或任何角色说“还没买/看中了那间铺子/铺主开价狠/妾身明日便去跟他磨价”！大酒楼早就是王家私产，沈婉儿是亲自主理筹备开张的主母！\n3. **对话推进方向**：沈婉儿必须深明大义、满怀敬佩赞同夫君的远见卓识，紧扣“码头是两淮咽喉要道、天下情报第一站”，从酒楼开业筹备、挑选精明掌柜与大厨伙计、以及如何打探两淮各路过往客商机密展开，给足当家主母的得力与温存！）`;
  } else if (isImmediateActionDeparture) {
    currentEpoch = 'ancient';
    delete history.inPrivateWorld;
    contextHint = (() => {
      const wT = loadState(dataDir);
      const meT = viewerActorId ? wT.actors?.[viewerActorId] : wT.actors?.husband;
      const placeT = String(wT.places?.[meT?.location]?.name || '');
      const hereT = Object.values(wT.actors || {})
        .filter((a) => a && !a.dead && a.name && a.location === meT?.location && a.id !== (meT?.id || 'husband'))
        .slice(0, 4).map((a) => a.name);
      return `（【现状】相公此刻在「${placeT}」。${hereT.length ? '此处：' + hereT.join('、') + '。' : '此处无人。'}）\n`;
    })();
  } else if (/报家底|咱家有多少钱|有多少银子|还有多少钱|家当几何|资产几何|盘点家底/i.test(say)) {
    currentEpoch = 'ancient';
    contextHint = `（【查账】：相公要看家底。所有数目一律以【天机】里「家底」那一行为准——现银多少、日入多少、产业什么状况，必须与账本完全一致。【绝对严禁】凭记忆编造金额，绝不许说出与账本不符的数字。报完账可顺带提一句眼下的难处或打算。）`;
  } else if (/早安|早上好|早|起床|醒了|起了|新的一天|天亮了/i.test(say)) {
    currentEpoch = 'ancient';
    contextHint = (() => {
      const wM2 = loadState(dataDir);
      const rumor = (wM2.rumors || []).slice(-1)[0];
      const rumorText = rumor?.text ? String(rumor.text).slice(0, 40) : '';
      return `（【现状】第${wM2.clock?.day}日 ${wM2.clock?.hour}时。${rumorText ? '城里在传：' + rumorText + '。' : ''}该起身了。）\n`;
    })();
  } else if (!contextHint) {
    // 动态场景兜底：相公亲临运河大酒楼现场处理商海大单
    try {
      const wLive = loadState(dataDir);
      const husLoc = wLive.actors?.husband?.location;
      const isAtRestaurant = husLoc && (husLoc === 'canal_restaurant' || husLoc === 'place_44' || husLoc.startsWith('place_44__') || String(wLive.places?.[husLoc]?.name || '').includes('酒楼'));
      if (isAtRestaurant) {
        currentEpoch = 'ancient';
        contextHint = `（【天道商海·东家王甯亲临运河大酒楼现场】：\n相公是运河码头三层大酒楼的全资大老板/大东家，此刻亲临酒楼！（相公指示：“${say}”）！\n【现场主从尊卑与商海闭环铁律】：\n1. 【大厨·何顺】、【账房·周有财】与【掌柜·钱有福】在场主答！针对扬州盐帮汪总商送来五十两定金包下【三层天字阁】办寿宴一事，账房周有财核验清点五十两纹银定金入柜立账，大厨何顺大喜、躬身呈请八冷八热两淮硬席与金桂酿配酒菜单，掌柜钱有福妥善统筹打点天字阁陈设！\n2. 【伙计·陈二】只在后头垂手端茶听差，绝不抢白！所有人必须围绕汪总商天字阁寿宴与酒楼大单展开，绝对严禁失忆扯东扯西！）`;
      }
    } catch (_) {}
  }

  return {
    contextHint,
    currentEpoch,
    isQuestioningWife,
    isSendingAwayOther,
    isPrivateWhisperWithWife,
    isWifeReturning,
    isRestaurantMilestoneIntent,
    isImmediateActionDeparture,
  };
}
